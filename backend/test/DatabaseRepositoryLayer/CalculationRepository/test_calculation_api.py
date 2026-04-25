"""
Tests for CalculationAPI
========================
The CalculationAPI is a thin adapter/facade that transforms frontend JSON
into a flat dict, delegates to CalculationRepository, and maps the raw
results back into the camelCase contract the frontend expects.

Testing strategy
----------------
- The heavy dependencies (MetaDataExtractor, FormulaEngine) are replaced
  with lightweight fakes — the same approach used in test_calculation.py.
- Pure transformation methods (_transform_input, _build_measure_output,
  _resolve_field, _calculate_normalised_scores) are tested directly.
- The async calculate() method is tested end-to-end through the fakes.
"""

import asyncio
from pathlib import Path
from typing import Any, Dict
from unittest.mock import MagicMock

import pytest

from DatabaseRepositoryLayer.CalculationRepository.calculationAPI import CalculationAPI


# ---------------------------------------------------------------------------
# Fakes — same lightweight approach as test_calculation.py
# ---------------------------------------------------------------------------

class FakeMetaExtractor:
    """Minimal extractor that returns two hardcoded measures."""

    def __init__(self, directory_path: str):
        self.directory_path = directory_path

    def generate_configuration(self):
        return {
            "M01": {
                "measure_id": "M01",
                "measure_title": "Measure 1",
                "file": "data/ExcelDataSources/MeasureCalculationSheets/ID20101.xlsx",
                "data_city_mapping": {"Fallhöhe": "F6", "Einwohnerzahl": "F7"},
                "result_mapping": {
                    "zeitaufwand": {"werte": "F6", "kategorie": "F8"},
                },
            },
            "M02": {
                "measure_id": "M02",
                "measure_title": "Measure 2",
                "file": "data/ExcelDataSources/MeasureCalculationSheets/ID20102.xlsx",
                "data_city_mapping": {"kommunaler_haushalt": "F6"},
                "result_mapping": {
                    "direkte_kosten_(€)": {"werte": "F6", "kategorie": "F8"},
                },
            },
        }


class FakeEngine:
    """Minimal engine that returns plausible result shapes."""

    def __init__(self, excel_directory: Path):
        self.excel_directory = excel_directory

    def build_all(self):
        pass

    def evaluate(
        self,
        xlsx_filename,
        data_city_mapping,
        filtered_inputs,
        result_mapping,
        data_sheet_index,
        result_sheet_index,
    ) -> Dict[str, Any]:
        if "zeitaufwand" in result_mapping:
            return {
                "zeitaufwand": {"scale": 3, "werte": 12},
                "jährliche_thg_emissionen_in_kgco2e": {"scale": 3, "werte": 100.0},
            }
        return {
            "direkte_kosten_(€)": {"scale": 1, "werte": 10000},
        }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_excel_dir(tmp_path: Path) -> Path:
    d = tmp_path / "excel"
    d.mkdir()
    return d


@pytest.fixture
def api(tmp_excel_dir, monkeypatch) -> CalculationAPI:
    """
    Build a CalculationAPI backed by fakes so no real Excel I/O happens.

    The patches target the module where CalculationRepository is defined,
    exactly like test_calculation.py does.
    """
    import DatabaseRepositoryLayer.CalculationRepository.calculation as calc_mod

    monkeypatch.setattr(calc_mod, "MetaDataExtractor", FakeMetaExtractor)
    monkeypatch.setattr(calc_mod, "FormulaEngine", FakeEngine)

    return CalculationAPI(
        excel_directory=str(tmp_excel_dir),
        max_concurrent_evaluations=2,
    )


# ---------------------------------------------------------------------------
# _transform_input
# ---------------------------------------------------------------------------

