"""
This module provides a unified interface for downloading various datasets from different sources based on a configuration file.
The main function, `run_downloads`, reads a JSON configuration that specifies which data sources to download, their settings, and where to save the downloaded data.
The supported data sources include:
- Destatis Genesis
- Regionaldatenbank (RDB) Genesis
- Deutscher Wetterdienst (DWD) Open Data
- Gemeindeverzeichnis
- SRTM Elevation Data
Each data source has its own specific download logic encapsulated in helper classes, and the module handles error checking, optional sources, and organized output directories.
"""

from __future__ import annotations

import logging
import json
import shutil
import re

from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from Exceptions.External_Connection_Error import raise_externalConnection_error
from Exceptions.Output_Not_Defined_Error import raise_output_not_defined_error
from externalAPI.DownloadHelper import Downloader_DeutscherWetterdienst as DWD, \
    Downloader_StatBund as STATBUND, Downloader_Gemeindeverzeichnis as GV, Downloader_Regionaldatenbank as RDB, \
    Downloader_SRTM as SRTM
from externalAPI.Constants import Constants


logger = logging.getLogger(__name__) 


### Helper Functions ###

def _is_enabled(source_cfg: Optional[Dict[str, Any]]) -> bool:
    """
    Checks if a source configuration is enabled. A source is considered enabled if:
    - The source configuration is not None
    - The "enabled" key is either not present or set to True

    Args:
        source_cfg: The configuration dictionary for a data source, or None if the source is not defined.

    Returns: true, if it is enabled, false otherwise
    """
    return bool(source_cfg and source_cfg.get("enabled", True))



def _folder_key(p: str) -> str:
    """
    Creates a safe folder name from a URL or file path.

    - Trims surrounding whitespace and leading/trailing slashes
    - If a URL is provided, uses only its path component
    - Optionally removes the "climate_environment/CDC/" prefix to shorten the result
    - Replaces any non-alphanumeric characters with underscores
    - Falls back to "dwd_folder" if the resulting name would be empty
    """
    p = p.strip()
    if p.startswith("http"):
        p = urlparse(p).path
    p = p.strip("/")

    prefix = "climate_environment/CDC/"
    if p.startswith(prefix):
        p = p[len(prefix):]

    key = re.sub(r"[^A-Za-z0-9]+", "_", p).strip("_")
    return key or "dwd_folder"


def _download_destatis_or_rdb(items: List[Dict[str, Any]], output_dir: Path, source_name: str) -> None:
    """
    This method is a helper function to download tables from either Destatis Genesis or RDB Genesis, since they have a very similar structure in the JSON and the downloading process.
    Args:
        items: The list of items to download, where each item is a dictionary that should contain at least the "id" key for the table id. It can also contain an "optional" key to indicate if the download of this item can be skipped in case of an error.
        output_dir: The directory where the downloaded tables should be saved.
        source_name: Weather the source is Destatis Genesis or RDB Genesis, since we need to call different download functions for each of them. It should be either "destatis_genesis" or "rdb_genesis".
    Returns: None
    """
    # --- Iterate over all items (tables) to download --- #
    for it in items:
        table_id = it.get(Constants.KEY_FOR_ID_OF_ITEMS_IN_JSON)
        optional = bool(it.get(Constants.KEY_FOR_OPTIONAL_IN_JSON, False))
        if not table_id:
            if optional:
                continue
            raise_externalConnection_error(
                "Missing table id in an item in the Download JSON for " + source_name,
                details=f"Item config: {it}"
            )
        try:
            # --- StatBund and RDB expects output_dir as string --- #
            # --- We choose which Downloader we need right now --- #
            if source_name == Constants.SOURCE_NAME_STATBUND:
                STATBUND.download_table_and_save(table_id, output_dir=str(output_dir))
            else:
                if RDB.download_table_and_save(table_id, str(output_dir)):
                    logger.info(f"{source_name}: Table {table_id} downloaded successfully.")
        except Exception as e:
            if optional:
                # --- if the error can be ignored, we just skip to the next item instead of raising an error --- #
                logger.warning("By downloading from the: %s. The item : %s was skipped due to the following error: %s", source_name, table_id, e)
            raise_externalConnection_error(str(e), details=f"table_id={table_id} out_dir={output_dir}")


