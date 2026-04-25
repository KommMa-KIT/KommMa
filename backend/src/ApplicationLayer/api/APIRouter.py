"""
APIRouter: Public REST API Endpoints

This module defines the application's HTTP endpoints (FastAPI router).

Architecture / Dependencies
---------------------------
- Business logic lives in services/repositories, accessed via `request.app.state.deps`.
- `deps` is a dependency container (e.g., created by `build_dependencies()`), providing factory methods
  such as `get_MeasureRepository()`, `get_CalculationService()`, etc.
- If a dependency is missing or misconfigured, a `MissingDependencyError` is raised.
  This is translated here into an `HTTPException(500)`.

Error Handling (Convention)
---------------------------
- 500: Missing dependency / internal setup issue
- 400: Validation error during input import or calculation (if explicitly caught)

Note
----
- Some endpoints are currently prototype/hardcoded (e.g., `/api/inputs/parameters`) and are intended
  to be backed by a proper data source later.

"""

from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Request, Query, Path, HTTPException
from Exceptions.MissingDependencyError import MissingDependencyError
from Exceptions.ValidationError import ValidationError

from .Pydantic import (
    ErrorResponse,
    AverageValuesResponse,
    GraphResponse,
    MeasuresResponse,
    InputsByCategory,
    OutdatedWarningsResponse,
    FillInputsRequest,
    SubsidiesResponse,
    CommuneSearchResponse,
    PrefillResponse,
    CommuneInfo,
    ReferenceCommunesResponse,
    ReferenceCommunePrefillResponse,
    FilledInputsAndSubsidies,
    CalculationResponse,
    ValidationResponse,
)

CommuneKey = Annotated[str, Path(..., pattern=r"^\d{8}$")]
reference_commune_id = Annotated[str, Path(..., description="Reference commune ID")]
commune_info_key = Annotated[str, Path(..., pattern=r"^\d{8}$", description="Commune key (exactly 8 digits)")]
search_communes_query = Annotated[str, Query(..., description="Search term")]
commune_info_path =  Annotated[str, Path(..., description="Commune code")]


router = APIRouter()

# Standardized response metadata for Swagger/OpenAPI.
MISSING_DEP_RESPONSES = {
    500: {"model": ErrorResponse, "description": "Missing dependency / internal setup error"},
}

VALIDATION_ERROR_RESPONSES = {
    400: {"model": ValidationResponse, "description": "Validation Error"},
}

# -------------------------
# Measures
# -------------------------
@router.get(
    "/api/measures",
    response_model=MeasuresResponse,
    responses=MISSING_DEP_RESPONSES,
)
def get_measures(request: Request) -> MeasuresResponse:
    """
    GET /api/measures

    Purpose
    -------
    Returns the measures catalog (all available measures).

    Response
    --------
    - 200: MeasuresResponse
    - 500: ErrorResponse (if dependencies/setup are missing)

    Internal Dependencies
    ---------------------
    - deps.get_MeasureRepository().get_all_measures()
    """
    deps = request.app.state.deps
    try:
        return deps.get_MeasureRepository().get_all_measures()
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------
# Results
# -------------------------
@router.post(
    "/api/results/calculate",
    response_model=CalculationResponse,
    responses={**MISSING_DEP_RESPONSES, **VALIDATION_ERROR_RESPONSES},
)
async def calculate_results(request: Request, payload: FilledInputsAndSubsidies) -> CalculationResponse:
    """
    POST /api/results/calculate

    Purpose
    -------
    Executes the calculation for the selected measures.

    Request Body
    ------------
    - FilledInputsAndSubsidies:
      Contains the filled inputs and (optionally) the selected subsidies.

    Response
    --------
    - 200: CalculationResponse (calculation result incl. scores/outputs)
    - 400: ValidationResponse (validation error, if the service layer validates and raises)
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_CalculationService().calculate(payload)

    Note
    ----
    - Currently only MissingDependencyError is caught.
      If `calculate()` raises a ValidationError, it should also be translated to HTTP 400.
    """
    deps = request.app.state.deps
    try:
        return await deps.get_CalculationService().calculate(payload)
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))
    # Optional (useful if CalculationService validates and raises ValidationError):
    # except ValidationError as ve:
    #     raise HTTPException(status_code=400, detail=str(ve.errors))

