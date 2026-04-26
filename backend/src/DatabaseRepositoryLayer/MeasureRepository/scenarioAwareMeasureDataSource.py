"""
ScenarioAwareMeasureDataSource
==============================
Decorator that expands the base measure catalogue with reference-scenario
variants discovered by the calculation pipeline.

Business Purpose
----------------
The frontend expects measure IDs to match the composite IDs returned by
``/api/results/calculate``.  When a calculation Excel file defines multiple
reference scenarios (e.g. *Dieselbus* and *Erdgas-/CNG-Bus* for the same
base measure), the calculation pipeline produces separate result entries
like ``10107-e-dieselbus`` and ``10107-e-erdgas_/cng_bus``.

The **measure information file**, however, stores each measure only once
(e.g. ``10107-E``).  This class bridges the gap by duplicating the base
measure info for every scenario variant, using the composite ID from the
calculation metadata.

Architecture
------------
Wraps any ``MeasureDataSource`` and receives the list of calculation
measure IDs (already built by ``MetaDataExtractor`` at startup).  No extra
Excel I/O is performed — the scenario information is derived from the IDs
that already exist in memory.

Implements the ``MeasureDataSource`` protocol (structural typing), so the
API layer continues to call ``get_all_measures()`` without any changes.

Coupling
--------
The **only** coupling to the calculation domain is a ``list[str]`` of
measure IDs.  The adapter has no knowledge of Excel files, formula engines,
or metadata structures — making it easy to test, mock, and replace.

Thread Safety
-------------
Stateless after construction; safe for concurrent reads.
"""

from __future__ import annotations

import copy
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class ScenarioAwareMeasureDataSource:
    """
    Decorator that expands base measures with reference-scenario variants.

    Given a base ``MeasureDataSource`` and the composite measure IDs from
    the calculation pipeline, this class:

    1. For each base measure, finds all matching calculation IDs
       (exact match **or** prefix + ``"-"`` match, case-insensitive).
    2. If a single match is found, the measure is returned with the
       calculation ID (ensures ID consistency across endpoints).
    3. If multiple matches are found (multiple reference scenarios),
       the measure is duplicated — one copy per scenario, each with
       its composite ID.
    4. If no match is found (measure exists in the info file but has
       no calculation sheet), the measure is returned unchanged.
    """

    def __init__(
        self,
        base_source: Any,
        calculation_measure_ids: List[str],
    ) -> None:
        """
        Initialise the decorator.

        @param base_source:             Any object satisfying the
                                        ``MeasureDataSource`` protocol
                                        (must expose ``get_all_measures()``).
        @param calculation_measure_ids: List of composite measure IDs
                                        produced by ``MetaDataExtractor``
                                        (e.g. ``["20106", "10107-e-dieselbus",
                                        "10107-e-erdgas_/cng_bus", ...]``).
        """
        self._base_source = base_source
        # Store lowered for matching; keep originals for output
        self._calc_ids: List[str] = list(calculation_measure_ids)
        self._calc_ids_lower: List[str] = [cid.lower() for cid in calculation_measure_ids]

        logger.info(
            f"ScenarioAwareMeasureDataSource initialized with "
            f"{len(self._calc_ids)} calculation measure IDs"
        )

    # ------------------------------------------------------------------
    # MeasureDataSource protocol
    # ------------------------------------------------------------------

    def get_all_measures(self) -> List[Dict[str, Any]]:
        """
        Return the expanded measure catalogue with scenario variants.

        Satisfies the ``MeasureDataSource`` protocol.

        @return: List of measure dicts.  Measures with multiple reference
                 scenarios appear multiple times, each with a unique
                 composite ``"id"``.
        """
        base_measures = self._base_source.get_all_measures()
        expanded: List[Dict[str, Any]] = []

        for measure in base_measures:
            base_id = measure.get("id", "")
            scenario_ids = self._find_matching_calc_ids(base_id)

            if not scenario_ids:
                # No corresponding calculation entry — return as-is
                expanded.append(measure)
                logger.debug(
                    f"Measure '{base_id}': no matching calculation IDs, "
                    f"keeping original"
                )

            elif len(scenario_ids) == 1:
                # Single scenario (or exact match) — use the calculation ID
                # for cross-endpoint consistency
                variant = copy.deepcopy(measure)
                variant["id"] = scenario_ids[0]
                scenario_suffix = self._extract_scenario_suffix(base_id, scenario_ids[0])
                if scenario_suffix:
                    variant["title"] = f"{variant.get('title', '')}_{scenario_suffix}"
                expanded.append(variant)
                logger.debug(
                    f"Measure '{base_id}': single match → '{scenario_ids[0]}'"
                )

            else:
                # Multiple reference scenarios — duplicate
                for sid in scenario_ids:
                    variant = copy.deepcopy(measure)
                    variant["id"] = sid
                    scenario_suffix = self._extract_scenario_suffix(base_id, sid)
                    if scenario_suffix:
                        variant["title"] = f"{variant.get('title', '')}_{scenario_suffix}"
                    expanded.append(variant)

                logger.info(
                    f"Measure '{base_id}': expanded into "
                    f"{len(scenario_ids)} scenario variants: {scenario_ids}"
                )

        logger.info(
            f"Measure catalogue expanded: {len(base_measures)} base measures "
            f"→ {len(expanded)} entries (including scenario variants)"
        )
        return expanded

    # ------------------------------------------------------------------
    # Internal matching
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_scenario_suffix(base_id: str, composite_id: str) -> str:
        """
        Extract the scenario name from a composite calculation ID.

        If ``composite_id`` is ``"10107-e-dieselbus"`` and ``base_id`` is
        ``"10107-E"``, the suffix is ``"dieselbus"``.  Returns an empty
        string when there is no scenario suffix (exact match).

        @param base_id:      The original measure ID (e.g. ``"10107-E"``).
        @param composite_id: The calculation-pipeline ID
                             (e.g. ``"10107-e-dieselbus"``).

        @return: Scenario suffix or ``""`` if IDs match exactly.
        """
        prefix = base_id.lower() + "-"
        if composite_id.lower().startswith(prefix):
            return composite_id[len(prefix):]
        return ""

    def _find_matching_calc_ids(self, base_id: str) -> List[str]:
        """
        Find all calculation measure IDs that belong to a base measure.

        Matching rules (case-insensitive):
            - **Exact match**: ``calc_id == base_id``
            - **Scenario prefix**: ``calc_id`` starts with ``base_id + "-"``

        The ``"-"`` delimiter prevents false positives (e.g. base ``"2010"``
        must not match calc ID ``"20104"``).

        @param base_id: ID from the measure information file
                        (e.g. ``"10107-E"``).

        @return: Sorted list of matching calculation measure IDs
                 (original casing from the calculation metadata).
        """
        base_lower = base_id.lower()
        matches: List[str] = []

        for original_id, lowered_id in zip(self._calc_ids, self._calc_ids_lower):
            if lowered_id == base_lower or lowered_id.startswith(base_lower + "-"):
                matches.append(original_id)

        return sorted(matches)
