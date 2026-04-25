from __future__ import annotations

"""
CalculationService

This service is the application-layer entry point for running measure calculations.

Responsibilities
----------------
- Accepts calculation input (Pydantic model or plain dict) from the API layer.
- Converts the input into a plain dictionary (robust across Pydantic v1/v2).
- Computes “individualisation levels” based on which inputs are marked as `individual=True`.
- Delegates the actual computation to the injected calculation engine (`ICalculationEngine`).
  The engine may be synchronous or asynchronous.
- Normalizes/adjusts the engine output into the public API response format.

Dependencies
------------
- `engine` (ICalculationEngine):
    The computation engine (can return a dict or an awaitable returning a dict).
- `definition` (dict):
    The input parameter definition grouped by categories, used to build an index
    mapping parameter IDs to their category (e.g. "Energy", "Water", ...).

Input Expectations
------------------
The service expects `input_data` to either be:
- a Pydantic model with `.model_dump()` (Pydantic v2), or `.dict()` (Pydantic v1), or
- a plain `dict`.

The input payload must contain a list under the key `"inputs"` where each item
contains at least:
- `"id"`: the parameter ID (str)
- `"individual"`: whether the value is commune-specific (bool-like)

Individualisation Levels
------------------------
Individualisation is computed as the ratio of inputs marked as “individual”
to the total number of recognized inputs:

- Total level:
    individual_count_total / total_count_total
- Per-category level:
    individual_count_in_category / total_count_in_category

Ratios are rounded to 2 decimals.

Output Normalization
--------------------
The public API response includes:
- levelOfIndividualisationTotal
- levelOfIndividualisationGeneral
- levelOfIndividualisationEnergy
- levelOfIndividualisationMobility
- levelOfIndividualisationWater
- measureResults

Additionally, the service normalizes measure result keys:
- If `ongoingEmissionSavings` is missing, it is derived from:
    - `ongoingEmissionSavingsNBisko` or `ongoingEmissionSavingsBisko`
  and the legacy keys are removed.

Notes
-----
- The engine may expect the original Pydantic input or a dict. This implementation
  passes a dict (`payload_dict`) to the engine.
- Categories are currently expected to match: "General", "Energy", "Mobility", "Water".
"""

from typing import Any, Dict
import inspect

from ApplicationLayer.CalculationApi.ICalculationEngine import ICalculationEngine


