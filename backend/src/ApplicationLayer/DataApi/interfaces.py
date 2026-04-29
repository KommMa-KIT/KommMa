from __future__ import annotations

"""
Data Source Protocols (Interfaces)

This module defines the data source interfaces (Protocols) used by the application
to access external data and repositories in a decoupled way.

Purpose
-------
- Provide a stable contract for reading domain data (measures, communes, graphs, inputs, etc.).
- Allow clean dependency injection (DI) in the application layer.
- Make implementations interchangeable (e.g., JSON files, database, external APIs, mocks).
- Improve testability by enabling lightweight stub/mock implementations.

Design Notes
------------
- Uses `typing.Protocol` (structural typing):
  Any class that implements the same methods automatically satisfies the Protocol,
  without explicit inheritance.
- Uses plain Python data structures (`dict`, `list`) in the interface:
  - This keeps data sources independent from Pydantic models.
  - Validation and shaping into API schemas happens at the service/API layer.

Returned Data Shapes (High-Level)
---------------------------------
The exact key structure in returned dictionaries is part of the application contract,
but typical expectations are:

- Graph:
    list[{"from": "...", "to": "...", "type": "..."}]
- Commune info:
    {"name": "...", "postal_code": "...", "key": "...", ...}
- Prefill:
    { "<parameter_id>": {"value": ..., "source": "...", "date": "...", "individual": ...}, ... }
- Measures:
    list[{"id": "...", "title": "...", ...}]
- Input parameters:
    {"Water": [{"id": "...", "type": "...", "subinputs": [...]}, ...], ...}

If you want stricter typing later, you can replace `dict[str, Any]` with TypedDicts
or dedicated Pydantic models.
"""

from typing import Protocol, Any


class GraphDataSource(Protocol):
    """
    Provides the measures graph used for visualization or dependency navigation.

    Returns
    -------
    list[dict[str, Any]]
        List of edges or graph records. Typically includes:
        - "from", "to", "type"
    """
    def get_graph(self) -> list[dict[str, Any]]:
        ...


class CommuneAverageDataSource(Protocol):
    """
    Provides aggregated average/default values across communes.

    Returns
    -------
    dict[str, Any]
        Average commune data, typically including an ID/name and a `values` mapping.
    """
    def get_average_commune_data(self) -> dict[str, Any]:
        ...


class CommuneDataSource(Protocol):
    """
    Provides commune lookup, search, and prefill data.

    Methods cover:
    - fetching commune info by key or by code
    - fetching commune-specific prefill values
    - searching communes by name
    - listing communes with outdated data warnings
    """

    def get_commune_info_by_key(self, key: str) -> dict[str, Any]:
        """
        Return basic commune information by its official 8-digit key.

        Parameters
        ----------
        key:
            Official commune key (expected format: 8 digits).

        Returns
        -------
        dict[str, Any]
            Commune info record.
        """
        ...

    def get_commune_info_by_code(self, code: str) -> dict[str, Any]:
        """
        Return commune information by a commune code (format may vary).

        Parameters
        ----------
        code:
            Commune code identifier.

        Returns
        -------
        dict[str, Any]
            Commune info record.
        """
        ...

    def get_commune_prefill_by_key(self, key: str) -> dict[str, Any]:
        """
        Return prefill values (auto-fill suggestions) for a commune.

        Parameters
        ----------
        key:
            Official commune key (expected format: 8 digits).

        Returns
        -------
        dict[str, Any]
            Mapping parameter_id -> prefill object.
        """
        ...

    def search_communes_by_name(self, query: str) -> list[dict[str, Any]]:
        """
        Search communes by name or partial string.

        Parameters
        ----------
        query:
            Search term.

        Returns
        -------
        list[dict[str, Any]]
            List of search results (name, postal_code, key, etc.).
        """
        ...

    def get_old_warning_communes(self) -> list[dict[str, Any]]:
        """
        Return warnings about outdated data.

        Returns
        -------
        list[dict[str, Any]]
            Warning entries that the UI can display.
        """
        ...


class MeasureDataSource(Protocol):
    """
    Provides the measures catalog.

    Returns
    -------
    list[dict[str, Any]]
        List of measures.
    """
    def get_all_measures(self) -> list[dict[str, Any]]:
        ...


class InputParametersDataSource(Protocol):
    """
    Provides input parameter definitions grouped by category.

    Returns
    -------
    dict[str, Any]
        Typically: { "<Category>": [<InputDefinition dicts>], ... }
    """
    def get_input_parameters(self) -> dict[str, Any]:
        ...


class ReferenceCommuneDataSource(Protocol):
    """
    Provides reference commune metadata and prefill data.

    Notes
    -----
    This could later be merged with `CommuneDataSource` or refactored into a single
    unified interface, depending on your architecture decisions.
    """

    def list_all_reference_communes_info(self) -> list[dict[str, Any]]:
        """
        List all reference communes with basic metadata for selection in the UI.

        Returns
        -------
        list[dict[str, Any]]
            Reference commune info records.
        """
        ...

    def get_reference_commune_prefill(self, reference_commune_id: str) -> dict[str, Any]:
        """
        Return prefill/detail data for a specific reference commune.

        Parameters
        ----------
        reference_commune_id:
            Reference commune ID.

        Returns
        -------
        dict[str, Any]
            Reference commune prefill record.
        """
        ...


class SubsidiesDataSource(Protocol):
    """
    Provides available subsidy types for UI selection.

    Returns
    -------
    list[dict[str, Any]]
        List of subsidy type records.
    """
    def get_all_subsidies_types(self) -> list[dict[str, Any]]:
        ...
