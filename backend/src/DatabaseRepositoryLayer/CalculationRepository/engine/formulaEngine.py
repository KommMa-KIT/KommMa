"""
FormulaEngine
=============
Compiles Excel workbooks into persistent in-memory formula DAGs and exposes
a thread-safe ``evaluate()`` method for request-time computation.

Business Purpose
----------------
Climate-protection measures are modelled as Excel formulas.  This engine
replaces the previous xlwings/COM-based approach with the pure-Python
``formulas`` library, removing the Windows dependency and enabling
Linux / container deployments.

Pipeline (startup -- ``build_all``)
    1. Pre-process each ``.xlsx`` through ``StructuredRefResolver`` to
       rewrite Excel Table references the ``formulas`` parser cannot handle.
    2. Compile a persistent ``ExcelModel`` (directed acyclic graph of cell
       formulas) for each file.

Pipeline (request -- ``evaluate``)
    3. Inject municipal input values into the model.
    4. Evaluate the DAG (pure arithmetic, no I/O).
    5. Collect and return the result cells.

Scalability
-----------
All models are built once and reused, so evaluation is pure in-memory
arithmetic.  If the number of measures grows, models can be pre-compiled
to a binary cache (pickle / shelve) to speed up startup.

Thread Safety
-------------
Each ``evaluate()`` call works on an independent copy of the model inputs;
concurrent requests for the **same** file are safe.  The internal model
registry (``_models``) is guarded by a ``threading.Lock``.
"""

from __future__ import annotations

import logging
import shutil
import threading
from pathlib import Path
from typing import Any, Dict, Optional
try:
    import numpy as np
except ImportError:
    np = None

import formulas

from ..preprocessing.structuredRefResolver import resolve_structured_references

logger = logging.getLogger(__name__)


