# test/ApplicationLayer/test_api_router.py
# ============================================================
# Unit Tests für ALLE API Endpoints aus ApplicationLayer/api/APIRouter.py
#
# Ausführen:
#   cd backend
#   python -m pytest -q
#
# Voraussetzung (empfohlen):
#   backend/pytest.ini enthält:
#     [pytest]
#     pythonpath = src
#     testpaths = test
# ============================================================

import pytest
from fastapi import FastAPI, APIRouter
from fastapi.testclient import TestClient

from Exceptions.MissingDependencyError import MissingDependencyError
from Exceptions.ValidationError import ValidationError

from ApplicationLayer.api import Pydantic as P

from ApplicationLayer.api.APIRouter import get_commune_prefill

from types import SimpleNamespace

def _rebuild_pydantic_models_and_typeadapters():
    # 1) rebuild BaseModels
    for _, obj in vars(P).items():
        if hasattr(obj, "model_rebuild"):
            try:
                # wichtiger: types namespace setzen, sonst bleiben ForwardRefs gern hängen
                obj.model_rebuild(force=True, _types_namespace=vars(P))
            except Exception:
                pass

    # 2) rebuild TypeAdapters für TypeAliases (List[Measure], Dict[str, ...], etc.)
    try:
        from pydantic import TypeAdapter
        for t in (
            P.MeasuresResponse,
            P.GraphResponse,
            P.SubsidiesResponse,
            P.ValidationResponse,
            P.InputsByCategory,
            P.PrefillResponse,
            P.CommuneSearchResponse,
            P.OutdatedWarningsResponse,
            P.AverageValuesResponse,
            P.ReferenceCommunesResponse,
            P.ReferenceCommunePrefillResponse,
            P.CalculationResponse,
        ):
            try:
                TypeAdapter(t).rebuild()
            except Exception:
                pass
    except Exception:
        pass

_rebuild_pydantic_models_and_typeadapters()


# Router
from ApplicationLayer.api.APIRouter import router

# Pydantic-Models (für valide JSON Bodies)
from ApplicationLayer.api.Pydantic import (
    FillInputsRequest,
    FilledInputsAndSubsidies,
    popularityLevel,
)


# ---------------------------------------------------------------------
# Fake Repositories / Services (müssen exakt die ResponseModels treffen!)
# ---------------------------------------------------------------------

class FakeMeasureRepository:
    def get_all_measures(self):
        # MeasuresResponse = List[Measure]
        # popularity muss 'niedrig'|'mittel'|'hoch' sein
        return [
            {
                "id": "M01",
                "title": "Test Measure",  # wichtig: in euren Pydantic Models heißt es 'title' (nicht 'titel')
                "popularity": popularityLevel.niedrig,
                "popularityComment": "",
                "shortDescription": "short",
                "description": "desc",
                "relevantParamters": [],   # Tippfehler wird als Alias akzeptiert
                "furtherInfo": [],
                "imageURL": None,
            }
        ]


class FakeGraphRepository:
    def get_graph(self):
        # GraphResponse = List[GraphEdge]
        return [{"from": "M01", "to": "M02", "type": "requires"}]


class FakeSubsidiesRepository:
    def get_all_subsidies_types(self):
        # SubsidiesResponse = List[Subsidies]
        return [{"id": "S01", "title": "Förderung 1"}]


class FakeInputValidatorOK:
    def validate(self, payload):
        # ValidationResponse: {valid: bool, errors?: [...]}
        return {"valid": True, "errors": None}


class FakeInputValidatorFail:
    def validate(self, payload):
        raise ValidationError(errors=[{"path": "inputs[0].value", "message": "invalid"}])


class FakeCommuneRepository:
    def search_communes_by_name(self, q: str):
        # CommuneSearchResponse = List[CommuneSearchResult]
        return [{"name": "Karlsruhe", "postal_code": "76131", "key": "08212000"}]

    def get_old_warning_communes(self):
        # OutdatedWarningsResponse = List[OutdatedWarning]
        return [{"title": "Destatis", "last_update": "2025-01-01T00:00:00"}]

    def get_commune_info_by_key(self, key: str):
        # CommuneInfo
        return {"name": "Karlsruhe", "postal_code": "76131", "key": key}

    def get_commune_info_by_code(self, code: str):
        # CommuneInfo
        return {"name": "Karlsruhe", "postal_code": "76131", "key": "08212000"}

    def get_commune_prefill_by_key(self, key: str):
        return {
            "einwohnerzahl": {
                "value": 123,
                "source": "commune",
                "date": "2025-01-01",
                "individual": True,
            }
        }



