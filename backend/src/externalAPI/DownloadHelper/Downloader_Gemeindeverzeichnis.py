"""
Helper module to provide the download functionality for downloading Gemeindeverzeichnis data.
This is used by the Downloader to download the Gemeindeverzeichnis Excel file from the official Destatis website.
Author: Jonas Dorner (@OilersLD)
"""

import os
from datetime import date
import requests
import logging

from Exceptions.External_Connection_Error import raise_externalConnection_error
from externalAPI.Constants import Constants

# FYI: If there are issues with downloading the file, check: the URL in a browser to see if it has changed.




logger = logging.getLogger(__name__)


def download_gv_excel(out_dir: str) -> bool:
    """Downloads the Gemeindeverzeichnis Excel file from the official Destatis website.
    Args:
        out_dir (str): The output directory where the Excel file will be saved.
    Returns:   bool: True if the download was successful, False otherwise.
    """

    today = date.today()
    os.makedirs(out_dir, exist_ok=True)
    xlsx_path =os.path.join(out_dir, f"gemeindeverzeichnis_{today}.xlsx")

    try:
        response = requests.get(Constants.GV_AUSZUG_EXCEL_URL, timeout=Constants.REQUEST_TIMEOUT)
        response.raise_for_status()
    except requests.exceptions.Timeout:
        raise_externalConnection_error(f"Gemeindeverzeichnis download timed out: {Constants.STATION_LIST_URL}")
        return False
    except requests.exceptions.RequestException:
        raise_externalConnection_error(f"Gemeindeverzeichnis download failed: {Constants.STATION_LIST_URL}")
        return False
    #Check if the request was successful
    if response.status_code != 200:
        raise_externalConnection_error(
            "Failed to download Gemeindeverzeichnis Excel file.",
            genesis_code=str(response.status_code),
            details=f"Status code: {response.status_code}",
        )
        return False

    with open(xlsx_path, "wb") as f:
        f.write(response.content)
    logger.info(f"Gemeindeverzeichnis downloaded to {xlsx_path} as gemeindeverzeichnis_{today}.xlsx")

    return True