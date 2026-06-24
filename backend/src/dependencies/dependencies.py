"""
Dependencies (Dependency Container / Provider)

This module defines the central dependency provider for the REST API layer.

Purpose
-------
The `Dependencies` class acts as the single source of truth for application-wide
dependencies such as repositories, data sources, external API adapters, and
calculation services.

The REST API layer must never instantiate dependencies directly. Instead, all
dependencies are accessed exclusively through `request.app.state.deps`.

This ensures:
- a single shared instance per dependency (singleton-like behavior)
- consistent state across API requests
- reduced resource usage (e.g., avoid reloading large Excel files repeatedly)
- loose coupling between API layer and concrete implementations
- easy mocking and swapping of implementations in one central place

Design / Pattern
----------------
- Intended to behave like a Singleton container (instantiated once on app startup).
- Each `get_*` method is an accessor/factory for one specific dependency.
- No business logic belongs here. This class should only manage wiring and lifecycle.

Important Notes
---------------
- Placeholder methods or mock dependencies are intentional integration points and
  allow incremental development.
- If a dependency is missing or misconfigured, `_raise_missing_dependency(...)`
  should be used to raise a consistent application-level error.

Build Process
-------------
The factory function `build_dependencies(...)` is responsible for:
1) (Optional) downloading external datasets (`run_downloads`)
2) (Optional) running update routines (`run_updates`)
3) instantiating concrete implementations and returning a fully wired `Dependencies` instance

When replacing an implementation (e.g., switch from a dummy repository to a real one),
update the imports and the instantiation in `build_dependencies(...)` and ensure the
new implementation adheres to the expected Protocol/interface.

Caution
-------
- Do not add domain logic or request-specific state here.
- Keep this file focused on dependency wiring only.
"""

from __future__ import annotations
from typing import Any


import logging

# --- DEPENDENCY INTERFACES (Protocols) ---
from ApplicationLayer.DataApi.interfaces import (
    CommuneDataSource,
    InputParametersDataSource,
    MeasureDataSource,
    ReferenceCommuneDataSource,
    SubsidiesDataSource,
    GraphDataSource,
    CommuneAverageDataSource,
)
from ApplicationLayer.CalculationApi.ICalculationEngine import ICalculationEngine
from ApplicationLayer.CalculationApi.CalculationService import CalculationService

# --- Concrete Implementations ---
# These imports should point to the real implementations of the dependencies,
# such as data sources, external API adapters, and calculation engines.

# When replacing an implementation, update the import here and ensure that the new
# implementation adheres to the expected interface/Protocol.

from externalAPI.Downloader import run_downloads
from externalAPI.Updater import run_updates
from externalAPI.Parser import CommuneParserDataSource, ValidatiorAndUpdater

from DatabaseRepositoryLayer.GraphRepository.graphRepository import GraphRepository
from DatabaseRepositoryLayer.ReferenceCommuneRepository.referenceCommuneRepository import (
    ReferenceCommuneRepository,
)
from DatabaseRepositoryLayer.DataInputRepository.dataInputExtractor import DataCityCategoriesExtractor
from DatabaseRepositoryLayer.CalculationRepository.calculationAPI import CalculationAPI
from DatabaseRepositoryLayer.MeasureRepository.MeasureRepository import MeasuresInformationExtractor
from DatabaseRepositoryLayer.MeasureRepository.scenarioAwareMeasureDataSource import ScenarioAwareMeasureDataSource

from config import (
    CALCULATION_SHEETS_DIR,
    REFERENCE_COMMUNE_DIR,
    GRAPH_EXCEL_FILE,
    MEASURES_EXCEL_FILE,
    REFERENCE_COMMUNE_INFO_FILE,
)

# --- Mocks / Temporary Implementations ---
from dependencies.mocks import (
    DummySubsidiesDataSource,
    DummyCommuneAverageDataSource,
)

# --- Exceptions ---
from Exceptions.MissingDependencyError import _raise_missing_dependency


