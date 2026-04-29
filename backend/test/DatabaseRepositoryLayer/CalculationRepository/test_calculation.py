import asyncio
from pathlib import Path
import pytest

# Adjust import if your module path differs
from DatabaseRepositoryLayer.CalculationRepository.calculation import (
    CalculationRepository,
    _build_thg_mapping,
    _map_thg_scale,
)


# -----------------------
# Fakes
# -----------------------

class FakeMetaExtractor:
    def __init__(self, directory_path: str):
        self.directory_path = directory_path

    def generate_configuration(self):
        # minimal metadata the repository expects
        return {
            "M01": {
                "measure_id": "M01",
                "measure_title": "Measure 1",
                "file": "data/ExcelDataSources/MeasureCalculationSheets/ID20101.xlsx",
                "data_city_mapping": {"Fallhöhe": "A1", "Einwohnerzahl": "A2"},
                "result_mapping": {"zeitaufwand": "B2"},
            },
            "M02": {
                "measure_id": "M02",
                "measure_title": "Measure 2",
                "file": "data/ExcelDataSources/MeasureCalculationSheets/ID20102.xlsx",
                "data_city_mapping": {"kommunaler_haushalt": "A1"},
                "result_mapping": {"direkte_kosten_(€)": "B2"},
            },
        }


class FakeEngine:
    def __init__(self, excel_directory: Path):
        self.excel_directory = excel_directory
        self.build_all_called = False
        self.evaluate_calls = []

    def build_all(self):
        self.build_all_called = True

    def evaluate(
        self,
        xlsx_filename,
        data_city_mapping,
        filtered_inputs,
        result_mapping,
        data_sheet_index,
        result_sheet_index,
    ):
        self.evaluate_calls.append(
            {
                "xlsx_filename": xlsx_filename,
                "data_city_mapping": data_city_mapping,
                "filtered_inputs": dict(filtered_inputs),
                "result_mapping": result_mapping,
                "data_sheet_index": data_sheet_index,
                "result_sheet_index": result_sheet_index,
            }
        )
        # Return a shape compatible with _apply_scale_mappings:
        # { field_name: { "scale": <raw>, "werte": <value> } }
        if "zeitaufwand" in result_mapping:
            return {
                "zeitaufwand": {"scale": "III", "werte": 12},
                "jährliche_thg_emissionen_in_kgco2e": {"scale": "ignored", "werte": 100.0},
            }
        return {
            "direkte_kosten_(€)": {"scale": "günstig", "werte": 10000},
        }


# -----------------------
# Fixtures
# -----------------------

@pytest.fixture
def tmp_excel_dir(tmp_path: Path) -> Path:
    # Create an existing directory to satisfy FileNotFound check
    d = tmp_path / "excel"
    d.mkdir()
    return d


@pytest.fixture
def repo(tmp_excel_dir, monkeypatch) -> CalculationRepository:
    # Patch MetaDataExtractor and FormulaEngine in the module where CalculationRepository is defined
    import DatabaseRepositoryLayer.CalculationRepository.calculation as calc_mod

    monkeypatch.setattr(calc_mod, "MetaDataExtractor", FakeMetaExtractor)
    monkeypatch.setattr(calc_mod, "FormulaEngine", FakeEngine)

    r = CalculationRepository(excel_directory=str(tmp_excel_dir), max_workers=2)
    return r


# -----------------------
# Unit tests
# -----------------------

def test_init_builds_metadata_and_engine(repo: CalculationRepository):
    assert repo.metadata  # non-empty
    assert "M01" in repo.metadata
    assert repo._engine.build_all_called is True
    assert isinstance(repo.cache, dict)
    assert repo.get_cache_stats()["measures_available"] == len(repo.metadata)


def test_filter_required_inputs_matches_case_and_whitespace(repo: CalculationRepository):
    meta = repo.metadata["M01"]
    input_json = {
        " fallhöhe ": 104,
        "EINWOHNERZAHL": 50000,
        "ignored": 1,
    }

    filtered = repo._filter_required_inputs(meta, input_json)
    # required keys are taken from meta["data_city_mapping"].keys() and preserved as-is
    assert filtered == {"Fallhöhe": 104, "Einwohnerzahl": 50000}


def test_generate_cache_key_is_deterministic_and_order_independent(repo: CalculationRepository):
    a = {"x": 1, "y": 2}
    b = {"y": 2, "x": 1}
    k1 = repo._generate_cache_key("M01", a)
    k2 = repo._generate_cache_key("M01", b)
    assert k1 == k2

    k3 = repo._generate_cache_key("M02", a)
    assert k3 != k1


