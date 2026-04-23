
"""
Helper module to provide the download functionality for downloading DWD data.
This is used by the Downloader to download official Data from the Deutscher Wetterdienst.
Author: Jonas Dorner (@OilersLD)
"""

# ============================================================
# DWD "Index of" Tree Downloader + Optional ZIP -> CSV Extract
# (append below your existing code; does not modify existing)
# ============================================================
from __future__ import annotations

from io import StringIO
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urljoin, urlparse, unquote
from pathlib import Path

import re
import time
import logging
import pandas as pd
import requests
import os

from Exceptions.External_Connection_Error import raise_externalConnection_error
from externalAPI.Constants import Constants as C


logger = logging.getLogger(__name__)


# -----------------------------
# Config
# -----------------------------
@dataclass(frozen=True)
class DwdCdcUrls:
    stations_list: str = C.DWD_DOWNLOADER_CDC_STATIONS_LIST_URL
    DWD_PING_URL: str = C.DWD_DOWNLOADER_PING_URL


def test_login() -> None:
    try:
        requests.get(DwdCdcUrls.DWD_PING_URL, timeout=20)
    except requests.exceptions.RequestException as exception:
        raise_externalConnection_error(
            C.DWD_DOWNLOADER_ERR_CONNECTION,
            details=str(exception)
        )


# -----------------------------
# Utilities
# -----------------------------
def make_id_5(station_id: int | str) -> str:
    """Make a 5-digit station ID string, padding with leading zeros if necessary."""
    return str(station_id).strip().zfill(C.NORMALIZATION_LENGTH)


def normalize_stations(df: pd.DataFrame) -> pd.DataFrame:
    """Normalizes the information of the stations DataFrame."""
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]

    # numeric columns (if present)
    for col in [
        C.DWD_DOWNLOADER_COL_STATIONS_ID,
        C.DWD_DOWNLOADER_COL_STATION_HEIGHT,
        C.DWD_DOWNLOADER_COL_GEO_LAT,
        C.DWD_DOWNLOADER_COL_GEO_LON,
    ]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # required columns (as provided by DWD)
    df[C.DWD_DOWNLOADER_COL_STATION_ID_5] = df[C.DWD_DOWNLOADER_COL_STATIONS_ID].apply(make_id_5)
    df[C.DWD_DOWNLOADER_COL_STATIONS_NAME] = df[C.DWD_DOWNLOADER_COL_STATIONS_NAME].astype(str).str.strip()
    df[C.DWD_DOWNLOADER_COL_BUNDESLAND] = df[C.DWD_DOWNLOADER_COL_BUNDESLAND].astype(str).str.strip()

    return df


def parse_stations_txt(text: str) -> pd.DataFrame:
    """
    DWD provides a text file with header + fixed-width table.
    This function parses the file and returns a DataFrame.
    """
    lines = text.splitlines()
    header_idx = None

    for i, line in enumerate(lines[:150]):  # buffer
        if (f"{C.HEADER_STATIONID}") in line and (f"{C.HEADER_STATIONNAME}") in line:
            header_idx = i
            break

    if header_idx is None:
        raise_externalConnection_error(C.DWD_DOWNLOADER_ERR_STATIONS_HEADER_NOT_FOUND)

    # DWD format: after the header line usually comes a separator line, then data starts.
    data_start = header_idx + C.OFFSET_OF_START_OF_DATA_IN_DWDFiles
    txt_data = "\n".join(lines[data_start:])

    df = pd.read_fwf(StringIO(txt_data), header=None)

    # column names from header line
    colnames = lines[header_idx].split()
    df.columns = colnames[: len(df.columns)]

    return normalize_stations(df)