class TestTransformInput:

    def test_flattens_inputs_to_dict(self, api: CalculationAPI):
        payload = {
            "inputs": [
                {"id": "fallhoehe", "value": 104},
                {"id": "einwohnerzahl", "value": 50000},
            ]
        }
        result = api._transform_input(payload)
        assert result == {"fallhoehe": 104, "einwohnerzahl": 50000}

    def test_strips_whitespace_from_id(self, api: CalculationAPI):
        payload = {"inputs": [{"id": "  fallhoehe  ", "value": 42}]}
        result = api._transform_input(payload)
        assert "fallhoehe" in result

    def test_drops_none_and_empty_values(self, api: CalculationAPI):
        payload = {
            "inputs": [
                {"id": "a", "value": None},
                {"id": "b", "value": ""},
                {"id": "c", "value": 0},
            ]
        }
        result = api._transform_input(payload)
        assert "a" not in result
        assert "b" not in result
        assert result["c"] == 0  # 0 is a valid value, not dropped

    def test_drops_inputs_with_missing_id(self, api: CalculationAPI):
        payload = {"inputs": [{"id": "", "value": 10}, {"value": 20}]}
        result = api._transform_input(payload)
        assert result == {}

    def test_subsidies_are_logged_but_not_applied(self, api: CalculationAPI):
        payload = {
            "inputs": [{"id": "x", "value": 1}],
            "subsidies": [{"id": "sub1", "value": 5000}],
        }
        result = api._transform_input(payload)
        # Subsidies must NOT appear in the flattened dict
        assert "sub1" not in result
        assert result == {"x": 1}

    def test_empty_payload_returns_empty_dict(self, api: CalculationAPI):
        assert api._transform_input({}) == {}
        assert api._transform_input({"inputs": []}) == {}


# ---------------------------------------------------------------------------
# _resolve_field
# ---------------------------------------------------------------------------

class TestResolveField:

    def test_exact_match_returns_frontend_key(self, api: CalculationAPI):
        assert api._resolve_field("zeitaufwand") == "time"
        assert api._resolve_field("direkte_kosten_(€)") == "investmentCost"
        assert api._resolve_field("laufende_kosten_(€)") == "ongoingCost"

    def test_prefix_fallback_for_kosten_gesamt_variant(self, api: CalculationAPI):
        # A future Excel file might use a new depreciation suffix
        assert api._resolve_field("kosten_gesamt_über_42_jahre") == "totalCost"

    def test_prefix_fallback_for_emission_variants(self, api: CalculationAPI):
        assert api._resolve_field("einmalige_thg_emissionen_xyz") == "onetimeEmissionSavings"
        assert api._resolve_field("jährliche_thg_emissionen_xyz") == "ongoingEmissionSavings"

    def test_unknown_field_returns_none(self, api: CalculationAPI):
        assert api._resolve_field("unknown_field") is None
        assert api._resolve_field("") is None


# ---------------------------------------------------------------------------
# _build_measure_output
# ---------------------------------------------------------------------------

