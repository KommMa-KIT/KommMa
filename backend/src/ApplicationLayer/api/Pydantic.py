from datetime import datetime, date as Date
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict, field_validator
import math
from typing import Dict, Optional, Union, Any, List

# =============================================================================
# Pydantic Models: API Schemas (Request/Response)
# =============================================================================
"""
This module contains all Pydantic models used as request and response schemas
for the FastAPI endpoints.

Goals / Design
--------------
- Strict validation of API requests (422 for invalid bodies/types/patterns).
- Validation of API responses (FastAPI automatically validates response_model).
- Robustness against Excel/Pandas data (NaN/missing fields/strings instead of lists),
  especially for measure imports.

Important Notes
---------------
- Many response types are type aliases (e.g. `MeasuresResponse = List[Measure]`).
  This means: the endpoint must actually return a list — not a dict like
  `{"results": [...]}`.
- Patterns:
  - `key` and `community_key`: exactly 8 digits (official municipality key)
  - `postal_code`: exactly 5 digits
- Pydantic v2: `Field(..., example=...)` is deprecated -> use `json_schema_extra` in the future.
"""

# -------------------------
# Enums
# -------------------------

class InputType(str, Enum):
    """
    Type of an input field in the UI.

    Values
    ------
    - number: numeric value (int/float)
    - selection: exactly one selection from `selectable`
    - multiSelection: multiple selections from `selectable`
    - bool: true/false
    """
    number = "number"
    selection = "selection"
    multiSelection = "multiSelection"
    bool = "bool"


class popularityLevel(str, Enum):
    """
    Popularity / priority level of a measure.

    Values
    ------
    - niedrig
    - mittel
    - hoch

    Note
    ----
    This enum is strictly validated in responses. Tests/mocks must use exactly
    these strings (not 'low/medium/high').
    """
    niedrig = "niedrig"
    mittel = "mittel"
    hoch = "hoch"


class FillType(str, Enum):
    """
    Source/strategy describing how inputs were filled.

    Values
    ------
    - averages: default average values
    - commune: commune-specific values
    - manual: manual input
    """
    averages = "averages"
    commune = "commune"
    manual = "manual"


class GraphEdgeType(str, Enum):
    """
    Type of an edge in the measures graph.

    Values
    ------
    - conflict: measures contradict each other
    - synergy: measures positively reinforce each other
    - requires / dependency / prerequisite: dependency relationships
    """
    conflict = "conflict"
    synergy = "synergy"
    requires = "requires"
    dependency = "dependency"
    prerequisite = "prerequisite"

# -------------------------
# Models
# -------------------------

class Measure(BaseModel):
    """
    Measure from the measures catalog.

    Purpose
    -------
    This model serves as the **response schema** for `/api/measures` and is designed
    to robustly accept data from Excel/Pandas imports.

    Robustness Rules (Input Normalization)
    --------------------------------------
    - Unknown fields are ignored (`extra="ignore"`).
    - `title`:
        - `None`, `NaN`, or empty string -> converted to `None`
        - After parsing: fallback `title = id` if no title exists.
    - `relevantParameters` & `furtherInfo`:
        - Accepts `List[str]` **or** `str` (multiline -> splitlines())
        - `None`/`NaN` -> `[]`
        - Strings are trimmed, empty entries removed
    - `imageURL`:
        - `None`/`NaN`/empty -> `None`
        - Otherwise trimmed string
    - Alias compatibility:
        - Accepts old typo `relevantParamters` as input alias.

    Fields (important for clients)
    ------------------------------
    - id: measure ID, e.g. "M01"
    - title: display name (fallback to `id`)
    - popularity: "niedrig" | "mittel" | "hoch" (optional)
    - shortDescription / description: description texts
    - relevantParameters: list of required parameter IDs
    - furtherInfo: additional information
    - imageURL: optional image link
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

    # -----------------------
    # Normalizers / Validators
    # -----------------------

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
"""Response type for `/api/measures`: list of Measure objects."""


class OutdatedWarning(BaseModel):
    """
    Warning about outdated data.

    Fields
    ------
    - title: description/name of the data source or warning
    - last_update: timestamp of the last update (datetime)
    """
    title: str
    last_update: datetime


OutdatedWarningsResponse = List[OutdatedWarning]
"""Response type for `/api/data/outdatedWarning`."""


class ValidationErrorDetail(BaseModel):
    """
    Single validation error (for UI/client).

    Fields
    ------
    - path: path/ID of the affected field (e.g. "inputs[3].value")
    - message: human-readable error message
    """
    path: str
    message: str


class ValidationResponse(BaseModel):
    """
    Standard response for validation results.

    Fields
    ------
    - valid: True if no validation errors occurred
    - errors: List of ValidationErrorDetail (optional)
    """
    valid: bool
    errors: Optional[List[ValidationErrorDetail]] = None


class InputDefinition(BaseModel):
    """
    Definition of an input field (used by the UI).

    Fields
    ------
    - id: Parameter ID (stable, used in calculations)
    - title: Display name
    - type: InputType (number/selection/multiSelection/bool)
    - description: Explanatory text
    - critical: True if mandatory/decisive
    - unit: Unit (optional, e.g. "EUR", "m3 a")
    - selectable: Possible values for selection/multiSelection
    - subinputs: Recursively nested sub-fields (e.g. grouped/composite fields)

    Note
    ----
    `subinputs` references `InputDefinition` recursively -> `model_rebuild()` required.
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
"""Mapping: category -> list of InputDefinition (e.g. {"Water": [...], "Energy": [...]})"""