def stations_compact(df: pd.DataFrame) -> pd.DataFrame:
    """
    Returns a compact station DataFrame with:
    - station_id_5 (string, e.g. "02667")
    - station_id (int, if possible)
    - name
    - elevation_m
    - lat
    - lon
    """
    needed = [
        C.DWD_DOWNLOADER_COL_STATION_ID_5,
        C.DWD_DOWNLOADER_COL_STATIONS_ID,
        C.DWD_DOWNLOADER_COL_STATIONS_NAME,
        C.DWD_DOWNLOADER_COL_STATION_HEIGHT,
        C.DWD_DOWNLOADER_COL_GEO_LAT,
        C.DWD_DOWNLOADER_COL_GEO_LON,
    ]
    missing = [col for col in needed if col not in df.columns]
    if missing:
        raise_externalConnection_error(
            C.DWD_DOWNLOADER_ERR_STATIONS_MISSING_COLUMNS,
            details=f"Missing columns: {missing}"
        )

    out = df[needed].copy()
    out = out.rename(columns={
        C.DWD_DOWNLOADER_COL_STATIONS_ID: "station_id",
        C.DWD_DOWNLOADER_COL_STATIONS_NAME: "name",
        C.DWD_DOWNLOADER_COL_STATION_HEIGHT: "elevation_m",
        C.DWD_DOWNLOADER_COL_GEO_LAT: "lat",
        C.DWD_DOWNLOADER_COL_GEO_LON: "lon",
    })

    out["station_id"] = pd.to_numeric(out["station_id"], errors="coerce").astype("Int64")
    out["elevation_m"] = pd.to_numeric(out["elevation_m"], errors="coerce").astype("Int64")
    out["lat"] = pd.to_numeric(out["lat"], errors="coerce")
    out["lon"] = pd.to_numeric(out["lon"], errors="coerce")

    out = out.sort_values([C.DWD_DOWNLOADER_COL_STATION_ID_5, "name"], kind="stable").reset_index(drop=True)
    return out


def save_stations_csv(df: pd.DataFrame, path: str) -> str:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    df.to_csv(path, index=False, encoding=C.DWD_DOWNLOADER_ENCODING_UTF8_SIG)
    return path


# -----------------------------
# Client
# -----------------------------
class DwdCdcClient:
    def __init__(self, urls: DwdCdcUrls | None = None, timeout: int = 60):
        self.urls = urls or DwdCdcUrls()
        self.timeout = timeout
        self.session = requests.Session()

    def _get_text(self, url: str) -> str:
        r = self.session.get(url, timeout=self.timeout)
        r.raise_for_status()
        return r.text

    def get_stations(self) -> pd.DataFrame:
        text = self._get_text(self.urls.stations_list)
        return parse_stations_txt(text)

    @staticmethod
    def search_stations(df: pd.DataFrame, query: str, limit: int = 25) -> pd.DataFrame:
        mask = df[C.DWD_DOWNLOADER_COL_STATIONS_NAME].astype(str).str.contains(query, case=False, na=False)
        cols = [
            C.DWD_DOWNLOADER_COL_STATION_ID_5,
            C.DWD_DOWNLOADER_COL_STATIONS_NAME,
            C.DWD_DOWNLOADER_COL_BUNDESLAND,
            C.DWD_DOWNLOADER_COL_GEO_LAT,
            C.DWD_DOWNLOADER_COL_GEO_LON,
        ]
        return df.loc[mask, cols].head(limit)

    @staticmethod
    def filter_bundesland(df: pd.DataFrame, bundesland: str) -> pd.DataFrame:
        key = (
            bundesland.lower()
            .replace(C.DWD_DOWNLOADER_TOKEN_SPACE, "")
            .replace(C.DWD_DOWNLOADER_TOKEN_DASH, "")
            .replace(C.DWD_DOWNLOADER_TOKEN_UMLAUT_UE, C.DWD_DOWNLOADER_TOKEN_UMLAUT_UE_REPL)
        )
        bl = (
            df[C.DWD_DOWNLOADER_COL_BUNDESLAND].astype(str).str.lower()
            .str.replace(C.DWD_DOWNLOADER_TOKEN_SPACE, "", regex=False)
            .str.replace(C.DWD_DOWNLOADER_TOKEN_DASH, "", regex=False)
            .str.replace(C.DWD_DOWNLOADER_TOKEN_UMLAUT_UE, C.DWD_DOWNLOADER_TOKEN_UMLAUT_UE_REPL, regex=False)
        )
        return df[bl == key].copy()


