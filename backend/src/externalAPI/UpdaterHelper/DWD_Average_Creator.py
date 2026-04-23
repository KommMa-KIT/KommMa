"""
A module to create a CSV with average temperatures and other info for DWD stations, based on the local mirror.
This is used in the updater to create the dwd_durchschnitte.csv, which is then used in the app for quick access to station averages without needing to read all daily files.
Author: Jonas Dorner (@OilersLD)
"""


from __future__ import annotations

from io import StringIO
from pathlib import Path
import logging
import re
import unicodedata
import zipfile
import pandas as pd

from externalAPI.Constants import Constants as C
from Exceptions.Data_Set_Error import raise_data_set_error


logger = logging.getLogger(__name__)


# ============================================================
# Robust text decoding (for TXT/ZIP contents)
# ============================================================
def decode_bytes_robust(data: bytes, encodings: tuple[str, ...]) -> str:
    for enc in encodings:
        try:
            return data.decode(enc)  # strict
        except UnicodeDecodeError:
            continue

    logger.warning(C.DWD_AVERAGE_CREATOR_LOG_DECODE_FALLBACK, encodings)
    fallback = encodings[0] if encodings else C.DWD_AVERAGE_CREATOR_DEFAULT_FALLBACK_ENCODING
    return data.decode(fallback, errors=C.DWD_AVERAGE_CREATOR_DECODE_ERRORS_MODE)


def read_text_robust(path: Path, encodings: tuple[str, ...]) -> str:
    return decode_bytes_robust(path.read_bytes(), encodings)


# ============================================================
# Helpers
# ============================================================
def normalize_station_id_5(station_id: int | str) -> str:
    return str(station_id).strip().zfill(C.NORMALIZED_STATION_ID_WIDTH)


def _strip_diacritics(s: str) -> str:
    s = unicodedata.normalize(C.DWD_AVERAGE_CREATOR_UNICODE_NORMAL_FORM, s)
    return "".join(ch for ch in s if not unicodedata.combining(ch))


def normalize_bundesland_key(value: str) -> str:
    """
    Robust against umlauts/diacritics:
    - 'Baden-Württemberg' -> 'badenwurttemberg'
    """
    s = str(value).strip().lower()
    s = s.replace(C.DWD_AVERAGE_CREATOR_SHARP_S, C.DWD_AVERAGE_CREATOR_SHARP_S_REPL)
    s = _strip_diacritics(s)
    s = re.sub(C.DWD_AVERAGE_CREATOR_BUNDESLAND_STRIP_NONALNUM_REGEX, C.DWD_AVERAGE_CREATOR_EMPTY, s)
    return s


def parse_mess_datum_robust(series: pd.Series) -> pd.Series:
    s = series.astype(str).str.strip()

    # Remove everything but digits (handles cases like 19370101.0)
    digits = s.str.replace(C.DWD_AVERAGE_CREATOR_DIGITS_ONLY_REGEX, C.DWD_AVERAGE_CREATOR_EMPTY, regex=True)

    out = pd.Series(pd.NaT, index=s.index, dtype=C.DWD_AVERAGE_CREATOR_DATETIME_DTYPE)

    # Case A: exactly 8 digits -> YYYYMMDD
    m8 = digits.str.len() == C.DWD_AVERAGE_CREATOR_DATE_YYYYMMDD_LEN
    out.loc[m8] = pd.to_datetime(
        digits.loc[m8],
        format=C.DWD_AVERAGE_CREATOR_DATE_YYYYMMDD_FORMAT,
        errors=C.DWD_AVERAGE_CREATOR_COERCE,
    )

    # Case B: anything else -> let pandas infer (ISO: 1937-01-01 etc.)
    out.loc[~m8] = pd.to_datetime(s.loc[~m8], errors=C.DWD_AVERAGE_CREATOR_COERCE)

    return out


def resolve_local_path(dwd_path: str) -> Path:
    """Maps a DWD path (starting with /...) or a relative path to the local mirror."""
    return C.DWD_DIR / str(dwd_path).lstrip(C.DWD_AVERAGE_CREATOR_PATH_LSTRIP)


