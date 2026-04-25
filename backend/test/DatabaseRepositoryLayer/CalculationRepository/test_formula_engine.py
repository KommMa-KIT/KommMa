import types
from pathlib import Path

import pytest

# ✅ Passe den Import an deinen echten Pfad an:
from DatabaseRepositoryLayer.CalculationRepository.engine.formulaEngine import (
    FormulaEngine,
    _model_key,
    _bare_ref,
    _get_output,
)


# ----------------------------
# Small fakes
# ----------------------------

class FakeSheet:
    def __init__(self, title: str):
        self.title = title


class FakeWB:
    def __init__(self, titles):
        self.worksheets = [FakeSheet(t) for t in titles]


class FakeExcelModel:
    """
    Mimics: formulas.ExcelModel().loads(path).finish()
    plus calculate(inputs, outputs)
    """
    def __init__(self, outputs=None):
        self._outputs = outputs or {}
        self.loaded_path = None
        self.finished = False
        self.last_inputs = None
        self.last_requested = None

    def loads(self, path: str):
        self.loaded_path = path
        return self

    def finish(self):
        self.finished = True
        return self

    def calculate(self, inputs, _):
        self.last_inputs = dict(inputs)
        return dict(self._outputs)


# ----------------------------
# Fixtures
# ----------------------------

@pytest.fixture
def excel_dir(tmp_path: Path):
    # create a fake dir
    return tmp_path


@pytest.fixture
def engine(excel_dir: Path):
    return FormulaEngine(excel_dir)


# ----------------------------
# Tests: build_all
# ----------------------------

def test_build_all_raises_if_no_xlsx(engine, excel_dir: Path):
    with pytest.raises(ValueError):
        engine.build_all()


def test_build_all_calls_build_model_for_each_file(engine, excel_dir: Path, monkeypatch):
    # create two fake xlsx
    (excel_dir / "A.xlsx").write_bytes(b"x")
    (excel_dir / "B.xlsx").write_bytes(b"x")
    (excel_dir / "~$tmp.xlsx").write_bytes(b"x")  # should be ignored

    calls = []

    def fake_build_model(p: Path):
        calls.append(p.name)

    monkeypatch.setattr(engine, "_build_model", fake_build_model)

    engine.build_all()

    assert set(calls) == {"A.xlsx", "B.xlsx"}


# ----------------------------
# Tests: _build_model
# ----------------------------

def test_build_model_registers_model_and_cleans_tmpdir(engine, excel_dir: Path, monkeypatch, tmp_path: Path):
    xlsx = excel_dir / "ID20106.xlsx"
    xlsx.write_bytes(b"x")

    # resolver returns a temp copy in a temp dir
    temp_dir = tmp_path / "resolver_tmp"
    temp_dir.mkdir()
    resolved_path = temp_dir / "ID20106.xlsx"
    resolved_path.write_bytes(b"x")

    # patch resolver + formulas.ExcelModel + shutil.rmtree
    from DatabaseRepositoryLayer.CalculationRepository.engine import formulaEngine as mod

    monkeypatch.setattr(mod, "resolve_structured_references", lambda p: resolved_path)

    fake_model = FakeExcelModel()
    monkeypatch.setattr(mod.formulas, "ExcelModel", lambda: fake_model)

    deleted = []
    monkeypatch.setattr(mod.shutil, "rmtree", lambda p, ignore_errors=True: deleted.append(Path(p)))

    engine._build_model(xlsx)

    assert engine.has_model("ID20106.xlsx") is True
    assert fake_model.loaded_path == str(resolved_path)
    assert fake_model.finished is True
    assert deleted == [temp_dir]


def test_build_model_failure_does_not_raise(engine, excel_dir: Path, monkeypatch):
    xlsx = excel_dir / "BAD.xlsx"
    xlsx.write_bytes(b"x")

    from DatabaseRepositoryLayer.CalculationRepository.engine import formulaEngine as mod

    monkeypatch.setattr(mod, "resolve_structured_references", lambda p: p)

    # make formulas explode
    class Boom:
        def loads(self, path): raise RuntimeError("boom")

    monkeypatch.setattr(mod.formulas, "ExcelModel", lambda: Boom())

    # should not raise
    engine._build_model(xlsx)
    assert engine.has_model("BAD.xlsx") is False