_HREF_RE = re.compile(C.DWD_DOWNLOADER_HREF_REGEX_PATTERN, re.IGNORECASE)


@dataclass
class DwdTreeDownloadStats:
    dirs_visited: int = 0
    files_found: int = 0
    files_downloaded: int = 0
    files_skipped: int = 0
    errors: int = 0


def _normalize_dwd_base_url(base_url: str) -> str:
    """
    Accepts:
      - full URL: https://opendata.dwd.de/climate_environment/CDC/...
      - path-only: /climate_environment/CDC/...
    Ensures trailing slash.
    """
    base_url = base_url.strip()
    if base_url.startswith("/"):
        base_url = C.DWD_DOWNLOADER_BASE_DOMAIN + base_url
    if not base_url.endswith("/"):
        base_url += "/"
    return base_url


def _list_index_links(session: requests.Session, dir_url: str, timeout: int) -> list[str]:
    """
    Reads Apache-style 'Index of' and returns absolute URLs of href targets.
    Skips ../, ./, sorting/query links.
    """
    try:
        r = session.get(dir_url, timeout=timeout)
        r.raise_for_status()
    except requests.exceptions.RequestException as exception:
        raise_externalConnection_error(
            C.DWD_DOWNLOADER_ERR_DIR_LISTING,
            details=f"{dir_url} -> {exception}"
        )

    hrefs = _HREF_RE.findall(r.text)

    out: list[str] = []
    for h in hrefs:
        if h in (C.DWD_DOWNLOADER_HREF_PARENT_DIR, C.DWD_DOWNLOADER_HREF_CURRENT_DIR):
            continue
        if h.startswith(C.DWD_DOWNLOADER_HREF_SKIP_PREFIXES):
            continue
        out.append(urljoin(dir_url, h))
    return out


def _relative_path_under_base(file_url: str, base_path: str) -> str:
    """
    Computes relative path of file_url under base_path (URL path part).
    Returns "" if file_url is outside subtree.
    """
    path = urlparse(file_url).path
    if not path.startswith(base_path):
        return ""
    rel = path[len(base_path):].lstrip("/")
    return unquote(rel)


def _download_file_atomic(
    session: requests.Session,
    file_url: str,
    dest_path: str,
    timeout: int,
    overwrite: bool,
    chunk_size: int = 1024 * 1024
) -> bool:
    """
    Downloads file_url to dest_path using .part and atomic rename.
    Returns True if downloaded, False if skipped.
    """
    if (not overwrite) and os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
        return False

    os.makedirs(os.path.dirname(dest_path) or ".", exist_ok=True)
    tmp = dest_path + C.DWD_DOWNLOADER_TEMP_SUFFIX

    try:
        with session.get(file_url, stream=True, timeout=timeout) as r:
            r.raise_for_status()
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(chunk_size=chunk_size):
                    if chunk:
                        f.write(chunk)
    except requests.exceptions.RequestException as exception:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass
        raise_externalConnection_error(
            C.DWD_DOWNLOADER_ERR_FILE_DOWNLOAD,
            details=f"{file_url} -> {exception}"
        )

    os.replace(tmp, dest_path)
    return True


