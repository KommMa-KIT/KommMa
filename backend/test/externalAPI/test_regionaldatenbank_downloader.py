import io
import json
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest

import externalAPI.DownloadHelper.Downloader_Regionaldatenbank as M


# ----------------------------
# Helpers
# ----------------------------
class FakeResp:
    def __init__(self, status_code=200, content=b"", text=None):
        self.status_code = status_code
        self.content = content
        # some code paths access r.text
        self.text = text if text is not None else content.decode("utf-8", errors="ignore")


def make_zip_bytes(filename="x.csv", data="a;b\n1;2\n"):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(filename, data.encode("utf-8"))
    return buf.getvalue()


def status_json(code, typ="info", content="ok", obj_content=None):
    payload = {"Status": {"Code": code, "Type": typ, "Content": content}}
    if obj_content is not None:
        payload["Object"] = {"Content": obj_content}
    return json.dumps(payload, ensure_ascii=False)


@pytest.fixture(autouse=True)
def patch_errors(monkeypatch):
    # Make errors testable
    class ExternalConnection(RuntimeError):
        pass

    monkeypatch.setattr(M, "ExternalConnection", ExternalConnection, raising=False)

    def raise_ext(msg, genesis_code=None, details=None):
        raise ExternalConnection(f"{msg} | {genesis_code} | {details}")

    monkeypatch.setattr(M, "raise_externalConnection_error", raise_ext)

    def raise_out(output_target=None, details=None):
        raise RuntimeError(f"OUT_NOT_DEFINED | {output_target} | {details}")

    monkeypatch.setattr(M, "raise_output_not_defined_error", raise_out)


@pytest.fixture(autouse=True)
def patch_constants(monkeypatch):
    C = M.Constants
    monkeypatch.setattr(C, "RDB_USER", "user", raising=False)
    monkeypatch.setattr(C, "RDB_PASS", "pass", raising=False)
    monkeypatch.setattr(C, "RDB_BASE_URL", "https://rdb.test/", raising=False)
    monkeypatch.setattr(C, "LANG_PREF", "de", raising=False)
    monkeypatch.setattr(C, "AREA_CANDIDATES", ["all", "01"], raising=False)


@pytest.fixture(autouse=True)
def patch_datetime(monkeypatch):
    # Freeze datetime.now().strftime("%Y-%m-%d") -> 2026-03-05
    class FakeDT:
        @classmethod
        def now(cls):
            import datetime as _dt
            return _dt.datetime(2026, 3, 5, 12, 0, 0)

    monkeypatch.setattr(M, "datetime", FakeDT)


@pytest.fixture(autouse=True)
def patch_sleep(monkeypatch):
    monkeypatch.setattr(M.time, "sleep", lambda *_a, **_k: None)


# ----------------------------
# headers()
# ----------------------------
def test_headers_contains_credentials():
    h = M.headers()
    assert h["Content-Type"] == "application/x-www-form-urlencoded"
    assert h["username"] == "user"
    assert h["password"] == "pass"


# ----------------------------
# test_login()
# ----------------------------
def test_test_login_no_credentials(monkeypatch):
    monkeypatch.setattr(M.Constants, "RDB_USER", "", raising=False)
    monkeypatch.setattr(M.Constants, "RDB_PASS", "", raising=False)

    with pytest.raises(RuntimeError) as e:
        M.test_login()
    assert "NO_CREDENTIALS" in str(e.value)


def test_test_login_http_not_200(monkeypatch):
    def fake_post(url, headers, data, timeout):
        return FakeResp(status_code=401, content=b"nope")

    monkeypatch.setattr(M.requests, "post", fake_post)

    with pytest.raises(RuntimeError) as e:
        M.test_login()
    assert "401" in str(e.value)


def test_test_login_ok(monkeypatch):
    def fake_post(url, headers, data, timeout):
        return FakeResp(status_code=200, content=b"ok")

    monkeypatch.setattr(M.requests, "post", fake_post)

    assert M.test_login() is True


