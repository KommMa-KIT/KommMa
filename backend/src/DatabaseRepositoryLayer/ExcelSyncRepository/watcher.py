"""
Excel Sync Watcher
==================
Monitors the central mastertable for filesystem changes and triggers the
sync engine after a configurable debounce interval.

Architecture
------------
* Uses **watchdog** ``Observer`` to receive OS-level file-change events
  (inotify on Linux) — no polling, minimal CPU overhead.
* A **3-second debounce** (configurable via ``ExcelSyncConfig.json``)
  collapses rapid successive writes (e.g. openpyxl creating a temp file,
  renaming, then deleting the old one) into a single sync run.
* Designed to run as an unbounded ``main()`` loop inside a systemd
  ``Type=simple`` service.  Graceful shutdown on SIGTERM / SIGINT via
  Python's ``signal`` module.

Thread Safety
-------------
The debounce timer fires on a background thread.  Because ``SyncEngine.run``
is the *only* code that executes inside that callback, and the timer is
reset on every new event, there is never more than one sync running at a
time.
"""

import json
import logging
import os
import signal
import sys
import threading
from pathlib import Path

from watchdog.events import FileSystemEvent, FileSystemEventHandler, FileMovedEvent
from watchdog.observers import Observer

from DatabaseRepositoryLayer.ExcelSyncRepository.sync_engine import SyncEngine

logger = logging.getLogger(__name__)


class _DebouncedHandler(FileSystemEventHandler):
    """
    Watchdog event handler with debounced sync execution.

    Resets a ``threading.Timer`` on every qualifying event so that the
    sync engine fires only once after the configured quiet period.
    """

    def __init__(self, engine: SyncEngine, debounce_seconds: float, central_file: str):
        super().__init__()
        self._engine = engine
        self._debounce = debounce_seconds
        self._central_name = Path(central_file).name
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()

    def on_any_event(self, event: FileSystemEvent) -> None:
        # Only react to changes involving the central file itself.
        if event.is_directory:
            return

        # Excel saves via an atomic rename: it writes a temp file then moves
        # it over the original.  The final event is a FileMovedEvent whose
        # dest_path is the real filename — check both src and dest.
        paths_to_check = [Path(event.src_path).name]
        if isinstance(event, FileMovedEvent):
            paths_to_check.append(Path(event.dest_path).name)

        if self._central_name not in paths_to_check:
            return

        logger.debug("FS event detected for watched central file: %s", event.event_type)
        self._schedule_sync()

    def _schedule_sync(self) -> None:
        with self._lock:
            if self._timer is not None:
                self._timer.cancel()
            self._timer = threading.Timer(self._debounce, self._run_sync)
            self._timer.daemon = True
            self._timer.start()

    def _run_sync(self) -> None:
        logger.info("Debounce elapsed — starting sync cycle.")
        try:
            self._engine.run()
        except Exception:
            logger.exception("Sync cycle failed.")


def _configure_logging(log_file: str | None) -> None:
    """
    Set up root logger to write to *log_file* (with rotation handled by
    systemd journal in production) and to stderr for local debugging.
    """
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stderr)]

    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_path, encoding="utf-8"))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=handlers,
    )


def main(config_path: str | None = None) -> None:
    """
    Entry point for the Excel sync watcher.

    Resolves the config path, starts the watchdog observer on the directory
    containing the central file, and blocks until SIGTERM or SIGINT.
    """
    if config_path is None:
        config_path = os.getenv(
            "EXCEL_SYNC_CONFIG",
            "/app/config/ExcelSyncConfig.json",
        )

    with open(config_path, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)

    _configure_logging(cfg.get("log_file"))

    engine = SyncEngine(config_path)
    central_file = cfg["central_file"]
    debounce = cfg.get("debounce_seconds", 3)
    watch_dir = str(Path(central_file).parent)

    handler = _DebouncedHandler(engine, debounce, central_file)
    observer = Observer()
    observer.schedule(handler, watch_dir, recursive=False)

    # Graceful shutdown ----------------------------------------------------
    shutdown_event = threading.Event()

    def _handle_signal(signum: int, _frame: object) -> None:
        sig_name = signal.Signals(signum).name
        logger.info("Received %s — shutting down.", sig_name)
        shutdown_event.set()

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    # Start ----------------------------------------------------------------
    observer.start()
    logger.info(
        "Watching configured central file (debounce=%ds). Press Ctrl+C or send SIGTERM to stop.",
        debounce,
    )

    # Run an initial sync so dependent files are up-to-date at service start.
    logger.info("Running initial sync on startup.")
    try:
        engine.run()
    except Exception:
        logger.exception("Initial sync failed — watcher continues.")

    # Block until signal ---------------------------------------------------
    try:
        while not shutdown_event.is_set():
            shutdown_event.wait(timeout=1)
    finally:
        observer.stop()
        observer.join()
        logger.info("Watcher stopped.")


if __name__ == "__main__":
    import sys as _sys
    main(_sys.argv[1] if len(_sys.argv) > 1 else None)
