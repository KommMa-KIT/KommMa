import io
import os
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest
import requests

import externalAPI.DownloadHelper.Downloader_SRTM as M


@pytest.fixture(autouse=True)
def patch_raise(monkeypatch):
    # make raise_externalConnection_error testable
    def _raise(msg, genesis_code=None, details=None):
        raise RuntimeError(f"{msg} | {genesis_code} | {details}")
    monkeypatch.setattr(M, "raise_externalConnection_error", _raise)


@pytest.fixture(autouse=True)
def patch_constants(monkeypatch):
    # ensure code's "C" alias exists even if buggy
    monkeypatch.setattr(M, "C", M.Constants, raising=False)

    monkeypatch.setattr(M.Constants, "SRTM_GERMANY_DTM_URL", "https://example.test/srtm.zip", raising=False)
    monkeypatch.setattr(M.Constants, "REQUEST_TIMEOUT", 1, raising=False)
    # used in error messages in your code
    monkeypatch.setattr(M.Constants, "STATION_LIST_URL", "https://example.test/stations.txt", raising=False)


@pytest.fixture(autouse=True)
def freeze_date(monkeypatch):
    class FakeDate:
        @staticmethod
        def today():
            import datetime
            return datetime.date(2026, 3, 5)

    monkeypatch.setattr(M, "date", FakeDate)


def _make_zip_bytes(member_path: str, member_bytes: bytes) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr(member_path, member_bytes)
    return buf.getvalue()


def test_download_srtm_success_flat_member(tmp_path, monkeypatch):
    # ZIP contains the tif at root
    tif_name = "srtm_germany_dtm.tif"
    zip_bytes = _make_zip_bytes(tif_name, b"TIFDATA")

    class Resp:
        status_code = 200
        content = zip_bytes

    monkeypatch.setattr(M.requests, "get", lambda url, timeout: Resp())

    out = M.download_srtm_dtm(str(tmp_path), tif_name=tif_name)
    assert out.endswith("srtm_germany_dtm_2026-03-05.tif")
    assert Path(out).exists()
    assert Path(out).read_bytes() == b"TIFDATA"

    # ZIP should be removed in finally
    assert not any(tmp_path.glob("srtm_germany_dtm_2026-03-05.zip"))


def test_download_srtm_success_nested_member_moves_to_root(tmp_path, monkeypatch):
    # ZIP contains the tif inside a folder
    tif_name = "srtm_germany_dtm.tif"
    zip_bytes = _make_zip_bytes(f"subdir/{tif_name}", b"TIFDATA2")

    class Resp:
        status_code = 200
        content = zip_bytes

    monkeypatch.setattr(M.requests, "get", lambda url, timeout: Resp())

    out = M.download_srtm_dtm(str(tmp_path), tif_name=tif_name)
    assert Path(out).exists()
    assert Path(out).read_bytes() == b"TIFDATA2"
    # should be normalized to out_dir/<date>.tif (no subdir left)
    assert not (tmp_path / "subdir").exists()


def test_download_srtm_timeout(monkeypatch, tmp_path):
    def fake_get(url, timeout):
        raise requests.exceptions.Timeout("t")

    monkeypatch.setattr(M.requests, "get", fake_get)

    with pytest.raises(RuntimeError) as e:
        M.download_srtm_dtm(str(tmp_path))
    assert "timed out" in str(e.value).lower()


def test_download_srtm_request_exception(monkeypatch, tmp_path):
    def fake_get(url, timeout):
        raise requests.exceptions.RequestException("boom")

    monkeypatch.setattr(M.requests, "get", fake_get)

    with pytest.raises(RuntimeError) as e:
        M.download_srtm_dtm(str(tmp_path))
    assert "download failed" in str(e.value).lower()


def test_download_srtm_status_not_200(monkeypatch, tmp_path):
    class Resp:
        status_code = 404
        content = b"nope"

    monkeypatch.setattr(M.requests, "get", lambda url, timeout: Resp())

    with pytest.raises(RuntimeError) as e:
        M.download_srtm_dtm(str(tmp_path))
    assert "failed to download srtm" in str(e.value).lower()
    assert "404" in str(e.value)


def test_download_srtm_missing_member(monkeypatch, tmp_path):
    # ZIP does not contain the desired tif_name
    zip_bytes = _make_zip_bytes("other.tif", b"x")

    class Resp:
        status_code = 200
        content = zip_bytes

    monkeypatch.setattr(M.requests, "get", lambda url, timeout: Resp())

    with pytest.raises(RuntimeError) as e:
        M.download_srtm_dtm(str(tmp_path), tif_name="srtm_germany_dtm.tif")
    assert "not found in srtm zip" in str(e.value).lower()


def test_download_srtm_bad_zip(monkeypatch, tmp_path):
    class Resp:
        status_code = 200
        content = b"not-a-zip"

    monkeypatch.setattr(M.requests, "get", lambda url, timeout: Resp())

    with pytest.raises(RuntimeError) as e:
        M.download_srtm_dtm(str(tmp_path))
    assert "not a valid zip" in str(e.value).lower()