import os
from types import SimpleNamespace
import pytest
import requests
import re

# Import: dein Modul
import externalAPI.DownloadHelper.Downloader_Gemeindeverzeichnis as M


@pytest.fixture(autouse=True)
def patch_raise(monkeypatch):
    # macht raise_externalConnection_error testbar
    def _raise(msg, genesis_code=None, details=None):
        raise RuntimeError(f"{msg} | {genesis_code} | {details}")
    monkeypatch.setattr(M, "raise_externalConnection_error", _raise)



@pytest.fixture(autouse=True)
def patch_constants(monkeypatch):
    # nur was im Modul verwendet wird
    monkeypatch.setattr(M.Constants, "GV_AUSZUG_EXCEL_URL", "https://example.test/gv.xlsx", raising=False)
    monkeypatch.setattr(M.Constants, "REQUEST_TIMEOUT", 1, raising=False)
    # im Code wird (leider) STATION_LIST_URL in Fehlermeldung benutzt -> existieren lassen
    monkeypatch.setattr(M.Constants, "STATION_LIST_URL", "https://example.test/stations.txt", raising=False)


def test_download_gv_excel_success_writes_file(tmp_path, monkeypatch):
    class FakeDate:
        @staticmethod
        def today():
            import datetime
            return datetime.date(2026, 3, 5)

    monkeypatch.setattr(M, "date", FakeDate)

    content = b"excel-bytes"

    class Resp:
        def __init__(self):
            self.status_code = 200
            self.content = content
        def raise_for_status(self):
            return None

    def fake_get(url, timeout):
        assert url == "https://example.test/gv.xlsx"
        assert timeout == 1
        return Resp()

    monkeypatch.setattr(M.requests, "get", fake_get)

    out_dir = tmp_path / "out"
    ok = M.download_gv_excel(str(out_dir))
    assert ok is True

    expected = out_dir / "gemeindeverzeichnis_2026-03-05.xlsx"
    assert expected.exists()
    assert expected.read_bytes() == content


def test_download_gv_excel_timeout_raises(monkeypatch, tmp_path):
    def fake_get(url, timeout):
        raise requests.exceptions.Timeout("t")

    monkeypatch.setattr(M.requests, "get", fake_get)

    with pytest.raises(RuntimeError) as e:
        M.download_gv_excel(str(tmp_path))
    # Message kommt aus deinem Code (mit STATION_LIST_URL)
    assert "timed out" in str(e.value)


def test_download_gv_excel_request_exception_raises(monkeypatch, tmp_path):
    def fake_get(url, timeout):
        raise requests.exceptions.RequestException("boom")

    monkeypatch.setattr(M.requests, "get", fake_get)

    with pytest.raises(RuntimeError) as e:
        M.download_gv_excel(str(tmp_path))
    assert "download failed" in str(e.value)


def test_download_gv_excel_status_not_200_raises(monkeypatch, tmp_path):
    class Resp:
        status_code = 404
        content = b"nope"
        def raise_for_status(self):
            # wichtig: darf NICHT raisen, sonst landen wir im RequestException-Block
            return None

    monkeypatch.setattr(M.requests, "get", lambda *a, **k: Resp())

    with pytest.raises(RuntimeError) as e:
        M.download_gv_excel(str(tmp_path))

    s = str(e.value)
    assert "Failed to download Gemeindeverzeichnis Excel file." in s
    assert "404" in s

