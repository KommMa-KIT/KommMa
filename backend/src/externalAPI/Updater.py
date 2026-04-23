"""
This Script runs the updater functions.
For more Information read README_UPDATER.md
Author: Jonas Dorner (@OilersLD)
"""

import logging

from externalAPI.UpdaterHelper.Gradtage_Creator import create_gradtage_csv
from externalAPI.UpdaterHelper.Updater_Mastertable import update_mastertable
from externalAPI.UpdaterHelper.Converter_Gemeindeverzeichnis import Converter_Gemeindeverzeichnis
from externalAPI.UpdaterHelper.DWD_Average_Creator import create_dwd_averages
from externalAPI.Parser import get_gv_path


logger = logging.getLogger(__name__)


def run_updates():
    create_gradtage_csv()
    results = Converter_Gemeindeverzeichnis.convert_folder(get_gv_path())
    for r in results:
        if r.success:
            logger.info(
                f"OK: CSV erstellt: {r.output_csv} (Sheet={r.used_sheet}, rows={r.rows}, deleted_xlsx={r.deleted_input})")
            if r.error:
                logger.warning(f"WARN: {r.error}")
        else:
            logger.error(f"ERROR: {r.input_excel} | {r.error}")
    update_mastertable()
    create_dwd_averages()
    