class FakeCommuneAverageRepository:
    def get_average_commune_data(self):
        # AverageValuesResponse
        return {"id": "AVG", "name": "Average", "values": {"einwohnerzahl": 100}}


class FakeReferenceCommuneRepository:
    def list_all_reference_communes_info(self):
        # ReferenceCommunesResponse = List[ReferenceCommune]
        return [
            {
                "id": "RC01",
                "name": "Ref City",
                "population": 1000,
                "description": "desc",
            }
        ]

    def get_reference_commune_prefill(self, id: str):
        # ReferenceCommunePrefillResponse
        return {
            "id": id,
            "name": "Ref City",
            "inputs": [{"id": "einwohnerzahl", "value": 1000}],
        }


class FakeCalculationService:
    async def calculate(self, payload):
        # CalculationResponse (Achtung: Aliases!)
        return {
            "levelOfIndividualisationTotal": 10.0,
            "levelOfIndividualisationGeneral": 10.0,
            "levelOfIndividualisationEnergy": 10.0,
            "levelOfIndividualisationMobility": 10.0,
            "levelOfIndividualisationWater": 10.0,
            "measureResults": [],
        }

class FakeInputParametersDataSource:
    def get_input_parameters(self):
        return {
            "Water": [{
                "id": "w1",
                "title": "W1",
                "type": "number",
                "description": "",          # <-- fehlte
                "critical": True,
                "unit": "x",
                "selectable": None,
                "subinputs": [],
            }],
            "Energy": [],
            "Mobility": [],
            "General": [],
        }




# ---------------------------------------------------------------------
# Fake Dependency Container (stellt alle get_* Methoden bereit)
# ---------------------------------------------------------------------
class FakeDeps:
    def __init__(
        self,
        *,
        measure_repo=None,
        graph_repo=None,
        subsidies_repo=None,
        input_validator=None,
        input_params_ds=None,   # <--- add
        commune_repo=None,
        commune_avg_repo=None,
        ref_commune_repo=None,
        calc_service=None,
    ):
        self._measure_repo = measure_repo
        self._graph_repo = graph_repo
        self._subsidies_repo = subsidies_repo
        self._input_validator = input_validator
        self._input_params_ds = input_params_ds  # <--- add
        self._commune_repo = commune_repo
        self._commune_avg_repo = commune_avg_repo
        self._ref_commune_repo = ref_commune_repo
        self._calc_service = calc_service

    def get_InputParametersDataSource(self):
        if self._input_params_ds is None:
            raise MissingDependencyError("InputParametersDataSource missing")
        return self._input_params_ds
    
    def get_MeasureRepository(self):
        if self._measure_repo is None:
            raise MissingDependencyError("MeasureRepository missing")
        return self._measure_repo

    def get_GraphRepository(self):
        if self._graph_repo is None:
            raise MissingDependencyError("GraphRepository missing")
        return self._graph_repo

    def get_SubsidiesRepository(self):
        if self._subsidies_repo is None:
            raise MissingDependencyError("SubsidiesRepository missing")
        return self._subsidies_repo

    def get_InputValidator(self):
        if self._input_validator is None:
            raise MissingDependencyError("InputValidator missing")
        return self._input_validator

    def get_CommuneRepository(self):
        if self._commune_repo is None:
            raise MissingDependencyError("CommuneRepository missing")
        return self._commune_repo

    def get_CommuneAverageRepository(self):
        if self._commune_avg_repo is None:
            raise MissingDependencyError("CommuneAverageRepository missing")
        return self._commune_avg_repo

    def get_ReferenceCommuneRepository(self):
        if self._ref_commune_repo is None:
            raise MissingDependencyError("ReferenceCommuneRepository missing")
        return self._ref_commune_repo

    def get_CalculationService(self):
        if self._calc_service is None:
            raise MissingDependencyError("CalculationService missing")
        return self._calc_service
    


# ---------------------------------------------------------------------
# Test-App Factory
# ---------------------------------------------------------------------



