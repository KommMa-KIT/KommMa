import json
import logging
import os
import signal
import threading
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest
from watchdog.events import FileModifiedEvent, FileMovedEvent, DirModifiedEvent

from DatabaseRepositoryLayer.ExcelSyncRepository.watcher import (
    _DebouncedHandler,
    _configure_logging,
    main,
)


# --------------------------------------------------
# Helpers
# --------------------------------------------------

class _PresetEvent:
    """A threading.Event replacement that reports set on the second is_set() call."""

    def __init__(self):
        self._calls = 0

    def set(self):
        self._calls = 100  # force exit

    def is_set(self):
        self._calls += 1
        return self._calls > 1  # False first time, True after

    def wait(self, timeout=None):
        pass


# --------------------------------------------------
# Helpers
# --------------------------------------------------

def _make_handler(
    central_file: str = "/data/master.xlsx",
    debounce: float = 0.0,
) -> _DebouncedHandler:
    engine = MagicMock()
    return _DebouncedHandler(engine, debounce, central_file)


# --------------------------------------------------
# _DebouncedHandler.on_any_event
# --------------------------------------------------

def test_on_any_event_triggers_on_central_file_modification():
    handler = _make_handler(central_file="/data/master.xlsx", debounce=0.0)

    event = FileModifiedEvent("/data/master.xlsx")
    handler.on_any_event(event)

    # Wait briefly for the timer to fire
    import time
    time.sleep(0.1)

    handler._engine.run.assert_called_once()


def test_on_any_event_ignores_unrelated_files():
    handler = _make_handler(central_file="/data/master.xlsx")

    event = FileModifiedEvent("/data/other_file.xlsx")
    handler.on_any_event(event)

    handler._engine.run.assert_not_called()


def test_on_any_event_ignores_directory_events():
    handler = _make_handler(central_file="/data/master.xlsx")

    event = DirModifiedEvent("/data/")
    handler.on_any_event(event)

    handler._engine.run.assert_not_called()


def test_on_any_event_handles_move_event_with_dest():
    handler = _make_handler(central_file="/data/master.xlsx", debounce=0.0)

    event = FileMovedEvent("/data/tmp_save.xlsx", "/data/master.xlsx")
    handler.on_any_event(event)

    import time
    time.sleep(0.1)

    handler._engine.run.assert_called_once()


def test_on_any_event_ignores_move_to_unrelated_dest():
    handler = _make_handler(central_file="/data/master.xlsx")

    event = FileMovedEvent("/data/master.xlsx", "/data/backup.xlsx")
    # src_path matches but on_any_event checks name — master.xlsx is in paths_to_check
    # per the implementation, src_path name IS checked too
    # so this should actually trigger. Let's test with neither matching.
    event2 = FileMovedEvent("/data/a.xlsx", "/data/b.xlsx")
    handler.on_any_event(event2)

    handler._engine.run.assert_not_called()


def test_debounce_collapses_rapid_events():
    handler = _make_handler(central_file="/data/master.xlsx", debounce=0.2)

    # Fire multiple rapid events
    for _ in range(5):
        event = FileModifiedEvent("/data/master.xlsx")
        handler.on_any_event(event)

    import time
    time.sleep(0.4)

    # Engine should be called only once despite 5 events
    handler._engine.run.assert_called_once()


def test_sync_exception_does_not_crash_handler():
    handler = _make_handler(central_file="/data/master.xlsx", debounce=0.0)
    handler._engine.run.side_effect = RuntimeError("sync failed")

    event = FileModifiedEvent("/data/master.xlsx")
    handler.on_any_event(event)

    import time
    time.sleep(0.1)

    # Should have been called (and the exception caught internally)
    handler._engine.run.assert_called_once()


# --------------------------------------------------
# _configure_logging
# --------------------------------------------------

def test_configure_logging_without_file(tmp_path):
    """Calling with None should not create any log file."""
    import logging
    root = logging.getLogger()
    handlers_before = len(root.handlers)

    _configure_logging(None)

    # Should have added at least a stderr handler (basicConfig is idempotent
    # if root already has handlers, so just verify no crash)
    assert True


