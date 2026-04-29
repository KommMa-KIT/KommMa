# test/ApplicationLayer/test_calculation_service.py

import pytest
from pydantic import BaseModel

from ApplicationLayer.CalculationApi.CalculationService import CalculationService


# ------------------------------------------------------------
# Fake Engine(s)
# ------------------------------------------------------------

class FakeEngineSync:
    def __init__(self, result):
        self.result = result
        self.last_payload = None

    def calculate(self, payload):
        self.last_payload = payload
        return self.result


class FakeEngineAsync:
    def __init__(self, result):
        self.result = result
        self.last_payload = None

    async def calculate(self, payload):
        self.last_payload = payload
        return self.result


# ------------------------------------------------------------
# Helper: simple Pydantic input model (wie FilledInputsAndSubsidies)
# ------------------------------------------------------------

class PydInput(BaseModel):
    inputs: list[dict]
    subsidies: list[dict] = []


# ------------------------------------------------------------
# Fixtures / helper data
# ------------------------------------------------------------

@pytest.fixture
def definition():
    # Kategorien-Definition wie /api/inputs/parameters:
    # id_to_category Index wird daraus gebaut
    return {
        "Wasser": [
            {"id": "w1", "subinputs": [{"id": "w1_sub"}]},
        ],
        "Energie": [
            {"id": "e1", "subinputs": []},
        ],
        "Mobilität": [
            {"id": "m1", "subinputs": []},
        ],
        "Allgemein": [
            {"id": "g1", "subinputs": []},
        ],
    }


# ============================================================
# Tests: _to_dict
# ============================================================

def test_to_dict_accepts_dict(definition):
    svc = CalculationService(engine=FakeEngineSync({}), definition=definition)
    d = {"inputs": [], "subsidies": []}
    assert svc._to_dict(d) == d


def test_to_dict_accepts_pydantic_v2_model(definition):
    svc = CalculationService(engine=FakeEngineSync({}), definition=definition)
    obj = PydInput(inputs=[{"id": "w1", "value": 1, "individual": True}], subsidies=[])
    out = svc._to_dict(obj)
    assert isinstance(out, dict)
    assert out["inputs"][0]["id"] == "w1"


def test_to_dict_rejects_unknown_type(definition):
    svc = CalculationService(engine=FakeEngineSync({}), definition=definition)
    with pytest.raises(TypeError):
        svc._to_dict(object())


# ============================================================
# Tests: _is_true
# ============================================================

@pytest.mark.parametrize(
    "value, expected",
    [
        (True, True),
        (False, False),
        ("true", True),
        ("TRUE", True),
        (" false ", False),
        (1, True),
        (0, False),
        (2, True),
        (0.0, False),
        (0.1, True),
        (None, False),
        ("yes", False),  # nur "true" gilt bei strings
    ],
)
def test_is_true_variants(value, expected, definition):
    svc = CalculationService(engine=FakeEngineSync({}), definition=definition)
    assert svc._is_true(value) is expected


# ============================================================
# Tests: calculate_individualisation_levels
# ============================================================

def test_individualisation_levels_counts_per_category(definition):
    svc = CalculationService(engine=FakeEngineSync({}), definition=definition)

    payload = {
        "inputs": [
            {"id": "w1", "individual": True},
            {"id": "w1_sub", "individual": "true"},   # subinput zählt zur selben Kategorie (Wasser)
            {"id": "e1", "individual": 1},
            {"id": "m1", "individual": 0},
            {"id": "g1", "individual": False},
            {"id": "unknown", "individual": True},   # ignoriert (nicht in definition)
        ]
    }

    levels = svc.calculate_individualisation_levels(payload)

    # total: gezählt werden nur ids mit Kategorie: w1, w1_sub, e1, m1, g1 => 5
    # true: w1, w1_sub, e1 => 3
    assert levels["total"] == round(3 / 5, 2)

    # Wasser: 2/2 true
    assert levels["Wasser"] == 1.0

    # Energie: 1/1 true
    assert levels["Energie"] == 1.0

    # Mobilität: 0/1 true
    assert levels["Mobilität"] == 0.0

    # Allgemein: 0/1 true
    assert levels["Allgemein"] == 0.0


