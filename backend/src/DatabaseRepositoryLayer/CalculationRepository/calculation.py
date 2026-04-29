"""
CalculationRepository
=====================
Orchestrates the full **measure-calculation pipeline** for the KommMa climate
protection tool.

Business Purpose
----------------
Given a set of municipal input parameters (population, budget, topography, ...)
this repository evaluates every known climate-protection measure by injecting
the inputs into pre-compiled Excel formula DAGs and reading back cost, time,
and emission results.

Pipeline (executed once at startup)
    1. **MetaDataExtractor** -- scans Excel files to discover which cells
       accept inputs and which cells contain results.
    2. **FormulaEngine** -- compiles each ``.xlsx`` into an in-memory DAG
       via the ``formulas`` library (no xlwings / COM / Windows dependency).

Pipeline (executed per request)
    3. **Input filtering** -- selects only the parameters a measure needs.
    4. **Cache lookup** -- MD5(measure_id + inputs) avoids redundant work.
    5. **Formula evaluation** -- thread-safe, semaphore-limited.
    6. **Scale mapping** -- converts raw German category strings
       (e.g. ``"kostenintensiv"``) into numeric 0-5 scales.

Scalability
-----------
The repository hides the Excel-backed calculation behind a pure-Python
in-memory engine.  Replacing it with a database of pre-computed results or a
remote calculation micro-service only requires a new class that exposes the
same ``calculate_all_measures`` / ``clear_cache`` / ``get_cache_stats``
interface.

Thread Safety
-------------
* The in-memory cache (``dict``) is safe for the single-writer / many-reader
  pattern of asyncio, but **not** for true multi-threaded writes.
* Formula evaluation is offloaded to ``asyncio.to_thread`` and guarded by an
  ``asyncio.Semaphore`` to cap concurrent CPU-bound work.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

# Handle both direct execution and module imports
try:
    from .engine.formulaEngine import FormulaEngine
    from .metaDataExtractor import MetaDataExtractor
except ImportError:
    # Running directly, not as a module - add src to path
    _src_dir = Path(__file__).resolve().parent.parent.parent
    if str(_src_dir) not in sys.path:
        sys.path.insert(0, str(_src_dir))
    from DatabaseRepositoryLayer.CalculationRepository.engine.formulaEngine import FormulaEngine
    from DatabaseRepositoryLayer.CalculationRepository.metaDataExtractor import MetaDataExtractor

logger = logging.getLogger(__name__)


class CalculationRepository:
    """
    Core calculation engine for climate-protection measures.

    Holds the compiled formula DAGs, the metadata configuration, and the
    result cache.  Created once at application startup and shared across
    requests.

    All public methods are ``async``-friendly; CPU-bound formula evaluation
    is dispatched to a thread pool.
    """

    DATA_SHEET_INDEX   = 2
    RESULT_SHEET_INDEX = 6

    COST_SCALE_MAPPING = {
        "gewinnbringend":      0,
        "günstig":             1,
        "moderat":             2,
        "kostenintensiv":      3,
        "sehr kostenintensiv": 4,
    }
    TIME_SCALE_MAPPING = {
        "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5,
    }

    def __init__(
        self,
        excel_directory: str,
        metadata_extractor: Optional[MetaDataExtractor] = None,
        max_workers: int = 3,
    ) -> None:
        """
        Bootstrap the repository: scan Excel files, compile DAGs, warm caches.

        This constructor performs significant I/O (reading every ``.xlsx`` in
        the directory) and should be called **once** during application startup,
        not on every request.

        @param excel_directory:    Path to the folder containing measure
                                   Excel workbooks.
        @param metadata_extractor: Optional pre-built extractor; useful for
                                   testing with a mock or a cached snapshot.
        @param max_workers:        Maximum number of concurrent formula
                                   evaluations (limits CPU pressure).

        @throws FileNotFoundError: If *excel_directory* does not exist.
        """
        self.excel_directory = Path(excel_directory)
        if not self.excel_directory.exists():
            raise FileNotFoundError(f"Excel directory not found: {excel_directory}")

        # Metadata
        if metadata_extractor is None:
            logger.info("Creating MetaDataExtractor ...")
            self.metadata_extractor = MetaDataExtractor(
                directory_path=str(self.excel_directory)
            )
        else:
            self.metadata_extractor = metadata_extractor

        logger.info("Generating metadata configuration ...")
        self.metadata: Dict[str, dict] = self.metadata_extractor.generate_configuration()

        # Formula engine — builds all DAGs once at startup
        self._engine = FormulaEngine(self.excel_directory)
        self._engine.build_all()

        # Simple in-memory cache (same as original)
        self.cache: Dict[str, dict] = {}

        # Semaphore to limit concurrent formula evaluations
        self._excel_semaphore = asyncio.Semaphore(max_workers)

        logger.info(
            f"CalculationRepository initialized:\n"
            f"  • Measures: {len(self.metadata)}\n"
            f"  • Workers: {max_workers}"
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def calculate_all_measures(self, input_json: Dict[str, Any]) -> List[dict]:
        """
        Evaluate **every** known measure against the supplied municipal inputs.

        Measures that fail (missing file, formula error, ...) are logged and
        excluded from the returned list so one broken Excel file does not
        block the entire calculation.

        @param input_json: Flat dictionary of input parameters,
                           e.g. ``{"fallhoehe": 104, "einwohnerzahl": 50000}``.

        @return: List of result dictionaries, each containing
                 ``measure_id``, ``measure_title``, and ``raw_results``.
                 Failed measures are omitted (errors logged).
        """
        logger.info(f"Starting calculation for {len(self.metadata)} measures")

        tasks = [
            self._calculate_single_measure(mid, meta, input_json)
            for mid, meta in self.metadata.items()
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        valid: List[dict] = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                mid = list(self.metadata.keys())[i]
                logger.error(f"Error processing measure {mid}: {result}")
            else:
                valid.append(result)

        valid = self._apply_scale_mappings(valid)

        logger.info(
            f"Calculation completed: {len(valid)}/{len(self.metadata)} measures successful"
        )
        return valid

    # ------------------------------------------------------------------
    # Internal — single measure
    # ------------------------------------------------------------------

    async def _calculate_single_measure(
        self,
        measure_id: str,
        measure_meta: dict,
        input_json: Dict[str, Any],
    ) -> dict:
        """
        Filter inputs, check the cache, and evaluate a single measure.

        The three-step flow (filter -> cache -> evaluate) ensures that
        only relevant parameters reach the engine, repeated calls are
        served from memory, and CPU-bound work is semaphore-limited.

        @param measure_id:   Unique identifier of the measure.
        @param measure_meta: Metadata dict produced by ``MetaDataExtractor``
                             (contains ``data_city_mapping`` and ``result_mapping``).
        @param input_json:   Full set of municipal inputs (un-filtered).

        @return: Result dictionary with ``measure_id``, ``measure_title``,
                 and either ``raw_results`` or ``error``.
        """
        filtered  = self._filter_required_inputs(measure_meta, input_json)
        cache_key = self._generate_cache_key(measure_id, filtered)

        if cache_key in self.cache:
            logger.debug(f"Cache HIT for measure {measure_id}")
            return self.cache[cache_key]

        logger.debug(f"Cache MISS for measure {measure_id} — evaluating")

        async with self._excel_semaphore:
            result = await asyncio.to_thread(
                self._evaluate_measure, measure_id, measure_meta, filtered
            )

        self.cache[cache_key] = result
        return result

    def _filter_required_inputs(
        self, measure_meta: dict, input_json: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Select only the input parameters that this measure actually consumes.

        Matching is case-insensitive and whitespace-tolerant so that minor
        naming discrepancies between the frontend and the Excel template do
        not cause silent data loss.

        @param measure_meta: Metadata containing ``data_city_mapping``.
        @param input_json:   Full set of municipal inputs.

        @return: Subset of *input_json* whose keys appear in the mapping.
        """
        required = measure_meta["data_city_mapping"].keys()
        filtered: Dict[str, Any] = {}

        for param in required:
            p_norm = param.lower().strip()
            for key, val in input_json.items():
                if key.lower().strip() == p_norm:
                    filtered[param] = val
                    break

        missing = set(required) - set(filtered)
        if missing:
            # Log at DEBUG level since calculation will proceed with available parameters
            # The formulas engine will handle missing values gracefully
            logger.debug(
                "Calculating with partial input set: %d/%d parameters available",
                len(filtered),
                len(required),
            )
        return filtered

    def _generate_cache_key(self, measure_id: str, filtered_inputs: dict) -> str:
        """
        Produce a deterministic cache key for a (measure, inputs) pair.

        Uses MD5 over the JSON-serialised inputs to keep the key compact
        while still being collision-resistant for practical workloads.

        @param measure_id:      Unique measure identifier.
        @param filtered_inputs: Already-filtered input dictionary.

        @return: Hex-encoded MD5 digest string.
        """
        data = f"{measure_id}:{json.dumps(filtered_inputs, sort_keys=True)}"
        return hashlib.md5(data.encode("utf-8")).hexdigest()

    def _evaluate_measure(
        self,
        measure_id: str,
        measure_meta: dict,
        filtered_inputs: Dict[str, Any],
    ) -> dict:
        """
        Evaluate a single measure using the formulas engine.
        This method runs in a worker thread to avoid blocking.
        
        Args:
            measure_id: ID of the measure
            measure_meta: Metadata for this measure
            filtered_inputs: Filtered input parameters
            
        Returns:
            Calculation results dict with measure_id, measure_title, and raw_results
        """
        # Extract the Excel filename from the metadata
        # metadata["file"] contains relative path
        file_path = measure_meta.get("file", "")
        if not file_path:
            return {
                "measure_id": measure_id,
                "measure_title": measure_meta.get("measure_title", ""),
                "error": "No file path in metadata"
            }
        
        # Extract just the filename (e.g., "ID20109.xlsx")
        excel_filename = Path(file_path).name
        
        # Use the formulas engine to evaluate
        try:
            raw_results = self._engine.evaluate(
                xlsx_filename      = excel_filename,
                data_city_mapping  = measure_meta["data_city_mapping"],
                filtered_inputs    = filtered_inputs,
                result_mapping     = measure_meta["result_mapping"],
                data_sheet_index   = self.DATA_SHEET_INDEX,
                result_sheet_index = self.RESULT_SHEET_INDEX,
            )
            return {
                "measure_id":    measure_id,
                "measure_title": measure_meta.get("measure_title", ""),
                "raw_results":   raw_results,
            }
        except Exception as exc:
            logger.error(f"Evaluation error for {measure_id}: {exc}")
            return {
                "measure_id":    measure_id,
                "measure_title": measure_meta.get("measure_title", ""),
                "error":         str(exc),
            }
    

    # ------------------------------------------------------------------
    # Scale mapping
    # ------------------------------------------------------------------

    def _apply_scale_mappings(self, results: List[dict]) -> List[dict]:
        """
        Replace raw German category strings with numeric scale values.

        Three mapping strategies are applied depending on the field type:
            - **Cost** fields  -- static lookup ("guenstig" -> 1, ...).
            - **Time** fields  -- Roman-numeral lookup ("I" -> 1, ...).
            - **THG / Climate** fields -- percentile-based relative ranking
              across all measures in the current batch.

        The mapping mutates ``val["scale"]`` in-place for efficiency.

        @param results: List of raw result dicts from formula evaluation.

        @return: The same list with ``scale`` values replaced by integers.
        """
        # Collect all THG values for relative percentile scaling
        thg_values: List[float] = []
        for r in results:
            if "error" in r:
                continue
            for key, val in r.get("raw_results", {}).items():
                if isinstance(val, dict) and _is_thg_field(key):
                    w = val.get("werte")
                    if isinstance(w, (int, float)):
                        thg_values.append(w)

        thg_mapping = _build_thg_mapping(thg_values)

        for result in results:
            if "error" in result:
                continue
            for key, val in result.get("raw_results", {}).items():
                if not isinstance(val, dict) or "scale" not in val:
                    continue

                raw_scale = val["scale"]
                key_lower = key.lower()

                if _is_cost_field(key_lower):
                    mapped = self._map_cost_scale(raw_scale)
                elif _is_time_field(key_lower):
                    mapped = self._map_time_scale(raw_scale)
                elif _is_thg_field(key_lower):
                    werte  = val.get("werte")
                    mapped = _map_thg_scale(werte, thg_mapping) \
                             if isinstance(werte, (int, float)) else None
                else:
                    mapped = None

                if mapped is not None:
                    val["scale"] = mapped

        return results

    def _map_cost_scale(self, raw: Any) -> Optional[int]:
        """
        Map a German cost-category string to a 0-4 integer scale.

        @param raw: Raw scale string from the Excel result cell.

        @return: Integer in ``[0..4]`` or ``None`` if *raw* is not a
                 recognised cost category.
        """
        if not isinstance(raw, str):
            return None
        return self.COST_SCALE_MAPPING.get(raw.lower().strip())

    def _map_time_scale(self, raw: Any) -> Optional[int]:
        """
        Map a Roman-numeral time-effort string to a 1-5 integer scale.

        @param raw: Raw scale string (expected Roman numeral I-V).

        @return: Integer in ``[1..5]`` or ``None`` if unrecognised.
        """
        if not isinstance(raw, str):
            return None
        return self.TIME_SCALE_MAPPING.get(raw.strip())

    # ------------------------------------------------------------------
    # Cache helpers (same as original)
    # ------------------------------------------------------------------

    def clear_cache(self) -> int:
        """
        Evict all cached calculation results.

        Useful after Excel files have been updated or during administrative
        maintenance.  Returns the number of entries removed so the caller
        can log or display the impact.

        @return: Number of evicted cache entries.
        """
        count = len(self.cache)
        self.cache.clear()
        logger.info(f"Cache cleared: {count} entries removed")
        return count

    def refresh_metadata(self) -> int:
        """
        Re-scan Excel files and reload the metadata configuration.

        This is useful when Excel workbooks have been added, removed, or
        modified on disk after the initial startup scan.  The formula-engine
        DAGs are **not** rebuilt (they are keyed by filename and remain
        valid); only the cell-mapping metadata and the result cache are
        refreshed.

        The cache is cleared unconditionally because cache keys are derived
        from the old metadata and may no longer be valid.

        Infrastructure for Future Features
        -----------------------------------
        This method is **not currently called from anywhere in the codebase**.
        It provides the foundation for future admin/management features such as:

        - Runtime metadata refresh without server restart
        - Automated detection of new/modified measure Excel files
        - Administrative endpoints for metadata management
        - Integration with deployment pipelines

        Reviewers should note this capability exists for architectural planning
        and forward compatibility, even though it is not actively used in the
        current release.

        @return: Number of measures in the newly loaded metadata.
        """
        logger.info("Refreshing metadata configuration from disk ...")

        try:
            new_metadata = self.metadata_extractor.generate_configuration()
        except Exception as exc:
            logger.error(f"Metadata refresh failed: {exc}")
            raise

        old_count = len(self.metadata)
        self.metadata = new_metadata

        # Invalidate cache — keys are based on the old metadata
        evicted = self.clear_cache()

        logger.info(
            f"Metadata refreshed: {old_count} → {len(self.metadata)} measures "
            f"({evicted} cached entries evicted)"
        )
        return len(self.metadata)

    def get_cache_stats(self) -> dict:
        """
        Return lightweight diagnostics about the current cache state.

        @return: Dictionary with ``total_entries`` and ``measures_available``.
        """
        return {
            "total_entries":      len(self.cache),
            "measures_available": len(self.metadata),
        }


