"""
This scripts run's everything related to the Daemon job every night at 03:00 AM.
See herefore backend/services/README_DAEMON_JOB.md
Author: Jonas Dorner (@OilersLD)
"""

from externalAPI.Downloader import run_downloads
from externalAPI.Updater import run_updates
from externalAPI.Constants import Constants

run_downloads(Constants.CONFIG_PATH, Constants.OUT_ROOT)
run_updates()