# ----------------------------
# download_table_and_save()
# ----------------------------
def test_download_table_and_save_outdir_none_raises():
    with pytest.raises(RuntimeError) as e:
        M.download_table_and_save("TAB1", out_dir=None)
    assert "OUT_NOT_DEFINED" in str(e.value)


def test_download_table_and_save_initial_http_not_200(monkeypatch, tmp_path):
    def fake_post(url, headers, data, timeout):
        assert url.endswith("data/tablefile")
        return FakeResp(status_code=500, content=b"err")

    monkeypatch.setattr(M.requests, "post", fake_post)

    with pytest.raises(M.ExternalConnection):
        M.download_table_and_save("TAB1", out_dir=str(tmp_path))


def test_download_table_and_save_direct_zip_success(monkeypatch, tmp_path):
    zip_bytes = make_zip_bytes("x.csv", "c1;c2\n1;2\n")

    def fake_post(url, headers, data, timeout):
        assert url.endswith("data/tablefile")
        return FakeResp(status_code=200, content=zip_bytes)

    monkeypatch.setattr(M.requests, "post", fake_post)

    ok = M.download_table_and_save("TAB1", out_dir=str(tmp_path))
    assert ok is True

    # file saved with frozen date
    out = list(Path(tmp_path).glob("TAB1_rdb_2026-03-05.csv"))
    assert len(out) == 1
    assert out[0].read_text(encoding="utf-8-sig").strip().startswith("c1;c2")


def test_download_table_and_save_plain_text_success(monkeypatch, tmp_path):
    def fake_post(url, headers, data, timeout):
        return FakeResp(status_code=200, content="hello;world\n".encode("utf-8"))

    monkeypatch.setattr(M.requests, "post", fake_post)

    ok = M.download_table_and_save("TAB2", out_dir=str(tmp_path))
    assert ok is True
    out = tmp_path / "TAB2_rdb_2026-03-05.csv"
    assert out.exists()
    assert "hello;world" in out.read_text(encoding="utf-8-sig")


def test_download_table_and_save_status_ok_with_object_content(monkeypatch, tmp_path):
    payload = status_json(0, obj_content="x;y\n3;4\n").encode("utf-8")

    def fake_post(url, headers, data, timeout):
        return FakeResp(status_code=200, content=payload)

    monkeypatch.setattr(M.requests, "post", fake_post)

    ok = M.download_table_and_save("TAB3", out_dir=str(tmp_path))
    assert ok is True
    out = tmp_path / "TAB3_rdb_2026-03-05.csv"
    assert out.exists()
    assert "3;4" in out.read_text(encoding="utf-8-sig")


def test_download_table_and_save_status_warning_22_with_content(monkeypatch, tmp_path):
    payload = status_json(22, obj_content="a;b\n5;6\n").encode("utf-8")

    monkeypatch.setattr(M.requests, "post", lambda *a, **k: FakeResp(200, payload))

    ok = M.download_table_and_save("TAB4", out_dir=str(tmp_path))
    assert ok is True
    assert (tmp_path / "TAB4_rdb_2026-03-05.csv").exists()


def test_download_table_and_save_status_error(monkeypatch, tmp_path):
    payload = status_json(55, typ="error", content="bad").encode("utf-8")

    monkeypatch.setattr(M.requests, "post", lambda *a, **k: FakeResp(200, payload))

    with pytest.raises(M.ExternalConnection) as e:
        M.download_table_and_save("TAB5", out_dir=str(tmp_path))
    assert "55" in str(e.value)