# ============================================================
# Station list: parsing + normalization
# ============================================================
def normalize_stations_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]

    # numeric columns
    for col in C.DWD_AVERAGE_CREATOR_STATIONS_NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors=C.DWD_AVERAGE_CREATOR_COERCE)

    # string columns
    for col in C.DWD_AVERAGE_CREATOR_STATIONS_STRING_COLS:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    # Always build station_id_5 from Stations_id (even if it already exists)
    if C.DWD_AVERAGE_CREATOR_COL_STATIONS_ID in df.columns:
        df[C.DWD_AVERAGE_CREATOR_COL_STATION_ID_5] = df[C.DWD_AVERAGE_CREATOR_COL_STATIONS_ID].apply(normalize_station_id_5)
    else:
        df[C.DWD_AVERAGE_CREATOR_COL_STATION_ID_5] = pd.NA

    return df


def parse_stations_txt(text: str) -> pd.DataFrame:
    lines = text.splitlines()

    header_idx: int | None = None
    for i, line in enumerate(lines[: C.STATIONS_HEADER_SCAN_LINES]):
        if C.STATIONS_HEADER_ID in line and C.STATIONS_HEADER_NAME in line:
            header_idx = i
            break

    if header_idx is None:
        raise_data_set_error(
            message=C.DWD_AVERAGE_CREATOR_ERR_STATIONS_HEADER_NOT_FOUND,
            dataset=C.DWD_AVERAGE_CREATOR_DATASET_STATIONS,
            column=C.DWD_AVERAGE_CREATOR_NA,
            row=C.DWD_AVERAGE_CREATOR_NA,
        )
        return pd.DataFrame()

    header_tokens = lines[header_idx].split()
    data_start = header_idx + C.STATIONS_DATA_OFFSET_LINES

    df = pd.read_fwf(StringIO("\n".join(lines[data_start:])), header=None)
    df.columns = header_tokens[: len(df.columns)]
    return normalize_stations_df(df)


def load_stations_df(station_list_file: Path) -> pd.DataFrame:
    """
    Loads the station list depending on the file type:
    - .csv -> pd.read_csv
    - otherwise -> TXT parser
    """
    suffix = station_list_file.suffix.lower()

    if suffix == C.DWD_AVERAGE_CREATOR_SUFFIX_CSV:
        try:
            # In this mirror the CSV is often comma-separated; fallback to autodetect.
            df = pd.read_csv(station_list_file, sep=C.DWD_AVERAGE_CREATOR_CSV_SEP_COMMA)
            if df.shape[1] <= 1:
                df = pd.read_csv(station_list_file, sep=None, engine=C.DWD_AVERAGE_CREATOR_PANDAS_ENGINE)
        except Exception as e:
            raise_data_set_error(
                message=C.DWD_AVERAGE_CREATOR_ERR_STATIONS_CSV_READ_TEMPLATE.format(err=e),
                dataset=C.DWD_AVERAGE_CREATOR_DATASET_STATIONS_CSV,
                column=C.DWD_AVERAGE_CREATOR_NA,
                row=str(station_list_file),
            )
            return pd.DataFrame()

        return normalize_stations_df(df)

    # TXT
    text = read_text_robust(station_list_file, C.DWD_TEXT_ENCODINGS)
    return parse_stations_txt(text)


def stations_compact_df(df: pd.DataFrame) -> pd.DataFrame:
    cols = list(C.DWD_AVERAGE_CREATOR_STATIONS_COMPACT_INPUT_COLS)
    missing = [c for c in cols if c not in df.columns]
    if missing:
        logger.error(C.DWD_AVERAGE_CREATOR_LOG_STATIONS_MISSING_COLS, C.DWD_AVERAGE_CREATOR_JOIN_COMMA.join(missing))
        return pd.DataFrame()

    out = df[cols].copy()
    out = out.rename(columns=C.DWD_AVERAGE_CREATOR_STATIONS_COMPACT_RENAME_MAP)

    out[C.DWD_AVERAGE_CREATOR_COL_OUT_STATION_ID] = pd.to_numeric(
        out[C.DWD_AVERAGE_CREATOR_COL_OUT_STATION_ID], errors=C.DWD_AVERAGE_CREATOR_COERCE
    ).astype("Int64")
    out[C.DWD_AVERAGE_CREATOR_COL_OUT_ELEVATION_M] = pd.to_numeric(
        out[C.DWD_AVERAGE_CREATOR_COL_OUT_ELEVATION_M], errors=C.DWD_AVERAGE_CREATOR_COERCE
    ).astype("Int64")
    out[C.DWD_AVERAGE_CREATOR_COL_OUT_LAT] = pd.to_numeric(out[C.DWD_AVERAGE_CREATOR_COL_OUT_LAT], errors=C.DWD_AVERAGE_CREATOR_COERCE)
    out[C.DWD_AVERAGE_CREATOR_COL_OUT_LON] = pd.to_numeric(out[C.DWD_AVERAGE_CREATOR_COL_OUT_LON], errors=C.DWD_AVERAGE_CREATOR_COERCE)

    return out.sort_values(C.DWD_AVERAGE_CREATOR_COL_STATION_ID_5).reset_index(drop=True)