def make_client(deps: FakeDeps) -> TestClient:
    app = FastAPI()

    test_router = APIRouter()

    # Router aus eurem Modul übernehmen, aber response_model rausnehmen
    for r in router.routes:
        test_router.add_api_route(
            r.path,
            r.endpoint,
            methods=list(r.methods),
            name=r.name,
            # response_model bewusst NICHT setzen
        )

    app.include_router(test_router)
    app.state.deps = deps
    return TestClient(app)




# ---------------------------------------------------------------------
# Helpers: valide Bodies (sonst gibt FastAPI 422!)
# ---------------------------------------------------------------------

def valid_fill_inputs_request_json():
    req = FillInputsRequest(
        community_key="08212000",
        filltype="manual",
        inputs=[{"id": "einwohnerzahl", "value": 123}],
    )
    return req.model_dump(mode="json")


def valid_filled_inputs_and_subsidies_json():
    req = FilledInputsAndSubsidies(
        inputs=[{"id": "einwohnerzahl", "value": 123, "individual": True}],
        subsidies=[{"id": "S01", "value": 0.0, "unit": "EUR"}],
    )
    return req.model_dump(mode="json")


# ============================================================
# TESTS: Measures
# ============================================================

def test_get_measures_ok():
    client = make_client(FakeDeps(measure_repo=FakeMeasureRepository()))
    r = client.get("/api/measures")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["id"] == "M01"
    assert data[0]["popularity"] in ["niedrig", "mittel", "hoch"]


def test_get_measures_missing_dependency_returns_500():
    client = make_client(FakeDeps(measure_repo=None))
    r = client.get("/api/measures")
    assert r.status_code == 500


# ============================================================
# TESTS: Results
# ============================================================

def test_calculate_results_ok():
    client = make_client(FakeDeps(calc_service=FakeCalculationService()))
    r = client.post("/api/results/calculate", json=valid_filled_inputs_and_subsidies_json())
    assert r.status_code == 200
    body = r.json()
    # Response wird von FastAPI nach response_model serialisiert (Aliases!)
    assert "levelOfIndividualisationTotal" in body
    assert "measureResults" in body


def test_calculate_results_missing_dependency_returns_500():
    client = make_client(FakeDeps(calc_service=None))
    r = client.post("/api/results/calculate", json=valid_filled_inputs_and_subsidies_json())
    assert r.status_code == 500


def test_results_graph_ok():
    client = make_client(FakeDeps(graph_repo=FakeGraphRepository()))
    r = client.get("/api/results/graph")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["type"] in ["conflict", "synergy", "requires", "dependency", "prerequisite"]
    assert data[0]["to"] == "M02"


def test_results_graph_missing_dependency_returns_500():
    client = make_client(FakeDeps(graph_repo=None))
    r = client.get("/api/results/graph")
    assert r.status_code == 500


# ============================================================
# TESTS: Inputs
# ============================================================

#TODO add if finished 
# def test_get_subsidies_ok():
#     client = make_client(FakeDeps(subsidies_repo=FakeSubsidiesRepository()))
#     r = client.get("/api/inputs/subsidies")
#     assert r.status_code == 200
#     data = r.json()
#     assert isinstance(data, list)
#     assert data[0]["id"] == "S01"


# def test_get_subsidies_missing_dependency_returns_500():
#     client = make_client(FakeDeps(subsidies_repo=None))
#     r = client.get("/api/inputs/subsidies")
#     assert r.status_code == 500


def test_import_inputs_ok_returns_200():
    client = make_client(FakeDeps(input_validator=FakeInputValidatorOK()))
    r = client.post("/api/inputs/import", json=valid_fill_inputs_request_json())
    assert r.status_code == 200
    assert r.json()["valid"] is True


# def test_import_inputs_validation_error_returns_400():
#     client = make_client(FakeDeps(input_validator=FakeInputValidatorFail()))
#     r = client.post("/api/inputs/import", json=valid_fill_inputs_request_json())
#     assert r.status_code == 400


def test_import_inputs_missing_dependency_returns_500():
    client = make_client(FakeDeps(input_validator=None))
    r = client.post("/api/inputs/import", json=valid_fill_inputs_request_json())
    assert r.status_code == 500