def test_download_table_and_save_job_flow_result_zip(monkeypatch, tmp_path):
    """
    Flow:
      1) tablefile returns status needing job (code 98)
      2) tablefile with job=true returns status OK and contains result name
      3) resultfile returns zip -> saved -> True
    """

    calls = {"n": 0}
    zip_bytes = make_zip_bytes("res.csv", "k;l\n7;8\n")

    # 1) job required
    first = status_json(98, content="job=true please").encode("utf-8")
    # 2) job started (code 0) with content that includes table_name_123
    job_started = status_json(0, content="kann abgerufen werden: TABJOB_123").encode("utf-8")

    def fake_post(url, headers, data, timeout):
        calls["n"] += 1
        if url.endswith("data/tablefile") and "job" not in data:
            return FakeResp(200, first)
        if url.endswith("data/tablefile") and data.get("job") == "true":
            return FakeResp(200, job_started)
        if url.endswith("data/resultfile"):
            return FakeResp(200, zip_bytes)
        raise AssertionError(f"unexpected call url={url} data={data}")

    monkeypatch.setattr(M.requests, "post", fake_post)

    ok = M.download_table_and_save("TABJOB", out_dir=str(tmp_path))
    assert ok is True
    assert (tmp_path / "TABJOB_rdb_2026-03-05.csv").exists()


def test_download_table_and_save_job_start_http_not_200(monkeypatch, tmp_path):
    first = status_json(98, content="job=true please").encode("utf-8")

    def fake_post(url, headers, data, timeout):
        if url.endswith("data/tablefile") and "job" not in data:
            return FakeResp(200, first)
        if url.endswith("data/tablefile") and data.get("job") == "true":
            return FakeResp(500, b"nope")
        raise AssertionError("unexpected")

    monkeypatch.setattr(M.requests, "post", fake_post)

    with pytest.raises(M.ExternalConnection) as e:
        M.download_table_and_save("TABJOB", out_dir=str(tmp_path))
    assert "Failed to start GENESIS job" in str(e.value)
    
def test_download_table_and_save_job_flow_result_not_ready_then_zip(monkeypatch, tmp_path):
    first = status_json(98, content="job=true please").encode("utf-8")
    job_started = status_json(0, content="kann abgerufen werden: TABJOB_123").encode("utf-8")
    not_ready = status_json(104, typ="info", content="wait").encode("utf-8")
    zip_bytes = make_zip_bytes("res.csv", "k;l\n7;8\n")

    calls = {"result": 0}

    def fake_post(url, headers, data, timeout):
        if url.endswith("data/tablefile") and "job" not in data:
            return FakeResp(200, first)
        if url.endswith("data/tablefile") and data.get("job") == "true":
            return FakeResp(200, job_started)
        if url.endswith("data/resultfile"):
            calls["result"] += 1
            # first poll: not ready, second poll: zip
            return FakeResp(200, not_ready if calls["result"] == 1 else zip_bytes)
        raise AssertionError("unexpected")

    monkeypatch.setattr(M.requests, "post", fake_post)

    ok = M.download_table_and_save("TABJOB", out_dir=str(tmp_path))
    assert ok is True
    assert (tmp_path / "TABJOB_rdb_2026-03-05.csv").exists()

def test_download_table_and_save_job_start_no_status_json(monkeypatch, tmp_path):
    first = status_json(98, content="job=true please").encode("utf-8")

    def fake_post(url, headers, data, timeout):
        if url.endswith("data/tablefile") and "job" not in data:
            return FakeResp(200, first)
        if url.endswith("data/tablefile") and data.get("job") == "true":
            return FakeResp(200, b"not json")
        raise AssertionError("unexpected")

    monkeypatch.setattr(M.requests, "post", fake_post)

    with pytest.raises(M.ExternalConnection) as e:
        M.download_table_and_save("TABJOB", out_dir=str(tmp_path))
    assert "JOB_START_NO_STATUS" in str(e.value)