def test_individualisation_levels_empty_inputs(definition):
    svc = CalculationService(engine=FakeEngineSync({}), definition=definition)

    levels = svc.calculate_individualisation_levels({"inputs": []})
    assert levels["total"] == 0.0
    assert levels["Wasser"] == 0.0
    assert levels["Energie"] == 0.0
    assert levels["Mobilität"] == 0.0
    assert levels["Allgemein"] == 0.0


# ============================================================
# Tests: transform_output_format
# ============================================================

def test_transform_output_format_maps_ongoing_emission_savings(definition):
    svc = CalculationService(engine=FakeEngineSync({}), definition=definition)

    engine_result = {
        "measureResults": [
            {"measureId": "M01", "ongoingEmissionSavingsNBisko": 123},
            {"measureId": "M02", "ongoingEmissionSavingsBisko": 456},
            {"measureId": "M03", "ongoingEmissionSavings": 789},
        ]
    }
    indiv = {"total": 0.5, "Wasser": 1.0, "Energie": 0.0, "Mobilität": 0.0, "Allgemein": 0.0}

    out = svc.transform_output_format(engine_result, indiv)

    assert out["levelOfIndividualisationTotal"] == 0.5
    assert out["levelOfIndividualisationWater"] == 1.0
    assert isinstance(out["measureResults"], list)

    m1 = out["measureResults"][0]
    assert m1["ongoingEmissionSavings"] == 123
    assert "ongoingEmissionSavingsNBisko" not in m1
    assert "ongoingEmissionSavingsBisko" not in m1

    m2 = out["measureResults"][1]
    assert m2["ongoingEmissionSavings"] == 456

    m3 = out["measureResults"][2]
    assert m3["ongoingEmissionSavings"] == 789


def test_transform_output_format_ignores_non_dict_measures(definition):
    svc = CalculationService(engine=FakeEngineSync({}), definition=definition)

    engine_result = {"measureResults": [{"measureId": "M01"}, "bad", 123, None]}
    indiv = {"total": 0.0, "Wasser": 0.0, "Energie": 0.0, "Mobilität": 0.0, "Allgemein": 0.0}

    out = svc.transform_output_format(engine_result, indiv)
    assert len(out["measureResults"]) == 1
    assert out["measureResults"][0]["measureId"] == "M01"


# ============================================================
# Tests: calculate() end-to-end (sync & async engine)
# ============================================================

@pytest.mark.asyncio
async def test_calculate_calls_engine_with_dict_and_transforms_sync_engine(definition):
    engine_result = {"measureResults": [{"measureId": "M01", "ongoingEmissionSavingsNBisko": 1}]}
    engine = FakeEngineSync(engine_result)
    svc = CalculationService(engine=engine, definition=definition)

    input_obj = PydInput(
        inputs=[
            {"id": "w1", "value": 1, "individual": True},
            {"id": "e1", "value": 2, "individual": False},
        ],
        subsidies=[],
    )

    out = await svc.calculate(input_obj)

    # engine bekam dict, nicht pydantic
    assert isinstance(engine.last_payload, dict)
    assert engine.last_payload["inputs"][0]["id"] == "w1"

    # individualisation: total true = 1 / total counted = 2
    assert out["levelOfIndividualisationTotal"] == round(1 / 2, 2)

    # transformed output
    assert out["measureResults"][0]["ongoingEmissionSavings"] == 1
    assert "ongoingEmissionSavingsNBisko" not in out["measureResults"][0]


@pytest.mark.asyncio
async def test_calculate_awaits_async_engine(definition):
    engine_result = {"measureResults": [{"measureId": "M01", "ongoingEmissionSavingsBisko": 2}]}
    engine = FakeEngineAsync(engine_result)
    svc = CalculationService(engine=engine, definition=definition)

    input_dict = {
        "inputs": [{"id": "w1", "value": 1, "individual": "true"}],
        "subsidies": [],
    }

    out = await svc.calculate(input_dict)
    assert out["measureResults"][0]["ongoingEmissionSavings"] == 2
    assert out["levelOfIndividualisationWater"] == 1.0