def filter_by_bundesland(df: pd.DataFrame, bundesland: str) -> pd.DataFrame:
    if C.DWD_AVERAGE_CREATOR_COL_BUNDESLAND not in df.columns:
        return pd.DataFrame()

    key = normalize_bundesland_key(bundesland)
    bl = df[C.DWD_AVERAGE_CREATOR_COL_BUNDESLAND].map(normalize_bundesland_key)
    return df[bl == key].copy()


# ============================================================
# Daily reader (CSV/ZIP) – robust for local mirror
# ============================================================
def _normalize_daily_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).lstrip(C.DWD_AVERAGE_CREATOR_BOM).strip().upper() for c in df.columns]
    return df


def read_daily_kl_csv_to_df(csv_path: Path | None) -> pd.DataFrame | None:
    if csv_path is None or not csv_path.exists():
        return None

    # Mirror is often comma-separated; fallback to ';', then autodetect.
    try:
        df = pd.read_csv(csv_path, sep=C.DWD_AVERAGE_CREATOR_CSV_SEP_COMMA)
        if df.shape[1] <= 1:
            df = pd.read_csv(csv_path, sep=C.DWD_AVERAGE_CREATOR_CSV_SEP_SEMICOLON)
            if df.shape[1] <= 1:
                df = pd.read_csv(csv_path, sep=None, engine=C.DWD_AVERAGE_CREATOR_PANDAS_ENGINE)
    except Exception as e:
        logger.warning(C.DWD_AVERAGE_CREATOR_LOG_CSV_READ_ERROR, csv_path, e)
        return None

    df = _normalize_daily_columns(df)
    df = df.replace(list(C.DWD_MISSING_VALUES), pd.NA)

    # Guard: accept only real daily datasets
    if C.DWD_AVERAGE_CREATOR_COL_MESS_DATUM not in df.columns or C.DWD_AVERAGE_CREATOR_COL_TMK not in df.columns:
        return None

    df[C.DWD_AVERAGE_CREATOR_COL_MESS_DATUM] = parse_mess_datum_robust(df[C.DWD_AVERAGE_CREATOR_COL_MESS_DATUM])
    return df


def read_daily_kl_zip_to_df(zip_path: Path | None) -> pd.DataFrame | None:
    if zip_path is None or not zip_path.exists():
        return None

    try:
        with zipfile.ZipFile(zip_path, C.DWD_AVERAGE_CREATOR_ZIP_OPEN_MODE) as z:
            files = [n for n in z.namelist() if n.lower().endswith(C.DWD_AVERAGE_CREATOR_ZIP_DATA_SUFFIXES)]
            if not files:
                return None

            preferred = [f for f in files if C.DWD_AVERAGE_CREATOR_ZIP_PREFERRED_TOKEN in f.lower()]
            fname = preferred[0] if preferred else files[0]

            raw_bytes = z.open(fname).read()
            raw = decode_bytes_robust(raw_bytes, C.DWD_TEXT_ENCODINGS)

            # Try comma first, then semicolon, then autodetect.
            df = pd.read_csv(StringIO(raw), sep=C.DWD_AVERAGE_CREATOR_CSV_SEP_COMMA)
            if df.shape[1] <= 1:
                df = pd.read_csv(StringIO(raw), sep=C.DWD_AVERAGE_CREATOR_CSV_SEP_SEMICOLON)
                if df.shape[1] <= 1:
                    df = pd.read_csv(StringIO(raw), sep=None, engine=C.DWD_AVERAGE_CREATOR_PANDAS_ENGINE)

    except zipfile.BadZipFile:
        logger.warning(C.DWD_AVERAGE_CREATOR_LOG_BAD_ZIP, zip_path)
        return None
    except Exception as e:
        logger.warning(C.DWD_AVERAGE_CREATOR_LOG_ZIP_READ_ERROR, zip_path, e)
        return None

    df = _normalize_daily_columns(df)
    df = df.replace(list(C.DWD_MISSING_VALUES), pd.NA)

    # Guard: accept only real daily datasets
    if C.DWD_AVERAGE_CREATOR_COL_MESS_DATUM not in df.columns or C.DWD_AVERAGE_CREATOR_COL_TMK not in df.columns:
        return None

    df[C.DWD_AVERAGE_CREATOR_COL_MESS_DATUM] = parse_mess_datum_robust(df[C.DWD_AVERAGE_CREATOR_COL_MESS_DATUM])
    return df


