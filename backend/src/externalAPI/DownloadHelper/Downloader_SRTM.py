"""
Helper module to provide the download functionality for downloading SRTM elevation data.
Author: Julian Kragler
Co-Author: Jonas Dorner (@OilersLD)
"""

from datetime import date
from io import BytesIO

import os
import requests
import zipfile
import logging

from Exceptions.External_Connection_Error import raise_externalConnection_error
from externalAPI.Constants import Constants



logger = logging.getLogger(__name__)


def download_srtm_dtm(out_dir: str, tif_name: str = "srtm_germany_dtm.tif") -> str:
    """Downloads the SRTM Germany DTM ZIP from OpenDEM and extracts the GeoTIFF.

    Args:
        out_dir (str): The output directory where the GeoTIFF file will be saved.
        tif_name (str): The GeoTIFF filename to extract from the ZIP (default: "srtm_germany_dtm.tif").

    Returns:
        str: Absolute path to the extracted GeoTIFF file.
    """
    today = date.today()
    os.makedirs(out_dir, exist_ok=True)

    zip_basename = f"srtm_germany_dtm_{today}"
    zip_path = os.path.join(out_dir, f"{zip_basename}.zip")
    output_tif_name = f"{zip_basename}.tif"
    tif_path = os.path.join(out_dir, output_tif_name)


    try:
        r = requests.get(Constants.SRTM_GERMANY_DTM_URL, timeout=Constants.REQUEST_TIMEOUT)
    except requests.exceptions.Timeout:
        raise_externalConnection_error(
            f"SRTM Download timed out: {Constants.STATION_LIST_URL}"
        )
        return ""
    except requests.exceptions.RequestException:
        raise_externalConnection_error(
            f"SRTM Download failed: {Constants.STATION_LIST_URL}"
        )
        return ""

    # Check if the request was successful
    if r.status_code != 200:
        raise_externalConnection_error(
            "Failed to download SRTM Germany DTM ZIP file.",
            genesis_code=str(r.status_code),
            details=f"Status code: {r.status_code}",
        )
        return ""

    # Save ZIP (optional but useful for debugging)
    with open(zip_path, "wb") as f:
        f.write(r.content)
    logger.info(f"SRTM ZIP downloaded to {zip_path}")

    # Extract only the desired .tif from the ZIP
    try:
        with zipfile.ZipFile(BytesIO(r.content)) as z:
            members = z.namelist()
            target_member = next((m for m in members if m.endswith(tif_name)), None)

            if target_member is None:
                raise_externalConnection_error(
                    f"GeoTIFF '{tif_name}' not found in SRTM ZIP.",
                    genesis_code="zip_missing_member",
                    details=f"ZIP members: {members[:50]}",
                )
                return ""

            extracted = z.extract(target_member, out_dir)
            extracted_path = os.path.abspath(extracted)

            # If the ZIP contains subfolders, normalize to out_dir/<tif_name>
            if os.path.normpath(extracted_path) != os.path.normpath(os.path.abspath(tif_path)):
                # Move to the desired location/name
                os.replace(extracted_path, tif_path)
                # Remove now-empty folder path(s) if they exist (best-effort)
                extracted_dir = os.path.dirname(extracted_path)
                try:
                    if extracted_dir != os.path.abspath(out_dir):
                        os.removedirs(extracted_dir)
                except OSError:
                    pass

            logger.info(f"SRTM GeoTIFF extracted to {os.path.abspath(tif_path)}")
            return os.path.abspath(tif_path)

    except zipfile.BadZipFile:
        raise_externalConnection_error(
            "Downloaded SRTM file is not a valid ZIP archive.",
            genesis_code="bad_zip",
            details="zipfile.BadZipFile",
        )
        return ""
    finally:
        # Remove the ZIP after extraction to keep the output directory clean
        try:
            if os.path.exists(zip_path):
                os.remove(zip_path)
        except OSError:
            pass
