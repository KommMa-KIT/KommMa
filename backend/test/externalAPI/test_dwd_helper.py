import io
import os
import zipfile
from types import SimpleNamespace
from pathlib import Path

import pandas as pd
import pytest
import requests


import externalAPI.DownloadHelper.Downloader_DeutscherWetterdienst as M


@pytest.fixture(autouse=True)
def patch_raise(monkeypatch):
    # make raise_externalConnection_error predictable in tests
    def _raise(code, details=None):
        raise RuntimeError(f"{code} | {details}")
    monkeypatch.setattr(M, "raise_externalConnection_error", _raise)


@pytest.fixture(autouse=True)
def patch_constants(monkeypatch):
    """
    Patch only the constants your tests rely on.
    Keep it minimal & deterministic.
    """
    C = M.C
    monkeypatch.setattr(C, "NORMALIZATION_LENGTH", 5, raising=False)

    monkeypatch.setattr(C, "DWD_DOWNLOADER_COL_STATIONS_ID", "Stations_id", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_COL_STATION_HEIGHT", "Stationshoehe", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_COL_GEO_LAT", "geoBreite", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_COL_GEO_LON", "geoLaenge", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_COL_STATIONS_NAME", "Stationsname", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_COL_BUNDESLAND", "Bundesland", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_COL_STATION_ID_5", "station_id_5", raising=False)

    monkeypatch.setattr(C, "HEADER_STATIONID", "Stations_id", raising=False)
    monkeypatch.setattr(C, "HEADER_STATIONNAME", "Stationsname", raising=False)
    monkeypatch.setattr(C, "OFFSET_OF_START_OF_DATA_IN_DWDFiles", 2, raising=False)

    monkeypatch.setattr(C, "DWD_DOWNLOADER_ENCODING_UTF8_SIG", "utf-8-sig", raising=False)

    monkeypatch.setattr(C, "DWD_DOWNLOADER_BASE_DOMAIN", "https://opendata.dwd.de", raising=False)

    monkeypatch.setattr(C, "DWD_DOWNLOADER_DAILY_KL_ZIP_PREFIX", "tageswerte_kl_", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_ZIP_EXTENSION", ".zip", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_CSV_EXTENSION", ".csv", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_TEMP_SUFFIX", ".part", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_TXT_EXTENSION", ".txt", raising=False)

    monkeypatch.setattr(C, "DWD_DOWNLOADER_ZIP_DATA_EXTENSIONS", (".txt", ".csv"), raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_SEP_DAILY_KL", ";", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_PANDAS_ENGINE", "python", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_DATE_COLUMN", "MESS_DATUM", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_DATE_FORMAT", "%Y%m%d", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_MISSING_SENTINELS", (-999, -9999), raising=False)

    monkeypatch.setattr(C, "DWD_DOWNLOADER_SEP_TXT_TO_CSV", ";", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_UNNAMED_COLUMN_REGEX", r"^Unnamed", raising=False)

    monkeypatch.setattr(C, "DWD_DOWNLOADER_TOKEN_SPACE", " ", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_TOKEN_DASH", "-", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_TOKEN_UMLAUT_UE", "ü", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_TOKEN_UMLAUT_UE_REPL", "ue", raising=False)

    # error codes used in tests
    monkeypatch.setattr(C, "DWD_DOWNLOADER_ERR_STATIONS_HEADER_NOT_FOUND", "ERR_HEADER", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_ERR_STATIONS_MISSING_COLUMNS", "ERR_MISSING_COLS", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_ERR_FILE_DOWNLOAD", "ERR_FILE_DL", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_ERR_ZIP_DOWNLOAD", "ERR_ZIP_DL", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_ERR_ZIP_NO_DATA_FILES", "ERR_ZIP_NO_DATA", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_ERR_ZIP_PARSE", "ERR_ZIP_PARSE", raising=False)
    
    monkeypatch.setattr(C, "DWD_DOWNLOADER_LOG_OK_PREFIX", "OK", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_LOG_FAIL_PREFIX", "FAIL", raising=False)


# -----------------------------
# Pure utilities
# -----------------------------
def test_make_id_5_pads():
    assert M.make_id_5(7) == "00007"
    assert M.make_id_5(" 42 ") == "00042"


def test_normalize_stations_strips_and_types():
    df = pd.DataFrame({
        " Stations_id ": ["7", "42"],
        "Stationshoehe": ["10", "x"],
        "geoBreite": ["49.1", "n/a"],
        "geoLaenge": ["8.4", "8.5"],
        "Stationsname": ["  Foo ", "Bar"],
        "Bundesland": [" BW ", "BY"],
    })
    out = M.normalize_stations(df)
    assert list(out.columns) == ["Stations_id", "Stationshoehe", "geoBreite", "geoLaenge", "Stationsname", "Bundesland", "station_id_5"]
    assert out["station_id_5"].tolist() == ["00007", "00042"]
    assert out["Stationsname"].tolist() == ["Foo", "Bar"]
    assert out["Bundesland"].tolist() == ["BW", "BY"]
    assert pd.api.types.is_numeric_dtype(out["Stations_id"])


def test_parse_stations_txt_ok(monkeypatch):
    # Patch pd.read_fwf so we don't depend on fixed-width specifics
    fake = pd.DataFrame({
        "Stations_id": ["7"],
        "Stationsname": ["Foo"],
        "Bundesland": ["BW"],
        "Stationshoehe": ["10"],
        "geoBreite": ["49.1"],
        "geoLaenge": ["8.4"],
    })

    def fake_read_fwf(*args, **kwargs):
        return fake.copy()

    monkeypatch.setattr(M.pd, "read_fwf", fake_read_fwf)

    text = "\n".join([
        "some header line",
        "Stations_id Stationsname Bundesland Stationshoehe geoBreite geoLaenge",
        "---- separator ----",
        "data starts here (ignored by fake_read_fwf)",
    ])

    df = M.parse_stations_txt(text)
    assert df["station_id_5"].iloc[0] == "00007"
    assert df["Stationsname"].iloc[0] == "Foo"


def test_parse_stations_txt_header_not_found():
    with pytest.raises(RuntimeError) as e:
        M.parse_stations_txt("no header here")
    assert "ERR_HEADER" in str(e.value)


def test_stations_compact_missing_columns():
    df = pd.DataFrame({"Stations_id": [1]})
    with pytest.raises(RuntimeError) as e:
        M.stations_compact(df)
    assert "ERR_MISSING_COLS" in str(e.value)


def test_stations_compact_ok_sorts_and_types():
    df = pd.DataFrame({
        "station_id_5": ["00002", "00001"],
        "Stations_id": ["2", "1"],
        "Stationsname": ["B", "A"],
        "Stationshoehe": ["10", "20"],
        "geoBreite": ["49.0", "48.0"],
        "geoLaenge": ["8.0", "9.0"],
        "Bundesland": ["BW", "BY"],  # not used here, but doesn't hurt
    })
    out = M.stations_compact(df)
    assert out["station_id"].tolist() == [1, 2]
    assert out["name"].tolist() == ["A", "B"]
    assert str(out["station_id"].dtype) == "Int64"


def test_save_stations_csv_creates_dirs(tmp_path):
    df = pd.DataFrame({"a": [1]})
    dest = tmp_path / "nested" / "stations.csv"
    p = M.save_stations_csv(df, str(dest))
    assert Path(p).exists()
    back = pd.read_csv(dest)
    assert back["a"].tolist() == [1]


def test_normalize_base_url():
    assert M._normalize_dwd_base_url("/climate_environment/CDC") == "https://opendata.dwd.de/climate_environment/CDC/"
    assert M._normalize_dwd_base_url("https://x/y") == "https://x/y/"


def test_relative_path_under_base():
    base_path = "/a/b/"
    assert M._relative_path_under_base("https://host/a/b/c/d.txt", base_path) == "c/d.txt"
    assert M._relative_path_under_base("https://host/other/x.txt", base_path) == ""


def test_is_daily_kl_zip_url():
    assert M._is_daily_kl_zip_url("https://x/tageswerte_kl_foo.zip")
    assert not M._is_daily_kl_zip_url("https://x/other.zip")


def test_zip_dest_to_csv_dest():
    assert M._zip_dest_to_csv_dest("/tmp/a.zip") == "/tmp/a.csv"


# -----------------------------
# DwdCdcClient (no real HTTP)
# -----------------------------
def test_client_get_text(monkeypatch):
    client = M.DwdCdcClient(timeout=1)

    class FakeResp:
        text = "hello"
        def raise_for_status(self): pass

    def fake_get(url, timeout):
        assert timeout == 1
        return FakeResp()

    monkeypatch.setattr(client.session, "get", fake_get)
    assert client._get_text("http://x") == "hello"


def test_client_search_stations():
    df = pd.DataFrame({
        "station_id_5": ["00001", "00002"],
        "Stationsname": ["Karlsruhe", "Berlin"],
        "Bundesland": ["BW", "BE"],
        "geoBreite": [49.0, 52.5],
        "geoLaenge": [8.4, 13.4],
    })
    out = M.DwdCdcClient.search_stations(df, "kar", limit=10)
    assert out.shape[0] == 1
    assert out["Stationsname"].iloc[0] == "Karlsruhe"


def test_client_filter_bundesland_normalizes():
    df = pd.DataFrame({"Bundesland": ["Baden-Württemberg", "Berlin"], "x": [1, 2]})
    out = M.DwdCdcClient.filter_bundesland(df, "Baden Wuerttemberg")
    assert out["x"].tolist() == [1]


# -----------------------------
# Download helpers (no real HTTP)
# -----------------------------
def test_download_file_atomic_skips_existing(tmp_path):
    dest = tmp_path / "f.bin"
    dest.write_bytes(b"abc")

    session = SimpleNamespace()
    # should never be called
    session.get = lambda *a, **k: (_ for _ in ()).throw(AssertionError("should not download"))

    changed = M._download_file_atomic(session, "http://x", str(dest), timeout=1, overwrite=False)
    assert changed is False


def test_download_file_atomic_writes_and_renames(tmp_path):
    dest = tmp_path / "f.bin"

    class FakeResp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def raise_for_status(self): pass
        def iter_content(self, chunk_size):
            yield b"hello"
            yield b""
            yield b"world"

    session = SimpleNamespace(get=lambda *a, **k: FakeResp())

    changed = M._download_file_atomic(session, "http://x", str(dest), timeout=1, overwrite=True)
    assert changed is True
    assert dest.read_bytes() == b"helloworld"
    assert not (tmp_path / "f.bin.part").exists()


def test_download_file_atomic_cleans_tmp_on_error(tmp_path):
    dest = tmp_path / "f.bin"

    class FakeResp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def raise_for_status(self):
            raise requests.exceptions.RequestException("boom")

    session = SimpleNamespace(get=lambda *a, **k: FakeResp())

    with pytest.raises(RuntimeError) as e:
        M._download_file_atomic(session, "http://x", str(dest), timeout=1, overwrite=True)

    assert "ERR_FILE_DL" in str(e.value)
    assert not (tmp_path / "f.bin.part").exists()
    assert not dest.exists()


# -----------------------------
# ZIP -> CSV (in-memory)
# -----------------------------
def _make_daily_kl_zip_bytes(txt_name="data.txt", txt_content="MESS_DATUM;A\n20250101;1\n"):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr(txt_name, txt_content)
    return buf.getvalue()


def test_download_daily_kl_zip_and_write_csv_ok(tmp_path, monkeypatch):
    csv_dest = tmp_path / "out.csv"
    zip_bytes = _make_daily_kl_zip_bytes()

    class Resp:
        content = zip_bytes
        def raise_for_status(self): pass

    session = SimpleNamespace(get=lambda *a, **k: Resp())

    changed = M._download_daily_kl_zip_and_write_csv(
        session=session,
        zip_url="http://x/tageswerte_kl_foo.zip",
        csv_dest_path=str(csv_dest),
        timeout=1,
        overwrite=True,
    )
    assert changed is True
    assert csv_dest.exists()

    df = pd.read_csv(csv_dest)
    assert "MESS_DATUM" in df.columns


def test_download_daily_kl_zip_and_write_csv_skips_if_exists(tmp_path):
    csv_dest = tmp_path / "out.csv"
    csv_dest.write_text("a\n1\n", encoding="utf-8")

    session = SimpleNamespace(get=lambda *a, **k: (_ for _ in ()).throw(AssertionError("no download")))
    changed = M._download_daily_kl_zip_and_write_csv(
        session=session,
        zip_url="http://x/tageswerte_kl_foo.zip",
        csv_dest_path=str(csv_dest),
        timeout=1,
        overwrite=False,
    )
    assert changed is False


def test_download_daily_kl_zip_no_data_files(tmp_path):
    # zip with non-data file
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("readme.md", "x")

    class Resp:
        content = buf.getvalue()
        def raise_for_status(self): pass

    session = SimpleNamespace(get=lambda *a, **k: Resp())

    with pytest.raises(RuntimeError) as e:
        M._download_daily_kl_zip_and_write_csv(
            session=session,
            zip_url="http://x/tageswerte_kl_foo.zip",
            csv_dest_path=str(tmp_path / "out.csv"),
            timeout=1,
            overwrite=True,
        )
    assert "ERR_ZIP_NO_DATA" in str(e.value)


# -----------------------------
# convert_all_txt_to_csv
# -----------------------------
def test_convert_all_txt_to_csv_ok(tmp_path):
    root = tmp_path
    txt = root / "a.txt"
    txt.write_text("ignore_line\nc1;c2\n1;2\n", encoding="utf-8")

    M.convert_all_txt_to_csv(str(root))

    csv = root / "a.csv"
    assert csv.exists()
    df = pd.read_csv(csv)
    assert df.columns.tolist() == ["c1", "c2"]
    assert df.iloc[0].tolist() == [1, 2]

def test_test_login_raises_on_request_exception(monkeypatch):
    def fake_get(url, timeout):
        raise requests.exceptions.RequestException("no internet")

    monkeypatch.setattr(M.requests, "get", fake_get)

    with pytest.raises(RuntimeError) as e:
        M.test_login()
    assert M.C.DWD_DOWNLOADER_ERR_CONNECTION in str(e.value)

def test_list_index_links_filters_and_joins(monkeypatch):
    C = M.C
    monkeypatch.setattr(C, "DWD_DOWNLOADER_HREF_REGEX_PATTERN", r'href="([^"]+)"', raising=False)
    # recompile regex im Modul neu setzen
    monkeypatch.setattr(M, "_HREF_RE", M.re.compile(C.DWD_DOWNLOADER_HREF_REGEX_PATTERN, M.re.IGNORECASE))

    monkeypatch.setattr(C, "DWD_DOWNLOADER_HREF_PARENT_DIR", "../", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_HREF_CURRENT_DIR", "./", raising=False)
    monkeypatch.setattr(C, "DWD_DOWNLOADER_HREF_SKIP_PREFIXES", "?", raising=False)

    html = """
    <a href="../">../</a>
    <a href="./">./</a>
    <a href="?C=N;O=D">sort</a>
    <a href="subdir/">subdir/</a>
    <a href="file.txt">file.txt</a>
    """

    class Resp:
        text = html
        def raise_for_status(self): pass

    session = SimpleNamespace(get=lambda *a, **k: Resp())

    out = M._list_index_links(session, "https://host/base/", timeout=1)
    assert out == ["https://host/base/subdir/", "https://host/base/file.txt"]

def test_list_index_links_raises_on_request_exception():
    def fake_get(*a, **k):
        raise requests.exceptions.RequestException("boom")

    session = SimpleNamespace(get=fake_get)

    with pytest.raises(RuntimeError) as e:
        M._list_index_links(session, "https://host/base/", timeout=1)
    assert M.C.DWD_DOWNLOADER_ERR_DIR_LISTING in str(e.value)

def test_download_dwd_tree_dry_run_counts_only(monkeypatch, tmp_path):
    # Arrange
    base = "https://opendata.dwd.de/x/"
    # base dir listing: one subdir and one file
    def fake_list(session, dir_url, timeout):
        if dir_url == base:
            return [base + "sub/", base + "a.txt"]
        if dir_url == base + "sub/":
            return [base + "sub/b.txt"]
        return []

    monkeypatch.setattr(M, "_normalize_dwd_base_url", lambda u: u if u.endswith("/") else u + "/")
    monkeypatch.setattr(M, "_list_index_links", fake_list)

    # Fail fast if download gets called
    monkeypatch.setattr(M, "_download_file_atomic", lambda *a, **k: (_ for _ in ()).throw(AssertionError("should not download")))
    monkeypatch.setattr(M, "_download_daily_kl_zip_and_write_csv", lambda *a, **k: (_ for _ in ()).throw(AssertionError("should not download zip")))

    stats = M.download_dwd_tree(base, str(tmp_path), dry_run=True)

    assert stats.dirs_visited == 2
    assert stats.files_found == 2
    assert stats.files_downloaded == 0
    assert stats.files_skipped == 0
    assert stats.errors == 0

def test_download_dwd_tree_listing_error_increments_errors(monkeypatch, tmp_path):
    base = "https://opendata.dwd.de/x/"

    def fake_list(session, dir_url, timeout):
        raise RuntimeError("listing failed")

    monkeypatch.setattr(M, "_normalize_dwd_base_url", lambda u: u if u.endswith("/") else u + "/")
    monkeypatch.setattr(M, "_list_index_links", fake_list)

    stats = M.download_dwd_tree(base, str(tmp_path), dry_run=True)
    assert stats.dirs_visited == 1
    assert stats.errors == 1

def test_download_dwd_tree_daily_kl_uses_zip_to_csv(monkeypatch, tmp_path):
    base = "https://opendata.dwd.de/x/"

    def fake_list(session, dir_url, timeout):
        return [base + "tageswerte_kl_foo.zip"]

    monkeypatch.setattr(M, "_normalize_dwd_base_url", lambda u: u if u.endswith("/") else u + "/")
    monkeypatch.setattr(M, "_list_index_links", fake_list)
    monkeypatch.setattr(M, "_relative_path_under_base", lambda u, base_path: os.path.basename(u))

    monkeypatch.setattr(M, "_is_daily_kl_zip_url", lambda u: True)

    called = {"zip": 0}
    def fake_zip(*a, **k):
        called["zip"] += 1
        return True

    monkeypatch.setattr(M, "_download_daily_kl_zip_and_write_csv", fake_zip)
    monkeypatch.setattr(M, "_download_file_atomic", lambda *a, **k: (_ for _ in ()).throw(AssertionError("should not download file")))

    stats = M.download_dwd_tree(base, str(tmp_path), overwrite=True)
    assert stats.files_found == 1
    assert stats.files_downloaded == 1
    assert called["zip"] == 1
    
def test_download_daily_kl_zip_and_write_csv_raises_on_request_exception(tmp_path):
    def fake_get(*a, **k):
        raise requests.exceptions.RequestException("boom")

    session = SimpleNamespace(get=fake_get)

    with pytest.raises(RuntimeError) as e:
        M._download_daily_kl_zip_and_write_csv(
            session=session,
            zip_url="http://x/tageswerte_kl_foo.zip",
            csv_dest_path=str(tmp_path / "out.csv"),
            timeout=1,
            overwrite=True,
        )
    assert "ERR_ZIP_DL" in str(e.value)