def read_daily_kl_any_to_df(path: Path | None) -> pd.DataFrame | None:
    if path is None:
        return None
    suf = path.suffix.lower()
    if suf == C.DWD_AVERAGE_CREATOR_SUFFIX_ZIP:
        return read_daily_kl_zip_to_df(path)
    return read_daily_kl_csv_to_df(path)


# ============================================================
# File discovery
# ============================================================
def build_hist_file_map(hist_dir: Path) -> dict[str, Path]:
    """
    Map station_id_5 -> historical file path.
    Supports:
    - ..._hist.zip
    - ..._hist.csv
    """
    out: dict[str, Path] = {}
    if not hist_dir.exists():
        logger.error(C.DWD_AVERAGE_CREATOR_LOG_HIST_DIR_NOT_FOUND, hist_dir)
        return out

    rx_csv = re.compile(C.DWD_AVERAGE_CREATOR_RX_HIST_CSV, re.IGNORECASE)

    for f in hist_dir.iterdir():
        if not f.is_file():
            continue

        m_zip = C.RX_HIST_ZIP.search(f.name)
        if m_zip:
            out[m_zip.group(1)] = f
            continue

        m_csv = rx_csv.search(f.name)
        if m_csv:
            out[m_csv.group(1)] = f
            continue

    return out