def download_dwd_tree(
    base_url: str,
    output_dir: str,
    *,
    timeout: int = 60,
    overwrite: bool = False,
    max_depth: int | None = None,
    max_files: int | None = None,
    include_ext: Iterable[str] | None = None,
    exclude_ext: Iterable[str] | None = None,
    polite_sleep_s: float = 0.0,
    dry_run: bool = False,
) -> DwdTreeDownloadStats:
    """
    Recursively downloads everything under a DWD directory listing.

    - Preserves the directory structure under output_dir.
    - Safety knobs:
      max_depth: 0 -> only base dir listing
      max_files: stop after N matched files
      include_ext: only download these extensions, e.g. (".zip",".csv",".txt")
      exclude_ext: skip these extensions
      dry_run: only crawl & count (no downloads)

    Returns stats.
    """
    base_url = _normalize_dwd_base_url(base_url)
    base_path = urlparse(base_url).path
    if not base_path.endswith("/"):
        base_path += "/"

    include_ext = tuple(e.lower() for e in include_ext) if include_ext else None
    exclude_ext = tuple(e.lower() for e in exclude_ext) if exclude_ext else None

    stats = DwdTreeDownloadStats()

    visited_dirs: set[str] = set()
    stack: list[tuple[str, int]] = [(base_url, 0)]  # (dir_url, depth)

    def _print_status() -> None:
        # logger.info() doesn't support end=/flush= like print()
        msg = C.DWD_DOWNLOADER_PROGRESS_TEMPLATE.format(
            found=stats.files_found,
            downloaded=stats.files_downloaded,
            skipped=stats.files_skipped,
            errors=stats.errors,
        )
        print(msg, end="\r", flush=True)

    with requests.Session() as session:
        while stack:
            dir_url, depth = stack.pop()
            if dir_url in visited_dirs:
                continue
            visited_dirs.add(dir_url)
            stats.dirs_visited += 1

            if max_depth is not None and depth > max_depth:
                continue

            try:
                entries = _list_index_links(session, dir_url, timeout)
            except Exception:
                stats.errors += 1
                continue

            for u in entries:
                # subdirectory
                if u.endswith("/"):
                    if max_depth is None or (depth + 1) <= max_depth:
                        stack.append((u, depth + 1))
                    continue

                # file
                rel = _relative_path_under_base(u, base_path)
                if not rel:
                    continue

                low = rel.lower()
                if include_ext is not None and not low.endswith(include_ext):
                    continue
                if exclude_ext is not None and low.endswith(exclude_ext):
                    continue

                stats.files_found += 1
                if max_files is not None and stats.files_found > max_files:
                    return stats

                dest_path = os.path.join(output_dir, rel)

                if dry_run:
                    _print_status()
                    continue

                try:
                    # If it's a Daily-KL ZIP -> store as CSV in the same tree (replace .zip by .csv)
                    if _is_daily_kl_zip_url(u):
                        csv_dest = _zip_dest_to_csv_dest(dest_path)
                        changed = _download_daily_kl_zip_and_write_csv(
                            session=session,
                            zip_url=u,
                            csv_dest_path=csv_dest,
                            timeout=timeout,
                            overwrite=overwrite,
                        )
                    else:
                        changed = _download_file_atomic(session, u, dest_path, timeout, overwrite)

                    if changed:
                        stats.files_downloaded += 1
                    else:
                        stats.files_skipped += 1

                except Exception:
                    stats.errors += 1

                _print_status()

                if polite_sleep_s > 0:
                    time.sleep(polite_sleep_s)

    print()  # newline after progress line
    logger.info(C.DWD_DOWNLOADER_MSG_DOWNLOAD_FINISHED)
    return stats


# -----------------------------
# ZIP -> CSV (Daily-KL) helpers
# -----------------------------
def _is_daily_kl_zip_url(url: str) -> bool:
    name = os.path.basename(urlparse(url).path).lower()
    return name.startswith(C.DWD_DOWNLOADER_DAILY_KL_ZIP_PREFIX) and name.endswith(C.DWD_DOWNLOADER_ZIP_EXTENSION)


def _zip_dest_to_csv_dest(dest_path: str) -> str:
    base, _ = os.path.splitext(dest_path)
    return base + C.DWD_DOWNLOADER_CSV_EXTENSION


