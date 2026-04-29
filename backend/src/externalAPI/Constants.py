"""
A class with all Constants needed in externalAPI to prevent hardcoding the same string multiple times.
Author: Jonas Dorner (@OilersLD)
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from externalAPI.ENV_Reader import env_required


class Constants:

    CONFIG_PATH = "/app/config/DownloadConfig.json"
    ADMIN_EMAIL = env_required("ADMIN_EMAIL")
    CONSTANTS_CHANGES_CONFIG = Path("/app/config/constants_that_change.json")

    # ======================
    # Downloader
    # ======================
    DEFAULT_VALUE_FOR_KEY_FOR_TARGET_SRTM = "srtm_germany_dtm.tif"
    KEY_FOR_TARGET_SRTM = "raw_target"

    SOURCE_NAME_SRTM = "srtm_elevation"
    SOURCE_NAME_GV = "gemeindeverzeichnis"
    SOURCE_NAME_DWD = "dwd_opendata"
    SOURCE_NAME_RDB = "rdb_genesis"
    SOURCE_NAME_STATBUND = "destatis_genesis"

    KEY_FOR_FOLDERS_IN_DWD_JSON = "folders"
    KEY_FOR_PATHES_IN_DWD = "path"
    KEY_FOR_STATION_LIST = "station_list"
    KEY_FOR_SOURCES = "sources"
    KEY_FOR_ITEMS_BLOCK_IN_JSON = "items"
    KEY_FOR_OPTIONAL_IN_JSON = "optional"
    KEY_FOR_ID_OF_ITEMS_IN_JSON = "id"

    NAME_OF_STATION_CSV = "stations.csv"
    DIRECTORY_NAME_FOR_DWD_STATION_LIST = "stations"

    DIRECTORY_NAME_FOR_SRTM = "srtm_elevation"
    DIRECTORY_NAME_FOR_GV = "gv"
    DIRECTORY_NAME_FOR_DWD = "dwd_tree"
    DIRECTORY_NAME_FOR_RDB = "rdb"
    DIRECTORY_NAME_FOR_STATBUND = "destatis"

    SOURCE_ORDER = [
        SOURCE_NAME_STATBUND,
        SOURCE_NAME_RDB,
        SOURCE_NAME_DWD,
        SOURCE_NAME_GV,
        SOURCE_NAME_SRTM,
    ]

    JSON_NAME = "downloader"

    # ======================
    # Parser
    # ======================
    KEY_IN_JSON_LAST_MAIL_OUTDATED_WARNING = "outdated_last_mail"
    LAST_MAIL_OUTDATED_WARNING_FORMAT = "%d.%m.%Y"
    GAP_MAILS_OUTDATED_DAYS = 14

    OUT_ROOT = Path(os.getenv("DATA_ROOT", "/app/data/extern"))
    PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", "/app"))

    MASTER_XLSX_PATH = Path("/app/data/ExcelDataSources/DataGeneralMastertable.xlsx")

    GV_PREFIX = "gemeindeverzeichnis_"          # (Parser: GV_PREFIX)
    GV_SUFFIX = "_suche.csv"                    # (Parser: GV_SUFFIX)

    SRTM_PREFIX = "srtm_germany_dtm_"           # (Parser: SRTM_PREFIX)
    SRTM_SUFFIX = ".tif"                        # (Parser: SRTM_SUFFIX)

    # Verzeichnis-Namen vereinheitlicht: Downloader-Namen behalten
    GV_DIR = OUT_ROOT / DIRECTORY_NAME_FOR_GV
    SRTM_DIR = OUT_ROOT / DIRECTORY_NAME_FOR_SRTM
    RDB_DIR = OUT_ROOT / DIRECTORY_NAME_FOR_RDB
    DWD_DIR = OUT_ROOT / DIRECTORY_NAME_FOR_DWD
    DESTATIS_DIR = OUT_ROOT / DIRECTORY_NAME_FOR_STATBUND

    # Station-List Pfad vereinheitlicht (nutzt Downloader-Namen)
    STATION_LIST_PATH = (
        DWD_DIR / DIRECTORY_NAME_FOR_DWD_STATION_LIST / NAME_OF_STATION_CSV
    )

    DWD_DD_DIR = DWD_DIR / "dd" / "median15a_dd_recent.csv"
    DWD_AVERAGES_CSV = OUT_ROOT / "dwd_durchschnitte.csv"

    TOPICALITY_COLUMN_MASTERTABLE = "Aktualität"
    NAME_COLUMN_MASTERTABLE = "Datenkategorie"

    # This is the gap in days after which a warning mail should be sent, if the data is outdated. It is used in the
    # Updater_Mastertable, but it is a general constant, that can be used for all data sources, so it is defined here.
    AGE_OUTDATED_WARNING_IN_DATES_WITH_AUTOMATIC_UPDATE = 7
    AGE_OUTDATED_WARNING_IN_DATES_WITHOUT_AUTOMATIC_UPDATE = 91  # There are values that are calculated by the experts and could not be automaticly updated. To prevent from spam, we only show them after 91 Days.

    TITLE_COL_OUTDATED_WARNING = NAME_COLUMN_MASTERTABLE
    DATE_COL_OUTDATED_WARNING = "last_updated"
    SOURCE_COL_OUTDATED_WARNING = "source_name"

    PATH_FOR_JSON_INPUT_FIELDS = "/app/config/Input_fields_id.json"

    # ======================
    # EMail_Service
    # ======================
    SMTP_SERVER = "smtp.gmail.com"
    SMTP_PORT = 587  # STARTTLS
    # DEPTH_OF_FILE_TO_ENV = 3 # Has to be in ENV_Reader, cause we have to have it, before we can import Constants there. (We need it to find the .env file)
    GMAIL_CREDENTIALS = (  # (email, app_password)
        env_required("GMAIL_USER"),
        env_required("GMAIL_APP_PASSWORD"),
    )
    FOOTER_EMAIL = f"\n\nThis email was sent automatically by the KommMa Tool. Please do not reply to this email."

    # ======================
    # Converter_Gemeindeverzeichnis
    # ======================
    LAENDERCODE_BW = "08"
    SATZART = "60"
    CSV_SEPARATOR_DEFAULT = ";"
    CSV_ENCODING_DEFAULT = "utf-8-sig"

    # File patterns / naming
    CONVERTER_GEMEINDEVERZEICHNIS_DEFAULT_XLSX_PATTERN = "*.xlsx"
    CONVERTER_GEMEINDEVERZEICHNIS_EXCEL_LOCK_PREFIX = "~$"
    CONVERTER_GEMEINDEVERZEICHNIS_OUTPUT_SUFFIX = GV_SUFFIX
    CONVERTER_GEMEINDEVERZEICHNIS_TMP_SUFFIX = ".tmp"

    # Text / normalization helpers
    CONVERTER_GEMEINDEVERZEICHNIS_WHITESPACE_REGEX = r"\s+"
    CONVERTER_GEMEINDEVERZEICHNIS_SPACE = " "
    CONVERTER_GEMEINDEVERZEICHNIS_EMPTY = ""
    CONVERTER_GEMEINDEVERZEICHNIS_TRAILING_DOT_ZERO_REGEX = r"\.0$"
    CONVERTER_GEMEINDEVERZEICHNIS_NAN_STRING = "nan"
    CONVERTER_GEMEINDEVERZEICHNIS_EXCEL_UNNAMED_PREFIX = "Unnamed"
    CONVERTER_GEMEINDEVERZEICHNIS_MULTIINDEX_JOINER = "_"

    # Sheet / parsing
    CONVERTER_GEMEINDEVERZEICHNIS_HEADER_CANDIDATES = (
        (2, 3),
        (2, 3, 4),
        (1, 2, 3),
    )

    # Destatis "needles" used to find columns robustly
    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_SATZART = "Satzart",
    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_NAME = "Gemeindename",
    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_PLZ = "Postleitzahl",

    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_LAND = "_land", " Land"
    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_RB = "_rb", " RB"
    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_KREIS = "_kreis", " Kreis"
    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_GEM = "_gem", " Gem"

    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_LON = "längengrad", "laengengrad"
    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_LAT = "breitengrad",
    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_FLAECHE = "fläche", "flaeche"
    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_EINWOHNER = "insgesamt",
    CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_DICHTE = "je km2", "je km²"

    # Satzart values (40 = district, 60 = municipalities lives already in Constants.SATZART)
    CONVERTER_GEMEINDEVERZEICHNIS_SATZART_KREIS = "40"

    # Output columns
    CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_AGS = "AGS"
    CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_PLZ = "PLZ"
    CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_NAME = "NAME"
    CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_LANDKREIS = "LANDKREIS"
    CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_LAENGENGRAD = "LAENGENGRAD"
    CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_BREITENGRAD = "BREITENGRAD"
    CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_FLAECHE_KM2 = "FLAECHE_KM2"
    CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_EINWOHNER = "EINWOHNER"
    CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_BEVOELKERUNGSDICHTE = "BEVOELKERUNGSDICHTE"

    # Error / message templates
    CONVERTER_GEMEINDEVERZEICHNIS_ERR_INPUT_NOT_FOUND_PREFIX = "Input Excel not found: "
    CONVERTER_GEMEINDEVERZEICHNIS_ERR_FOLDER_NOT_FOUND_PREFIX = "Folder not found: "
    CONVERTER_GEMEINDEVERZEICHNIS_ERR_NO_SHEET_WITH_SATZART = "No sheet containing a 'Satzart' column could be found."
    CONVERTER_GEMEINDEVERZEICHNIS_ERR_COLUMN_NOT_FOUND_TEMPLATE = "Column not found for {needles}. Available: {cols}"
    CONVERTER_GEMEINDEVERZEICHNIS_ERR_CSV_OK_BUT_DELETE_FAILED_TEMPLATE = "CSV ok, but Excel could not be deleted: {err_type}: {err}"
    CONVERTER_GEMEINDEVERZEICHNIS_ERR_EXCEPTION_TEMPLATE = "{err_type}: {err}"

    # ======================
    # Search_Gemeindeverzeichnis
    # ======================

    # CSV / IO
    SEARCH_GEMEINDEVERZEICHNIS_CSV_SEP = CSV_SEPARATOR_DEFAULT
    SEARCH_GEMEINDEVERZEICHNIS_CSV_ENCODING = CSV_ENCODING_DEFAULT

    # Expected CSV columns
    SEARCH_GEMEINDEVERZEICHNIS_COL_AGS = "AGS"
    SEARCH_GEMEINDEVERZEICHNIS_COL_PLZ = "PLZ"
    SEARCH_GEMEINDEVERZEICHNIS_COL_NAME = "NAME"
    SEARCH_GEMEINDEVERZEICHNIS_COL_NAME_NORM = "NAME_NORM"

    # Lengths
    SEARCH_GEMEINDEVERZEICHNIS_AGS_LENGTH = 8
    SEARCH_GEMEINDEVERZEICHNIS_PLZ_LENGTH = 5

    # Text normalization
    SEARCH_GEMEINDEVERZEICHNIS_UNICODE_NORMAL_FORM = "NFKD"
    SEARCH_GEMEINDEVERZEICHNIS_NON_ALNUM_WHITESPACE_REGEX = r"[^0-9a-z\s]"
    SEARCH_GEMEINDEVERZEICHNIS_MULTISPACE_REGEX = CONVERTER_GEMEINDEVERZEICHNIS_WHITESPACE_REGEX
    SEARCH_GEMEINDEVERZEICHNIS_REPLACE_WITH_SPACE = CONVERTER_GEMEINDEVERZEICHNIS_SPACE

    # Search behavior
    SEARCH_GEMEINDEVERZEICHNIS_RESULT_LIMIT = 5
    SEARCH_GEMEINDEVERZEICHNIS_CONTAINS_MULTIPLIER = 4

    SEARCH_GEMEINDEVERZEICHNIS_FUZZY_MIN_QUERY_LEN = 3
    SEARCH_GEMEINDEVERZEICHNIS_FUZZY_LEN_WINDOW_BEFORE = 3
    SEARCH_GEMEINDEVERZEICHNIS_FUZZY_LEN_WINDOW_AFTER = 12
    SEARCH_GEMEINDEVERZEICHNIS_FUZZY_POOL_LIMIT = 4000
    SEARCH_GEMEINDEVERZEICHNIS_FUZZY_MIN_SCORE = 60

    # Temporary helper columns (internal)
    SEARCH_GEMEINDEVERZEICHNIS_TMP_LEN_DIFF_COL = "_len_diff"

    # Scores
    SEARCH_GEMEINDEVERZEICHNIS_SCORE_EXACT = 100
    SEARCH_GEMEINDEVERZEICHNIS_SCORE_AGS_PREFIX = 85
    SEARCH_GEMEINDEVERZEICHNIS_SCORE_PLZ_PREFIX = 80
    SEARCH_GEMEINDEVERZEICHNIS_SCORE_STARTSWITH = 100
    SEARCH_GEMEINDEVERZEICHNIS_SCORE_CONTAINS = 90

    # Match type labels
    SEARCH_GEMEINDEVERZEICHNIS_MATCH_AGS_PREFIX = "ags_prefix"
    SEARCH_GEMEINDEVERZEICHNIS_MATCH_PLZ_PREFIX = "plz_prefix"
    SEARCH_GEMEINDEVERZEICHNIS_MATCH_STARTSWITH = "startswith"
    SEARCH_GEMEINDEVERZEICHNIS_MATCH_CONTAINS = "contains"
    SEARCH_GEMEINDEVERZEICHNIS_MATCH_FUZZY = "fuzzy"

    # Output formatting
    SEARCH_GEMEINDEVERZEICHNIS_MSG_NO_RESULTS = "No results."
    SEARCH_GEMEINDEVERZEICHNIS_RESULT_FORMAT = "{score:3d} | {match_type:10s} | {ags} | {plz} | {name}"

    # Error messages
    SEARCH_GEMEINDEVERZEICHNIS_ERR_CSV_NOT_FOUND_PREFIX = "CSV not found: "
    SEARCH_GEMEINDEVERZEICHNIS_ERR_MISSING_REQUIRED_COLUMNS_PREFIX = "CSV is missing required columns: "

    # ======================
    # Gradtage_Creator
    # ======================
    # (DATA_ROOT existierte vorher als: Path(os.getenv("DATA_ROOT", "/app/data/extern")))
    # -> Vereinheitlicht auf OUT_ROOT

    # (OUTPUT_DIR existierte vorher als: DATA_ROOT / "dwd_tree" / "dd")
    DWD_DD_OUTPUT_DIR = DWD_DIR / "dd"

    ANNUAL_CSV = DWD_DD_OUTPUT_DIR / "annual_dd.csv"
    # (MEDIAN15_CSV existierte vorher als: OUTPUT_DIR / "median15a_dd_recent.csv")
    # -> Duplikat zu DWD_DD_DIR, daher weggelassen

    # (STATIONS_CSV_PATH existierte vorher als: DATA_ROOT / "dwd_tree" / "stations" / "stations.csv")
    # -> Duplikat zu STATION_LIST_PATH, daher weggelassen

    DAILY_CSV_DIR = DWD_DIR / "observations_germany_climate_daily_kl_historical"

    # Spaltennamen (vermeidet Magic Strings)
    COL_STATIONS_ID = "station_id_5"
    COL_STATIONS_NAME = "Stationsname"
    COL_STATIONS_HEIGHT = "Stationshoehe"
    COL_GEO_LAT = "geoBreite"
    COL_GEO_LON = "geoLaenge"
    COL_FILE_INDEX = "file_index"
    # (COL_FILE_INDEX_OUT existierte vorher als: "station_id_5")
    # -> Duplikat zu COL_STATIONS_ID, daher weggelassen

    COL_FROM_DATE = "von_datum"
    COL_TO_DATE = "bis_datum"
    COL_STATIONS_ID_RAW = "STATIONS_ID"
    COL_STATIONS_NAME_RAW = "STATIONSNAME"
    COL_STATIONS_HEIGHT_RAW = "STATIONS_HOEHE"
    COL_GEO_LAT_RAW = "GEOBREITE"
    COL_GEO_LON_RAW = "GEOLAENGE"
    COL_DATE = "MESS_DATUM"
    COL_TEMP = "TMK"
    COL_TIME = "time"
    COL_TEMP_C = "temperature_C"
    COL_YEAR = "year"
    COL_DATE_ONLY = "date"
    COL_DAILY_AVG = "daily_avg_temp"
    COL_DEGREE_DAY = "degree_day"
    COL_ANNUAL_DD = "annual_dd"

    CSV_SEP = ","

    STATION_LIST_URL = (
        "https://opendata.dwd.de/climate_environment/CDC/observations_germany/"
        "climate/daily/kl/historical/KL_Tageswerte_Beschreibung_Stationen.txt"
    )

    # Generic
    GRADTAGE_CREATOR_EMPTY = CONVERTER_GEMEINDEVERZEICHNIS_EMPTY
    GRADTAGE_CREATOR_NA = "N/A"
    GRADTAGE_CREATOR_COERCE = "coerce"
    GRADTAGE_CREATOR_PANDAS_ENGINE = "python"

    # IDs / parsing
    GRADTAGE_CREATOR_STATION_ID_WIDTH = 5
    GRADTAGE_CREATOR_TRAILING_DOT_ZERO_REGEX = CONVERTER_GEMEINDEVERZEICHNIS_TRAILING_DOT_ZERO_REGEX

    # Encodings / filenames
    GRADTAGE_CREATOR_STATION_LIST_ENCODING = "iso-8859-1"
    GRADTAGE_CREATOR_STATIONS_TXT_FILENAME = "stations_sued.txt"

    # Station filter
    GRADTAGE_CREATOR_TARGET_STATES = "Baden-Württemberg", "Bayern", "Hessen", "Rheinland-Pfalz"
    GRADTAGE_CREATOR_FROM_DATE_CUTOFF = 20101231
    GRADTAGE_CREATOR_TO_DATE_CUTOFF = 20200101
    GRADTAGE_CREATOR_DATE_YYYYMMDD_FORMAT = "%Y%m%d"

    # Fixed-width parsing
    GRADTAGE_CREATOR_STATIONS_FWF_COLSPECS = (
        (0, 5),
        (6, 14),
        (15, 33),
        (34, 42),
        (43, 52),
        (53, 60),
        (61, 101),
        (102, 142),
        (143, None),
    )
    GRADTAGE_CREATOR_STATIONS_FWF_SKIPROWS = 2
    GRADTAGE_CREATOR_COL_BUNDESLAND = "Bundesland"
    GRADTAGE_CREATOR_COL_ABGABE = "Abgabe"

    # URL building
    GRADTAGE_CREATOR_DATE_YYYYMMDD_FORMAT_NOSEP = "%Y%m%d"
    GRADTAGE_CREATOR_DATE_DASH = "-"
    GRADTAGE_CREATOR_MAX_BIS_DATE = 20241231
    GRADTAGE_CREATOR_DWD_HIST_BASE_URL = (
        "https://opendata.dwd.de/climate_environment/CDC/observations_germany/"
        "climate/daily/kl/historical/"
    )
    GRADTAGE_CREATOR_HIST_ZIP_FILENAME_TEMPLATE = "tageswerte_KL_{station_id_5}_{von_yyyymmdd}_{bis_yyyymmdd}_hist.zip"
    GRADTAGE_CREATOR_URL_SLASH = "/"
    GRADTAGE_CREATOR_SUFFIX_ZIP = ".zip"
    GRADTAGE_CREATOR_SUFFIX_CSV = ".csv"

    # Download
    GRADTAGE_CREATOR_HTTP_TIMEOUT_S = 30
    GRADTAGE_CREATOR_HTTP_CHUNK_SIZE = 8192
    GRADTAGE_CREATOR_ZIP_OPEN_MODE = "r"
    GRADTAGE_CREATOR_ZIP_DATA_PREFIX = "produkt_klima_tag"

    # File parsing / regex
    GRADTAGE_CREATOR_RX_ANY_CSV_WITH_ID5 = r".*?(\d{5}).*?\.csv$"
    GRADTAGE_CREATOR_DWD_MISSING_VALUE = "-999"
    GRADTAGE_CREATOR_TEMP_DTYPE = "float32"
    GRADTAGE_CREATOR_DATE_ISO_FORMAT = "%Y-%m-%d"

    # Merge behavior
    GRADTAGE_CREATOR_MERGE_HOW_LEFT = "left"

    # Degree day calculation
    GRADTAGE_CREATOR_DD_BASE = 20
    GRADTAGE_CREATOR_DD_THRESHOLD = 15

    # Min/max columns & window
    GRADTAGE_CREATOR_MIN = "min"
    GRADTAGE_CREATOR_MAX = "max"
    GRADTAGE_CREATOR_COL_MIN_YEAR = "min_year"
    GRADTAGE_CREATOR_COL_MAX_YEAR = "max_year"
    GRADTAGE_CREATOR_YEAR_WINDOW = 29

    # Median processing
    GRADTAGE_CREATOR_RECENT_YEAR_MIN = 2020
    GRADTAGE_CREATOR_MEDIAN_YEARS = 15
    GRADTAGE_CREATOR_OUT_COL_MEDIAN_15YR_DD = "median_15yr_dd"
    GRADTAGE_CREATOR_ALT_STATIONS_ID_5 = "stations_id_5"

    # Errors / logs
    GRADTAGE_CREATOR_ERR_STATIONS_CSV_NEEDS_ID_OR_INDEX = "Stations CSV needs column 'Stations_id' or 'file_index'."
    GRADTAGE_CREATOR_ERR_NO_ID5_COLUMN_FOUND = "No column for the 5-digit station ID found."
    GRADTAGE_CREATOR_ERR_NO_DWD_DATA_TEMPLATE = "No DWD data loaded; median15 CSV was not created. Dataset: {data_dir}"
    GRADTAGE_CREATOR_LOG_MEDIAN_CREATED_TEMPLATE = "Median 15 years degree-day CSV created: {path}"

    # ======================
    # Downloader_DeutscherWetterdienst
    # ======================
    HEADER_STATIONID = "Stations_id"
    HEADER_STATIONNAME = "Stationsname"
    NORMALIZATION_LENGTH = 5
    OFFSET_OF_START_OF_DATA_IN_DWDFiles = 2

    # URLs / domains
    DWD_DOWNLOADER_BASE_DOMAIN = "https://opendata.dwd.de"
    DWD_DOWNLOADER_CDC_STATIONS_LIST_URL = (
        "https://opendata.dwd.de/climate_environment/CDC/"
        "observations_germany/climate/daily/kl/recent/"
        "KL_Tageswerte_Beschreibung_Stationen.txt"
    )
    DWD_DOWNLOADER_PING_URL = DWD_DOWNLOADER_CDC_STATIONS_LIST_URL

    # Error / info messages
    DWD_DOWNLOADER_ERR_CONNECTION = "DWD CDC: Connection could not be established."
    DWD_DOWNLOADER_ERR_DIR_LISTING = "DWD CDC: Directory listing could not be loaded."
    DWD_DOWNLOADER_ERR_FILE_DOWNLOAD = "DWD CDC: File download failed."
    DWD_DOWNLOADER_ERR_STATIONS_HEADER_NOT_FOUND = "DWD CDC Stationsliste: Headerline could not be found."
    DWD_DOWNLOADER_ERR_STATIONS_MISSING_COLUMNS = "DWD CDC Stationsliste: Missing needed columns for compact view."
    DWD_DOWNLOADER_ERR_ZIP_DOWNLOAD = "DWD CDC: ZIP download failed."
    DWD_DOWNLOADER_ERR_ZIP_NO_DATA_FILES = "DWD CDC: ZIP does not contain .txt or .csv files."
    DWD_DOWNLOADER_ERR_ZIP_PARSE = "DWD CDC: ZIP could not be parsed."
    DWD_DOWNLOADER_MSG_DOWNLOAD_FINISHED = "DWD download finished."

    DWD_DOWNLOADER_PROGRESS_TEMPLATE = (
        "DWD-Download: gefunden {found}, heruntergeladen {downloaded}, "
        "übersprungen {skipped}, fehler {errors}"
    )

    # HTML / index parsing
    DWD_DOWNLOADER_HREF_REGEX_PATTERN = r'href="([^"]+)"'
    DWD_DOWNLOADER_HREF_PARENT_DIR = "../../"
    DWD_DOWNLOADER_HREF_CURRENT_DIR = "/"
    DWD_DOWNLOADER_HREF_SKIP_PREFIXES = "?", "#"

    # Files / suffixes / encodings
    DWD_DOWNLOADER_TEMP_SUFFIX = ".part"
    DWD_DOWNLOADER_ENCODING_UTF8_SIG = CSV_ENCODING_DEFAULT

    DWD_DOWNLOADER_TXT_EXTENSION = ".txt"
    DWD_DOWNLOADER_CSV_EXTENSION = GRADTAGE_CREATOR_SUFFIX_CSV
    DWD_DOWNLOADER_ZIP_EXTENSION = GRADTAGE_CREATOR_SUFFIX_ZIP

    # Daily-KL ZIP naming and extraction
    DWD_DOWNLOADER_DAILY_KL_ZIP_PREFIX = "tageswerte_kl_"
    DWD_DOWNLOADER_ZIP_DATA_EXTENSIONS = DWD_DOWNLOADER_TXT_EXTENSION, DWD_DOWNLOADER_CSV_EXTENSION

    # Pandas parsing / formatting
    DWD_DOWNLOADER_PANDAS_ENGINE = GRADTAGE_CREATOR_PANDAS_ENGINE
    DWD_DOWNLOADER_SEP_DAILY_KL = CSV_SEPARATOR_DEFAULT
    DWD_DOWNLOADER_SEP_TXT_TO_CSV = CSV_SEP
    DWD_DOWNLOADER_DATE_COLUMN = "MESS_DATUM"
    DWD_DOWNLOADER_DATE_FORMAT = "%Y%m%d"
    DWD_DOWNLOADER_MISSING_SENTINELS = -999, -999.0
    DWD_DOWNLOADER_UNNAMED_COLUMN_REGEX = r"^Unnamed"

    # Station columns
    DWD_DOWNLOADER_COL_STATIONS_ID = HEADER_STATIONID
    DWD_DOWNLOADER_COL_STATION_HEIGHT = "Stationshoehe"
    DWD_DOWNLOADER_COL_GEO_LAT = "geoBreite"
    DWD_DOWNLOADER_COL_GEO_LON = "geoLaenge"
    DWD_DOWNLOADER_COL_STATIONS_NAME = HEADER_STATIONNAME
    DWD_DOWNLOADER_COL_BUNDESLAND = "Bundesland"
    DWD_DOWNLOADER_COL_STATION_ID_5 = "station_id_5"

    # String normalization tokens
    DWD_DOWNLOADER_TOKEN_SPACE = " "
    DWD_DOWNLOADER_TOKEN_DASH = "-"
    DWD_DOWNLOADER_TOKEN_UMLAUT_UE = "ü"
    DWD_DOWNLOADER_TOKEN_UMLAUT_UE_REPL = "u"

    # ======================
    # Downloader_Gemeindeverzeichnis
    # ======================
    GV_AUSZUG_EXCEL_URL = (
        "https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/"
        "Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/"
        "AuszugGV3QAktuell.xlsx?__blob=publicationFile"
        # The &v=21 was deliberately omitted here so that the latest version is always loaded.
    )

    # ======================
    # Downloader_Regionaldatenbank
    # ======================
    RDB_BASE_URL = "https://www.regionalstatistik.de/genesisws/rest/2020/"
    LANG_PREF = "de"

    RDB_USER = env_required("RDB_USER")
    RDB_PASS = env_required("RDB_PASS")

    AREA_CANDIDATES = ["my", "user", "all"]

    # ======================
    # Downloader_SRTM
    # ======================
    SRTM_GERMANY_DTM_URL = "https://www.opendem.info/downloads/srtm_germany_dtm.zip"

    # ======================
    # Downloader_StatBund
    # ======================
    DEST_BASE_URL = "https://www-genesis.destatis.de/genesisWS/rest/2020/"
    GENESIS_TOKEN = env_required("GENESIS_TOKEN")

    # ======================
    # Updater_Mastertable
    # ======================
    NAME_TO_FILTER = {
        "Strompreis": "3_variable_attribute_label",
        "Durchschnittspreis Erdgas": "4_variable_attribute_label"
    }
    NAME_TO_FILTER_TARGET = {
        "Strompreis": "Insgesamt",
        "Durchschnittspreis Erdgas": "Insgesamt"
    }
    NAME_TO_TARGET = {
        "Strompreis": "value",
        "Durchschnittspreis Erdgas": "value"
    }
    NAME_TO_THIRD_FILTER = {
        "Strompreis": "",
        "Durschnittspreis Erdgas": "3_variable_attribute_label"
    }
    NAME_TO_THIRD_FILTER_VALUE = {
        "Strompreis": "",
        "Durschnittspreis Erdgas": "Durchschnittspreise inkl.Steuern, Abgaben, Umlagen"
    }

    KEY_IN_JSON_FOR_KLAERSCHLAMM_LAST_MAIL = "klaerschlamm_last_mail"
    KEY_IN_JSON_FOR_KLAERSCHLAMM_YEAR = "year_of_klaerschlamm"
    KLAERSCHLAMM_NOTIFICATION_GAP_IN_DAYS = 7
    KLAERSCHLAMM_NOTIFICATION_LAST_DAY_FORMAT = LAST_MAIL_OUTDATED_WARNING_FORMAT

    # ======================
    # Updater_Mastertable
    # ======================
    CHECKER_JSON_PATH = Path("/app/config/Checker.json")

    KEY_FOR_SOURCES_CHECKER_JSON = "sources"
    KEY_FOR_TYPE_CHECKER_JSON = "type"
    KEY_FOR_URL_TEMPLATE_CHECKER_JSON = "url_template"
    KEY_FOR_LOOKAHEAD_YEARS_CHECKER_JSON = "lookahead_years"
    KEY_FOR_LAST_SEEN_CHECKER_JSON = "last_seen"
    KEY_FOR_YEAR_CHECKER_JSON = "year"
    KEY_FOR_URL_CHECKER_JSON = "url"
    KEY_FOR_LISTING_URL_CHECKER_JSON = "listing_url"
    KEY_FOR_HREF_MUST_CONTAIN_CHECKER_JSON = "href_must_contain"
    KEY_FOR_MUST_CONTAIN_CHECKER_JSON = "must_contain"
    KEY_FOR_DOWNLOAD_URL_CHECKER_JSON = "download_url"

    # type values
    TYPE_YEARLY_PAGE_EXISTS_CHECKER_JSON = "yearly_page_exists"
    TYPE_LISTING_LATEST_DOWNLOAD_CHECKER_JSON = "listing_latest_download"

    # defaults
    DEFAULT_LOOKAHEAD_YEARS_CHECKER_JSON = 5
    DEFAULT_START_YEAR_OFFSET_CHECKER = 1

    # result dict keys (optional, aber konsistent)
    KEY_FOR_UPDATED_CHECK_RESULT = "updated"
    KEY_FOR_LATEST_CHECK_RESULT = "latest"
    KEY_FOR_PREVIOUS_CHECK_RESULT = "previous"

    # dataset-error helpers
    ROW_ALL_CHECKER_JSON = "all"
    ERR_NO_SOURCES_CHECKER_JSON = "There are no values in the Checker.json file. Please add some values to check."
    ERR_NO_DOWNLOAD_LINKS_FOUND_CHECKER_JSON = "No download links found on {listing_url} that match the criteria."
    ERR_UNKNOWN_SOURCE_TYPE_CHECKER_JSON = "Unbekannter source.type: {type} ({name})"

    # Generic
    UPDATER_MASTERTABEL_EMPTY = GRADTAGE_CREATOR_EMPTY
    UPDATER_MASTERTABEL_SPACE = CONVERTER_GEMEINDEVERZEICHNIS_SPACE
    UPDATER_MASTERTABEL_NA = GRADTAGE_CREATOR_NA
    UPDATER_MASTERTABEL_NAN = CONVERTER_GEMEINDEVERZEICHNIS_NAN_STRING

    # Excel / I/O
    UPDATER_MASTERTABEL_SHEET_INDEX = 0
    UPDATER_MASTERTABEL_EXCEL_ENGINE = "openpyxl"
    UPDATER_MASTERTABEL_EXCEL_WRITE_MODE = "w"
    UPDATER_MASTERTABEL_EXCEL_SHEET_NAME = "Sheet1"
    UPDATER_MASTERTABEL_EXCEL_ROW_OFFSET = 2  # header row + 1-based Excel rows

    # Columns in master table
    UPDATER_MASTERTABEL_COL_DATENKATEGORIE = TITLE_COL_OUTDATED_WARNING
    UPDATER_MASTERTABEL_COL_SOURCE_NAME = SOURCE_COL_OUTDATED_WARNING
    UPDATER_MASTERTABEL_COL_SOURCE_ID = "source_id"
    UPDATER_MASTERTABEL_COL_SOURCE_NAME_SOURCE_ID = "source_name/source_id"
    UPDATER_MASTERTABEL_COL_WERT = "Wert"
    UPDATER_MASTERTABEL_COL_LAST_UPDATED = DATE_COL_OUTDATED_WARNING
    UPDATER_MASTERTABEL_COL_TIME = "time"

    # Formatting / dates
    UPDATER_MASTERTABEL_DATE_FORMAT_DDMMYYYY = LAST_MAIL_OUTDATED_WARNING_FORMAT

    # Supported sources
    UPDATER_MASTERTABEL_SOURCE_RDB = "RDB"
    UPDATER_MASTERTABEL_SOURCE_DESTATIS = "DESTATIS"

    # Special-case name matching
    UPDATER_MASTERTABEL_NAME_CONTAINS_MEDIAN = "Median der "
    UPDATER_MASTERTABEL_NAME_CONTAINS_KL = "Kl"
    UPDATER_MASTERTABEL_NAME_CONTAINS_SLUDGE = "rschlammproduktion"

    # Errors / logs
    UPDATER_MASTERTABEL_ERR_MASTER_EMPTY_TEMPLATE = "Mastertable at {path} is empty. Please check the file and try again."
    UPDATER_MASTERTABEL_ERR_MISSING_REQUIRED_FIELDS = "Missing required fields in Mastertable. Please check the file and try again."
    UPDATER_MASTERTABEL_ERR_MISSING_SOURCE_FIELDS = "Missing required fields in Mastertable (source_name/source_id)."
    UPDATER_MASTERTABEL_ERR_MISSING_MAPPING_TEMPLATE = "Missing mapping in constants for Datenkategorie '{name}'."
    UPDATER_MASTERTABEL_ERR_UNKNOWN_SOURCE_TEMPLATE = "Source name '{source}' in Mastertable is not recognized or not supported for '{name}'."
    UPDATER_MASTERTABEL_ERR_VALUE_UPDATE_FAILED_TEMPLATE = (
        "Could not update value for '{name}' (source_name={source_name}, source_id={source_id}). Received: {value}"
    )
    UPDATER_MASTERTABEL_LOG_SUCCESS = "Mastertable updated successfully."

    # CSV / parsing
    UPDATER_MASTERTABEL_CSV_SEP_SEMICOLON = CSV_SEPARATOR_DEFAULT
    UPDATER_MASTERTABEL_PANDAS_ENGINE = GRADTAGE_CREATOR_PANDAS_ENGINE
    UPDATER_MASTERTABEL_RX_YEAR_EXTRACT = r"(\d{4})"

    # Files / JSON
    UPDATER_MASTERTABEL_FILE_READ_MODE = "r"
    UPDATER_MASTERTABEL_FILE_WRITE_MODE = "w"
    UPDATER_MASTERTABEL_FILE_ENCODING = "utf-8"
    UPDATER_MASTERTABEL_JSON_INDENT = 2

    UPDATER_MASTERTABEL_ERR_CHANGES_CONFIG_MISSING = "The config with the constants that can change is not there!"

    # Mail content
    UPDATER_MASTERTABEL_MAIL_SUBJECT_KLAERSCHLAMM_UPDATED = "Median der Klärschlammproduktion BaWü updated"
    UPDATER_MASTERTABEL_MAIL_BODY_KLAERSCHLAMM_PREFIX = (
        "The median of the sludge production in Baden-Württemberg may have new source years."
    )
    UPDATER_MASTERTABEL_MAIL_BODY_KLAERSCHLAMM_PREV_YEAR_TEMPLATE = "Previously expected year: {prev_year}."
    UPDATER_MASTERTABEL_MAIL_BODY_KLAERSCHLAMM_REVIEW_TEMPLATE = "Please review table {table_id} and update constants if necessary."

    # ======================
    # DWD_Averages_Creator
    # ======================
    TARGET_BUNDESLAND = "Baden-Württemberg"
    NORMALIZED_STATION_ID_WIDTH = 5

    STATIONS_HEADER_ID = HEADER_STATIONID
    STATIONS_HEADER_NAME = HEADER_STATIONNAME
    STATIONS_HEADER_SCAN_LINES = 150
    STATIONS_DATA_OFFSET_LINES = 2  # Zeilen nach Header bis Daten

    DWD_MISSING_VALUES = DWD_DOWNLOADER_MISSING_SENTINELS

    REQUIRED_DAILY_COLUMNS = {"TMK", "MESS_DATUM"}
    OPTIONAL_DAILY_COLUMNS = "RSK", "SDK"

    TMK_SCALE_MEDIAN_ABS_THRESHOLD = 200  # falls Zehntelgrad -> sehr große Werte
    TMK_SCALE_DIVISOR = 10.0

    WINDOW_YEARS = 10

    RX_HIST_ZIP = re.compile(r"tageswerte_KL_(\d{5})_.*_hist\.zip$", re.IGNORECASE)
    # Stationsliste (bei dir als CSV in ./stations/)
    DWD_PATH_STATION_LIST = STATION_LIST_PATH

    # Daily KL
    DWD_FOLDER_DAILY_KL_HISTORICAL = "observations_germany_climate_daily_kl_historical/"
    DWD_FOLDER_DAILY_KL_RECENT = "observations_germany_climate_daily_kl_recent/"

    DWD_FOLDER_HDD_RECENT = "derived_germany_techn_monthly_heating_degreedays_hdd_3807_recent/"
    DWD_FOLDER_REGIONAL_AVG_SEASONAL_AIR_TEMP = "regional_averages_DE_seasonal_air_temperature_mean/"

    DWD_TEXT_ENCODINGS = "utf-8", "cp1252", "iso-8859-1", "latin-1"

    DWD_AVERAGE_CREATOR_EMPTY = GRADTAGE_CREATOR_EMPTY
    DWD_AVERAGE_CREATOR_NA = GRADTAGE_CREATOR_NA

    # Decoding
    DWD_AVERAGE_CREATOR_LOG_DECODE_FALLBACK = "Could not decode with %s. Falling back to replace."
    DWD_AVERAGE_CREATOR_DEFAULT_FALLBACK_ENCODING = "utf-8"
    DWD_AVERAGE_CREATOR_DECODE_ERRORS_MODE = "replace"

    # Unicode / normalization
    DWD_AVERAGE_CREATOR_UNICODE_NORMAL_FORM = "NFKD"
    DWD_AVERAGE_CREATOR_SHARP_S = "ß"
    DWD_AVERAGE_CREATOR_SHARP_S_REPL = "ss"
    DWD_AVERAGE_CREATOR_BOM = "\ufeff"

    # Regex
    DWD_AVERAGE_CREATOR_BUNDESLAND_STRIP_NONALNUM_REGEX = r"[^a-z0-9]"
    DWD_AVERAGE_CREATOR_DIGITS_ONLY_REGEX = r"\D"
    DWD_AVERAGE_CREATOR_RX_HIST_CSV = r"tageswerte_KL_(\d{5})_.*_hist\.csv$"

    # Pandas parsing
    DWD_AVERAGE_CREATOR_PANDAS_ENGINE = GRADTAGE_CREATOR_PANDAS_ENGINE
    DWD_AVERAGE_CREATOR_COERCE = "coerce"
    DWD_AVERAGE_CREATOR_DATETIME_DTYPE = "datetime64[ns]"

    # Date parsing
    DWD_AVERAGE_CREATOR_DATE_YYYYMMDD_LEN = 8
    DWD_AVERAGE_CREATOR_DATE_YYYYMMDD_FORMAT = "%Y%m%d"

    # Paths / suffixes
    DWD_AVERAGE_CREATOR_PATH_LSTRIP = "/"
    DWD_AVERAGE_CREATOR_SUFFIX_CSV = GRADTAGE_CREATOR_SUFFIX_CSV
    DWD_AVERAGE_CREATOR_SUFFIX_ZIP = GRADTAGE_CREATOR_SUFFIX_ZIP

    # CSV parsing fallbacks
    DWD_AVERAGE_CREATOR_CSV_SEP_COMMA = CSV_SEP
    DWD_AVERAGE_CREATOR_CSV_SEP_SEMICOLON = CSV_SEPARATOR_DEFAULT

    # ZIP reading
    DWD_AVERAGE_CREATOR_ZIP_OPEN_MODE = GRADTAGE_CREATOR_ZIP_OPEN_MODE
    DWD_AVERAGE_CREATOR_ZIP_DATA_SUFFIXES = ".txt", ".csv"
    DWD_AVERAGE_CREATOR_ZIP_PREFERRED_TOKEN = "produkt_klima_tag"

    # Station list columns
    DWD_AVERAGE_CREATOR_COL_STATIONS_ID = HEADER_STATIONID
    DWD_AVERAGE_CREATOR_COL_STATIONS_NAME = HEADER_STATIONNAME
    DWD_AVERAGE_CREATOR_COL_STATIONS_HEIGHT = DWD_DOWNLOADER_COL_STATION_HEIGHT
    DWD_AVERAGE_CREATOR_COL_GEO_LAT = DWD_DOWNLOADER_COL_GEO_LAT
    DWD_AVERAGE_CREATOR_COL_GEO_LON = DWD_DOWNLOADER_COL_GEO_LON
    DWD_AVERAGE_CREATOR_COL_BUNDESLAND = DWD_DOWNLOADER_COL_BUNDESLAND
    DWD_AVERAGE_CREATOR_COL_STATION_ID_5 = DWD_DOWNLOADER_COL_STATION_ID_5

    DWD_AVERAGE_CREATOR_STATIONS_NUMERIC_COLS = (
        HEADER_STATIONID,
        DWD_DOWNLOADER_COL_STATION_HEIGHT,
        DWD_DOWNLOADER_COL_GEO_LAT,
        DWD_DOWNLOADER_COL_GEO_LON,
    )
    DWD_AVERAGE_CREATOR_STATIONS_STRING_COLS = HEADER_STATIONNAME, DWD_DOWNLOADER_COL_BUNDESLAND

    # Compact stations DF
    DWD_AVERAGE_CREATOR_STATIONS_COMPACT_INPUT_COLS = (
        DWD_DOWNLOADER_COL_STATION_ID_5,
        HEADER_STATIONID,
        HEADER_STATIONNAME,
        DWD_DOWNLOADER_COL_STATION_HEIGHT,
        DWD_DOWNLOADER_COL_GEO_LAT,
        DWD_DOWNLOADER_COL_GEO_LON,
        DWD_DOWNLOADER_COL_BUNDESLAND,
    )

    DWD_AVERAGE_CREATOR_COL_OUT_STATION_ID = "station_id"
    DWD_AVERAGE_CREATOR_COL_OUT_NAME = "name"
    DWD_AVERAGE_CREATOR_COL_OUT_ELEVATION_M = "elevation_m"
    DWD_AVERAGE_CREATOR_COL_OUT_LAT = "lat"
    DWD_AVERAGE_CREATOR_COL_OUT_LON = "lon"
    DWD_AVERAGE_CREATOR_COL_OUT_BUNDESLAND = "bundesland"

    DWD_AVERAGE_CREATOR_STATIONS_COMPACT_RENAME_MAP = {
        HEADER_STATIONID: "station_id",
        HEADER_STATIONNAME: "name",
        DWD_DOWNLOADER_COL_STATION_HEIGHT: "elevation_m",
        DWD_DOWNLOADER_COL_GEO_LAT: "lat",
        DWD_DOWNLOADER_COL_GEO_LON: "lon",
        DWD_DOWNLOADER_COL_BUNDESLAND: "bundesland",
    }

    # Daily data columns
    DWD_AVERAGE_CREATOR_COL_MESS_DATUM = "MESS_DATUM"
    DWD_AVERAGE_CREATOR_COL_TMK = "TMK"
    DWD_AVERAGE_CREATOR_COL_RSK = "RSK"
    DWD_AVERAGE_CREATOR_COL_SDK = "SDK"

    # Logging
    DWD_AVERAGE_CREATOR_JOIN_COMMA = ", "
    DWD_AVERAGE_CREATOR_LOG_STATIONS_MISSING_COLS = "Station list: Missing columns: %s"
    DWD_AVERAGE_CREATOR_LOG_CSV_READ_ERROR = "CSV read error (%s): %s"
    DWD_AVERAGE_CREATOR_LOG_BAD_ZIP = "Bad ZIP: %s"
    DWD_AVERAGE_CREATOR_LOG_ZIP_READ_ERROR = "ZIP read error (%s): %s"
    DWD_AVERAGE_CREATOR_LOG_HIST_DIR_NOT_FOUND = "Historical folder not found: %s"
    DWD_AVERAGE_CREATOR_LOG_PROGRESS_TEMPLATE = "[{i}/{total}] {sid5}"
    DWD_AVERAGE_CREATOR_LOG_CSV_WRITTEN_TEMPLATE = "CSV written: {path}"

    # Recent file naming (known patterns only)
    DWD_AVERAGE_CREATOR_RECENT_AKT_CSV_TEMPLATE = "tageswerte_KL_{sid5}_akt.csv"
    DWD_AVERAGE_CREATOR_RECENT_RECENT_ZIP_TEMPLATE = "tageswerte_KL_{sid5}_recent.zip"
    DWD_AVERAGE_CREATOR_RECENT_RECENT_CSV_TEMPLATE = "tageswerte_KL_{sid5}_recent.csv"
    DWD_AVERAGE_CREATOR_RECENT_AKT_ZIP_TEMPLATE = "tageswerte_KL_{sid5}_akt.zip"

    # Datasets / error messages for raise_data_set_error
    DWD_AVERAGE_CREATOR_DATASET_STATIONS = "DWD CDC Local Mirror - Station list"
    DWD_AVERAGE_CREATOR_DATASET_STATIONS_CSV = "DWD CDC Local Mirror - Station list (CSV)"
    DWD_AVERAGE_CREATOR_DATASET_AVERAGES = "DWD CDC Local Mirror - Baden-Württemberg station means"

    DWD_AVERAGE_CREATOR_ERR_STATIONS_HEADER_NOT_FOUND = "Station list: header not found."
    DWD_AVERAGE_CREATOR_ERR_STATIONS_CSV_READ_TEMPLATE = "Station CSV could not be read: {err}"
    DWD_AVERAGE_CREATOR_ERR_STATIONS_LIST_NOT_FOUND_TEMPLATE = "Station list not found in local DWD mirror. Path: {path}"
    DWD_AVERAGE_CREATOR_ERR_NO_STATIONS_FOR_STATE_TEMPLATE = "No stations found for federal state: {bundesland}"

    # Empty-result diagnostics
    DWD_AVERAGE_CREATOR_EXAMPLES_LIMIT = 10
    DWD_AVERAGE_CREATOR_MIN_YEARS_SPAN = 1.0
    DWD_AVERAGE_CREATOR_DAYS_PER_YEAR = 365.25

    DWD_AVERAGE_CREATOR_ERR_NO_VALID_DATA_TEMPLATE = (
        "No valid station data found in the local DWD mirror.\n"
        "Status: processed={processed}, ok={ok}\n"
        "\n"
        "Skip reasons:\n"
        "- no_files_or_dfs={n_no_files}\n"
        "  examples: {ex_no_files}\n"
        "- no_valid_daily={n_no_valid_daily}\n"
        "  examples: {ex_no_valid_daily}\n"
        "- empty_after_dropna={n_empty_after_dropna}\n"
        "  examples: {ex_empty_after_dropna}\n"
        "- empty_window={n_empty_window}\n"
        "  examples: {ex_empty_window}\n"
        "\n"
        "Last processed station: {last_sid5}\n"
    )
    
    # Output DF columns (station means)
    DWD_AVERAGE_CREATOR_OUT_COL_STATION_ID_5 = "station_id_5"
    DWD_AVERAGE_CREATOR_OUT_COL_STATION_ID_5_EXCEL = "station_id_5_excel"
    DWD_AVERAGE_CREATOR_OUT_COL_STATION_ID = "station_id"
    DWD_AVERAGE_CREATOR_OUT_COL_NAME = "name"
    DWD_AVERAGE_CREATOR_OUT_COL_BUNDESLAND = "bundesland"
    DWD_AVERAGE_CREATOR_OUT_COL_LAT = "lat"
    DWD_AVERAGE_CREATOR_OUT_COL_LON = "lon"
    DWD_AVERAGE_CREATOR_OUT_COL_ELEVATION_M = "elevation_m"
    DWD_AVERAGE_CREATOR_OUT_COL_MEAN_TEMP_LAST_10Y_C = "mean_temp_last_10y_c"
    DWD_AVERAGE_CREATOR_OUT_COL_MEAN_YEARLY_PRECIP_MM = "mean_yearly_precip_mm"
    DWD_AVERAGE_CREATOR_OUT_COL_MEAN_YEARLY_SUN_HOURS = "mean_yearly_sun_hours"
    DWD_AVERAGE_CREATOR_OUT_COL_N_DAYS_LAST_10Y = "n_days_last_10y"
    DWD_AVERAGE_CREATOR_OUT_COL_WINDOW_START = "window_start"
    DWD_AVERAGE_CREATOR_OUT_COL_WINDOW_END = "window_end"

    # Excel-safe ID formatting
    DWD_AVERAGE_CREATOR_EXCEL_INSERT_POS = 1
    DWD_AVERAGE_CREATOR_EXCEL_ID_PREFIX = '="'
    DWD_AVERAGE_CREATOR_EXCEL_ID_SUFFIX = '"'
    DWD_AVERAGE_CREATOR_CSV_ENCODING = "utf-8-sig"

        # Output file
    DWD_AVERAGES_CSV = OUT_ROOT / "dwd_durchschnitte.csv"   # oder Path("out")/...

    # CSV writing
    DWD_AVERAGE_CREATOR_CSV_SEP_OUT = ";"
    DWD_AVERAGE_CREATOR_CSV_DECIMAL = ","
    DWD_AVERAGE_CREATOR_CSV_FLOAT_FORMAT = "%.2f"
    DWD_AVERAGE_CREATOR_CSV_ENCODING = "utf-8-sig"

    # ZIP filename regex must exist as C.RX_HIST_ZIP
    RX_HIST_ZIP = re.compile(r"tageswerte_KL_(\d{5})_.*_hist\.zip$", re.IGNORECASE)

    REQUEST_TIMEOUT = 60, 300  # (connect timeout, read timeout) in seconds