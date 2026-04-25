from typing import Protocol, Any

"""
ICalculationEngine

This module defines the calculation engine interface using a `Protocol`.

Purpose
-------
`ICalculationEngine` specifies the contract that every concrete
calculation engine implementation must fulfill.

It is used by the `CalculationService` (Application Layer) to
delegate the actual calculation logic without depending on a
specific implementation.

Design Rationale
----------------
- Uses `typing.Protocol` (structural typing).
- No inheritance is required.
- Any class implementing a compatible `calculate()` method
  automatically satisfies this interface.
- Enables clean dependency injection and testability.

Expected Behavior
-----------------
- Accepts a dictionary-based input payload.
- Returns a dictionary-based result payload.
- May be implemented as either synchronous or asynchronous
  (if async, the caller must handle awaitable results).

Example Implementation
----------------------

class MyCalculationEngine:
    def calculate(self, input_data: dict[str, Any]) -> dict[str, Any]:
        return {"measureResults": []}

This class automatically conforms to `ICalculationEngine`
because it provides a compatible `calculate` method.
"""


class ICalculationEngine(Protocol):
    """
    Calculation engine interface.

    Method
    ------
    calculate(input_data: dict[str, Any]) -> dict[str, Any]

    Parameters
    ----------
    input_data:
        Dictionary containing all prepared inputs and subsidies
        required for the calculation.

    Returns
    -------
    dict[str, Any]:
        Dictionary containing calculation results.
        Typically expected to include:
            - "measureResults": list of result objects
            - additional metadata fields (if needed)

    Notes
    -----
    - The exact structure of `input_data` and the returned dict
      is defined by the application contract between
      CalculationService and the concrete engine.
    - Implementations may perform validation internally.
    """
    def calculate(self, input_data: dict[str, Any]) -> dict[str, Any]:
        ...