def test_download_table_and_save_job_timeout(monkeypatch, tmp_path):
    first = status_json(98, content="job=true please").encode("utf-8")
    job_started = status_json(0, content="kann abgerufen werden: TABJOB_123").encode("utf-8")
    not_ready = status_json(104, typ="info", content="wait").encode("utf-8")

    # fake time: start at 0, quickly exceed deadline (600)
    t = {"now": 0}
    monkeypatch.setattr(M.time, "time", lambda: t["now"])

    def fake_post(url, headers, data, timeout):
        if url.endswith("data/tablefile") and "job" not in data:
            return FakeResp(200, first)
        if url.endswith("data/tablefile") and data.get("job") == "true":
            return FakeResp(200, job_started)
        if url.endswith("data/resultfile"):
            # advance time so loop ends
            t["now"] += 1000
            return FakeResp(200, not_ready)
        raise AssertionError("unexpected")

    monkeypatch.setattr(M.requests, "post", fake_post)

    with pytest.raises(M.ExternalConnection) as e:
        M.download_table_and_save("TABJOB", out_dir=str(tmp_path))
    assert "JOB_TIMEOUT" in str(e.value)

def test_download_table_and_save_job_start_status_error_code(monkeypatch, tmp_path):
    # 1) initial says job required
    first = status_json(98, content="job=true please").encode("utf-8")
    # 2) job started but returns error code not allowed
    job_started_bad = status_json(55, typ="error", content="bad").encode("utf-8")

    def fake_post(url, headers, data, timeout):
        if url.endswith("data/tablefile") and "job" not in data:
            return FakeResp(200, first)
        if url.endswith("data/tablefile") and data.get("job") == "true":
            return FakeResp(200, job_started_bad)
        raise AssertionError("unexpected")

    monkeypatch.setattr(M.requests, "post", fake_post)

    with pytest.raises(M.ExternalConnection) as e:
        M.download_table_and_save("TABJOB", out_dir=str(tmp_path))

    s = str(e.value)
    assert "GENESIS job-start returned an error" in s
    assert "55" in s
    
def test_download_table_and_save_job_no_result_name(monkeypatch, tmp_path):
    first = status_json(98, content="job=true please").encode("utf-8")
    # code 0 but content does NOT contain "kann abgerufen werden: <name>"
    job_started_no_name = status_json(0, typ="info", content="ok but no result reference").encode("utf-8")

    def fake_post(url, headers, data, timeout):
        if url.endswith("data/tablefile") and "job" not in data:
            return FakeResp(200, first)
        if url.endswith("data/tablefile") and data.get("job") == "true":
            return FakeResp(200, job_started_no_name)
        raise AssertionError("unexpected")

    monkeypatch.setattr(M.requests, "post", fake_post)

    with pytest.raises(M.ExternalConnection) as e:
        M.download_table_and_save("TABJOB", out_dir=str(tmp_path))

    s = str(e.value)
    assert "JOB_NO_RESULT_NAME" in s

def test_download_table_and_save_resultfile_status_error(monkeypatch, tmp_path):
    first = status_json(98, content="job=true please").encode("utf-8")
    job_started = status_json(0, content="kann abgerufen werden: TABJOB_123").encode("utf-8")
    result_error = status_json(55, typ="error", content="bad").encode("utf-8")

    def fake_post(url, headers, data, timeout):
        if url.endswith("data/tablefile") and "job" not in data:
            return FakeResp(200, first)
        if url.endswith("data/tablefile") and data.get("job") == "true":
            return FakeResp(200, job_started)
        if url.endswith("data/resultfile"):
            return FakeResp(200, result_error)
        raise AssertionError("unexpected")

    monkeypatch.setattr(M.requests, "post", fake_post)

    with pytest.raises(M.ExternalConnection) as e:
        M.download_table_and_save("TABJOB", out_dir=str(tmp_path))

    s = str(e.value)
    assert "GENESIS resultfile returned an error" in s
    assert "55" in s

def test_download_table_and_save_resultfile_status_ok_with_object_content(monkeypatch, tmp_path):
    first = status_json(98, content="job=true please").encode("utf-8")
    job_started = status_json(0, content="kann abgerufen werden: TABJOB_123").encode("utf-8")
    result_ok_obj = status_json(0, typ="info", content="ok", obj_content="x;y\n9;10\n").encode("utf-8")

    def fake_post(url, headers, data, timeout):
        if url.endswith("data/tablefile") and "job" not in data:
            return FakeResp(200, first)
        if url.endswith("data/tablefile") and data.get("job") == "true":
            return FakeResp(200, job_started)
        if url.endswith("data/resultfile"):
            return FakeResp(200, result_ok_obj)
        raise AssertionError("unexpected")

    monkeypatch.setattr(M.requests, "post", fake_post)

    ok = M.download_table_and_save("TABJOB", out_dir=str(tmp_path))
    assert ok is True

    out = tmp_path / "TABJOB_rdb_2026-03-05.csv"
    assert out.exists()
    assert "9;10" in out.read_text(encoding="utf-8-sig")
    