# ----------------------------
# Tests: evaluate
# ----------------------------

def test_evaluate_injects_inputs_and_collects_results(engine, excel_dir: Path, monkeypatch):
    # Create dummy file (only used for path building)
    (excel_dir / "ID20106.xlsx").write_bytes(b"x")

    # Register a fake model in engine
    outputs = {
        "'[ID20106.xlsx]DATASHEET'!F6": 999,  # irrelevant - just to show map
        "'[ID20106.xlsx]RESULTSHEET'!F6": 123,  # werte
        "'[ID20106.xlsx]RESULTSHEET'!F8": "II",  # kategorie / scale
    }
    model = FakeExcelModel(outputs=outputs)
    engine._models["ID20106.xlsx"] = model

    # patch workbook opener to control sheet names
    from DatabaseRepositoryLayer.CalculationRepository.engine import formulaEngine as mod
    monkeypatch.setattr(mod, "_open_workbook", lambda p: FakeWB(["S0", "S1", "DataSheet", "S3", "S4", "S5", "ResultSheet"]))

    data_city_mapping = {
        "fallhöhe": "F6",
        "ignored_param": "F7",
    }
    filtered_inputs = {
        "fallhöhe": 42,
        # ignored_param absent => not injected
    }
    result_mapping = {
        "direkte_kosten": {"werte": "F6", "kategorie": "F8"},
    }

    res = engine.evaluate(
        xlsx_filename="ID20106.xlsx",
        data_city_mapping=data_city_mapping,
        filtered_inputs=filtered_inputs,
        result_mapping=result_mapping,
        data_sheet_index=2,
        result_sheet_index=6,
    )

    # Inputs injected with proper key format
    expected_input_key = "'[ID20106.xlsx]DATASHEET'!F6"
    assert model.last_inputs == {expected_input_key: 42}

    # Result collected
    assert res == {
        "direkte_kosten": {"werte": 123, "scale": "II"}
    }


def test_evaluate_raises_if_no_model(engine, monkeypatch):
    from DatabaseRepositoryLayer.CalculationRepository.engine import formulaEngine as mod
    monkeypatch.setattr(mod, "_open_workbook", lambda p: FakeWB(["DataSheet", "ResultSheet"]))

    with pytest.raises(RuntimeError):
        engine.evaluate(
            xlsx_filename="MISSING.xlsx",
            data_city_mapping={},
            filtered_inputs={},
            result_mapping={},
        )


def test_evaluate_wraps_formulas_exception(engine, excel_dir: Path, monkeypatch):
    (excel_dir / "ID20106.xlsx").write_bytes(b"x")

    class BadModel(FakeExcelModel):
        def calculate(self, inputs, _):
            raise ValueError("calc failed")

    engine._models["ID20106.xlsx"] = BadModel()

    from DatabaseRepositoryLayer.CalculationRepository.engine import formulaEngine as mod
    monkeypatch.setattr(mod, "_open_workbook", lambda p: FakeWB(["S0", "S1", "DataSheet", "S3", "S4", "S5", "ResultSheet"]))

    with pytest.raises(RuntimeError) as e:
        engine.evaluate(
            xlsx_filename="ID20106.xlsx",
            data_city_mapping={"x": "F6"},
            filtered_inputs={"x": 1},
            result_mapping={"r": {"werte": "F6", "kategorie": "F8"}},
            data_sheet_index=2,
            result_sheet_index=6,
        )
    assert "formulas evaluation failed" in str(e.value)


# ----------------------------
# Tests: helper functions
# ----------------------------

def test_bare_ref_strips_dollars_and_uppercasing():
    assert _bare_ref("$e$6") == "E6"
    assert _bare_ref("aa10") == "AA10"


def test_model_key_format():
    assert _model_key("ID.xlsx", "My Sheet", "$f$6") == "'[ID.xlsx]MY SHEET'!F6"


def test_get_output_scalar_and_missing():
    assert _get_output({"K": 5}, "K") == 5
    assert _get_output({}, "K") is None