class Dependencies:
    """
    Central dependency provider for the REST API layer.

    This class is designed to behave like a Singleton container for application-wide
    dependencies. It ensures each dependency (e.g., repositories, services, adapters)
    exists only once and is reused across the application lifecycle.

    The REST API layer must never instantiate dependencies directly. Instead, all
    dependencies are accessed via this container (e.g., `request.app.state.deps`).

    Guarantees
    ----------
    - one shared instance per dependency
    - consistent state across requests
    - reduced resource usage
    - loose coupling between API layer and concrete implementations

    Integration / Extension
    -----------------------
    Each `get_*` method acts as a controlled access point for a single dependency.
    New dependencies should be added by introducing additional `get_*` methods
    without changing the API router code.

    Important
    ---------
    - No business logic must be implemented here.
    - Dependencies should not be instantiated outside this class/factory.
    - Replacement, caching, and mocking of dependencies is done here.
    """

    # -------------------------------------------------------------------------
    # Initialization
    # -------------------------------------------------------------------------

    def __init__(
        self,
        CommuneRepository_dep: CommuneDataSource,
        MeasureRepository_dep: MeasureDataSource,
        ReferenceCommuneRepository_dep: ReferenceCommuneDataSource,
        SubsidiesRepository_dep: SubsidiesDataSource,
        GraphRepository_dep: GraphDataSource,
        CommuneAverageRepository_dep: CommuneAverageDataSource,
        CalculationEngine_dep: ICalculationEngine,
        InputParametersDataSource_dep: InputParametersDataSource,
    ):
        """
        Initialize and cache all dependencies.

        Notes
        -----
        The class stores references to dependency implementations and provides them
        via `get_*` accessors. It also performs one-time loading of input definitions
        (`_inputs_dep`) to avoid repeated IO during requests.
        """
        self._commune_repository_dep = CommuneRepository_dep
        self._measure_repository_dep = MeasureRepository_dep
        self._reference_commune_repository_dep = ReferenceCommuneRepository_dep
        self._subsidies_repository_dep = SubsidiesRepository_dep
        self._graph_repository_dep = GraphRepository_dep
        self._commune_average_repository_dep = CommuneAverageRepository_dep
        self._calculation_engine_dep = CalculationEngine_dep

        self._input_data_source_dep = InputParametersDataSource_dep

        # Cache input parameter definitions once (used e.g. for individualisation levels)
        self._inputs_dep: dict[str, Any] = InputParametersDataSource_dep.get_input_parameters()

        # Lazy-created service (because it depends on other deps and cached inputs)
        self._calculation_service: CalculationService | None = None

        # Validator (current implementation: checks for new/changed data in prefilled fields)
        self.validator = ValidatiorAndUpdater()

    # -------------------------------------------------------------------------
    # Repositories / Data Sources
    # -------------------------------------------------------------------------

    def get_CommuneRepository(self) -> CommuneDataSource:
        """
        Return the commune data source/repository.
        """
        if self._commune_repository_dep is None:
            _raise_missing_dependency("CommuneRepository_dep")
        return self._commune_repository_dep

    def get_CommuneAverageRepository(self) -> CommuneAverageDataSource:
        """
        Return the commune average data source.

        Note
        ----
        Currently backed by a dummy implementation (placeholder).
        """
        if self._commune_average_repository_dep is None:
            _raise_missing_dependency("CommuneAverageRepository_dep")
        return self._commune_average_repository_dep

    def get_MeasureRepository(self) -> MeasureDataSource:
        """
        Return the measures data source/repository.
        """
        if self._measure_repository_dep is None:
            _raise_missing_dependency("MeasureRepository_dep")
        return self._measure_repository_dep

    def get_ReferenceCommuneRepository(self) -> ReferenceCommuneDataSource:
        """
        Return the reference commune repository.
        """
        if self._reference_commune_repository_dep is None:
            _raise_missing_dependency("ReferenceCommuneRepository_dep")
        return self._reference_commune_repository_dep

    def get_SubsidiesRepository(self) -> SubsidiesDataSource:
        """
        Return the subsidies data source/repository.

        Note
        ----
        Currently backed by a dummy implementation (placeholder).
        """
        if self._subsidies_repository_dep is None:
            _raise_missing_dependency("SubsidiesRepository_dep")
        return self._subsidies_repository_dep

    def get_GraphRepository(self) -> GraphDataSource:
        """
        Return the graph repository/data source.
        """
        if self._graph_repository_dep is None:
            _raise_missing_dependency("GraphRepository_dep")
        return self._graph_repository_dep

    def get_InputParametersDataSource(self) -> InputParametersDataSource:
        """
        Return the input parameters data source.
        """
        if self._input_data_source_dep is None:
            _raise_missing_dependency("InputParametersDataSource_dep")
        return self._input_data_source_dep

    # -------------------------------------------------------------------------
    # Calculation Services
    # -------------------------------------------------------------------------

    def get_CalculationService(self) -> CalculationService:
        """
        Return the calculation service (lazy-initialized).

        The service is created once and cached, to ensure:
        - consistent behavior and state
        - no repeated initialization overhead
        """
        if self._calculation_service is None:
            self._calculation_service = CalculationService(
                self.get_CalculationEngine(),
                self._inputs_dep,
            )
        return self._calculation_service

    def get_CalculationEngine(self) -> ICalculationEngine:
        """
        Return the calculation engine.
        """
        if self._calculation_engine_dep is None:
            _raise_missing_dependency("CalculationEngine_dep")
        return self._calculation_engine_dep

    # -------------------------------------------------------------------------
    # Validators
    # -------------------------------------------------------------------------

    def get_InputValidator(self) -> Any:
        """
        Return the input validator.

        Current behavior
        ----------------
        The validator currently only checks whether there is *new/changed data*
        for fields that were previously prefilled (e.g., commune/average prefill).
        """
        if self.validator is None:
            _raise_missing_dependency("Validator")
        return self.validator


