"""
mocks.py

Placeholder data sources for repositories that are not implemented yet.
Every call reports a missing dependency.
"""

from __future__ import annotations

from typing import Any

from ApplicationLayer.DataApi.interfaces import (
    SubsidiesDataSource,
    CommuneAverageDataSource,
)
from Exceptions.MissingDependencyError import _raise_missing_dependency


def _missing(name: str) -> None:
    _raise_missing_dependency(name)





class DummyCommuneAverageDataSource(CommuneAverageDataSource):
    def get_average_commune_data(self) -> dict[str, Any]:
        _missing("CommuneAverageDataSource")
        return {}


class DummySubsidiesDataSource(SubsidiesDataSource):
    def get_all_subsidies_types(self) -> list[dict]:
        _missing("SubsidiesDataSource.get_all_subsidies_types")
        return []