class FormulaEngine:
    """
    Registry of compiled ``formulas.ExcelModel`` instances.

    One model is built per ``.xlsx`` file at startup and reused for every
    request.  The engine owns the model lifecycle (build, look-up, evaluate)
    and hides all ``formulas``-library details from the rest of the
    repository layer.

    Thread Safety
        The model dict is protected by a ``threading.Lock``.  Evaluation
        itself is stateless (the ``formulas`` library creates a fresh
        output dict per call) and safe for concurrent use.
    """

    def __init__(self, excel_directory: Path) -> None:
        """
        Create an empty engine bound to *excel_directory*.

        Call ``build_all()`` after construction to compile the models.

        @param excel_directory: Folder containing the ``.xlsx`` measure files.
        """
        self.excel_directory = excel_directory

        # { filename_stem → formulas.ExcelModel }
        self._models: Dict[str, Any] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def build_all(self) -> None:
        """
        Pre-process and compile every ``.xlsx`` in the configured directory.

        Intended to be called **once** at server startup.  Files that fail
        to compile are logged but do not prevent the remaining files from
        being built; they will raise ``RuntimeError`` at evaluation time.

        @throws ValueError: If the directory contains no ``.xlsx`` files.
        """
        xlsx_files = [
            f for f in self.excel_directory.glob("*.xlsx")
            if not f.name.startswith("~$")
        ]

        if not xlsx_files:
            raise ValueError(f"No Excel files found in {self.excel_directory}")

        logger.info(f"FormulaEngine: building models for {len(xlsx_files)} files …")

        for xlsx_path in xlsx_files:
            self._build_model(xlsx_path)

        logger.info(f"FormulaEngine: all {len(self._models)} models ready")

    def evaluate(
        self,
        xlsx_filename: str,
        data_city_mapping: Dict[str, str],
        filtered_inputs: Dict[str, Any],
        result_mapping: Dict[str, Any],
        data_sheet_index: int = 2,
        result_sheet_index: int = 6,
    ) -> Dict[str, Any]:
        """
        Inject inputs into the compiled DAG and return the result-cell values.

        This method is designed to run inside a worker thread (it performs no
        async I/O) and is safe for concurrent calls -- even for the same file.

        @param xlsx_filename:     Bare filename, e.g. ``"ID20106.xlsx"``.
        @param data_city_mapping: ``{param_name: cell_ref}`` from metadata.
        @param filtered_inputs:   ``{param_name: value}`` -- only the
                                  parameters this measure needs.
        @param result_mapping:    ``{result_name: {"werte": cell, "kategorie": cell}}``.
        @param data_sheet_index:  Zero-based index of the data sheet.
        @param result_sheet_index: Zero-based index of the result sheet.

        @return: ``{result_name: {"werte": value, "scale": value}, ...}``

        @throws RuntimeError: If no compiled model exists for *xlsx_filename*
                              or if the ``formulas`` evaluation fails.
        """
        model = self._get_model(xlsx_filename)
        if model is None:
            raise RuntimeError(f"No compiled model for '{xlsx_filename}'")

        wb = _open_workbook(self.excel_directory / xlsx_filename)
        data_sheet_name   = wb.worksheets[data_sheet_index].title
        result_sheet_name = wb.worksheets[result_sheet_index].title

        # ── Inject inputs ──────────────────────────────────────────────
        inputs: Dict[str, Any] = {}
        for param_name, cell_ref in data_city_mapping.items():
            if param_name in filtered_inputs:
                key = _model_key(xlsx_filename, data_sheet_name, cell_ref)
                inputs[key] = filtered_inputs[param_name]

        # ── Evaluate (formulas creates a new output dict; thread-safe) ─
        try:
            outputs = model.calculate(inputs, [])
        except Exception as exc:
            raise RuntimeError(f"formulas evaluation failed: {exc}") from exc

        # ── Collect results ────────────────────────────────────────────
        results: Dict[str, Any] = {}
        for result_name, cell_info in result_mapping.items():
            if isinstance(cell_info, dict):
                werte_key    = _model_key(xlsx_filename, result_sheet_name, cell_info["werte"])
                kategorie_key = _model_key(xlsx_filename, result_sheet_name, cell_info["kategorie"])
                results[result_name] = {
                    "werte": _get_output(outputs, werte_key),
                    "scale": _get_output(outputs, kategorie_key),
                }
            else:
                key = _model_key(xlsx_filename, result_sheet_name, cell_info)
                results[result_name] = _get_output(outputs, key)

        return results

    def has_model(self, xlsx_filename: str) -> bool:
        """
        Check whether a compiled model exists for the given file.

        @param xlsx_filename: Bare filename, e.g. ``"ID20106.xlsx"``.

        @return: ``True`` if the model is available.
        """
        return xlsx_filename in self._models

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_model(self, xlsx_path: Path) -> None:
        """
        Pre-process one file (resolve structured refs) and compile its DAG.

        If the structured-reference resolver creates a temporary copy, that
        copy is deleted in the ``finally`` block regardless of success.
        Compilation errors are logged but **not** re-raised so that the
        remaining files can still be built.

        @param xlsx_path: Full path to the original ``.xlsx`` file.
        """
        clean_path = xlsx_path   # may be replaced by resolved copy
        tmp_dir = None

        try:
            # Step 1 — resolve structured references
            resolved = resolve_structured_references(xlsx_path)
            if resolved != xlsx_path:
                clean_path = resolved
                tmp_dir = resolved.parent

            # Step 2 — compile with formulas
            logger.info("Compiling workbook model")
            xl_model = formulas.ExcelModel().loads(str(clean_path)).finish()

            with self._lock:
                self._models[xlsx_path.name] = xl_model

            logger.info("Workbook model compiled successfully")

        except Exception as exc:
            logger.error("Failed to compile workbook model")
            # Don't raise — let other files continue; this file will error at runtime

        finally:
            if tmp_dir is not None:
                shutil.rmtree(tmp_dir, ignore_errors=True)

    def _get_model(self, xlsx_filename: str) -> Optional[Any]:
        """
        Thread-safe look-up of a compiled model by filename.

        @param xlsx_filename: Bare filename.

        @return: The ``formulas.ExcelModel`` or ``None``.
        """
        with self._lock:
            return self._models.get(xlsx_filename)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _model_key(xlsx_filename: str, sheet_name: str, cell_ref: str) -> str:
    """
    Build the dictionary key the ``formulas`` library uses to address a cell.

    Format: ``'[filename.xlsx]SHEET NAME'!F6``
        - Filename is wrapped in square brackets.
        - Sheet name is **upper-cased** (``formulas`` convention).
        - Cell reference has no dollar signs, letters upper-cased.

    @param xlsx_filename: Bare workbook filename.
    @param sheet_name:    Worksheet title (original case).
    @param cell_ref:      Excel cell reference (any case, ``$`` optional).

    @return: Normalised key string.
    """
    cell_upper = _bare_ref(cell_ref)
    sheet_upper = sheet_name.upper()
    return f"'[{xlsx_filename}]{sheet_upper}'!{cell_upper}"


