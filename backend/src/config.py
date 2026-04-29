"""
Centralized Configuration for KommMa Backend

All file paths and directory locations are defined here in ONE place.
To change paths, either:
  1. Set environment variables (recommended for deployment / Docker)
  2. Create a .env file in the project root
  3. Edit the DEFAULT values below

Environment variables take precedence over defaults.

Required directories / files:
  CALCULATION_SHEETS_DIR      – folder with calculation Excel sheets
  REFERENCE_COMMUNE_DIR       – folder with reference commune Excel sheets
  GRAPH_EXCEL_FILE            – path to the Beziehungscheck Excel file
  MEASURES_EXCEL_FILE         – path to the Maßnahmen-Information Excel file
  REFERENCE_COMMUNE_INFO_FILE – path to the Reference Commune Information Excel file
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Try to load a .env file if python-dotenv is installed (optional dependency)
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv

    # Walk up from this file to find the project root (.env lives there)
    _project_root = Path(__file__).resolve().parent.parent # backend/src -> backend -> project root
    _env_path = _project_root / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except ImportError:
    # python-dotenv not installed – rely on real environment variables or defaults
    pass

# ---------------------------------------------------------------------------
# Default base directory – points to the repository's data folder
# ---------------------------------------------------------------------------

# Use PROJECT_ROOT environment variable if set (Docker), otherwise calculate it
# In Docker: /app (set by docker-compose)
# Locally: backend/src/config.py -> backend/src -> backend -> project root
_PROJECT_ROOT_ENV = os.environ.get("PROJECT_ROOT")
if _PROJECT_ROOT_ENV:
    _PROJECT_ROOT = Path(_PROJECT_ROOT_ENV)
else:
    _PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

_DEFAULT_DATA_DIR = str(_PROJECT_ROOT / "data" / "ExcelDataSources")

# ---------------------------------------------------------------------------
# Public configuration values
# ---------------------------------------------------------------------------

# Directory containing calculation Excel sheets
CALCULATION_SHEETS_DIR: str = os.environ.get(
    "CALCULATION_SHEETS_DIR",
    str(Path(_DEFAULT_DATA_DIR) / "MeasureCalculationSheets"),
)

# Directory containing reference commune Excel sheets
REFERENCE_COMMUNE_DIR: str = os.environ.get(
    "REFERENCE_COMMUNE_DIR",
    str(Path(_DEFAULT_DATA_DIR) / "ReferenceCommuneCalculationSheets"),
)

# Path to the graph / relations Excel file
GRAPH_EXCEL_FILE: str = os.environ.get(
    "GRAPH_EXCEL_FILE",
    str(Path(_DEFAULT_DATA_DIR) / "20251124_Beziehungscheck_MV.xlsx"),
)

# Path to the measures information Excel file
MEASURES_EXCEL_FILE: str = os.environ.get(
    "MEASURES_EXCEL_FILE",
    str(Path(_DEFAULT_DATA_DIR) / "MaßnahmenInformationFile.xlsx"),
)

# Path to the reference commune information Excel file
REFERENCE_COMMUNE_INFO_FILE: str = os.environ.get(
    "REFERENCE_COMMUNE_INFO_FILE",
    str(Path(_DEFAULT_DATA_DIR) / "ReferenceCommuneInformationSheet.xlsx"),
)
