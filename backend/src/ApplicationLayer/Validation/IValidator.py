from typing import Protocol, Any

"""
IValidator

This module defines a generic validation interface using `typing.Protocol`.

Purpose
-------
`IValidator` specifies the contract for validation components used in the
application (e.g., input validation before calculation).

It enables:
- Clean separation between validation logic and business logic
- Dependency injection of different validator implementations
- Easy mocking in tests
- Swappable validation strategies (e.g., strict mode, relaxed mode, schema-based, etc.)

Current Scope (Important)
-------------------------
At the moment, the validator has a **very limited responsibility**:

- It only checks whether there is *new data* provided for fields that were
  previously prefilled (e.g., commune-based or average-based values).
- It does NOT perform full semantic validation.
- It does NOT validate calculation logic.
- It does NOT enforce business rules beyond detecting changed prefill values.

This behavior may be extended in the future to include:
- Required field validation
- Type validation (beyond Pydantic)
- Cross-field validation
- Domain/business rule validation

Design Rationale
----------------
- Uses `Protocol` (structural typing).
- No explicit inheritance required.
- Any class that provides a compatible `validate()` method automatically
  satisfies this interface.
- Keeps the interface independent of Pydantic models to avoid tight coupling.

Expected Behavior
-----------------
- Accepts a dictionary containing data to validate.
- Returns a dictionary describing the validation result.

Typical Return Format
---------------------
Implementations are expected to return a structure similar to:

{
    "valid": bool,
    "errors": [
        {"path": "...", "message": "..."},
        ...
    ]
}

However, the exact structure is defined by the application contract
(e.g., matching `ValidationResponse` in the API layer).

Example Implementation (Current Simplified Behavior)
----------------------------------------------------

class PrefillChangeValidator:
    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        errors = []

        # Example logic:
        # Check whether prefilled fields were overwritten with new values.
        for input_item in data.get("inputs", []):
            if input_item.get("individual") is True:
                # Here you would compare against prefill source
                pass

        return {
            "valid": len(errors) == 0,
            "errors": errors or None
        }

This class automatically conforms to `IValidator`
because it provides a compatible `validate` method.
"""


class IValidator(Protocol):
    """
    Generic validation interface.

    Method
    ------
    validate(data: dict[str, Any]) -> dict[str, Any]

    Parameters
    ----------
    data:
        Dictionary containing data to validate.
        The expected structure depends on the concrete use case
        (e.g., imported inputs, calculation payload, etc.).

    Returns
    -------
    dict[str, Any]:
        Validation result structure.
        Typically contains:
            - "valid": bool
            - "errors": list of error details (optional)

    Notes
    -----
    - Currently, validation only checks for new/changed data in prefilled fields.
    - The API layer is responsible for translating validation errors
      into HTTP responses (e.g., HTTP 400).
    """
    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        ...