def _download_daily_kl_zip_and_write_csv(
    session: requests.Session,
    zip_url: str,
    csv_dest_path: str,
    timeout: int,
    overwrite: bool,
) -> bool:
    """
    Downloads a Daily-KL ZIP (tageswerte_KL_...) and writes extracted data as CSV.
    Returns True if written, False if skipped.
    """
    if (not overwrite) and os.path.exists(csv_dest_path) and os.path.getsize(csv_dest_path) > 0:
        return False

    try:
        r = session.get(zip_url, timeout=timeout)
        r.raise_for_status()
        content = r.content
    except requests.exceptions.RequestException as exception:
        raise_externalConnection_error(
            C.DWD_DOWNLOADER_ERR_ZIP_DOWNLOAD,
            details=f"{zip_url} -> {exception}",
        )

    import zipfile
    import io as _io

    try:
        z = zipfile.ZipFile(_io.BytesIO(content))
        candidates = [n for n in z.namelist() if n.lower().endswith(C.DWD_DOWNLOADER_ZIP_DATA_EXTENSIONS)]
        if not candidates:
            raise_externalConnection_error(
                C.DWD_DOWNLOADER_ERR_ZIP_NO_DATA_FILES,
                details=zip_url,
            )
        best = max(candidates, key=lambda n: z.getinfo(n).file_size)
        raw = z.open(best).read().decode("utf-8", errors="replace")
    except Exception as exception:
        raise_externalConnection_error(
            C.DWD_DOWNLOADER_ERR_ZIP_PARSE,
            details=f"{zip_url} -> {exception}",
        )

    df = pd.read_csv(StringIO(raw), sep=C.DWD_DOWNLOADER_SEP_DAILY_KL, engine=C.DWD_DOWNLOADER_PANDAS_ENGINE)
    df.columns = [c.strip() for c in df.columns]

    if C.DWD_DOWNLOADER_DATE_COLUMN in df.columns:
        df[C.DWD_DOWNLOADER_DATE_COLUMN] = pd.to_datetime(
            df[C.DWD_DOWNLOADER_DATE_COLUMN],
            format=C.DWD_DOWNLOADER_DATE_FORMAT,
            errors="coerce"
        )

    df = df.replace(list(C.DWD_DOWNLOADER_MISSING_SENTINELS), pd.NA)

    os.makedirs(os.path.dirname(csv_dest_path) or ".", exist_ok=True)
    tmp = csv_dest_path + C.DWD_DOWNLOADER_TEMP_SUFFIX
    df.to_csv(tmp, index=False, encoding=C.DWD_DOWNLOADER_ENCODING_UTF8_SIG)
    os.replace(tmp, csv_dest_path)

    return True


def convert_all_txt_to_csv(root_folder: str) -> None:
    root = Path(root_folder)

    for txt_path in root.rglob(f"*{C.DWD_DOWNLOADER_TXT_EXTENSION}"):
        try:
            df = pd.read_csv(
                txt_path,
                sep=C.DWD_DOWNLOADER_SEP_TXT_TO_CSV,
                skiprows=1,
                engine=C.DWD_DOWNLOADER_PANDAS_ENGINE
            )

            df = df.loc[:, ~df.columns.astype(str).str.match(C.DWD_DOWNLOADER_UNNAMED_COLUMN_REGEX)]
            df.columns = df.columns.astype(str).str.strip()

            csv_path = txt_path.with_suffix(C.DWD_DOWNLOADER_CSV_EXTENSION)
            df.to_csv(csv_path, index=False)

            logger.info(f"{C.DWD_DOWNLOADER_LOG_OK_PREFIX}: {txt_path}")
        except Exception as e:
            logger.error(f"{C.DWD_DOWNLOADER_LOG_FAIL_PREFIX}: {txt_path} ({e})")
