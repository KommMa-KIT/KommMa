"""
This scripts run's everything related to the Half year Checker job every six months take place.
See herefore backend/services/README_DAEMON_JOB.md
Author: Jonas Dorner (@OilersLD)
"""
from externalAPI.Checker import run_check

run_check()