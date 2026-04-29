"""
CalculationAPI
==============
High-level facade consumed by FastAPI routes.

Business Purpose
----------------
Translates the structured frontend JSON (inputs + subsidies) into a flat
parameter dict, delegates the heavy computation to ``CalculationRepository``,
and transforms the raw results back into the contract expected by the
frontend (camelCase keys, normalised 0-100 scores).

Architecture
------------
Implements ``ICalculationEngine`` (``ApplicationLayer.CalculationApi``), so
the application layer depends only on the protocol, not on this concrete
class.  Swapping to a different calculation back-end (e.g. a remote service)
requires only a new ``ICalculationEngine`` implementation.

Thread Safety
-------------
All state lives in the underlying ``CalculationRepository`` (see its own
thread-safety notes).  This class adds no mutable shared state.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from ApplicationLayer.CalculationApi.ICalculationEngine import ICalculationEngine
# Handle both direct execution and module imports
try:
    from .calculation import CalculationRepository
    from .metaDataExtractor import MetaDataExtractor
except ImportError:
    # Running directly, not as a module - add src to path
    _src_dir = Path(__file__).resolve().parent.parent.parent
    if str(_src_dir) not in sys.path:
        sys.path.insert(0, str(_src_dir))
    from DatabaseRepositoryLayer.CalculationRepository.calculation import CalculationRepository
    from DatabaseRepositoryLayer.CalculationRepository.metaDataExtractor import MetaDataExtractor

logger = logging.getLogger(__name__)


class CalculationAPI(ICalculationEngine):
    """
    Thin orchestration layer between FastAPI routes and ``CalculationRepository``.

    Responsibilities
        - Transform frontend input JSON  -> flat parameter dict
        - Delegate to ``CalculationRepository.calculate_all_measures()``
        - Transform raw results          -> frontend output JSON
        - Compute normalised 0-100 scores across all measures

    The class deliberately does **no** domain logic of its own; it is a
    mapping / adapter layer only.
    """

    # Map raw German field names → camelCase frontend keys.
    # Exact matches are tried first; for fields whose suffix varies across
    # Excel files (e.g. "kosten_gesamt_…über_lebensdauer" vs
    # "…über_nutzungsdauer" vs "…über_10_jahre") a prefix rule in
    # _PREFIX_MAPPINGS is used as fallback.
    FIELD_MAPPINGS: Dict[str, str] = {
        "direkte_kosten_(€)":                                          "investmentCost",
        "laufende_kosten_(€)":                                         "ongoingCost",
        "kosten_gesamt_(€/jahr)(mit_abschreibung_über_lebensdauer)":   "totalCost",
        "kosten_gesamt_(€/jahr)(mit_abschreibung_über_nutzungsdauer)": "totalCost",
        "kosten_gesamt_(€/jahr)(mit_abschreibung)":                    "totalCost",
        "zeitaufwand":                                                  "time",
        "einmalige_thg_emissionen_in_kgco2e":                          "onetimeEmissionSavings",
        "jährliche_thg_emissionen_in_kgco2e":                          "ongoingEmissionSavings",
    }

    # Prefix-based fallback: if an exact FIELD_MAPPINGS hit is not found,
    # the first prefix that matches wins.  This covers future Excel files
    # whose "Kosten Gesamt" column has yet another depreciation suffix.
    _PREFIX_MAPPINGS: List[tuple] = [
        ("kosten_gesamt_",                  "totalCost"),
        ("einmalige_thg_emissionen",        "onetimeEmissionSavings"),
        ("jährliche_thg_emissionen",        "ongoingEmissionSavings"),
    ]

    def __init__(
        self,
        excel_directory: str,
        metadata_extractor: Optional[MetaDataExtractor] = None,
        max_concurrent_evaluations: int = 4,
    ) -> None:
        """
        Create the API and its backing ``CalculationRepository``.

        @param excel_directory:             Path to the folder containing
                                            measure Excel workbooks.
        @param metadata_extractor:          Optional pre-built extractor
                                            (mainly for testing with mocks).
        @param max_concurrent_evaluations:  Maximum parallel formula
                                            evaluations (CPU-bound cap).
        """
        self.repository = CalculationRepository(
            excel_directory    = excel_directory,
            metadata_extractor = metadata_extractor,
            max_workers        = max_concurrent_evaluations,
        )

    # ------------------------------------------------------------------
    # Startup
    # ------------------------------------------------------------------

    def initialise(self) -> None:
        """
        No-op retained for backward compatibility.

        ``CalculationRepository`` now performs all initialisation in its
        constructor, so callers that still invoke ``initialise()`` will
        not break.
        """
        pass

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    async def calculate(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run the full calculation pipeline for the given frontend payload.

        Steps
            1. Flatten the structured ``input_data`` into a simple param dict.
            2. Evaluate all measures via ``CalculationRepository``.
            3. Map raw results to camelCase frontend keys and compute
               normalised 0-100 scores.

        @param input_data: Frontend JSON payload with the structure::

            {
                "inputs": [
                    {"id": "fallhoehe", "value": 104, "individual": "false"},
                    ...
                ],
                "subsidies": [
                    {"id": "123", "value": 10000, "unit": "euro"},
                    ...
                ]
            }

        @return: Response dict with a single ``measureResults`` key containing
                 a list of per-measure result objects (see class docstring for
                 the full schema).
        """
        # 1 — transform input
        repo_input = self._transform_input(input_data)

        # 2 — calculate
        raw_results = await self.repository.calculate_all_measures(repo_input)

        # 3 — transform output
        return self._transform_output(raw_results)

    # ------------------------------------------------------------------
    # Input transformation
    # ------------------------------------------------------------------

    def _transform_input(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Flatten the structured frontend input into a simple ``{name: value}`` dict.

        Empty / ``None`` values are silently dropped.  Subsidies are logged
        but not yet applied.

        Future Feature
        ---------------
        Subsidy handling is **not yet implemented**. Subsidies received in the
        payload are currently consumed but not applied to the calculation.
        This is a planned feature for a future release where subsidies will
        affect cost calculations or measure feasibility.

        @param input_data: Raw frontend JSON payload.

        @return: Flat parameter dictionary ready for ``CalculationRepository``.
        """
        result: Dict[str, Any] = {}

        for item in input_data.get("inputs", []):
            name  = item.get("id", "").strip()
            value = item.get("value")
            if name and value is not None and value != "":
                result[name] = value

        subsidies = input_data.get("subsidies", [])
        if subsidies:
            logger.info(f"{len(subsidies)} subsidies received — not yet applied (TODO)")

        return result

    # ------------------------------------------------------------------
    # Output transformation
    # ------------------------------------------------------------------

    def _transform_output(self, raw_results: List[dict]) -> Dict[str, Any]:
        """
        Convert a list of raw repository results into the frontend response.

        Measures that carry an ``"error"`` key are logged and excluded.
        After mapping, normalised 0-100 scores are computed across the
        surviving measures.

        @param raw_results: Output of ``CalculationRepository.calculate_all_measures``.

        @return: ``{"measureResults": [...]}``.
        """
        measure_results: List[Dict[str, Any]] = []

        for result in raw_results:
            if "error" in result:
                logger.warning(
                    f"Skipping measure {result['measure_id']}: {result['error']}"
                )
                continue

            measure_output = self._build_measure_output(result)
            measure_results.append(measure_output)

        # Normalise scores across all measures (0-100)
        measure_results = self._calculate_normalised_scores(measure_results)

        return {
            "measureResults": measure_results,
        }

    def _resolve_field(self, raw_key: str) -> Optional[str]:
        """
        Map a raw German Excel field name to its camelCase frontend counterpart.

        Exact matches in ``FIELD_MAPPINGS`` are tried first; if none is found,
        a prefix-based fallback (``_PREFIX_MAPPINGS``) covers future Excel
        files whose column headers have a different depreciation suffix.

        @param raw_key: Cleaned lower-case field name from the Excel result.

        @return: camelCase frontend key, or ``None`` if unrecognised.
        """
        # 1. Exact match
        mapped = self.FIELD_MAPPINGS.get(raw_key)
        if mapped:
            return mapped
        # 2. Prefix fallback
        for prefix, frontend_name in self._PREFIX_MAPPINGS:
            if raw_key.startswith(prefix):
                return frontend_name
        return None

    def _build_measure_output(self, result: dict) -> Dict[str, Any]:
        """
        Convert one raw repository result into the frontend measure dict.

        Iterates over every field in ``raw_results`` and classifies it as
        a time, cost, or climate field.  For cost and climate dimensions the
        **worst** (highest) scale across multiple sub-fields is taken.

        ``None`` values are replaced with ``0`` to prevent frontend errors
        (e.g. calling ``.toLocaleString()`` on ``null``).

        @param result: Single result dict from ``CalculationRepository``.

        @return: Frontend-ready dictionary with scales, scores, and values.
        """
        measure_id = result["measure_id"]
        raw_data   = result.get("raw_results", {})

        scales = {"timeScale": None, "costScale": None, "climateScale": None}
        values = {
            "time":                   None,
            "investmentCost":         None,
            "ongoingCost":            None,
            "totalCost":              None,
            "onetimeEmissionSavings": None,
            "ongoingEmissionSavings":  None,
        }

        for original_field, value_dict in raw_data.items():
            if not isinstance(value_dict, dict):
                continue

            frontend_field = self._resolve_field(original_field)
            scale_value    = value_dict.get("scale")
            werte_value    = value_dict.get("werte")
            field_lower    = original_field.lower()

            # Time
            if "zeitaufwand" in field_lower:
                if scale_value is not None:
                    scales["timeScale"] = scale_value
                if werte_value is not None and frontend_field:
                    values[frontend_field] = werte_value

            # Cost — take the worst (max) scale across multiple cost fields
            elif "kosten" in field_lower:
                if scale_value is not None:
                    prev = scales["costScale"]
                    scales["costScale"] = scale_value if prev is None \
                                         else max(prev, scale_value)
                if werte_value is not None and frontend_field:
                    values[frontend_field] = werte_value

            # Climate / THG — take the worst (max) scale
            elif "thg" in field_lower or "emissionen" in field_lower or "kgco2e" in field_lower:
                if scale_value is not None:
                    prev = scales["climateScale"]
                    scales["climateScale"] = scale_value if prev is None \
                                             else max(prev, scale_value)
                if werte_value is not None and frontend_field:
                    values[frontend_field] = werte_value

        # Convert None to 0 for all numeric fields to prevent frontend errors
        # Frontend expects numbers (can call .toLocaleString()) not null
        for key in values:
            if values[key] is None:
                values[key] = 0
        
        # Also ensure scales are never None
        for key in scales:
            if scales[key] is None:
                scales[key] = 0

        return {"measureId": measure_id, **scales, **values}

    # ------------------------------------------------------------------
    # Score normalisation
    # ------------------------------------------------------------------

    def _calculate_normalised_scores(
        self, measures: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Compute normalised 0-100 scores so measures are comparable.

        Formula:  ``score = (x_max - x) / (x_max - x_min) * 100``

        A **lower** raw value yields a **higher** score (better outcome).

        Dimensions
            - ``timeScore``    <- ``time``
            - ``costScore``    <- ``totalCost``
            - ``climateScore`` <- ``ongoingEmissionSavings``

        When all measures share the same raw value the score defaults to 50
        (neutral).  Missing or non-numeric values default to 0.

        @param measures: List of frontend measure dicts (mutated in-place).

        @return: The same list with ``*Score`` fields populated.
        """
        score_sources = {
            "timeScore":    "time",
            "costScore":    "totalCost",
            "climateScore": "ongoingEmissionSavings",
        }

        # Collect numeric values per dimension
        collected: Dict[str, List[float]] = {k: [] for k in score_sources}
        for m in measures:
            for score_key, value_key in score_sources.items():
                v = m.get(value_key)
                if v is not None:
                    try:
                        collected[score_key].append(float(v))
                    except (ValueError, TypeError):
                        pass

        # Compute per-dimension min/max
        ranges: Dict[str, Optional[Dict[str, float]]] = {}
        for score_key, vals in collected.items():
            ranges[score_key] = (
                {"xmin": min(vals), "xmax": max(vals)} if vals else None
            )

        # Apply formula
        for m in measures:
            for score_key, value_key in score_sources.items():
                r   = ranges[score_key]
                val = m.get(value_key)

                if r is None or val is None:
                    # No valid data to calculate score - use 0 instead of None
                    # to prevent frontend errors (toLocaleString on null)
                    m[score_key] = 0
                    continue

                try:
                    x = float(val)
                except (ValueError, TypeError):
                    # Invalid value - use 0 instead of None
                    m[score_key] = 0
                    continue

                xmin, xmax = r["xmin"], r["xmax"]
                if xmax == xmin:
                    m[score_key] = 50   # all measures equal → neutral
                else:
                    m[score_key] = round((xmax - x) / (xmax - xmin) * 100)

        return measures

    # ------------------------------------------------------------------
    # Utility (exposed for tests / admin routes)
    # ------------------------------------------------------------------

    def clear_cache(self) -> int:
        """
        Delegate cache eviction to the underlying repository.

        @return: Number of evicted entries.
        """
        return self.repository.clear_cache()

    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Return cache diagnostics from the underlying repository.

        @return: Dictionary with ``total_entries`` and ``measures_available``.
        """
        return self.repository.get_cache_stats()

    def refresh_metadata(self) -> int:
        """
        Re-scan Excel files and reload the measure metadata configuration.

        Delegates to ``CalculationRepository.refresh_metadata()`` which
        re-runs the ``MetaDataExtractor``, swaps in the new metadata, and
        clears the stale result cache.  The compiled formula-engine DAGs
        are **not** rebuilt (they remain valid).

        Future Feature (Admin / Management Use Case)
        -----------------------------------------------
        This method is **currently not exposed via any HTTP endpoint** and is
        not automatically triggered. It exists as infrastructure for potential
        future use cases such as:

        - Allowing administrators to refresh metadata without restarting
        - Detecting new/changed Excel files on disk at runtime
        - Zero-downtime deployment of measure updates
        - Scheduled metadata refresh (e.g., nightly)

        A future release may expose this via a protected admin endpoint
        (e.g., ``POST /api/admin/refresh-metadata``) or integrate it into
        a deployment pipeline. Reviewers should be aware this capability
        exists for planning purposes.

        @return: Number of measures in the newly loaded metadata.

        @throws Exception: Propagated from the extractor if the directory
                           is missing or no valid Excel files are found.
        """
        return self.repository.refresh_metadata()

    def get_available_measures(self) -> List[str]:
        """
        List the IDs of all measures the repository knows about.

        @return: List of measure-ID strings.
        """
        return list(self.repository.metadata.keys())