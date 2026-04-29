from __future__ import annotations

import sys
import types
import importlib

import pytest


# -------------------------
# Fakes / Dummies
# -------------------------

class DummyObj:
    pass


class FakeInputParametersDataSource:
    def __init__(self, definition: dict):
        self._definition = definition

    def get_input_parameters(self):
        return self._definition


class FakeCalculationEngine:
    def calculate(self, payload):
        return {"measureResults": []}


def minimal_definition():
    return {
        "Water": [{"id": "w1", "subinputs": []}],
        "Energy": [{"id": "e1", "subinputs": []}],
        "Mobility": [{"id": "m1", "subinputs": []}],
        "General": [{"id": "g1", "subinputs": []}],
    }


# -------------------------
# IMPORTANT: stub modules BEFORE importing dependencies.dependencies
# -------------------------

@pytest.fixture(scope="session")
def deps_module():
    """
    Returns the imported 'dependencies.dependencies' module, but with external modules stubbed
    so that .env loading / file IO does not happen at import time.
    """

    # 1) Create stub modules for the external API imports that crash on import
    externalAPI = types.ModuleType("externalAPI")
    externalAPI_Parser = types.ModuleType("externalAPI.Parser")
    externalAPI_Downloader = types.ModuleType("externalAPI.Downloader")
    externalAPI_Updater = types.ModuleType("externalAPI.Updater")

    # Provide required symbols used by dependencies.py
    externalAPI_Parser.CommuneParserDataSource = lambda: DummyObj()
    externalAPI_Parser.ValidatiorAndUpdater = lambda *a, **k: DummyObj()  # <-- ADD THIS
    externalAPI_Downloader.run_downloads = lambda *a, **k: None
    externalAPI_Updater.run_updates = lambda *a, **k: None


    # 2) Inject into sys.modules so import finds these instead of real ones
    sys.modules["externalAPI"] = externalAPI
    sys.modules["externalAPI.Parser"] = externalAPI_Parser
    sys.modules["externalAPI.Downloader"] = externalAPI_Downloader
    sys.modules["externalAPI.Updater"] = externalAPI_Updater

    # 3) Import (or reload) the module under test
    mod = importlib.import_module("dependencies.dependencies")
    importlib.reload(mod)
    return mod


# -------------------------
# Tests for Dependencies class
# -------------------------

def test_getters_return_injected_instances(deps_module):
    Dependencies = deps_module.Dependencies

    deps = Dependencies(
        CommuneRepository_dep=DummyObj(),
        MeasureRepository_dep=DummyObj(),
        ReferenceCommuneRepository_dep=DummyObj(),
        SubsidiesRepository_dep=DummyObj(),
        GraphRepository_dep=DummyObj(),
        CommuneAverageRepository_dep=DummyObj(),
        CalculationEngine_dep=FakeCalculationEngine(),
        InputParametersDataSource_dep=FakeInputParametersDataSource(minimal_definition()),
    )

    assert deps.get_CommuneRepository() is not None
    assert deps.get_MeasureRepository() is not None
    assert deps.get_ReferenceCommuneRepository() is not None
    assert deps.get_SubsidiesRepository() is not None
    assert deps.get_GraphRepository() is not None
    assert deps.get_CommuneAverageRepository() is not None
    assert deps.get_CalculationEngine() is not None
    assert deps.get_InputParametersDataSource() is not None


def test_missing_dependency_raises_missingdependencyerror(deps_module):
    Dependencies = deps_module.Dependencies
    MissingDependencyError = importlib.import_module("Exceptions.MissingDependencyError").MissingDependencyError

    deps = Dependencies(
        CommuneRepository_dep=None,
        MeasureRepository_dep=DummyObj(),
        ReferenceCommuneRepository_dep=DummyObj(),
        SubsidiesRepository_dep=DummyObj(),
        GraphRepository_dep=DummyObj(),
        CommuneAverageRepository_dep=DummyObj(),
        CalculationEngine_dep=FakeCalculationEngine(),
        InputParametersDataSource_dep=FakeInputParametersDataSource(minimal_definition()),
    )

    with pytest.raises(MissingDependencyError):
        deps.get_CommuneRepository()


def test_calculation_service_is_cached_singleton(deps_module):
    Dependencies = deps_module.Dependencies

    deps = Dependencies(
        CommuneRepository_dep=DummyObj(),
        MeasureRepository_dep=DummyObj(),
        ReferenceCommuneRepository_dep=DummyObj(),
        SubsidiesRepository_dep=DummyObj(),
        GraphRepository_dep=DummyObj(),
        CommuneAverageRepository_dep=DummyObj(),
        CalculationEngine_dep=FakeCalculationEngine(),
        InputParametersDataSource_dep=FakeInputParametersDataSource(minimal_definition()),
    )

    s1 = deps.get_CalculationService()
    s2 = deps.get_CalculationService()
    assert s1 is s2

# TODO ADD test if implemented 
# def test_get_inputvalidator_currently_crashes_without_fix(deps_module):
#     """
#     Current bug in your code:
#       self.validator is never initialized in __init__ -> AttributeError
#     """
#     Dependencies = deps_module.Dependencies

#     deps = Dependencies(
#         CommuneRepository_dep=DummyObj(),
#         MeasureRepository_dep=DummyObj(),
#         ReferenceCommuneRepository_dep=DummyObj(),
#         SubsidiesRepository_dep=DummyObj(),
#         GraphRepository_dep=DummyObj(),
#         CommuneAverageRepository_dep=DummyObj(),
#         CalculationEngine_dep=FakeCalculationEngine(),
#         InputParametersDataSource_dep=FakeInputParametersDataSource(minimal_definition()),
#     )

#     with pytest.raises(AttributeError):
#         deps.get_InputValidator()


# -------------------------
# Tests for build_dependencies without side effects
# -------------------------

def test_build_dependencies_no_downloads_no_updates(deps_module, monkeypatch):
    build_dependencies = deps_module.build_dependencies
    Dependencies = deps_module.Dependencies

    # Make sure run_downloads/run_updates would fail if called
    def boom(*args, **kwargs):
        raise AssertionError("run_downloads/run_updates should not be called in this test")

    monkeypatch.setattr(deps_module, "run_downloads", boom)
    monkeypatch.setattr(deps_module, "run_updates", boom)

    # Patch heavy constructors to cheap dummies (no file IO)
    monkeypatch.setattr(deps_module, "CommuneParserDataSource", lambda: DummyObj())
    monkeypatch.setattr(deps_module, "MeasuresInformationExtractor", lambda *a, **k: DummyObj())
    monkeypatch.setattr(deps_module, "ReferenceCommuneRepository", lambda *a, **k: DummyObj())
    monkeypatch.setattr(deps_module, "DummySubsidiesDataSource", lambda: DummyObj())
    monkeypatch.setattr(deps_module, "GraphRepository", lambda *a, **k: DummyObj())
    monkeypatch.setattr(deps_module, "DummyCommuneAverageDataSource", lambda: DummyObj())
    monkeypatch.setattr(deps_module, "CalculationAPI", lambda *a, **k: FakeCalculationEngine())
    monkeypatch.setattr(
        deps_module,
        "DataCityCategoriesExtractor",
        lambda *a, **k: FakeInputParametersDataSource(minimal_definition()),
    )

    deps = build_dependencies(build_complete=False, run_updates_flag=False)

    assert isinstance(deps, Dependencies)
    assert deps.get_CalculationService() is not None
