"""
Pydantic.py

Request and response schemas for the FastAPI endpoints. Requests are validated
strictly (422 on invalid bodies), and FastAPI validates every response_model.

Many response types are plain aliases (e.g. MeasuresResponse = List[Measure]),
so those endpoints have to return a list, not a dict like {"results": [...]}.
"""

from datetime import datetime, date as Date
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict, field_validator
import math
from typing import Dict, Optional, Union, Any, List

# --- Enums ---

class InputType(str, Enum):
    """Type of an input field in the UI."""
    number = "number"
    selection = "selection"
    multiSelection = "multiSelection"
    bool = "bool"


class popularityLevel(str, Enum):
    """
    Popularity level of a measure.

    Validated strictly in responses, so mocks have to use these German values.
    """
    niedrig = "niedrig"
    mittel = "mittel"
    hoch = "hoch"


class FillType(str, Enum):
    """How the inputs were filled: averages, commune-specific data or manual entry."""
    averages = "averages"
    commune = "commune"
    manual = "manual"


class GraphEdgeType(str, Enum):
    """Relation type of an edge in the measures graph."""
    conflict = "conflict"
    synergy = "synergy"
    contribution = "contribution"
    dependency = "dependency"
    prerequisite = "prerequisite"

# --- Models ---

class Measure(BaseModel):
    """
    Measure from the measures catalog, returned by /api/measures.

    The data comes from Excel via pandas, so the validators turn NaN and empty
    values into None/[] and split multiline strings into lists. The title falls
    back to the id, and the old typo "relevantParamters" is still accepted.
    """

    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
    )

    id: str = Field(..., json_schema_extra={"example": "M01"})
    title: Optional[str] = None

    popularity: Optional["popularityLevel"] = None
    popularityComment: Optional[str] = None

    shortDescription: str
    description: str

    relevantParameters: List[str] = Field(
        default_factory=list,
        validation_alias="relevantParamters",
    )
    furtherInfo: List[str] = Field(default_factory=list)
    imageURL: Optional[str] = None

    # --- Normalizers / Validators ---

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, float) and math.isnan(v):
            return None
        s = str(v).strip()
        return s or None

    @field_validator("relevantParameters", "furtherInfo", mode="before")
    @classmethod
    def normalize_list_fields(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, float) and math.isnan(v):
            return []
        if isinstance(v, str):
            return [line.strip() for line in v.splitlines() if line.strip()]
        if isinstance(v, list):
            out: List[str] = []
            for item in v:
                if item is None:
                    continue
                if isinstance(item, float) and math.isnan(item):
                    continue
                s = str(item).strip()
                if s:
                    out.append(s)
            return out
        s = str(v).strip()
        return [s] if s else []

    @field_validator("imageURL", mode="before")
    @classmethod
    def normalize_image_url(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, float) and math.isnan(v):
            return None
        s = str(v).strip()
        return s or None

    def model_post_init(self, __context: Any) -> None:
        if not self.title:
            self.title = self.id


MeasuresResponse = List[Measure]
"""Response of /api/measures."""


class OutdatedWarning(BaseModel):
    """Warning that a data source has not been updated for a while."""
    title: str
    last_update: datetime


OutdatedWarningsResponse = List[OutdatedWarning]
"""Response of /api/data/outdatedWarning."""


class ValidationErrorDetail(BaseModel):
    """A single validation error, path is e.g. "inputs[3].value"."""
    path: str
    message: str


class ValidationResponse(BaseModel):
    """Result of an input validation."""
    valid: bool
    errors: Optional[List[ValidationErrorDetail]] = None


class InputDefinition(BaseModel):
    """
    Definition of an input field shown in the UI.

    subinputs is recursive, which is why model_rebuild() is called below.
    """
    id: str
    title: str
    type: InputType
    description: str
    critical: bool
    unit: Optional[str] = None
    selectable: Optional[List[str]] = None
    subinputs: List["InputDefinition"] = Field(default_factory=list)


InputDefinition.model_rebuild()

InputsByCategory = Dict[str, List[InputDefinition]]
"""Input definitions per category, e.g. {"Water": [...], "Energy": [...]}."""


class InputValue(BaseModel):
    """Value assigned to an input parameter."""
    id: str
    value: Union[int, float, str, bool]