def _bare_ref(cell_ref: str) -> str:
    """
    Normalise a cell reference: strip ``$`` signs and upper-case letters.

    Examples: ``"e6"`` -> ``"E6"``, ``"$E$6"`` -> ``"E6"``.

    @param cell_ref: Raw cell reference string.

    @return: Canonical upper-case reference without dollar signs.
    """
    ref = cell_ref.upper().replace("$", "")
    col = "".join(c for c in ref if c.isalpha())
    row = "".join(c for c in ref if c.isdigit())
    return f"{col}{row}"


def _get_output(outputs: dict, key: str) -> Any:
    """
    Safely extract a scalar Python value from the ``formulas`` output dict.

    The ``formulas`` library may return a ``Ranges`` object, a bare
    ``numpy.ndarray``, a plain scalar, or ``None``. This helper unwraps
    all variants into a native Python type suitable for JSON serialisation.

    @param outputs: The dict returned by ``ExcelModel.calculate()``.
    @param key:     Cell key (see ``_model_key``).

    @return: Native Python scalar, or ``None`` if the key is absent.
    """
    val = outputs.get(key)
    if val is None:
        return None

    # Helper: unwrap numpy arrays to first element (or list for bare arrays)
    def _unwrap_ndarray(arr, *, list_if_many: bool):
        flat = arr.ravel()
        if flat.size == 0:
            return None

        item = flat[0]

        # Convert numpy scalar types -> Python native types
        if isinstance(item, (np.integer, np.floating)):
            item = item.item()
        elif isinstance(item, np.str_):
            item = str(item)

        if not list_if_many:
            return item
        return item if flat.size == 1 else flat.tolist()

    # Handle formulas Ranges objects — extract the underlying value
    # Ranges has a .value attribute that returns the numpy array (if numpy is available)
    if hasattr(val, "value"):
        try:
            inner = val.value
        except Exception:
            return val

        if inner is None:
            return None

        # If numpy is available, handle ndarrays specially; otherwise just return inner
        if "np" in globals() and np is not None and isinstance(inner, np.ndarray):
            return _unwrap_ndarray(inner, list_if_many=False)

        return inner

    # Handle bare numpy arrays
    if "np" in globals() and np is not None and isinstance(val, np.ndarray):
        return _unwrap_ndarray(val, list_if_many=True)

    return val

def _open_workbook(path: Path):
    """
    Open a workbook in read-only / data-only mode to inspect sheet names.

    Uses ``openpyxl`` rather than ``formulas`` because only the worksheet
    titles are needed, not the formula graph.

    @param path: Full path to the ``.xlsx`` file.

    @return: An ``openpyxl.Workbook`` instance (read-only).
    """
    import openpyxl
    return openpyxl.load_workbook(path, data_only=True, read_only=True)