@pytest.mark.anyio
async def test_calculate_single_measure_uses_cache(repo: CalculationRepository, monkeypatch):
    meta = repo.metadata["M02"]
    inputs = {"kommunaler_haushalt": 123}

    # spy on _evaluate_measure to ensure it's called only once
    calls = {"n": 0}
    original = repo._evaluate_measure

    def wrapped(*args, **kwargs):
        calls["n"] += 1
        return original(*args, **kwargs)

    monkeypatch.setattr(repo, "_evaluate_measure", wrapped)

    r1 = await repo._calculate_single_measure("M02", meta, inputs)
    r2 = await repo._calculate_single_measure("M02", meta, inputs)

    assert "measure_id" in r1 and r1["measure_id"] == "M02"
    assert r1 == r2
    assert calls["n"] == 1  # second call should hit cache


def test_evaluate_measure_no_file_returns_error(repo: CalculationRepository):
    meta = {
        "measure_id": "MXX",
        "measure_title": "Bad",
        "file": "",
        "data_city_mapping": {},
        "result_mapping": {},
    }
    out = repo._evaluate_measure("MXX", meta, {})
    assert out["measure_id"] == "MXX"
    assert "error" in out
    assert "No file path" in out["error"]


def test_evaluate_measure_calls_engine_with_filename(repo: CalculationRepository):
    meta = repo.metadata["M01"]
    out = repo._evaluate_measure("M01", meta, {"Fallhöhe": 104})

    assert out["measure_id"] == "M01"
    assert "raw_results" in out

    # engine should have been called with filename only, not full path
    assert repo._engine.evaluate_calls[-1]["xlsx_filename"] == "ID20101.xlsx"


def test_evaluate_measure_engine_exception_returns_error(tmp_excel_dir, monkeypatch):
    import DatabaseRepositoryLayer.CalculationRepository.calculation as calc_mod

    class ExplodingEngine(FakeEngine):
        def evaluate(self, *args, **kwargs):
            raise RuntimeError("boom")

    monkeypatch.setattr(calc_mod, "MetaDataExtractor", FakeMetaExtractor)
    monkeypatch.setattr(calc_mod, "FormulaEngine", ExplodingEngine)
    repo = CalculationRepository(excel_directory=str(tmp_excel_dir), max_workers=1)

    meta = repo.metadata["M01"]
    out = repo._evaluate_measure("M01", meta, {})
    assert out["measure_id"] == "M01"
    assert "error" in out
    assert "boom" in out["error"]


def test_apply_scale_mappings_maps_cost_time_and_thg(repo: CalculationRepository):
    # Build results list like calculate_all_measures would return (before mapping)
    results = [
        {
            "measure_id": "M01",
            "raw_results": {
                "zeitaufwand": {"scale": "III", "werte": 12},
                "direkte_kosten_(€)": {"scale": "günstig", "werte": 10000},
                "jährliche_thg_emissionen_in_kgco2e": {"scale": "ignored", "werte": 10.0},
            },
        },
        {
            "measure_id": "M02",
            "raw_results": {
                "zeitaufwand": {"scale": "I", "werte": 5},
                "direkte_kosten_(€)": {"scale": "sehr kostenintensiv", "werte": 99999},
                "jährliche_thg_emissionen_in_kgco2e": {"scale": "ignored", "werte": 100.0},
            },
        },
    ]

    mapped = repo._apply_scale_mappings(results)

    m1 = mapped[0]["raw_results"]
    m2 = mapped[1]["raw_results"]

    assert m1["zeitaufwand"]["scale"] == 3
    assert m2["zeitaufwand"]["scale"] == 1

    assert m1["direkte_kosten_(€)"]["scale"] == 1
    assert m2["direkte_kosten_(€)"]["scale"] == 4

    # THG mapping should map to 1..5 (percentile-based) for numeric werte
    assert 1 <= m1["jährliche_thg_emissionen_in_kgco2e"]["scale"] <= 5
    assert 1 <= m2["jährliche_thg_emissionen_in_kgco2e"]["scale"] <= 5


def test_thg_mapping_helpers_cover_empty_single_and_percentile():
    assert _build_thg_mapping([])["method"] == "empty"
    assert _build_thg_mapping([10.0])["method"] == "single_value"

    mapping = _build_thg_mapping([1.0, 2.0, 3.0, 4.0, 5.0])
    assert mapping["method"] == "percentile"
    s = _map_thg_scale(1.0, mapping)
    assert s in {1, 2, 3, 4, 5}