class TestBuildMeasureOutput:

    def test_maps_time_field_correctly(self, api: CalculationAPI):
        result = {
            "measure_id": "M01",
            "raw_results": {
                "zeitaufwand": {"scale": 3, "werte": 12},
            },
        }
        out = api._build_measure_output(result)
        assert out["measureId"] == "M01"
        assert out["timeScale"] == 3
        assert out["time"] == 12

    def test_maps_cost_fields_and_takes_worst_scale(self, api: CalculationAPI):
        result = {
            "measure_id": "M01",
            "raw_results": {
                "direkte_kosten_(€)":                                       {"scale": 1, "werte": 5000},
                "kosten_gesamt_(€/jahr)(mit_abschreibung_über_lebensdauer)": {"scale": 3, "werte": 12000},
            },
        }
        out = api._build_measure_output(result)
        assert out["costScale"] == 3          # worst (max) of 1 and 3
        assert out["investmentCost"] == 5000
        assert out["totalCost"] == 12000

    def test_maps_climate_fields_and_takes_worst_scale(self, api: CalculationAPI):
        result = {
            "measure_id": "M01",
            "raw_results": {
                "einmalige_thg_emissionen_in_kgco2e": {"scale": 2, "werte": 500},
                "jährliche_thg_emissionen_in_kgco2e": {"scale": 4, "werte": 100},
            },
        }
        out = api._build_measure_output(result)
        assert out["climateScale"] == 4       # worst (max) of 2 and 4
        assert out["onetimeEmissionSavings"] == 500
        assert out["ongoingEmissionSavings"] == 100

    def test_none_values_replaced_with_zero(self, api: CalculationAPI):
        result = {
            "measure_id": "M01",
            "raw_results": {},                 # nothing matches -> all None
        }
        out = api._build_measure_output(result)
        assert out["time"] == 0
        assert out["investmentCost"] == 0
        assert out["ongoingCost"] == 0
        assert out["totalCost"] == 0
        assert out["onetimeEmissionSavings"] == 0
        assert out["ongoingEmissionSavings"] == 0
        assert out["timeScale"] == 0
        assert out["costScale"] == 0
        assert out["climateScale"] == 0

    def test_non_dict_raw_results_are_skipped(self, api: CalculationAPI):
        result = {
            "measure_id": "M01",
            "raw_results": {
                "zeitaufwand": "not_a_dict",   # should be silently skipped
            },
        }
        out = api._build_measure_output(result)
        assert out["time"] == 0                # not populated from non-dict


# ---------------------------------------------------------------------------
# _transform_output
# ---------------------------------------------------------------------------

class TestTransformOutput:

    def test_excludes_errored_measures(self, api: CalculationAPI):
        raw = [
            {"measure_id": "M01", "raw_results": {}, "measure_title": "A"},
            {"measure_id": "M02", "error": "something broke"},
        ]
        out = api._transform_output(raw)
        ids = [m["measureId"] for m in out["measureResults"]]
        assert "M01" in ids
        assert "M02" not in ids

    def test_output_structure_has_measure_results_key(self, api: CalculationAPI):
        out = api._transform_output([])
        assert "measureResults" in out
        assert isinstance(out["measureResults"], list)


# ---------------------------------------------------------------------------
# _calculate_normalised_scores
# ---------------------------------------------------------------------------

class TestCalculateNormalisedScores:

    def test_scores_are_0_to_100(self, api: CalculationAPI):
        measures = [
            {"measureId": "A", "time": 10, "totalCost": 5000, "ongoingEmissionSavings": 200},
            {"measureId": "B", "time": 50, "totalCost": 50000, "ongoingEmissionSavings": 800},
        ]
        result = api._calculate_normalised_scores(measures)
        for m in result:
            for key in ("timeScore", "costScore", "climateScore"):
                assert 0 <= m[key] <= 100

    def test_lower_value_gets_higher_score(self, api: CalculationAPI):
        measures = [
            {"measureId": "cheap", "time": 5, "totalCost": 1000, "ongoingEmissionSavings": 50},
            {"measureId": "expensive", "time": 50, "totalCost": 90000, "ongoingEmissionSavings": 900},
        ]
        result = api._calculate_normalised_scores(measures)
        cheap = next(m for m in result if m["measureId"] == "cheap")
        expensive = next(m for m in result if m["measureId"] == "expensive")
        assert cheap["costScore"] > expensive["costScore"]
        assert cheap["timeScore"] > expensive["timeScore"]

    def test_equal_values_get_neutral_score(self, api: CalculationAPI):
        measures = [
            {"measureId": "A", "time": 10, "totalCost": 5000, "ongoingEmissionSavings": 100},
            {"measureId": "B", "time": 10, "totalCost": 5000, "ongoingEmissionSavings": 100},
        ]
        result = api._calculate_normalised_scores(measures)
        for m in result:
            assert m["timeScore"] == 50
            assert m["costScore"] == 50
            assert m["climateScore"] == 50

    def test_single_measure_gets_neutral_score(self, api: CalculationAPI):
        measures = [
            {"measureId": "A", "time": 10, "totalCost": 5000, "ongoingEmissionSavings": 100},
        ]
        result = api._calculate_normalised_scores(measures)
        assert result[0]["timeScore"] == 50
        assert result[0]["costScore"] == 50
        assert result[0]["climateScore"] == 50

    def test_empty_list_returns_empty(self, api: CalculationAPI):
        assert api._calculate_normalised_scores([]) == []

    def test_missing_value_defaults_to_zero_score(self, api: CalculationAPI):
        measures = [
            {"measureId": "A", "time": None, "totalCost": None, "ongoingEmissionSavings": None},
        ]
        result = api._calculate_normalised_scores(measures)
        assert result[0]["timeScore"] == 0
        assert result[0]["costScore"] == 0
        assert result[0]["climateScore"] == 0