# =============================================================================
# Factory Function
# =============================================================================

def build_dependencies(build_complete: bool = True, run_updates_flag: bool = True) -> Dependencies:
    """
    Build and wire up all dependencies.

    Parameters
    ----------
    build_complete:
        If True, external data downloads are executed before building dependencies.
    run_updates_flag:
        If True, update routines are executed after downloads.

    Returns
    -------
    Dependencies
        A fully initialized dependency container.
    """
    logger = logging.getLogger(__name__)
    logger.info("Building dependencies...")

    if build_complete:
        run_downloads(
            config_path="/app/config/DownloadConfig.json",
            output_root="/app/data/extern",
        )
        logger.info("Downloads completed successfully.")
    else:
        logger.info("Downloads skipped (build_complete=False).")

    if run_updates_flag:
        run_updates()
        logger.info("Updates completed successfully.")
    else:
        logger.info("Updates skipped (run_updates_flag=False).")

    # -- Build the calculation engine first (reads Excel files, builds DAGs) --
    calc_engine = CalculationAPI(CALCULATION_SHEETS_DIR)

    base_measure_source = MeasuresInformationExtractor(MEASURES_EXCEL_FILE)

    calculation_measure_ids = calc_engine.get_available_measures()


    scenario_aware_measures = ScenarioAwareMeasureDataSource(
        base_source=base_measure_source,
        calculation_measure_ids=calculation_measure_ids,
    )

    return Dependencies(
        CommuneRepository_dep=CommuneParserDataSource(),
        MeasureRepository_dep=scenario_aware_measures,
        ReferenceCommuneRepository_dep=ReferenceCommuneRepository(
            commune_directory=REFERENCE_COMMUNE_DIR,
            info_file_path=REFERENCE_COMMUNE_INFO_FILE,
        ),
        SubsidiesRepository_dep=DummySubsidiesDataSource(),           # TODO: replace with real implementation
        GraphRepository_dep=GraphRepository(
            GRAPH_EXCEL_FILE,
            #measure_source=scenario_aware_measures,
        ),
        CommuneAverageRepository_dep=DummyCommuneAverageDataSource(), # TODO: replace with real implementation
        CalculationEngine_dep=calc_engine,
        InputParametersDataSource_dep=DataCityCategoriesExtractor(CALCULATION_SHEETS_DIR),
    )