@router.get(
    "/api/results/graph",
    response_model=GraphResponse,
    responses=MISSING_DEP_RESPONSES,
)
def get_results_graph(request: Request) -> GraphResponse:
    """
    GET /api/results/graph

    Purpose
    -------
    Returns a graph structure (e.g., dependencies / visualization / navigation graph).

    Response
    --------
    - 200: GraphResponse
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_GraphRepository().get_graph()

    Common Pitfall
    --------------
    - Ensure that `get_graph()` returns a structure that matches `GraphResponse`,
      otherwise response-model validation will fail.
    """
    deps = request.app.state.deps
    try:
        return deps.get_GraphRepository().get_graph()
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------
# Inputs
# -------------------------
@router.get(
    "/api/inputs/subsidies",
    response_model=SubsidiesResponse,
    responses=MISSING_DEP_RESPONSES,
)
def get_subsidies(request: Request) -> SubsidiesResponse:
    """
    GET /api/inputs/subsidies

    Purpose
    -------
    Returns all available subsidy types (for UI selection).

    Response
    --------
    - 200: SubsidiesResponse
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_SubsidiesRepository().get_all_subsidies_types()
    """
    #TODO add Real 
    return []
    # deps = request.app.state.deps
    # try:
    #     return deps.get_SubsidiesRepository().get_all_subsidies_types()
    # except MissingDependencyError as e:
    #     raise HTTPException(status_code=500, detail=str(e))

@router.post(
    "/api/inputs/import",
    response_model=ValidationResponse,
    responses={**MISSING_DEP_RESPONSES, **VALIDATION_ERROR_RESPONSES},
)
def import_inputs(request: Request, payload: FillInputsRequest) -> ValidationResponse:
    """
    POST /api/inputs/import

    Purpose
    -------
    Validates (and potentially normalizes) imported inputs (e.g., from Excel/CSV).

    Request Body
    ------------
    - FillInputsRequest: Structure containing imported/provided inputs.

    Response
    --------
    - 200: ValidationResponse (e.g., "ok", warnings, missing fields, etc.)
    - 400: ValidationResponse (validation errors)
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_InputValidator().validate(payload)

    Common Pitfall (already fixed)
    ------------------------------
    - For ValidationError, use `raise HTTPException(...)` (not `return`).
    """
    deps = request.app.state.deps
    try:
        return deps.get_InputValidator().validate(payload)
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    except ValidationError as ve:
        raise HTTPException(status_code=400, detail=str(ve.errors))

@router.get(
    "/api/inputs/parameters",
    response_model=InputsByCategory,
    responses=MISSING_DEP_RESPONSES,
)
def get_input_params(request: Request) -> InputsByCategory:
    """
    GET /api/inputs/parameters

    Purpose
    -------
    Returns input parameter definitions (id, title, type, unit, criticality),
    grouped by categories (e.g., "Water").

    Response
    --------
    - 200: InputsByCategory (mapping: category -> list[InputDefinition])
    - 500: ErrorResponse (missing dependency / setup issue) [only relevant if loaded via a DataSource]

    Status / Note
    -------------
    - Uses deps.get_InputParametersDataSource().get_input_parameters()
    """
    deps = request.app.state.deps
    try:
        return deps.get_InputParametersDataSource().get_input_parameters()
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------
# Communes
# -------------------------
@router.get(
    "/api/communes/search",
    response_model=CommuneSearchResponse,
    responses=MISSING_DEP_RESPONSES,
)

def search_communes(request: Request, q: search_communes_query) -> CommuneSearchResponse:
    """
    GET /api/communes/search?q=...

    Purpose
    -------
    Searches communes by a search term (typically name/partial string).

    Query Parameters
    ----------------
    - q (required): search term

    Response
    --------
    - 200: CommuneSearchResponse (list of matches)
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_CommuneRepository().search_communes_by_name(q)
    """
    deps = request.app.state.deps
    try:
        return deps.get_CommuneRepository().search_communes_by_name(q)
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/api/communes/info_by_key/{key}",
    response_model=CommuneInfo,
    responses=MISSING_DEP_RESPONSES,
)

def get_commune_info_by_key(request: Request, key: commune_info_key) -> CommuneInfo:
    """
    GET /api/communes/info_by_key/{key}

    Purpose
    -------
    Returns basic information about a commune using an 8-digit key.

    Path Parameters
    ---------------
    - key: exactly 8 digits (regex: ^\\d{8}$)

    Response
    --------
    - 200: CommuneInfo
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_CommuneRepository().get_commune_info_by_key(key)
    """
    deps = request.app.state.deps
    try:
        return deps.get_CommuneRepository().get_commune_info_by_key(key)
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/api/communes/info_by_code/{code}",
    response_model=CommuneInfo,
    responses=MISSING_DEP_RESPONSES,
)