### Main Function ###

def run_downloads(config_path: str | Path, output_root: str | Path) -> None:
    """
    This function orchestrates the downloading of various datasets based on a provided configuration file.
    It reads the configuration, checks which data sources are enabled, and then calls the appropriate download functions for each source.
    The downloaded data is saved to specified output directories.
    Args:
        config_path: The Path of the JSON configuration file that specifies which data sources to download and their settings.
        output_root: The root directory where all downloaded data will be saved. Subdirectories for each data source will be created under this root.
    Returns: None
    """
    # --- Read in JSON --- #
    config_path = Path(config_path)
    if not config_path.exists():
        raise_output_not_defined_error(
            output_target=str(config_path),
            details="Downloader config file not found!",
        )

    # --- Creating Output Directories --- #
    output_root = Path(output_root)
    old_root = output_root / ".." / (output_root.name + "_old")
    second_root = output_root / ".." / (output_root.name + "_second")

    # At first, we safe all to the "_second" folder and after a sucessfull we copy to output_root
    
    # _old anlegen, falls es noch nicht existiert
    old_root.mkdir(parents=True, exist_ok=True)
    second_root.mkdir(parents=True, exist_ok=True)

    
    # Inhalt von _second löschen (aber Ordner behalten)
    for p in second_root.iterdir():
        if p.is_dir():
            shutil.rmtree(p)
        else:
            p.unlink()


    # output_root sicherstellen (leer/neu)
    output_root.mkdir(parents=True, exist_ok=True)

    out_destatis = second_root / Constants.DIRECTORY_NAME_FOR_STATBUND
    out_rdb      = second_root / Constants.DIRECTORY_NAME_FOR_RDB
    out_dwd      = second_root / Constants.DIRECTORY_NAME_FOR_DWD
    out_gv       = second_root / Constants.DIRECTORY_NAME_FOR_GV
    out_srtm     = second_root / Constants.DIRECTORY_NAME_FOR_SRTM

    out_destatis.mkdir(parents=True, exist_ok=True)
    out_rdb.mkdir(parents=True, exist_ok=True)
    out_dwd.mkdir(parents=True, exist_ok=True)
    out_gv.mkdir(parents=True, exist_ok=True)
    out_srtm.mkdir(parents=True, exist_ok=True)

    # --- Parse Config --- #
    raw = config_path.read_text(encoding="utf-8")
    cfg: Dict[str, Any] = json.loads(raw)


    # --- Check which Sources are enabled --- #
    sources: Dict[str, Dict[str, Any]] = (cfg.get(Constants.JSON_NAME) or {}).get(Constants.KEY_FOR_SOURCES) or {}
    if not sources:
        raise_output_not_defined_error(
            output_target="downloader.sources",
            details="No sources defined in downloader config.",
        )
    stations_list_downloaded = False

    # --- Read every single Source in order defined above --- #
    for source_name in Constants.SOURCE_ORDER:
        source_cfg = sources.get(source_name)
        if not _is_enabled(source_cfg):
            continue

        if source_name == Constants.SOURCE_NAME_STATBUND or source_name == Constants.SOURCE_NAME_RDB:
            items: List[Dict[str, Any]] = source_cfg.get(Constants.KEY_FOR_ITEMS_BLOCK_IN_JSON) or []
            _download_destatis_or_rdb(items, out_destatis if source_name == Constants.SOURCE_NAME_STATBUND else out_rdb, source_name)

        elif source_name == Constants.SOURCE_NAME_DWD:
            # 1) Stationsliste -> out_dwd/stations/stations.csv
            if not stations_list_downloaded:
                station_list = source_cfg.get(Constants.KEY_FOR_STATION_LIST)
                if station_list and station_list.get(Constants.KEY_FOR_PATHES_IN_DWD):
                    optional = bool(station_list.get(Constants.KEY_FOR_OPTIONAL_IN_JSON, False))
                    try:
                        client = DWD.DwdCdcClient()  # nutzt default URL, oder du setzt sie wie vorher
                        df = client.get_stations()

                        stations_dir = out_dwd / Constants.DIRECTORY_NAME_FOR_DWD_STATION_LIST
                        stations_dir.mkdir(parents=True, exist_ok=True)
                        DWD.save_stations_csv(df, str(stations_dir / Constants.NAME_OF_STATION_CSV))
                        stations_list_downloaded = True
                    except Exception as e:
                        if not optional:
                            raise_externalConnection_error(str(e), details="dwd station_list download failed")

            # 2) Every folder will become a subdirectory in out_dwd, and the content of the folder will be downloaded there
            folders: List[Dict[str, Any]] = source_cfg.get(Constants.KEY_FOR_FOLDERS_IN_DWD_JSON) or []
            for f in folders:
                folder_path = f.get(Constants.KEY_FOR_PATHES_IN_DWD)
                optional = bool(f.get(Constants.KEY_FOR_OPTIONAL_IN_JSON, False))

                if not folder_path:
                    if optional:
                        continue
                    raise_externalConnection_error(
                        "Missing folder path in an item in the Download JSON for dwd_opendata",
                        details=f"Item config: {f}"
                    )
                try:
                    subdir = out_dwd / _folder_key(folder_path)
                    subdir.mkdir(parents=True, exist_ok=True)

                    DWD.download_dwd_tree(folder_path, str(subdir))
                    logger.info(f"DWD: Folder {folder_path} downloaded successfully.")
                except Exception as e:
                    if optional:
                        continue
                    raise_externalConnection_error(str(e), details=f"DWD folder download failed: {folder_path}")


        elif source_name == Constants.SOURCE_NAME_GV:
            optional = bool(source_cfg.get(Constants.KEY_FOR_OPTIONAL_IN_JSON, False))
            try:
                # Download of the Excel file
                GV.download_gv_excel(str(out_gv))
            except Exception as e:
                if optional:
                    continue
                raise_externalConnection_error(str(e), details=f"out_dir={out_gv}")

        elif source_name == Constants.SOURCE_NAME_SRTM:
            optional = bool(source_cfg.get(Constants.KEY_FOR_OPTIONAL_IN_JSON, False))
            try:
                name_tif = source_cfg.get(Constants.KEY_FOR_TARGET_SRTM, Constants.DEFAULT_VALUE_FOR_KEY_FOR_TARGET_SRTM)
                SRTM.download_srtm_dtm(str(out_srtm) ,name_tif)
            except Exception as e:
                if optional:
                    continue
                raise_externalConnection_error(str(e), details=f"srtm out_dir={out_srtm}")

    
    # --- Alle Downloads erfolgreich: _second -> output_root --- #
    # Inhalt von _old löschen (aber Ordner behalten)
    for p in old_root.iterdir():
        if p.is_dir():
            shutil.rmtree(p)
        else:
            p.unlink()

    # Aktuellen Inhalt von output_root nach _old sichern
    for p in output_root.iterdir():
        shutil.move(str(p), str(old_root / p.name))


    # Inhalt von root löschen (aber Ordner behalten)
    for p in output_root.iterdir():
        if p.is_dir():
            shutil.rmtree(p)
        else:
            p.unlink()


    # Inhalt von _second nach output_root verschieben
    for p in second_root.iterdir():
        shutil.move(str(p), str(output_root / p.name))

    logger.info("Downloads abgeschlossen und nach output_root verschoben.")