def recent_file_path(recent_dir: Path, sid5: str) -> Path | None:
    """
    No wildcard fallback: only accept known file names.
    In this mirror we typically have: tageswerte_KL_<ID>_akt.csv
    """
    candidates = [
        recent_dir / C.DWD_AVERAGE_CREATOR_RECENT_AKT_CSV_TEMPLATE.format(sid5=sid5),
        recent_dir / C.DWD_AVERAGE_CREATOR_RECENT_RECENT_ZIP_TEMPLATE.format(sid5=sid5),
        recent_dir / C.DWD_AVERAGE_CREATOR_RECENT_RECENT_CSV_TEMPLATE.format(sid5=sid5),
        recent_dir / C.DWD_AVERAGE_CREATOR_RECENT_AKT_ZIP_TEMPLATE.format(sid5=sid5),
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


# ============================================================
# Main evaluation
# ============================================================
def build_station_means_last_10y_df_local(
    bundesland: str = C.TARGET_BUNDESLAND,
) -> pd.DataFrame:
    # Read station list from local mirror
    station_list_file = C.DWD_PATH_STATION_LIST
    if not station_list_file.exists():
        raise_data_set_error(
            message=C.DWD_AVERAGE_CREATOR_ERR_STATIONS_LIST_NOT_FOUND_TEMPLATE.format(path=station_list_file),
            dataset=C.DWD_AVERAGE_CREATOR_DATASET_STATIONS,
            column=C.DWD_AVERAGE_CREATOR_NA,
            row=str(station_list_file),
        )
        return pd.DataFrame()

    stations_raw = load_stations_df(station_list_file)
    stations_bl = filter_by_bundesland(stations_raw, bundesland)
    stations = stations_compact_df(stations_bl)

    if stations.empty:
        raise_data_set_error(
            message=C.DWD_AVERAGE_CREATOR_ERR_NO_STATIONS_FOR_STATE_TEMPLATE.format(bundesland=bundesland),
            dataset=C.DWD_AVERAGE_CREATOR_DATASET_STATIONS,
            column=C.DWD_AVERAGE_CREATOR_COL_BUNDESLAND,
            row=bundesland,
        )
        return pd.DataFrame()

    # Local folders
    hist_dir = resolve_local_path(C.DWD_FOLDER_DAILY_KL_HISTORICAL)
    recent_dir = resolve_local_path(C.DWD_FOLDER_DAILY_KL_RECENT)

    hist_map = build_hist_file_map(hist_dir)

    out_rows: list[dict] = []
    total = len(stations)

    # Debug counters
    processed = 0
    n_no_files = 0
    n_no_valid_daily = 0
    n_empty_after_dropna = 0
    n_empty_window = 0
    n_ok = 0

    examples_no_files: list[str] = []
    examples_no_valid_daily: list[str] = []
    examples_empty_after_dropna: list[str] = []
    examples_empty_window: list[str] = []

    last_sid5: str | None = None

    for i, (_, s) in enumerate(stations.iterrows(), start=1):
        sid5 = str(s[C.DWD_AVERAGE_CREATOR_COL_STATION_ID_5])
        logger.info(C.DWD_AVERAGE_CREATOR_LOG_PROGRESS_TEMPLATE.format(i=i, total=total, sid5=sid5))

        processed += 1
        last_sid5 = sid5

        dfs: list[pd.DataFrame] = []

        # historical
        if sid5 in hist_map:
            df_hist = read_daily_kl_any_to_df(hist_map[sid5])
            if df_hist is not None:
                dfs.append(df_hist)

        # recent
        p_recent = recent_file_path(recent_dir, sid5)
        df_recent = read_daily_kl_any_to_df(p_recent)
        if df_recent is not None:
            dfs.append(df_recent)

        if not dfs:
            n_no_files += 1
            if len(examples_no_files) < C.DWD_AVERAGE_CREATOR_EXAMPLES_LIMIT:
                examples_no_files.append(sid5)
            continue

        # Keep only real daily datasets (reader already guards; still safety)
        valid_dfs = [d for d in dfs if d is not None and C.REQUIRED_DAILY_COLUMNS.issubset(d.columns)]
        if not valid_dfs:
            n_no_valid_daily += 1
            if len(examples_no_valid_daily) < C.DWD_AVERAGE_CREATOR_EXAMPLES_LIMIT:
                examples_no_valid_daily.append(sid5)
            continue

        df_all = pd.concat(valid_dfs, ignore_index=True)

        # Cast numeric columns
        for col in (C.DWD_AVERAGE_CREATOR_COL_TMK, *C.OPTIONAL_DAILY_COLUMNS):
            if col in df_all.columns:
                df_all[col] = pd.to_numeric(df_all[col], errors=C.DWD_AVERAGE_CREATOR_COERCE)

        # Keep only rows with a valid date
        df_all = df_all.dropna(subset=[C.DWD_AVERAGE_CREATOR_COL_MESS_DATUM])

        # If no TMK values at all -> skip
        if C.DWD_AVERAGE_CREATOR_COL_TMK not in df_all.columns or df_all[C.DWD_AVERAGE_CREATOR_COL_TMK].notna().sum() == 0:
            n_empty_after_dropna += 1
            if len(examples_empty_after_dropna) < C.DWD_AVERAGE_CREATOR_EXAMPLES_LIMIT:
                examples_empty_after_dropna.append(sid5)
            continue

        # If values look like tenths of degrees -> convert to °C
        if df_all[C.DWD_AVERAGE_CREATOR_COL_TMK].abs().median() > C.TMK_SCALE_MEDIAN_ABS_THRESHOLD:
            df_all[C.DWD_AVERAGE_CREATOR_COL_TMK] = df_all[C.DWD_AVERAGE_CREATOR_COL_TMK] / C.TMK_SCALE_DIVISOR

        last_day = df_all[C.DWD_AVERAGE_CREATOR_COL_MESS_DATUM].max()
        start_day = last_day - pd.DateOffset(years=C.WINDOW_YEARS)

        df_win = df_all[df_all[C.DWD_AVERAGE_CREATOR_COL_MESS_DATUM] >= start_day]
        if df_win.empty:
            n_empty_window += 1
            if len(examples_empty_window) < C.DWD_AVERAGE_CREATOR_EXAMPLES_LIMIT:
                examples_empty_window.append(sid5)
            continue

        years_span = max(
            C.DWD_AVERAGE_CREATOR_MIN_YEARS_SPAN,
            (df_win[C.DWD_AVERAGE_CREATOR_COL_MESS_DATUM].max() - df_win[C.DWD_AVERAGE_CREATOR_COL_MESS_DATUM].min()).days
            / C.DWD_AVERAGE_CREATOR_DAYS_PER_YEAR,
        )

        out_rows.append(
            {
                C.DWD_AVERAGE_CREATOR_OUT_COL_STATION_ID_5: sid5,
                C.DWD_AVERAGE_CREATOR_OUT_COL_STATION_ID: s[C.DWD_AVERAGE_CREATOR_COL_OUT_STATION_ID],
                C.DWD_AVERAGE_CREATOR_OUT_COL_NAME: s[C.DWD_AVERAGE_CREATOR_COL_OUT_NAME],
                C.DWD_AVERAGE_CREATOR_OUT_COL_BUNDESLAND: s[C.DWD_AVERAGE_CREATOR_COL_OUT_BUNDESLAND],
                C.DWD_AVERAGE_CREATOR_OUT_COL_LAT: s[C.DWD_AVERAGE_CREATOR_COL_OUT_LAT],
                C.DWD_AVERAGE_CREATOR_OUT_COL_LON: s[C.DWD_AVERAGE_CREATOR_COL_OUT_LON],
                C.DWD_AVERAGE_CREATOR_OUT_COL_ELEVATION_M: s[C.DWD_AVERAGE_CREATOR_COL_OUT_ELEVATION_M],
                C.DWD_AVERAGE_CREATOR_OUT_COL_MEAN_TEMP_LAST_10Y_C: df_win[C.DWD_AVERAGE_CREATOR_COL_TMK].mean(),
                C.DWD_AVERAGE_CREATOR_OUT_COL_MEAN_YEARLY_PRECIP_MM: (df_win[C.DWD_AVERAGE_CREATOR_COL_RSK].sum() / years_span)
                if C.DWD_AVERAGE_CREATOR_COL_RSK in df_win
                else None,
                C.DWD_AVERAGE_CREATOR_OUT_COL_MEAN_YEARLY_SUN_HOURS: (df_win[C.DWD_AVERAGE_CREATOR_COL_SDK].sum() / years_span)
                if C.DWD_AVERAGE_CREATOR_COL_SDK in df_win
                else None,
                C.DWD_AVERAGE_CREATOR_OUT_COL_N_DAYS_LAST_10Y: int(df_win[C.DWD_AVERAGE_CREATOR_COL_TMK].count()),
                C.DWD_AVERAGE_CREATOR_OUT_COL_WINDOW_START: start_day.date().isoformat(),
                C.DWD_AVERAGE_CREATOR_OUT_COL_WINDOW_END: last_day.date().isoformat(),
            }
        )
        n_ok += 1

    logger.info(C.DWD_AVERAGE_CREATOR_EMPTY)  # newline after progress

    out = pd.DataFrame(out_rows)
    if out.empty:
        msg = C.DWD_AVERAGE_CREATOR_ERR_NO_VALID_DATA_TEMPLATE.format(
            processed=processed,
            ok=n_ok,
            n_no_files=n_no_files,
            ex_no_files=examples_no_files,
            n_no_valid_daily=n_no_valid_daily,
            ex_no_valid_daily=examples_no_valid_daily,
            n_empty_after_dropna=n_empty_after_dropna,
            ex_empty_after_dropna=examples_empty_after_dropna,
            n_empty_window=n_empty_window,
            ex_empty_window=examples_empty_window,
            last_sid5=last_sid5,
        )
        raise_data_set_error(
            message=msg,
            dataset=C.DWD_AVERAGE_CREATOR_DATASET_AVERAGES,
            column=C.DWD_AVERAGE_CREATOR_COL_STATION_ID_5,
            row=C.DWD_AVERAGE_CREATOR_NA,
        )
        return out

    out = out.sort_values(C.DWD_AVERAGE_CREATOR_OUT_COL_STATION_ID_5).reset_index(drop=True)

    # Excel-safe ID (keeps leading zeros)
    out.insert(
        C.DWD_AVERAGE_CREATOR_EXCEL_INSERT_POS,
        C.DWD_AVERAGE_CREATOR_OUT_COL_STATION_ID_5_EXCEL,
        C.DWD_AVERAGE_CREATOR_EXCEL_ID_PREFIX + out[C.DWD_AVERAGE_CREATOR_OUT_COL_STATION_ID_5].astype(str) + C.DWD_AVERAGE_CREATOR_EXCEL_ID_SUFFIX,
    )

    return out


def write_csv(df: pd.DataFrame, output_csv: Path) -> None:
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(
        output_csv,
        index=False,
        encoding=C.DWD_AVERAGE_CREATOR_CSV_ENCODING,
        sep=C.DWD_AVERAGE_CREATOR_CSV_SEP_OUT,
        decimal=C.DWD_AVERAGE_CREATOR_CSV_DECIMAL,
        float_format=C.DWD_AVERAGE_CREATOR_CSV_FLOAT_FORMAT,
    )
    logger.info(C.DWD_AVERAGE_CREATOR_LOG_CSV_WRITTEN_TEMPLATE.format(path=output_csv))


def create_dwd_averages() -> None:
    df = build_station_means_last_10y_df_local(C.TARGET_BUNDESLAND)
    if df.empty:
        return
    write_csv(df, C.DWD_AVERAGES_CSV)
