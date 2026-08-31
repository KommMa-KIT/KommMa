"""
APIRouter: Public REST API Endpoints

This module defines the application's HTTP endpoints (FastAPI router).

Business logic lives in services/repositories, accessed via `request.app.state.deps`
(a dependency container built by `build_dependencies()`), providing factory methods
such as `get_MeasureRepository()`, `get_CalculationService()`, etc.

Error handling
--------------
Every endpoint is wrapped with `@handle_api_errors`, which centralizes exception
handling for the whole router:
    - MissingDependencyError -> HTTP 500, generic message
    - ValidationError        -> HTTP 400, generic message
    - any other exception    -> HTTP 500, generic message
The real exception (with traceback) is always logged server-side via the "api.router"
logger; only a generic, non-leaking message is ever sent back to the client.
"""

from __future__ import annotations
import functools
import inspect
import logging
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

# Child of the "api" logger already used by APILoggingMiddleware, so it shares
# the same root-logger handlers/formatting configured in setup_logging().
logger = logging.getLogger("api.router")

GENERIC_500_MESSAGE = "Internal server error. Please try again later."
GENERIC_400_MESSAGE = "Invalid request data."


def handle_api_errors(func):
    """
    Route decorator that logs the real exception server-side and raises a
    generic HTTPException instead of letting exception details reach the
    client. Supports both sync and async route handlers. Place directly
    below @router.<method>(...).
    """
    endpoint = func.__name__

    def _translate(exception: Exception) -> HTTPException:
        if isinstance(exception, MissingDependencyError):
            logger.error("Missing dependency in %s", endpoint, exc_info=exception)
            return HTTPException(status_code=500, detail=GENERIC_500_MESSAGE)
        if isinstance(exception, ValidationError):
            logger.warning("Validation error in %s", endpoint, exc_info=exception)
            return HTTPException(status_code=400, detail=GENERIC_400_MESSAGE)
        logger.exception("Unhandled exception in %s", endpoint)
        return HTTPException(status_code=500, detail=GENERIC_500_MESSAGE)

    if inspect.iscoroutinefunction(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as exception:
                raise _translate(exception)
        return async_wrapper

    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as exception:
            raise _translate(exception)
    return sync_wrapper


# -------------------------
# Parameter definitions
# -------------------------

# 8-digit commune key
CommuneKey = Annotated[str, Path(..., pattern=r"^\d{8}$", description="Commune key (exactly 8 digits)")]

# 5-digit german postal code
PostalCode = Annotated[str, Path(..., pattern=r"^\d{5}$", description="Postal code (PLZ, exactly 5 digits)")]

# Reference commune identifier: this is the commune's name, not a technical ID. 
# Must allow letters incl. german umlauts/ß, spaces, hyphens, apostrophes, and periods.
ReferenceCommuneId = Annotated[
    str,
    Path(
        ...,
        pattern=r"^[A-Za-zÀ-ÖØ-öø-ÿß' \-\.]{1,100}$",
        description="Reference commune name",
    ),
]

# Search term, bounded to reduce abuse via oversized query strings.
SearchQuery = Annotated[str, Query(..., min_length=1, max_length=100, description="Search term")]


router = APIRouter()

MISSING_DEP_RESPONSES = {
    500: {"model": ErrorResponse, "description": "Internal server error"},
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
@handle_api_errors
def get_measures(request: Request) -> MeasuresResponse:
    """Returns the full measures catalog."""
    deps = request.app.state.deps
    return deps.get_MeasureRepository().get_all_measures()

# -------------------------
# Results
# -------------------------
@router.post(
    "/api/results/calculate",
    response_model=CalculationResponse,
    responses={**MISSING_DEP_RESPONSES, **VALIDATION_ERROR_RESPONSES},
)
@handle_api_errors
async def calculate_results(request: Request, payload: FilledInputsAndSubsidies) -> CalculationResponse:
    """Runs the calculation for the selected measures and returns the result."""
    deps = request.app.state.deps
    return await deps.get_CalculationService().calculate(payload)

@router.get(
    "/api/results/graph",
    response_model=GraphResponse,
    responses=MISSING_DEP_RESPONSES,
)
@handle_api_errors
def get_results_graph(request: Request) -> GraphResponse:
    """Returns the results/dependency graph structure."""
    deps = request.app.state.deps
    return deps.get_GraphRepository().get_graph()

# -------------------------
# Inputs
# -------------------------
@router.get(
    "/api/inputs/subsidies",
    response_model=SubsidiesResponse,
    responses=MISSING_DEP_RESPONSES,
)
@handle_api_errors
def get_subsidies(request: Request) -> SubsidiesResponse:
    """Returns all available subsidy types for UI selection."""
    # TODO: replace with real implementation once SubsidiesRepository is ready.
    return []
    # deps = request.app.state.deps
    # return deps.get_SubsidiesRepository().get_all_subsidies_types()

@router.post(
    "/api/inputs/import",
    response_model=ValidationResponse,
    responses={**MISSING_DEP_RESPONSES, **VALIDATION_ERROR_RESPONSES},
)
@handle_api_errors
def import_inputs(request: Request, payload: FillInputsRequest) -> ValidationResponse:
    """Validates (and normalizes) imported inputs, e.g. from Excel/CSV."""
    deps = request.app.state.deps
    return deps.get_InputValidator().validate(payload)

@router.get(
    "/api/inputs/parameters",
    response_model=InputsByCategory,
    responses=MISSING_DEP_RESPONSES,
)
@handle_api_errors
def get_input_params(request: Request) -> InputsByCategory:
    """Returns input parameter definitions grouped by category (e.g. "Water")."""
    deps = request.app.state.deps
    return deps.get_InputParametersDataSource().get_input_parameters()

# -------------------------
# Communes
# -------------------------
@router.get(
    "/api/communes/search",
    response_model=CommuneSearchResponse,
    responses=MISSING_DEP_RESPONSES,
)
@handle_api_errors
def search_communes(request: Request, q: SearchQuery) -> CommuneSearchResponse:
    """Searches communes by name/partial string (1-100 characters)."""
    deps = request.app.state.deps
    return deps.get_CommuneRepository().search_communes_by_name(q)

@router.get(
    "/api/communes/info_by_key/{key}",
    response_model=CommuneInfo,
    responses=MISSING_DEP_RESPONSES,
)
@handle_api_errors
def get_commune_info_by_key(request: Request, key: CommuneKey) -> CommuneInfo:
    """Returns basic information about a commune using its 8-digit key."""
    deps = request.app.state.deps
    return deps.get_CommuneRepository().get_commune_info_by_key(key)

@router.get(
    "/api/communes/info_by_code/{code}",
    response_model=CommuneInfo,
    responses=MISSING_DEP_RESPONSES,
)
@handle_api_errors
def get_commune_info_by_code(request: Request, code: PostalCode) -> CommuneInfo:
    """Returns basic information about a commune using its postal code (PLZ)."""
    deps = request.app.state.deps
    return deps.get_CommuneRepository().get_commune_info_by_code(code)

@router.get(
    "/api/communes/{key}/prefill",
    response_model=PrefillResponse,
    responses=MISSING_DEP_RESPONSES,
)
@handle_api_errors
def get_commune_prefill(request: Request, key: CommuneKey) -> PrefillResponse:
    """Returns prefill values used to auto-populate input fields for a commune."""
    deps = request.app.state.deps
    return deps.get_CommuneRepository().get_commune_prefill_by_key(key)

@router.get(
    "/api/communes/average",
    response_model=AverageValuesResponse,
    responses=MISSING_DEP_RESPONSES,
)
@handle_api_errors
def get_commune_average(request: Request) -> AverageValuesResponse:
    """Returns aggregated default values across communes, used when no commune-specific prefill exists."""
    # TODO: replace with real implementation once CommuneAverageRepository is ready.
    return AverageValuesResponse(
        id="AVG",
        name="Durchschnitt",
        values={}
    )
    # deps = request.app.state.deps
    # return deps.get_CommuneAverageRepository().get_average_commune_data()

@router.get(
    "/api/data/outdatedWarning",
    response_model=OutdatedWarningsResponse,
    responses=MISSING_DEP_RESPONSES,
)
@handle_api_errors
def get_outdated_data(request: Request) -> OutdatedWarningsResponse:
    """Returns warnings about outdated commune data (e.g. for a UI notice)."""
    deps = request.app.state.deps
    return deps.get_CommuneRepository().get_old_warning_communes()

# -------------------------
# Reference Communes
# -------------------------
@router.get(
    "/api/reference-communes/list",
    response_model=ReferenceCommunesResponse,
    responses=MISSING_DEP_RESPONSES,
)
@handle_api_errors
def list_reference_communes(request: Request) -> ReferenceCommunesResponse:
    """Lists all reference communes with basic information, for UI selection."""
    deps = request.app.state.deps
    return deps.get_ReferenceCommuneRepository().list_all_reference_communes_info()

@router.get(
    "/api/reference-communes/{reference_commune_id}",
    response_model=ReferenceCommunePrefillResponse,
    responses=MISSING_DEP_RESPONSES,
)
@handle_api_errors
def get_reference_commune(
    request: Request,
    reference_commune_id: ReferenceCommuneId,
) -> ReferenceCommunePrefillResponse:
    """Returns prefill/detail data for a reference commune by its name."""
    deps = request.app.state.deps
    return deps.get_ReferenceCommuneRepository().get_reference_commune_prefill(reference_commune_id)