class FillInputsRequest(BaseModel):
    """Request body for POST /api/inputs/import."""
    community_key: str = Field(..., pattern=r"^\d{8}$")
    filltype: FillType
    inputs: List[InputValue]


class Subsidies(BaseModel):
    """Subsidy type selectable in the UI."""
    id: str
    title: str


SubsidiesResponse = List[Subsidies]
"""Response of /api/inputs/subsidies."""


class CommuneSearchResult(BaseModel):
    """Single hit of the commune search."""
    name: str
    postal_code: str = Field(..., pattern=r"^\d{5}$")
    key: str = Field(..., pattern=r"^\d{8}$")


CommuneSearchResponse = List[CommuneSearchResult]
"""Response of /api/communes/search."""


class PrefillValue(BaseModel):
    """
    Prefill value for an input field.

    individual is True when the value is specific to the commune.
    """
    id: str
    value: Union[int, float, str, bool]
    source: str
    date: Date | None = None
    individual: bool


PrefillResponse = List[PrefillValue]
"""Response of /api/communes/{key}/prefill."""


class CommuneInfo(BaseModel):
    """Name, postal code and AGS key of a commune."""
    name: str
    postal_code: str = Field(..., pattern=r"^\d{5}$")
    key: str = Field(..., pattern=r"^\d{8}$")


class ReferenceCommune(BaseModel):
    """Preview data of a reference commune."""
    id: str
    name: str
    population: int = Field(..., ge=0)
    description: str


ReferenceCommunesResponse = List[ReferenceCommune]
"""Response of /api/reference-communes/list."""


class ReferenceCommuneInput(BaseModel):
    """Single input value of a reference commune (any JSON value)."""
    id: str
    value: Any


class ReferenceCommunePrefillResponse(BaseModel):
    """All input values of a reference commune."""
    id: str
    name: str
    inputs: List[ReferenceCommuneInput]


InputPrimitive = Union[int, float, str, bool]
"""Primitive value of an input in calculation or prefill."""


class AverageValuesResponse(BaseModel):
    """Average values per parameter id."""
    id: str = Field(..., example="AVG")
    name: str
    values: Dict[str, InputPrimitive]


class FilledInput(BaseModel):
    """Input value sent to the calculation."""
    id: str
    value: InputPrimitive
    individual: bool


class SubsidyValue(BaseModel):
    """Subsidy selected for the calculation."""
    id: str
    value: float = Field(..., ge=0)
    unit: str = Field(..., example="EUR")


class FilledInputsAndSubsidies(BaseModel):
    """Request body for POST /api/results/calculate."""
    inputs: List[FilledInput]
    subsidies: List[SubsidyValue]


class MeasureResult(BaseModel):
    """
    Result values and scores (0-100) of a measure.

    Not used by CalculationResponse yet, measure_results is still List[dict].
    """
    measureId: str

    time: float = Field(..., ge=0)
    timeScore: float = Field(..., ge=0, le=100)

    costs: float = Field(..., ge=0)
    costScore: float = Field(..., ge=0, le=100)

    co2Savings: float = Field(..., ge=0)
    climateScore: float = Field(..., ge=0, le=100)


class CalculationResponse(BaseModel):
    """
    Calculation response. Attributes are snake_case, the JSON keys are the
    camelCase aliases.
    """
    model_config = ConfigDict(populate_by_name=True)

    level_of_individualism_total: float = Field(alias="levelOfIndividualisationTotal")
    level_of_individualism_general: float = Field(alias="levelOfIndividualisationGeneral")
    level_of_individualism_energy: float = Field(alias="levelOfIndividualisationEnergy")
    level_of_individualism_mobility: float = Field(alias="levelOfIndividualisationMobility")
    level_of_individualism_water: float = Field(alias="levelOfIndividualisationWater")

    measure_results: List[dict] = Field(default_factory=list, alias="measureResults")


class GraphEdge(BaseModel):
    """
    Edge in the measures graph.

    "from" is a Python keyword, so the field is from_ with an alias.
    """
    from_: str = Field(alias="from")
    to: str
    type: GraphEdgeType


GraphResponse = List[GraphEdge]
"""Response of /api/results/graph."""


class ErrorResponse(BaseModel):
    """Error response, e.g. for HTTP 500."""
    detail: str


Measure.model_rebuild()