def test_download_table_and_save_resultfile_ok_no_object_then_zip_next_area(monkeypatch, tmp_path):
    first = status_json(98, content="job=true please").encode("utf-8")
    job_started = status_json(0, content="kann abgerufen werden: TABJOB_123").encode("utf-8")

    # OK status but without Object.Content -> should continue to next area
    result_ok_no_obj = status_json(0, typ="info", content="ok but no object").encode("utf-8")

    zip_bytes = make_zip_bytes("res.csv", "a;b\n1;2\n")

    def fake_post(url, headers, data, timeout):
        if url.endswith("data/tablefile") and "job" not in data:
            return FakeResp(200, first)
        if url.endswith("data/tablefile") and data.get("job") == "true":
            return FakeResp(200, job_started)
        if url.endswith("data/resultfile"):
            # First candidate area -> ok but no object
            if data.get("area") == "all":
                return FakeResp(200, result_ok_no_obj)
            # Second candidate area -> zip
            if data.get("area") == "01":
                return FakeResp(200, zip_bytes)
        raise AssertionError(f"unexpected call url={url} data={data}")

    monkeypatch.setattr(M.requests, "post", fake_post)

    ok = M.download_table_and_save("TABJOB", out_dir=str(tmp_path))
    assert ok is True
    assert (tmp_path / "TABJOB_rdb_2026-03-05.csv").exists()

def test_download_table_and_save_resultfile_raw_text_fallback(monkeypatch, tmp_path):
    first = status_json(98, content="job=true please").encode("utf-8")
    job_started = status_json(0, content="kann abgerufen werden: TABJOB_123").encode("utf-8")

    def fake_post(url, headers, data, timeout):
        if url.endswith("data/tablefile") and "job" not in data:
            return FakeResp(200, first)
        if url.endswith("data/tablefile") and data.get("job") == "true":
            return FakeResp(200, job_started)
        if url.endswith("data/resultfile"):
            return FakeResp(200, b"raw;csv\n11;12\n")  # not zip, not json
        raise AssertionError("unexpected")

    monkeypatch.setattr(M.requests, "post", fake_post)

    ok = M.download_table_and_save("TABJOB", out_dir=str(tmp_path))
    assert ok is True
    out = tmp_path / "TABJOB_rdb_2026-03-05.csv"
    assert out.exists()
    assert "11;12" in out.read_text(encoding="utf-8-sig")
    
def test_download_table_and_save_status_ok_but_no_object_content_raises(monkeypatch, tmp_path):
    payload = status_json(0, typ="info", content="ok but no object", obj_content=None).encode("utf-8")

    monkeypatch.setattr(M.requests, "post", lambda *a, **k: FakeResp(200, payload))

    with pytest.raises(M.ExternalConnection) as e:
        M.download_table_and_save("TABX", out_dir=str(tmp_path))

    s = str(e.value)
    assert "GENESIS returned OK status but no data content" in s
    
def test_download_table_and_save_status_22_but_no_object_content_raises(monkeypatch, tmp_path):
    payload = status_json(22, typ="warn", content="warn but no data", obj_content=None).encode("utf-8")

    monkeypatch.setattr(M.requests, "post", lambda *a, **k: FakeResp(200, payload))

    with pytest.raises(M.ExternalConnection) as e:
        M.download_table_and_save("TABX", out_dir=str(tmp_path))

    s = str(e.value)
    assert "GENESIS returned warning without data" in s
    assert "22" in s