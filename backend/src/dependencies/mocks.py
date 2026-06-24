from __future__ import annotations

from typing import Any

from ApplicationLayer.DataApi.interfaces import (
    SubsidiesDataSource,
    CommuneAverageDataSource,
)
from Exceptions.MissingDependencyError import _raise_missing_dependency


def _missing(name: str) -> None:
    # nutzt deine bestehende Fehlermeldung mit Dateiname/Zeile/Funktion
    _raise_missing_dependency(name)





class DummyCommuneAverageDataSource(CommuneAverageDataSource):
    def get_average_commune_data(self) -> dict[str, Any]:
        _missing("CommuneAverageDataSource")
        return {}


class DummySubsidiesDataSource(SubsidiesDataSource):
    def get_all_subsidies_types(self) -> list[dict]:
        _missing("SubsidiesDataSource.get_all_subsidies_types")
        return []