"""
Helper module to provide the download functionality for downloading Regionaldatenbank data.
This is used by the Downloader to download the Regionaldatenbank data from the official RDB website.
Author: Jonas Dorner (@OilersLD)
"""


from Exceptions.External_Connection_Error import ExternalConnection, raise_externalConnection_error
from Exceptions.Output_Not_Defined_Error import raise_output_not_defined_error
from externalAPI.Constants import Constants

import io
import json
import os
import re
import time
import zipfile
import requests

from pathlib import Path
from datetime import datetime

def headers():
    return {
        "Content-Type": "application/x-www-form-urlencoded",
        "username": Constants.RDB_USER,
        "password": Constants.RDB_PASS,
    }


def test_login() -> bool:
    if not Constants.RDB_USER or not Constants.RDB_PASS:
        raise_externalConnection_error(
            "Regionaldatenbank credentials are not set.",
            genesis_code="NO_CREDENTIALS",
            details="Please provide valid username and password for Regionaldatenbank access.",
        )
        return False

    r = requests.post(
        Constants.RDB_BASE_URL + "helloworld/logincheck",
        headers=headers(),
        data={"language": Constants.LANG_PREF, "username": Constants.RDB_USER, "password": Constants.RDB_PASS},
        timeout=60,
    )
    if r.status_code != 200:
        raise_externalConnection_error(
            "Failed to connect to Regionaldatenbank for login check.",
            genesis_code=str(r.status_code),
            details=f"HTTP status code: {r.status_code}, body: {r.text[:1200]}",
        )
        return False
    return True