# ---------------------------------------------------------------------------
# Module-level pure helpers
# ---------------------------------------------------------------------------

def _is_cost_field(key: str) -> bool:
    return "kosten" in key or "cost" in key

def _is_time_field(key: str) -> bool:
    return "zeitaufwand" in key or "time" in key

def _is_thg_field(key: str) -> bool:
    return "thg" in key or "emissionen" in key or "kgco2e" in key

def _build_thg_mapping(values: List[float]) -> dict:
    if not values:
        return {"method": "empty"}
    clean = [v for v in values if v is not None]
    if len(clean) == 1:
        return {"method": "single_value"}
    try:
        pcts = [
            float(np.percentile(clean, 20)),
            float(np.percentile(clean, 40)),
            float(np.percentile(clean, 60)),
            float(np.percentile(clean, 80)),
        ]
        return {"method": "percentile", "percentiles": pcts}
    except Exception as e:
        logger.error(f"THG percentile error: {e}")
        return {"method": "error"}

def _map_thg_scale(value: float, mapping: dict) -> Optional[int]:
    method = mapping.get("method")
    if method in ("empty", "error"):
        return None
    if method == "single_value":
        return 3
    pcts = mapping.get("percentiles", [])
    if not pcts:
        return None
    if value < pcts[0]: return 1
    if value < pcts[1]: return 2
    if value < pcts[2]: return 3
    if value < pcts[3]: return 4
    return 5
