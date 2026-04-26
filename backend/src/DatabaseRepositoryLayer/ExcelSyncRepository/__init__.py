"""
ExcelSyncRepository
===================
Synchronises the central mastertable with dependent calculation Excel files.

When the central file (``DataGeneralMastertable.xlsx``) is updated by the
nightly daemon or any other process, each dependent calculation sheet must
reflect the latest ``Wert`` values for matching ``Datenkategorie`` rows on
its **Sheet index 1** ("Daten Generell").

Sub-modules
    sync_engine — core matching and write-back logic
    watcher     — filesystem watcher with debounced change detection
"""
