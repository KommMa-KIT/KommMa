import io
import zipfile
from pathlib import Path

import pytest

import externalAPI.DownloadHelper.Downloader_StatBund as M


# -----------------------------
# Fixtures: errors + constants
# -----------------------------
@pytest.fixture(autouse=True)
def patch_errors(monkeypatch):
    def raise_ext(msg, genesis_code=None, details=None):
        raise RuntimeError(f"EXT | {msg} | {genesis_code} | {details}")

    def raise_out(output_target=None, details=None):
        raise RuntimeError(f"OUT | {output_target} | {details}")

    monkeypatch.setattr(M, "raise_externalConnection_error", raise_ext)
    monkeypatch.setattr(M, "raise_output_not_defined_error", raise_out)


@pytest.fixture(autouse=True)
def patch_constants(monkeypatch):
    monkeypatch.setattr(M.Constants, "GENESIS_TOKEN", "TOKEN123", raising=False)
    monkeypatch.setattr(M.Constants, "DEST_BASE_URL", "https://destatis.test/", raising=False)


@pytest.fixture(autouse=True)
def freeze_date(monkeypatch):
    class FakeDate:
        @staticmethod
        def today():
            import datetime
            return datetime.date(2026, 3, 5)

    monkeypatch.setattr(M, "date", FakeDate)


# -----------------------------
# Helper to make ZIP response
# -----------------------------
def make_zip_bytes(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    return buf.getvalue()


# -----------------------------
# _headers
# -----------------------------
def test_headers_uses_token():
    h = M._headers()
    assert h["username"] == "TOKEN123"
    assert h["password"] == ""
    assert h["Content-Type"] == "application/x-www-form-urlencoded"


# -----------------------------
# test_login
# -----------------------------
def test_test_login_ok(monkeypatch):
    class Resp:
        status_code = 200

    monkeypatch.setattr(M.requests, "post", lambda *a, **k: Resp())
    assert M.test_login() is True


def test_test_login_fail(monkeypatch):
    class Resp:
        status_code = 401

    monkeypatch.setattr(M.requests, "post", lambda *a, **k: Resp())

    with pytest.raises(RuntimeError) as e:
        M.test_login()
    assert "DESTATIS login failed" in str(e.value)
    assert "401" in str(e.value)


# -----------------------------
# _decode_bytes
# -----------------------------
def test_decode_bytes_utf8():
    text, enc = M._decode_bytes("äöü".encode("utf-8"))
    assert text == "äöü"
    assert enc == "utf-8"


def test_decode_bytes_fallback_latin1():
    b = "ä".encode("latin-1")
    text, enc = M._decode_bytes(b)
    assert text == "ä"
    assert enc in ("cp1252", "latin-1")  # depends which succeeds first


# -----------------------------
# _pick_zip_member
# -----------------------------
def test_pick_zip_member_prefers_csv(tmp_path):
    zip_path = tmp_path / "x.zip"
    zip_path.write_bytes(make_zip_bytes({"a.txt": b"1", "b.csv": b"2"}))
    with zipfile.ZipFile(zip_path) as zf:
        assert M._pick_zip_member(zf) == "b.csv"


def test_pick_zip_member_falls_back_first(tmp_path):
    zip_path = tmp_path / "x.zip"
    zip_path.write_bytes(make_zip_bytes({"a.txt": b"1", "b.dat": b"2"}))
    with zipfile.ZipFile(zip_path) as zf:
        assert M._pick_zip_member(zf) == "a.txt"


# -----------------------------
# download_table_and_save
# -----------------------------
def test_download_table_and_save_outdir_none_raises():
    with pytest.raises(RuntimeError) as e:
        M.download_table_and_save("12411-0001", output_dir=None)
    assert "OUT | None" in str(e.value)


def test_download_table_and_save_http_error(monkeypatch, tmp_path):
    class Resp:
        status_code = 500
        content = b""

    monkeypatch.setattr(M.requests, "post", lambda *a, **k: Resp())

    with pytest.raises(RuntimeError) as e:
        M.download_table_and_save("12411-0001", output_dir=str(tmp_path))
    assert "Error downloading table" in str(e.value)
    assert "500" in str(e.value)


def test_download_table_and_save_direct_csv_success(monkeypatch, tmp_path):
    csv_bytes = b"c1;c2\n1;2\n"

    class Resp:
        status_code = 200
        content = csv_bytes

    monkeypatch.setattr(M.requests, "post", lambda *a, **k: Resp())

    ok = M.download_table_and_save("12411-0001", output_dir=str(tmp_path))
    assert ok is True

    out = tmp_path / "12411-0001_destatis_2026-03-05.csv"
    assert out.exists()
    assert out.read_bytes() == csv_bytes  # should already be utf-8


def test_download_table_and_save_zip_success(monkeypatch, tmp_path):
    zip_bytes = make_zip_bytes({
        "readme.txt": b"x",
        "data.ffcsv": b"a;b\n3;4\n",
    })

    class Resp:
        status_code = 200
        content = zip_bytes

    monkeypatch.setattr(M.requests, "post", lambda *a, **k: Resp())

    ok = M.download_table_and_save("12411-0002", output_dir=str(tmp_path))
    assert ok is True

    out = tmp_path / "12411-0002_destatis_2026-03-05.csv"
    assert out.exists()
    assert b"3;4" in out.read_bytes()


def test_download_table_and_save_json_error_even_with_200(monkeypatch, tmp_path):
    # must contain {"Code"...} to trigger the JSON error detection
    json_err = b'{"Code": 123, "Msg": "fail"}'

    class Resp:
        status_code = 200
        content = json_err

    monkeypatch.setattr(M.requests, "post", lambda *a, **k: Resp())

    with pytest.raises(RuntimeError) as e:
        M.download_table_and_save("12411-0003", output_dir=str(tmp_path))
    assert "DESTATIS returned an error response" in str(e.value)
    assert "Code" in str(e.value)