class CalculationService:
    def __init__(self, engine: ICalculationEngine, definition: dict):
        """
        Create a new CalculationService.

        Parameters
        ----------
        engine:
            Calculation engine implementation (sync or async).
        definition:
            Input parameter definitions grouped by category.
            Used to build an index: parameter ID -> category.
        """
        self.engine = engine
        self.id_to_category = self._build_id_to_category_index(definition)

    async def calculate(self, input_data: Any) -> dict[str, Any]:
        """
        Run a full calculation.

        Steps
        -----
        1) Convert `input_data` (Pydantic or dict) into a plain dict.
        2) Compute individualisation levels from the payload.
        3) Execute the calculation engine (supports sync or async engine).
        4) Transform/normalize the engine output into the public response format.

        Parameters
        ----------
        input_data:
            Pydantic model or dict containing at least the key `"inputs"`.

        Returns
        -------
        dict[str, Any]
            Public API response format containing individualisation levels and measure results.
        """
        # 1) Pydantic -> dict (or keep dict as-is)
        payload_dict = self._to_dict(input_data)

        # 2) Compute individualisation levels on the plain dict payload
        individualisation_levels = self.calculate_individualisation_levels(payload_dict)

        # 3) Delegate to engine (engine may be sync or async)
        maybe = self.engine.calculate(payload_dict)
        engine_result = await maybe if inspect.isawaitable(maybe) else maybe

        # 4) Normalize output format
        return self.transform_output_format(engine_result, individualisation_levels)

    @staticmethod
    def _to_dict(obj: Any) -> Dict[str, Any]:
        """
        Convert Pydantic models (v1/v2) or plain dicts into a dict.

        Supported inputs
        ----------------
        - Pydantic v2: object has `.model_dump()`
        - Pydantic v1: object has `.dict()`
        - Plain dict

        Raises
        ------
        TypeError
            If the input is not a supported type.
        """
        # Pydantic v2
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        # Pydantic v1
        if hasattr(obj, "dict"):
            return obj.dict()
        # Already a dict
        if isinstance(obj, dict):
            return obj
        raise TypeError(f"Unsupported input_data type: {type(obj)!r}")

    # -------------------------------------------------------------------------
    # Helpers (normalization / indexing)
    # -------------------------------------------------------------------------

    @staticmethod
    def _is_true(value: Any) -> bool:
        """
        Interpret various "truthy" formats for the `individual` field.

        Accepted truthy values
        ----------------------
        - bool: True
        - str: "true" (case-insensitive, trimmed)
        - int/float: any non-zero value

        Everything else is False.
        """
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() == "true"
        if isinstance(value, (int, float)):
            return value != 0
        return False

    def _build_id_to_category_index(self, definition: dict) -> Dict[str, str]:
        """
        Build an index mapping parameter IDs to their category name.

        The `definition` is expected to be structured like:
            {
              "Water": [
                {"id": "...", "subinputs": [{"id": "..."}, ...]},
                ...
              ],
              "Energy": [...],
              ...
            }

        Both top-level fields and nested `subinputs` are indexed.
        """
        id_to_category: Dict[str, str] = {}
        for category, fields in (definition or {}).items():
            for f in fields or []:
                fid = f.get("id")
                if isinstance(fid, str):
                    id_to_category[fid] = category
                for sub in f.get("subinputs", []) or []:
                    sid = sub.get("id")
                    if isinstance(sid, str):
                        id_to_category[sid] = category
        return id_to_category

    # -------------------------------------------------------------------------
    # Individualisation computation
    # -------------------------------------------------------------------------

    def calculate_individualisation_levels(self, input_data: dict[str, Any]) -> Dict[str, float]:
        inputs = input_data.get("inputs", []) or []

        total_count: Dict[str, int] = {}
        true_count: Dict[str, int] = {}
        total_all = 0
        true_all = 0

        for item in inputs:
            field_id = item.get("id")
            if not isinstance(field_id, str):
                continue

            category = self.id_to_category.get(field_id)
            if category is None:
                continue

            total_all += 1
            total_count[category] = total_count.get(category, 0) + 1

            if self._is_true(item.get("individual", False)):
                true_all += 1
                true_count[category] = true_count.get(category, 0) + 1

        def safe_ratio(num: int, den: int) -> float:
            return round((num / den) if den else 0.0, 2)

        levels: Dict[str, float] = {"total": safe_ratio(true_all, total_all)}

        for cat in ["Allgemein", "Energie", "Mobilität", "Wasser"]:
            levels[cat] = safe_ratio(
                true_count.get(cat, 0),
                total_count.get(cat, 0),
            )

        return levels

    # -------------------------------------------------------------------------
    # Output transformation / normalization
    # -------------------------------------------------------------------------

    def transform_output_format(
        self,
        engine_result: dict[str, Any],
        individualisation_levels: dict[str, float],
    ) -> dict[str, Any]:
        """
        Transform the engine result into the public API response format.

        Adds individualisation level fields and normalizes measure result keys.

        Normalization performed
        -----------------------
        - Ensures `ongoingEmissionSavings` exists on each measure result:
            - derived from `ongoingEmissionSavingsNBisko` or `ongoingEmissionSavingsBisko`
        - Removes the legacy keys after mapping.

        Returns
        -------
        dict[str, Any]
            Public API response payload.
        """
        out: dict[str, Any] = {}

        out["levelOfIndividualisationTotal"] = individualisation_levels.get("total", 0.0)
        out["levelOfIndividualisationGeneral"] = individualisation_levels.get("Allgemein", 0.0)
        out["levelOfIndividualisationEnergy"] = individualisation_levels.get("Energie", 0.0)
        out["levelOfIndividualisationMobility"] = individualisation_levels.get("Mobilität", 0.0)
        out["levelOfIndividualisationWater"] = individualisation_levels.get("Wasser", 0.0)

        measure_results = engine_result.get("measureResults", []) or []
        transformed = []

        for m in measure_results:
            if not isinstance(m, dict):
                continue
            mm = dict(m)

            # Normalize ongoingEmissionSavings field
            if "ongoingEmissionSavings" not in mm:
                if "ongoingEmissionSavingsNBisko" in mm:
                    mm["ongoingEmissionSavings"] = mm.get("ongoingEmissionSavingsNBisko")
                elif "ongoingEmissionSavingsBisko" in mm:
                    mm["ongoingEmissionSavings"] = mm.get("ongoingEmissionSavingsBisko")

            mm.pop("ongoingEmissionSavingsNBisko", None)
            mm.pop("ongoingEmissionSavingsBisko", None)

            transformed.append(mm)

        out["measureResults"] = transformed
        return out