# ---------------------------------------------------------------------------
# Utility / delegate methods
# ---------------------------------------------------------------------------

class TestUtilityMethods:

    def test_initialise_is_noop(self, api: CalculationAPI):
        # Should not raise
        api.initialise()

    def test_clear_cache_delegates(self, api: CalculationAPI):
        # Warm the cache first via the repository
        api.repository.cache["dummy_key"] = {"x": 1}
        assert api.clear_cache() == 1
        assert api.clear_cache() == 0  # already empty

    def test_get_cache_stats_returns_expected_keys(self, api: CalculationAPI):
        stats = api.get_cache_stats()
        assert "total_entries" in stats
        assert "measures_available" in stats
        assert stats["measures_available"] == 2  # M01, M02

    def test_get_available_measures_returns_ids(self, api: CalculationAPI):
        measures = api.get_available_measures()
        assert sorted(measures) == ["M01", "M02"]

    def test_refresh_metadata_reloads_and_returns_count(self, api: CalculationAPI):
        # Warm some cache entries
        api.repository.cache["key1"] = {"data": 1}
        api.repository.cache["key2"] = {"data": 2}

        count = api.refresh_metadata()
        assert count == 2  # FakeMetaExtractor always returns 2 measures
        assert len(api.repository.cache) == 0  # cache should be cleared


# ---------------------------------------------------------------------------
# End-to-end async: calculate()
# ---------------------------------------------------------------------------

class TestCalculateEndToEnd:

    @pytest.mark.anyio
    async def test_calculate_returns_measure_results(self, api: CalculationAPI):
        payload = {
            "inputs": [
                {"id": "Fallhöhe", "value": 104},
                {"id": "Einwohnerzahl", "value": 50000},
                {"id": "kommunaler_haushalt", "value": 999},
            ],
        }
        result = await api.calculate(payload)

        assert "measureResults" in result
        assert len(result["measureResults"]) > 0

        # Every measure result must have the expected keys
        expected_keys = {
            "measureId", "timeScale", "costScale", "climateScale",
            "time", "investmentCost", "ongoingCost", "totalCost",
            "onetimeEmissionSavings", "ongoingEmissionSavings",
            "timeScore", "costScore", "climateScore",
        }
        for m in result["measureResults"]:
            assert expected_keys.issubset(m.keys()), (
                f"Missing keys in {m['measureId']}: "
                f"{expected_keys - set(m.keys())}"
            )

    @pytest.mark.anyio
    async def test_calculate_with_empty_inputs_still_returns_results(self, api: CalculationAPI):
        result = await api.calculate({"inputs": []})
        assert "measureResults" in result
        # Measures are still evaluated (with no inputs, engine sees empty filtered_inputs)

    @pytest.mark.anyio
    async def test_calculate_no_none_values_in_output(self, api: CalculationAPI):
        """Frontend contract: no None values -- everything is numeric (0 default)."""
        payload = {
            "inputs": [{"id": "Fallhöhe", "value": 104}],
        }
        result = await api.calculate(payload)
        for m in result["measureResults"]:
            for key, val in m.items():
                if key == "measureId":
                    continue
                assert val is not None, f"{m['measureId']}.{key} is None" 
