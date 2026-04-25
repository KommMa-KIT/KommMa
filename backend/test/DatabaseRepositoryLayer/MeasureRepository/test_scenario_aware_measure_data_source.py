"""
Tests for ScenarioAwareMeasureDataSource.

Verifies the decorator correctly expands base measures with reference-scenario
variants from the calculation pipeline, without requiring Excel files.
"""

import pytest
from DatabaseRepositoryLayer.MeasureRepository.scenarioAwareMeasureDataSource import (
    ScenarioAwareMeasureDataSource,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class FakeMeasureSource:
    """Minimal stub implementing MeasureDataSource.get_all_measures()."""

    def __init__(self, measures):
        self._measures = measures

    def get_all_measures(self):
        return list(self._measures)


def _make_measure(mid: str, titel: str = "Some measure") -> dict:
    return {
        "id": mid,
        "titel": titel,
        "shortDescription": "desc",
        "description": "long desc",
        "relevantParameters": ["A01"],
        "furtherInfo": ["http://example.com"],
        "imageURL": "http://img",
        "popularity": "high",
    }


# ---------------------------------------------------------------------------
# Tests — basic behaviour
# ---------------------------------------------------------------------------

class TestNoScenarioExpansion:
    """Measures with zero or one matching calc ID are returned once."""

    def test_no_matching_calc_ids_returns_original(self):
        """Base measure has no corresponding calculation entry."""
        base = [_make_measure("99999")]
        ds = ScenarioAwareMeasureDataSource(FakeMeasureSource(base), [])
        result = ds.get_all_measures()

        assert len(result) == 1
        assert result[0]["id"] == "99999"

    def test_single_exact_match_uses_calc_id(self):
        """Single calc ID matches → measure ID is replaced for consistency."""
        base = [_make_measure("20106")]
        calc_ids = ["20106"]
        ds = ScenarioAwareMeasureDataSource(FakeMeasureSource(base), calc_ids)
        result = ds.get_all_measures()

        assert len(result) == 1
        assert result[0]["id"] == "20106"

    def test_single_exact_match_case_insensitive(self):
        """Matching is case-insensitive; calc ID casing is preserved."""
        base = [_make_measure("20107A")]
        calc_ids = ["20107a"]
        ds = ScenarioAwareMeasureDataSource(FakeMeasureSource(base), calc_ids)
        result = ds.get_all_measures()

        assert len(result) == 1
        assert result[0]["id"] == "20107a"  # uses calc casing


# ---------------------------------------------------------------------------
# Tests — multi-scenario expansion
# ---------------------------------------------------------------------------

class TestMultiScenarioExpansion:
    """Measures with multiple matching calc IDs are duplicated."""

    def test_two_scenarios_produce_two_entries(self):
        base = [_make_measure("10107", "ÖPNV Elektrifizierung")]
        calc_ids = ["10107-e-dieselbus", "10107-e-erdgas_/cng_bus"]
        ds = ScenarioAwareMeasureDataSource(FakeMeasureSource(base), calc_ids)
        result = ds.get_all_measures()

        assert len(result) == 2
        ids = {r["id"] for r in result}
        assert ids == {"10107-e-dieselbus", "10107-e-erdgas_/cng_bus"}

        # All fields except "id" are duplicated from the base
        for r in result:
            assert r["titel"] == "ÖPNV Elektrifizierung"
            assert r["shortDescription"] == "desc"

    def test_three_scenarios(self):
        base = [_make_measure("10102")]
        calc_ids = [
            "10102-e-diesel_pkw",
            "10102-e-benzin_pkw",
            "10102-e-lpg_pkw",
        ]
        ds = ScenarioAwareMeasureDataSource(FakeMeasureSource(base), calc_ids)
        result = ds.get_all_measures()

        assert len(result) == 3
        ids = sorted(r["id"] for r in result)
        assert ids == ["10102-e-benzin_pkw", "10102-e-diesel_pkw", "10102-e-lpg_pkw"]


# ---------------------------------------------------------------------------
# Tests — mixed catalogue
# ---------------------------------------------------------------------------

class TestMixedCatalogue:
    """Combination of single-scenario and multi-scenario measures."""

    def test_mixed_expansion(self):
        base = [
            _make_measure("20106", "Kleinstwasserkraftwerke"),
            _make_measure("10107", "ÖPNV Elektrifizierung"),
            _make_measure("30101", "Solarthermie"),
        ]
        calc_ids = [
            "20106",
            "10107-e-dieselbus",
            "10107-e-erdgas_/cng_bus",
            # 30101 has no calc entry
        ]
        ds = ScenarioAwareMeasureDataSource(FakeMeasureSource(base), calc_ids)
        result = ds.get_all_measures()

        assert len(result) == 4  # 1 + 2 + 1
        ids = [r["id"] for r in result]
        assert "20106" in ids
        assert "10107-e-dieselbus" in ids
        assert "10107-e-erdgas_/cng_bus" in ids
        assert "30101" in ids  # kept unchanged


# ---------------------------------------------------------------------------
# Tests — edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Boundary conditions and defensive behaviour."""

    def test_empty_base_measures(self):
        ds = ScenarioAwareMeasureDataSource(FakeMeasureSource([]), ["20106"])
        assert ds.get_all_measures() == []

    def test_empty_calc_ids(self):
        base = [_make_measure("20106")]
        ds = ScenarioAwareMeasureDataSource(FakeMeasureSource(base), [])
        result = ds.get_all_measures()

        assert len(result) == 1
        assert result[0]["id"] == "20106"

    def test_no_false_prefix_match(self):
        """Base ID '2010' must NOT match calc ID '20104' (no '-' delimiter)."""
        base = [_make_measure("2010")]
        calc_ids = ["20104", "20106"]
        ds = ScenarioAwareMeasureDataSource(FakeMeasureSource(base), calc_ids)
        result = ds.get_all_measures()

        assert len(result) == 1
        assert result[0]["id"] == "2010"  # unchanged, no match

    def test_deep_copy_isolation(self):
        """Mutating one scenario variant must not affect others."""
        base = [_make_measure("10107")]
        calc_ids = ["10107-e-dieselbus", "10107-e-erdgas_/cng_bus"]
        ds = ScenarioAwareMeasureDataSource(FakeMeasureSource(base), calc_ids)
        result = ds.get_all_measures()

        # Mutate one variant
        result[0]["titel"] = "CHANGED"

        # Other variant and base must be unaffected
        assert result[1]["titel"] == "Some measure"
        assert base[0]["titel"] == "Some measure"