def get_commune_info_by_code(request: Request, code: commune_info_path) -> CommuneInfo:
    """
    GET /api/communes/info_by_code/{code}

    Purpose
    -------
    Returns basic information about a commune using a (commune) code.

    Path Parameters
    ---------------
    - code: commune code (format not enforced; consider adding a pattern later)

    Response
    --------
    - 200: CommuneInfo
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_CommuneRepository().get_commune_info_by_code(code)
    """
    deps = request.app.state.deps
    try:
        return deps.get_CommuneRepository().get_commune_info_by_code(code)
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/api/communes/{key}/prefill",
    response_model=PrefillResponse,
    responses=MISSING_DEP_RESPONSES,
)
def get_commune_prefill(request: Request, key: CommuneKey) -> PrefillResponse:
    """
    GET /api/communes/{key}/prefill

    Purpose
    -------
    Returns prefill data (auto-fill values) for a commune.
    These values are typically used to pre-populate input fields in the UI.

    Path Parameters
    ---------------
    - key: exactly 8 digits (regex: ^\\d{8}$)

    Response
    --------
    - 200: PrefillResponse
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_CommuneRepository().get_commune_prefill_by_key(key)
    """
    deps = request.app.state.deps
    try:
        return deps.get_CommuneRepository().get_commune_prefill_by_key(key)
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/api/communes/average",
    response_model=AverageValuesResponse,
    responses=MISSING_DEP_RESPONSES,
)
def get_commune_average(request: Request) -> AverageValuesResponse:
    """
    GET /api/communes/average

    Purpose
    -------
    Returns average/aggregated default values across communes.
    (Useful when no commune-specific prefill data is available.)

    Response
    --------
    - 200: AverageValuesResponse
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_CommuneAverageRepository().get_average_commune_data()
    """
    #TODO add Real 
    return AverageValuesResponse(
        id="AVG",
        name="Durchschnitt",
        values={}   # <- dict, nicht list
    )
    # deps = request.app.state.deps
    # try:
    #     return deps.get_CommuneAverageRepository().get_average_commune_data()
    # except MissingDependencyError as e:
    #     raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/api/data/outdatedWarning",
    response_model=OutdatedWarningsResponse,
    responses=MISSING_DEP_RESPONSES,
)
def get_outdated_data(request: Request) -> OutdatedWarningsResponse:
    """
    GET /api/data/outdatedWarning

    Purpose
    -------
    Returns warnings/notices about outdated data.
    The UI can use this, for example, to indicate that prefill values/statistics are no longer up to date.

    Response
    --------
    - 200: OutdatedWarningsResponse
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_CommuneRepository().get_old_warning_communes()

    Note (from a recent crash)
    --------------------------
    - If an internal file path is checked, ensure a `pathlib.Path` is used
      (a string does not have `.exists()`).
    """
    deps = request.app.state.deps
    try:
        return deps.get_CommuneRepository().get_old_warning_communes()
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------
# Reference Communes
# -------------------------
@router.get(
    "/api/reference-communes/list",
    response_model=ReferenceCommunesResponse,
    responses=MISSING_DEP_RESPONSES,
)
def list_reference_communes(request: Request) -> ReferenceCommunesResponse:
    """
    GET /api/reference-communes/list

    Purpose
    -------
    Lists all reference communes with basic information (for UI selection).

    Response
    --------
    - 200: ReferenceCommunesResponse
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_ReferenceCommuneRepository().list_all_reference_communes_info()
    """
    deps = request.app.state.deps
    try:
        return deps.get_ReferenceCommuneRepository().list_all_reference_communes_info()
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))

ReferenceCommuneId = Annotated[str, Path(..., description="Reference commune ID")]

@router.get(
    "/api/reference-communes/{reference_commune_id}",
    response_model=ReferenceCommunePrefillResponse,
    responses=MISSING_DEP_RESPONSES,
)
def get_reference_commune(
    request: Request,
    reference_commune_id: ReferenceCommuneId,
) -> ReferenceCommunePrefillResponse:
    """
    GET /api/reference-communes/{id}

    Purpose
    -------
    Returns prefill/detail data for a reference commune by its ID.

    Path Parameters
    ---------------
    - id: reference commune ID (format not enforced; consider adding a pattern later)

    Response
    --------
    - 200: ReferenceCommunePrefillResponse
    - 500: ErrorResponse (missing dependency / setup issue)

    Internal Dependencies
    ---------------------
    - deps.get_ReferenceCommuneRepository().get_reference_commune_prefill(id)
    """
    deps = request.app.state.deps
    try:
        return deps.get_ReferenceCommuneRepository().get_reference_commune_prefill(reference_commune_id)
    except MissingDependencyError as e:
        raise HTTPException(status_code=500, detail=str(e))