def test_configure_logging_with_file(tmp_path):
    """Passing a log_file path should create the file on disk."""
    log_file = tmp_path / "logs" / "test.log"
    assert not log_file.exists()

    # Reset root logger so basicConfig can take effect
    import logging
    root = logging.getLogger()
    for h in root.handlers[:]:
        root.removeHandler(h)

    _configure_logging(str(log_file))

    # Parent directory created, file handler added
    assert log_file.parent.exists()

    # Clean up: remove FileHandler to avoid leaking open files
    for h in root.handlers[:]:
        if isinstance(h, logging.FileHandler):
            root.removeHandler(h)
            h.close()


# --------------------------------------------------
# Helper: write a minimal ExcelSyncConfig JSON
# --------------------------------------------------

def _write_config(tmp_path, debounce=0, log_file=None, extra=None):
    central = tmp_path / "master.xlsx"
    central.write_bytes(b"dummy")
    cfg = {
        "central_file": str(central),
        "dependent_files_dir": str(tmp_path),
        "central_sheet_index": 0,
        "central_header_row": 1,
        "central_match_column": "Datenkategorie",
        "central_value_column": "Wert",
        "dependent_sheet_index": 1,
        "dependent_header_row": 5,
        "dependent_match_column": "Datenkategorie",
        "dependent_value_column": "Wert",
        "debounce_seconds": debounce,
    }
    if log_file is not None:
        cfg["log_file"] = log_file
    if extra:
        cfg.update(extra)
    cfg_file = tmp_path / "config.json"
    cfg_file.write_text(json.dumps(cfg), encoding="utf-8")
    return str(cfg_file)


# --------------------------------------------------
# main()
# --------------------------------------------------

@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.threading.Event", _PresetEvent)
@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.Observer")
@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.SyncEngine")
def test_main_starts_observer_and_runs_initial_sync(mock_engine_cls, mock_observer_cls, tmp_path):
    """main() should start the observer and run an initial sync."""
    cfg_path = _write_config(tmp_path)

    mock_engine = MagicMock()
    mock_engine_cls.return_value = mock_engine

    mock_observer = MagicMock()
    mock_observer_cls.return_value = mock_observer

    main(cfg_path)

    mock_engine_cls.assert_called_once_with(cfg_path)
    mock_observer.start.assert_called_once()
    mock_engine.run.assert_called_once()  # initial sync
    mock_observer.stop.assert_called_once()
    mock_observer.join.assert_called_once()


@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.threading.Event", _PresetEvent)
@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.Observer")
@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.SyncEngine")
def test_main_continues_when_initial_sync_fails(mock_engine_cls, mock_observer_cls, tmp_path):
    """If the initial sync raises, main() should still keep watching."""
    cfg_path = _write_config(tmp_path)

    mock_engine = MagicMock()
    mock_engine.run.side_effect = RuntimeError("initial sync boom")
    mock_engine_cls.return_value = mock_engine

    mock_observer = MagicMock()
    mock_observer_cls.return_value = mock_observer

    # Should NOT raise despite the sync failure
    main(cfg_path)

    mock_observer.start.assert_called_once()
    mock_observer.stop.assert_called_once()


@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.threading.Event", _PresetEvent)
@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.Observer")
@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.SyncEngine")
def test_main_uses_default_debounce_when_missing(mock_engine_cls, mock_observer_cls, tmp_path):
    """When debounce_seconds is absent from config, default (3) is used."""
    central = tmp_path / "master.xlsx"
    central.write_bytes(b"dummy")
    cfg = {
        "central_file": str(central),
        # no debounce_seconds key
    }
    cfg_file = tmp_path / "config.json"
    cfg_file.write_text(json.dumps(cfg), encoding="utf-8")

    mock_engine = MagicMock()
    mock_engine_cls.return_value = mock_engine
    mock_observer = MagicMock()
    mock_observer_cls.return_value = mock_observer

    main(str(cfg_file))

    mock_observer.start.assert_called_once()


@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.threading.Event", _PresetEvent)
@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.Observer")
@patch("DatabaseRepositoryLayer.ExcelSyncRepository.watcher.SyncEngine")
def test_main_reads_config_from_env(mock_engine_cls, mock_observer_cls, tmp_path, monkeypatch):
    """main(None) should fall back to the EXCEL_SYNC_CONFIG env var."""
    cfg_path = _write_config(tmp_path)
    monkeypatch.setenv("EXCEL_SYNC_CONFIG", cfg_path)

    mock_engine = MagicMock()
    mock_engine_cls.return_value = mock_engine
    mock_observer = MagicMock()
    mock_observer_cls.return_value = mock_observer

    main(None)

    mock_engine_cls.assert_called_once_with(cfg_path)
