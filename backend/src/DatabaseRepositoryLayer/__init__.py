"""
DatabaseRepositoryLayer
=======================
Data-access layer that abstracts all persistence details (currently Excel files)
behind clean repository interfaces.

Architecture
------------
Each repository implements a Protocol defined in ``ApplicationLayer.DataApi.interfaces``
(e.g. ``GraphDataSource``, ``MeasureDataSource``), so the business layer never depends
on a concrete storage technology.  Swapping the backing store — for instance migrating
from Excel to PostgreSQL or adding a Redis cache — requires only a new repository
implementation that satisfies the same Protocol.

Sub-packages
    CalculationRepository   — formula-based measure calculations
    DataInputRepository     — input-parameter definitions for the frontend form
    ExcelSyncRepository     — mastertable → calculation-sheet sync engine + watcher
    GraphRepository         — measure-to-measure relationship graph (synergy / conflict)
    MeasureRepository       — catalogue of available climate-protection measures
    ReferenceCommuneRepository — pre-filled input sets for demo / reference communes
    Exceptions              — domain-specific error types raised by repositories

Shared base classes
    BaseExcelProcessor      — low-level Excel cell reading and file discovery
    MultiSheetInfoExtractor — generic extraction from multi-sheet workbooks
"""