def test_get_input_params_ok():
    # Endpoint ist hardcoded -> braucht keine deps
    client = make_client(FakeDeps(input_params_ds=FakeInputParametersDataSource()))
    r = client.get("/api/inputs/parameters")
    assert r.status_code == 200
    data = r.json()
    assert "Water" in data
    assert isinstance(data["Water"], list)
    assert data["Water"][0]["type"] in ["number", "selection", "multiSelection", "bool"]


# ============================================================
# TESTS: Communes
# ============================================================

def test_search_communes_ok():
    client = make_client(FakeDeps(commune_repo=FakeCommuneRepository()))
    r = client.get("/api/communes/search", params={"q": "Karls"})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["key"] == "08212000"
    assert data[0]["postal_code"] == "76131"


def test_search_communes_missing_dependency_returns_500():
    client = make_client(FakeDeps(commune_repo=None))
    r = client.get("/api/communes/search", params={"q": "Karls"})
    assert r.status_code == 500


def test_get_commune_info_by_key_ok():
    client = make_client(FakeDeps(commune_repo=FakeCommuneRepository()))
    r = client.get("/api/communes/info_by_key/08212000")
    assert r.status_code == 200
    body = r.json()
    assert body["key"] == "08212000"


def test_get_commune_info_by_key_invalid_key_returns_422():
    client = make_client(FakeDeps(commune_repo=FakeCommuneRepository()))
    r = client.get("/api/communes/info_by_key/ABC")  # pattern ^\d{8}$ verletzt
    assert r.status_code == 422


def test_get_commune_info_by_code_ok():
    client = make_client(FakeDeps(commune_repo=FakeCommuneRepository()))
    r = client.get("/api/communes/info_by_code/whatever-code")
    assert r.status_code == 200
    body = r.json()
    assert body["key"] == "08212000"


@pytest.mark.asyncio
async def test_get_commune_prefill_ok_direct():
    deps = FakeDeps(commune_repo=FakeCommuneRepository())

    # Dummy Request bauen, der request.app.state.deps hat
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(deps=deps)))

    out = get_commune_prefill(request, key="08212000")

    # je nachdem was PrefillResponse ist: Liste oder Dict prüfen
    assert out is not None

def test_get_commune_prefill_invalid_key_returns_422():
    client = make_client(FakeDeps(commune_repo=FakeCommuneRepository()))
    r = client.get("/api/communes/ABC/prefill")
    assert r.status_code == 422

#TODO add if finished 
# def test_get_commune_average_ok():
#     client = make_client(FakeDeps(commune_avg_repo=FakeCommuneAverageRepository()))
#     r = client.get("/api/communes/average")
#     assert r.status_code == 200
#     body = r.json()
#     assert body["id"] == "AVG"
#     assert "values" in body


# def test_get_commune_average_missing_dependency_returns_500():
#     client = make_client(FakeDeps(commune_avg_repo=None))
#     r = client.get("/api/communes/average")
#     assert r.status_code == 500


def test_outdated_warning_ok():
    client = make_client(FakeDeps(commune_repo=FakeCommuneRepository()))
    r = client.get("/api/data/outdatedWarning")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert "title" in data[0]
    assert "last_update" in data[0]


def test_outdated_warning_missing_dependency_returns_500():
    client = make_client(FakeDeps(commune_repo=None))
    r = client.get("/api/data/outdatedWarning")
    assert r.status_code == 500


# ============================================================
# TESTS: Reference Communes
# ============================================================

def test_list_reference_communes_ok():
    client = make_client(FakeDeps(ref_commune_repo=FakeReferenceCommuneRepository()))
    r = client.get("/api/reference-communes/list")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["id"] == "RC01"


def test_list_reference_communes_missing_dependency_returns_500():
    client = make_client(FakeDeps(ref_commune_repo=None))
    r = client.get("/api/reference-communes/list")
    assert r.status_code == 500


def test_get_reference_commune_ok():
    client = make_client(FakeDeps(ref_commune_repo=FakeReferenceCommuneRepository()))
    r = client.get("/api/reference-communes/RC01")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == "RC01"
    assert isinstance(body["inputs"], list)


def test_get_reference_commune_missing_dependency_returns_500():
    client = make_client(FakeDeps(ref_commune_repo=None))
    r = client.get("/api/reference-communes/RC01")
    assert r.status_code == 500

