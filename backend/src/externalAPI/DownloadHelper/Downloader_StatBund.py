"""
Helper module to provide the download functionality for downloading Statistisches Bundesamt data.
This is used by the Downloader to download files from the official Destatis website.
Author: Jonas Dorner (@OilersLD)
"""

import os
import io
import zipfile
import requests
import logging

from datetime import date

from Exceptions.External_Connection_Error import raise_externalConnection_error
from Exceptions.Output_Not_Defined_Error import raise_output_not_defined_error
from externalAPI.Constants import Constants


logger = logging.getLogger(__name__)


def _headers():
    return {
        # --- We can log in in via Token or Username/Password. For simplicity, we use the token as username and an empty password. ---
        "Content-Type": "application/x-www-form-urlencoded",
        "username": Constants.GENESIS_TOKEN,
        "password": ""
    }


def test_login() -> bool:
    r = requests.post(
        Constants.DEST_BASE_URL + "helloworld/logincheck",
        headers=_headers(),
        data={"language": "de"},
        timeout=60
    )
    if r.status_code == 200:
        logger.info("DESTATIS Logincheck successful.")
        return True
    else:
        raise_externalConnection_error(
            "DESTATIS login failed",
            genesis_code=str(r.status_code),
            details=f"Status code: {r.status_code}"
        )
        return False


def _decode_bytes(b: bytes) -> tuple[str, str]:
    """
    Decode bytes into text with a robust fallback strategy.
    Returns (text, encoding_used).
    """
    encodings = ["utf-8", "utf-8-sig", "cp1252", "latin-1"]
    for enc in encodings:
        try:
            return b.decode(enc, errors="strict"), enc
        except UnicodeDecodeError:
            pass
    # last resort: data loss possible
    return b.decode("utf-8", errors="replace"), "utf-8 (replace)"


def _pick_zip_member(zf: zipfile.ZipFile) -> str:
    """
    Prefer .csv/.ffcsv members; otherwise fall back to the first entry.
    """
    names = zf.namelist()
    for suffix in (".csv", ".ffcsv"):
        for n in names:
            if n.lower().endswith(suffix):
                return n
    return names[0]


def download_table_and_save(table_name: str, startyear: int = 2020, output_dir: str | None = None) -> bool:
    """
    This method downloads a table from DESTATIS and saves it as a UTF-8 encoded CSV file in the specified output directory. It handles both direct CSV responses and ZIP files containing the CSV. It also includes error handling for connection issues and invalid responses.
    Args:
        table_name: The table id as number as string, e.g. "12411-0001"
        startyear: The starting year for the data (default: 2020)
        output_dir: Where the table should be saved. If None, an error is raised (default: None)
    Returns: True if the download and save were successful, False otherwise.
    """

    if output_dir is None:
        raise_output_not_defined_error(
            output_target=output_dir,
            details="Output directory is not specified."
        )
        return False

    r = requests.post(
        Constants.DEST_BASE_URL + "data/tablefile",
        headers=_headers(),
        data={
            "name": table_name,
            "startyear": str(startyear),
            "compress": "true",
            "format": "ffcsv",
            "language": "de",
        },
        timeout=120
    )

    if r.status_code != 200:
        raise_externalConnection_error(
            "Error downloading table with number " + table_name,
            genesis_code=str(r.status_code),
            details=f"Status code: {r.status_code}"
        )
        return False

    content = r.content

    # Extract bytes (either from ZIP member or directly from response)
    if content[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            member = _pick_zip_member(zf)
            data_bytes = zf.read(member)
    else:
        data_bytes = content

    text, enc_used = _decode_bytes(data_bytes)

    # Detect likely JSON error response
    stripped = text.lstrip()
    # --- Sometimes DESTATIS returns an error as JSON with a "Code" field or "{", even with 200 OK status. ---
    if stripped.startswith("{") and '"Code"' in text:
        raise_externalConnection_error(
            "DESTATIS returned an error response for table " + table_name,
            details=text
        )
        return False

    os.makedirs(output_dir, exist_ok=True)
    today = date.today().isoformat()
    out_path = os.path.join(output_dir, f"{table_name}_destatis_{today}.csv")

    # Normalize output to UTF-8
    with open(out_path, "wb") as f:
        f.write(text.encode("utf-8"))

    logger.info(f"Saved {out_path}")
    return True