class InputValue(BaseModel):
    """
    Concrete value assigned to an input parameter.

    Fields
    ------
    - id: Parameter ID
    - value: Value (depending on InputType), supports int/float/str/bool
    """
    id: str
    value: Union[int, float, str, bool]


class FillInputsRequest(BaseModel):
    """
    Request body for importing or validating inputs.

    Fields
    ------
    - community_key: 8-digit official municipality key (regex ^\\d{8}$)
    - filltype: FillType (averages/commune/manual)
    - inputs: List of InputValue (id + value)

    Typical usage
    -------------
    POST `/api/inputs/import`
    """
    community_key: str = Field(..., pattern=r"^\d{8}$")
    filltype: FillType
    inputs: List[InputValue]


class Subsidies(BaseModel):
    """
    Subsidy type (for UI selection).

    Fields
    ------
    - id: Subsidy ID
    - title: Display name
    """
    id: str
    title: str


SubsidiesResponse = List[Subsidies]
"""Response type for `/api/inputs/subsidies`: list of subsidy types."""


class CommuneSearchResult(BaseModel):
    """
    Result object returned by commune search.

    Fields
    ------
    - name: Commune name
    - postal_code: Postal code (regex ^\\d{5}$)
    - key: Official municipality key (regex ^\\d{8}$)
    """
    name: str
    postal_code: str = Field(..., pattern=r"^\d{5}$")
    key: str = Field(..., pattern=r"^\d{8}$")


CommuneSearchResponse = List[CommuneSearchResult]
"""Response type for `/api/communes/search`: list of CommuneSearchResult."""


class PrefillValue(BaseModel):
    """
    Prefill value for an input field.

    Fields
    ------
    - id: Parameter ID
    - value: Actual value (int/float/str/bool)
    - source: Origin/source (e.g. "Destatis", "User", "Average")
    - date: Reference date (date only)
    - individual: True if commune-specific, otherwise generic/default
    """
    id: str
    value: Union[int, float, str, bool]
    source: str
    date: Date | None = None
    individual: bool


PrefillResponse = List[PrefillValue]
"""
Response type for `/api/communes/{key}/prefill`:

- List[PrefillValue]
- The endpoint must return a list.
"""


class CommuneInfo(BaseModel):
    """
    Basic information about a commune.

    Fields
    ------
    - name
    - postal_code: Regex ^\\d{5}$
    - key: Regex ^\\d{8}$
    """
    name: str
    postal_code: str = Field(..., pattern=r"^\d{5}$")
    key: str = Field(..., pattern=r"^\d{8}$")


class ReferenceCommune(BaseModel):
    """
    Reference commune metadata.

    Fields
    ------
    - id: Reference commune ID
    - name: Name
    - population: Number of inha    dardbus: Anschaffungskosten(Stand: 13. Februar 2026)
    """
    id: str
    name: str
    population: int = Field(..., ge=0)
    description: str