def download_table_and_save(table_name: str, out_dir: str | None = None) -> bool:
    if out_dir is None:
        raise_output_not_defined_error(
            output_target="Regionaldatenbank table download",
            details="Please provide a valid output directory to save the downloaded table.",
        )
        return False

    Path(out_dir).mkdir(parents=True, exist_ok=True)

    base_data = {
        "name": table_name,
        "area": "all",
        "compress": "true",
        "format": "ffcsv",
        "language": Constants.LANG_PREF,
        "username": Constants.RDB_USER,
        "password": Constants.RDB_PASS,
    }

    def _looks_like_zip(b: bytes) -> bool:
        return len(b) >= 2 and b[:2] == b"PK"

    def _try_parse_status(text: str) -> dict | None:
        t = text.strip()
        if not (t.startswith("{") and '"Status"' in t):
            return None
        try:
            obj = json.loads(t)
        except Exception:
            return None
        if isinstance(obj, dict) and "Status" in obj:
            return obj
        return None

    def _status_fields(obj: dict) -> tuple[int | None, str, str]:
        status = obj.get("Status") or {}
        code = status.get("Code")
        typ = (status.get("Type") or "").strip()
        content = (status.get("Content") or "").strip()
        return code, typ, content

    def _job_required(text: str, status_obj: dict | None) -> bool:
        if status_obj is not None:
            code, _, content = _status_fields(status_obj)
            if code == 98:
                return True
            if "job=true" in (content or "").lower():
                return True

        hay = text.lower()
        markers = ["job=true", "auftrag", "hintergrund", "nicht im dialog", "zu groß", "zu gross", "wertfelder", "batch"]
        return any(m in hay for m in markers)

    def _extract_zip_to_csv_text(content: bytes) -> str:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            files = [n for n in zf.namelist() if not n.endswith("/")]
            if not files:
                raise RuntimeError("ZIP contains no files.")
            with zf.open(files[0]) as f:
                return f.read().decode("utf-8-sig", errors="replace")

    # Speichert immer mit Datum
    def _save_csv_text(csv_text: str) -> str:
        stamp = datetime.now().strftime("%Y-%m-%d")
        fname = f"{table_name}_rdb_{stamp}.csv"
        out_path = os.path.join(out_dir, fname)
        with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
            f.write(csv_text)
        return out_path

    def _extract_result_name_from_status(job_obj: dict) -> str | None:
        _, _, content = _status_fields(job_obj)
        m = re.search(r"abgerufen werden:\s*([^\s]+)", content, flags=re.IGNORECASE)
        if m:
            return m.group(1).strip()

        job_text = json.dumps(job_obj, ensure_ascii=False)
        m = re.search(rf"({re.escape(table_name)}_[0-9]+)", job_text)
        if m:
            return m.group(1)
        m = re.search(r"([0-9]{4,6}-[0-9]{3,5}_[0-9]+)", job_text)
        if m:
            return m.group(1)
        return None

    # 1) Normaler Abruf
    r = requests.post(
        Constants.RDB_BASE_URL + "data/tablefile",
        headers=headers(),
        data=base_data,
        timeout=120,
    )

    if r.status_code != 200:
        raise_externalConnection_error(
            "Failed to download tablefile from Regionaldatenbank.",
            genesis_code=str(r.status_code),
            details=f"HTTP status code: {r.status_code}, body: {r.text[:1200]}",
        )
        return False

    try:
        # A) Direkt als ZIP
        if _looks_like_zip(r.content):
            csv_text = _extract_zip_to_csv_text(r.content)
            _save_csv_text(csv_text)
            return True

        # B) Kein ZIP -> Status/Fehler oder uncompressed Text
        text = r.content.decode("utf-8-sig", errors="replace")
        obj = _try_parse_status(text)

        if obj is not None:
            code, typ, content = _status_fields(obj)

            # C) Wenn Job nötig -> Job starten
            if _job_required(text, obj):
                job_data = dict(base_data)
                job_data["job"] = "true"

                rj = requests.post(
                    Constants.RDB_BASE_URL + "data/tablefile",
                    headers=headers(),
                    data=job_data,
                    timeout=120,
                )
                if rj.status_code != 200:
                    raise_externalConnection_error(
                        "Failed to start GENESIS job for table download.",
                        genesis_code=str(rj.status_code),
                        details=f"HTTP status code: {rj.status_code}, body: {rj.text[:1200]}",
                    )
                    return False

                job_text = rj.content.decode("utf-8-sig", errors="replace")
                job_obj = _try_parse_status(job_text)
                if job_obj is None:
                    raise_externalConnection_error(
                        "Unexpected job-start response (no GENESIS status JSON).",
                        genesis_code="JOB_START_NO_STATUS",
                        details=job_text[:2000],
                    )
                    return False

                jcode, jtyp, jcontent = _status_fields(job_obj)

                if jcode not in (None, 0, 22, 99, 100):
                    raise_externalConnection_error(
                        "GENESIS job-start returned an error.",
                        genesis_code=str(jcode),
                        details=f"Type={jtyp}, Content={jcontent}\nRAW={job_text[:2000]}",
                    )
                    return False

                result_name = _extract_result_name_from_status(job_obj)
                if not result_name:
                    raise_externalConnection_error(
                        "Job started but result name could not be extracted.",
                        genesis_code="JOB_NO_RESULT_NAME",
                        details=f"Type={jtyp}, Content={jcontent}\nRAW={job_text[:2000]}",
                    )
                    return False

                deadline = time.time() + 600
                last_info = None

                while time.time() < deadline:
                    for area in Constants.AREA_CANDIDATES:
                        rr = requests.post(
                            Constants.RDB_BASE_URL + "data/resultfile",
                            headers=headers(),
                            data={
                                "name": result_name,
                                "area": area,
                                "compress": "true",
                                "format": "ffcsv",
                                "language": Constants.LANG_PREF,
                                "username": Constants.RDB_USER,
                                "password": Constants.RDB_PASS,
                            },
                            timeout=120,
                        )

                        if rr.status_code != 200:
                            last_info = f"area={area} HTTP {rr.status_code}: {rr.text[:200]}"
                            continue

                        if _looks_like_zip(rr.content):
                            csv_text = _extract_zip_to_csv_text(rr.content)
                            _save_csv_text(csv_text)
                            return True

                        rt = rr.content.decode("utf-8-sig", errors="replace")
                        robj = _try_parse_status(rt)

                        if robj is not None:
                            rcode, rtyp, rcontent = _status_fields(robj)
                            if rcode == 104:
                                last_info = f"not ready (104) area={area}: {rcontent}"
                                continue
                            if rcode in (None, 0, 22):
                                obj2 = robj.get("Object") or {}
                                if isinstance(obj2, dict) and "Content" in obj2:
                                    _save_csv_text(str(obj2["Content"]))
                                    return True
                                last_info = f"status OK but no data area={area}: Type={rtyp}, Content={rcontent}"
                                continue

                            raise_externalConnection_error(
                                "GENESIS resultfile returned an error.",
                                genesis_code=str(rcode),
                                details=f"area={area}\nType={rtyp}, Content={rcontent}\nRAW={rt[:2000]}",
                            )
                            return False

                        _save_csv_text(rt)
                        return True

                    time.sleep(2)

                raise_externalConnection_error(
                    "GENESIS job result was not available in time.",
                    genesis_code="JOB_TIMEOUT",
                    details=f"result_name={result_name}, last={last_info}",
                )
                return False

            # Kein Job nötig -> Status auswerten
            if code in (None, 0):
                o = obj.get("Object") or {}
                if isinstance(o, dict) and "Content" in o:
                    _save_csv_text(str(o["Content"]))
                    return True
                raise_externalConnection_error(
                    "GENESIS returned OK status but no data content.",
                    genesis_code=str(code),
                    details=f"Type={typ}, Content={content}\nRAW={text[:2000]}",
                )
                return False

            if code == 22:
                o = obj.get("Object") or {}
                if isinstance(o, dict) and "Content" in o:
                    _save_csv_text(str(o["Content"]))
                    return True
                raise_externalConnection_error(
                    "GENESIS returned warning without data.",
                    genesis_code=str(code),
                    details=f"Type={typ}, Content={content}\nRAW={text[:2000]}",
                )
                return False

            raise_externalConnection_error(
                "GENESIS returned an error status.",
                genesis_code=str(code),
                details=f"Type={typ}, Content={content}\nRAW={text[:2000]}",
            )
            return False

        # Kein JSON und kein ZIP -> als Text abspeichern
        _save_csv_text(text)
        return True

    except ExternalConnection:
        raise
    except Exception as e:
        raise_externalConnection_error(
            "Unexpected error while downloading/saving table from Regionaldatenbank.",
            genesis_code="UNEXPECTED",
            details=repr(e),
        )
        return False