ReferenceCommunesResponse = List[ReferenceCommune]
"""Response type for `/api/reference-communes/list`: list of ReferenceCommune."""


class ReferenceCommuneInput(BaseModel):
    """
    Single input value of a reference commune.

    Fields
    ------
    - id: Parameter ID
    - value: Any JSON value (heterogeneous reference data allowed)
    """
    id: str
    value: Any


class ReferenceCommunePrefillResponse(BaseModel):
    """
    Prefill response for a reference commune.

    Fields
    ------
    - id: Reference commune ID
    - name: Name
    - inputs: List of ReferenceCommuneInput (id + value)
    """
    id: str
    name: str
    inputs: List[ReferenceCommuneInput]


InputPrimitive = Union[int, float, str, bool]
"""Primitive input values that may occur in calculation or prefill."""


class AverageValuesResponse(BaseModel):
    """
    Aggregated average/default values.

    Fields
    ------
    - id: Identifier (e.g. "AVG")
    - name: Display name
    - values: Mapping parameter ID -> InputPrimitive
    """
    id: str = Field(..., example="AVG")
    name: str
    values: Dict[str, InputPrimitive]


class FilledInput(BaseModel):
    """
    Prepared input for calculation.

    Fields
    ------
    - id: Parameter ID
    - value: InputPrimitive
    - individual: True if commune-specific, otherwise default/average
    """
    id: str
    value: InputPrimitive
    individual: bool


class SubsidyValue(BaseModel):
    """
    Selected subsidy (used in calculation).

    Fields
    ------
    - id: Subsidy ID
    - value: Amount (>= 0)
    - unit: Unit (e.g. "EUR")
    """
    id: str
    value: float = Field(..., ge=0)
    unit: str = Field(..., example="EUR")


class FilledInputsAndSubsidies(BaseModel):
    """
    Request body for result calculation.

    Fields
    ------
    - inputs: List of prepared inputs (FilledInput)
    - subsidies: List of selected subsidies (SubsidyValue)

    Typical usage
    -------------
    POST `/api/results/calculate`

    Typical 422 reason in tests
    ----------------------------
    - `{}` is not valid because `inputs` and `subsidies` are required.
    """
    inputs: List[FilledInput]
    subsidies: List[SubsidyValue]


class MeasureResult(BaseModel):
    """
    Result scores for a measure.

    Fields
    ------
    - measureId: Measure ID
    - time, costs, co2Savings: Absolute values (>= 0)
    - timeScore, costScore, climateScore: Scores (0..100)

    Note
    ----
    This model is currently NOT directly used in CalculationResponse
    (measure_results is typed as List[dict]). Can be typed later.
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
    Calculation response.

    Special feature: Alias fields
    -----------------------------
    This model uses aliases so that JSON keys can be accepted/emitted in camelCase
    while Python attributes remain snake_case.

    Fields (Python name -> JSON alias)
    -----------------------------------
    - level_of_individualism_total -> levelOfIndividualisationTotal
    - level_of_individualism_general -> levelOfIndividualisationGeneral
    - level_of_individualism_energy -> levelOfIndividualisationEnergy
    - level_of_individualism_mobility -> levelOfIndividualisationMobility
    - level_of_individualism_water -> levelOfIndividualisationWater
    - measure_results -> measureResults

    Recommendation
    --------------
    Consider changing measure_results to `List[MeasureResult]` once stable.
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

    Fields
    ------
    - from_: Source node ID (JSON key: "from")
    - to: Target node ID
    - type: GraphEdgeType

    Note
    ----
    `from` is a Python keyword -> therefore `from_` with alias.
    """
    from_: str = Field(alias="from")
    to: str
    type: GraphEdgeType


GraphResponse = List[GraphEdge]
"""Response type for `/api/results/graph`: list of GraphEdge."""


class ErrorResponse(BaseModel):
    """
    Standard error response (e.g. for HTTP 500).

    Fields
    ------
    - detail: Error message
    """
    detail: str


Measure.model_rebuild()