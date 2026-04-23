#!/usr/bin/env python
# coding: utf-8

"""
This module creates a CSV file with median heating degree days over the last 15 years.
Author: Julian Kragler
Modified by: Jonas Dorner (@OilersLD)
"""

import os
import re
import zipfile
import logging
from pathlib import Path
from typing import Any

import pandas as pd
import requests

from Exceptions.Data_Set_Error import raise_data_set_error
from externalAPI.Constants import Constants as C
from pandas import DataFrame

from Exceptions.External_Connection_Error import raise_externalConnection_error

logger = logging.getLogger(__name__)


def normalize_station_id_5(series: pd.Series) -> pd.Series:
    # Keep IDs as 5-digit strings (preserve leading zeros).
    s = series.astype("string")
    s = s.str.strip().str.replace(C.GRADTAGE_CREATOR_TRAILING_DOT_ZERO_REGEX, C.GRADTAGE_CREATOR_EMPTY, regex=True).str.zfill(
        C.GRADTAGE_CREATOR_STATION_ID_WIDTH
    )
    return s


def download_and_filter_stations(save_folder: Path) -> DataFrame | None | Any:
    # If local stations.csv exists: use it.
    if C.STATION_LIST_PATH and Path(C.STATION_LIST_PATH).exists():
        return load_stations_from_csv(str(C.STATION_LIST_PATH))

    try:
        response = requests.get(C.STATION_LIST_URL, timeout=C.REQUEST_TIMEOUT)
        response.raise_for_status()
    except requests.exceptions.Timeout:
        raise_externalConnection_error(f"Station list download timed out: {C.STATION_LIST_URL}")
        return None
    except requests.exceptions.RequestException:
        raise_externalConnection_error(f"Station list download failed: {C.STATION_LIST_URL}")
        return None

    lines = response.content.decode(C.GRADTAGE_CREATOR_STATION_LIST_ENCODING).splitlines(keepends=True)
    states = list(C.GRADTAGE_CREATOR_TARGET_STATES)
    filtered_lines = [line for line in lines if any(state in line for state in states)]

    output_file = save_folder / C.GRADTAGE_CREATOR_STATIONS_TXT_FILENAME
    with open(output_file, "w", encoding=C.GRADTAGE_CREATOR_STATION_LIST_ENCODING) as f:
        f.writelines(filtered_lines)

    df = pd.read_fwf(
        output_file,
        colspecs=list(C.GRADTAGE_CREATOR_STATIONS_FWF_COLSPECS),
        names=[
            C.COL_STATIONS_ID,
            C.COL_FROM_DATE,
            C.COL_TO_DATE,
            C.COL_STATIONS_HEIGHT,
            C.COL_GEO_LAT,
            C.COL_GEO_LON,
            C.COL_STATIONS_NAME,
            C.GRADTAGE_CREATOR_COL_BUNDESLAND,
            C.GRADTAGE_CREATOR_COL_ABGABE,
        ],
        skiprows=C.GRADTAGE_CREATOR_STATIONS_FWF_SKIPROWS,
        encoding=C.GRADTAGE_CREATOR_STATION_LIST_ENCODING,
    )

    df[C.COL_FROM_DATE] = pd.to_numeric(df[C.COL_FROM_DATE], errors=C.GRADTAGE_CREATOR_COERCE)
    df[C.COL_TO_DATE] = pd.to_numeric(df[C.COL_TO_DATE], errors=C.GRADTAGE_CREATOR_COERCE)

    filtered_df = df[
        (df[C.COL_FROM_DATE] <= C.GRADTAGE_CREATOR_FROM_DATE_CUTOFF)
        & (df[C.COL_TO_DATE] >= C.GRADTAGE_CREATOR_TO_DATE_CUTOFF)
    ].copy()

    filtered_df[C.COL_FROM_DATE] = pd.to_datetime(
        filtered_df[C.COL_FROM_DATE], format=C.GRADTAGE_CREATOR_DATE_YYYYMMDD_FORMAT
    )
    filtered_df[C.COL_TO_DATE] = pd.to_datetime(
        filtered_df[C.COL_TO_DATE], format=C.GRADTAGE_CREATOR_DATE_YYYYMMDD_FORMAT
    )

    filtered_df[C.COL_STATIONS_ID] = normalize_station_id_5(filtered_df[C.COL_STATIONS_ID])
    filtered_df[C.COL_FILE_INDEX] = filtered_df[C.COL_STATIONS_ID]

    columns_to_keep = [
        C.COL_FILE_INDEX,
        C.COL_STATIONS_ID,
        C.COL_STATIONS_NAME,
        C.COL_STATIONS_HEIGHT,
        C.COL_GEO_LAT,
        C.COL_GEO_LON,
        C.GRADTAGE_CREATOR_COL_BUNDESLAND,
        C.COL_FROM_DATE,
        C.COL_TO_DATE,
    ]

    return filtered_df[columns_to_keep]


def load_stations_from_csv(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path, sep=C.CSV_SEP, engine=C.GRADTAGE_CREATOR_PANDAS_ENGINE)

    if C.COL_STATIONS_ID not in df.columns and C.COL_STATIONS_ID_RAW in df.columns:
        df = df.rename(columns={C.COL_STATIONS_ID_RAW: C.COL_STATIONS_ID})
    if C.COL_STATIONS_NAME not in df.columns and C.COL_STATIONS_NAME_RAW in df.columns:
        df = df.rename(columns={C.COL_STATIONS_NAME_RAW: C.COL_STATIONS_NAME})
    if C.COL_STATIONS_HEIGHT not in df.columns and C.COL_STATIONS_HEIGHT_RAW in df.columns:
        df = df.rename(columns={C.COL_STATIONS_HEIGHT_RAW: C.COL_STATIONS_HEIGHT})
    if C.COL_GEO_LAT not in df.columns and C.COL_GEO_LAT_RAW in df.columns:
        df = df.rename(columns={C.COL_GEO_LAT_RAW: C.COL_GEO_LAT})
    if C.COL_GEO_LON not in df.columns and C.COL_GEO_LON_RAW in df.columns:
        df = df.rename(columns={C.COL_GEO_LON_RAW: C.COL_GEO_LON})

    if C.COL_STATIONS_ID in df.columns:
        df[C.COL_STATIONS_ID] = normalize_station_id_5(df[C.COL_STATIONS_ID])
    if C.COL_FILE_INDEX in df.columns:
        df[C.COL_FILE_INDEX] = normalize_station_id_5(df[C.COL_FILE_INDEX])

    if C.COL_FILE_INDEX not in df.columns:
        if C.COL_STATIONS_ID not in df.columns:
            raise ValueError(C.GRADTAGE_CREATOR_ERR_STATIONS_CSV_NEEDS_ID_OR_INDEX)
        df[C.COL_FILE_INDEX] = normalize_station_id_5(df[C.COL_STATIONS_ID])

    return df


def build_url(station_id, von_datum, bis_datum):
    station_id_str = str(station_id).zfill(C.GRADTAGE_CREATOR_STATION_ID_WIDTH)

    if hasattr(von_datum, "strftime"):
        von_datum_str = von_datum.strftime(C.GRADTAGE_CREATOR_DATE_YYYYMMDD_FORMAT_NOSEP)
    else:
        von_datum_str = str(von_datum).split()[0].replace(C.GRADTAGE_CREATOR_DATE_DASH, C.GRADTAGE_CREATOR_EMPTY)

    if hasattr(bis_datum, "strftime"):
        bis_datum_str = bis_datum.strftime(C.GRADTAGE_CREATOR_DATE_YYYYMMDD_FORMAT_NOSEP)
    else:
        bis_datum_str = str(bis_datum).split()[0].replace(C.GRADTAGE_CREATOR_DATE_DASH, C.GRADTAGE_CREATOR_EMPTY)

    if int(bis_datum_str) > C.GRADTAGE_CREATOR_MAX_BIS_DATE:
        bis_datum_str = str(C.GRADTAGE_CREATOR_MAX_BIS_DATE)

    base_url = C.GRADTAGE_CREATOR_DWD_HIST_BASE_URL
    filename = C.GRADTAGE_CREATOR_HIST_ZIP_FILENAME_TEMPLATE.format(
        station_id_5=station_id_str,
        von_yyyymmdd=von_datum_str,
        bis_yyyymmdd=bis_datum_str,
    )
    return base_url + filename


def download_and_extract_dwd_data(url, target_folder):
    filename = url.split(C.GRADTAGE_CREATOR_URL_SLASH)[-1]
    zip_filepath = os.path.join(target_folder, filename)
    extract_folder_name = filename.replace(C.GRADTAGE_CREATOR_SUFFIX_ZIP, C.GRADTAGE_CREATOR_EMPTY)
    extract_folder_path = os.path.join(target_folder, extract_folder_name)

    response = requests.get(url, stream=True, timeout=C.GRADTAGE_CREATOR_HTTP_TIMEOUT_S)
    response.raise_for_status()

    with open(zip_filepath, "wb") as f:
        for chunk in response.iter_content(chunk_size=C.GRADTAGE_CREATOR_HTTP_CHUNK_SIZE):
            f.write(chunk)

    if not os.path.exists(extract_folder_path):
        os.makedirs(extract_folder_path)

    with zipfile.ZipFile(zip_filepath, C.GRADTAGE_CREATOR_ZIP_OPEN_MODE) as zip_ref:
        file_list = zip_ref.namelist()
        files_to_extract = [
            f for f in file_list if os.path.basename(f).startswith(C.GRADTAGE_CREATOR_ZIP_DATA_PREFIX)
        ]
        for file in files_to_extract:
            zip_ref.extract(file, extract_folder_path)

    os.remove(zip_filepath)


def download_climate_data(stations_df, save_folder):
    for _, row in stations_df.iterrows():
        url = build_url(row[C.COL_STATIONS_ID], row[C.COL_FROM_DATE], row[C.COL_TO_DATE])
        download_and_extract_dwd_data(url, str(save_folder))


def load_single_dwd_file(file_path):
    try:
        df = pd.read_csv(
            file_path,
            sep=C.CSV_SEP,
            skipinitialspace=True,
            na_values=[C.GRADTAGE_CREATOR_DWD_MISSING_VALUE],
            usecols=[C.COL_DATE, C.COL_TEMP, C.COL_STATIONS_ID_RAW],
            dtype={C.COL_TEMP: C.GRADTAGE_CREATOR_TEMP_DTYPE},
        )
    except ValueError:
        return None

    # Support both "YYYY-MM-DD" and "YYYYMMDD" (DWD exports can vary by source).
    df[C.COL_DATE] = pd.to_datetime(df[C.COL_DATE], format=C.GRADTAGE_CREATOR_DATE_ISO_FORMAT, errors=C.GRADTAGE_CREATOR_COERCE)
    if df[C.COL_DATE].isna().all():
        df[C.COL_DATE] = pd.to_datetime(df[C.COL_DATE], format=C.GRADTAGE_CREATOR_DATE_YYYYMMDD_FORMAT, errors=C.GRADTAGE_CREATOR_COERCE)

    df.rename(columns={C.COL_DATE: C.COL_TIME, C.COL_TEMP: C.COL_TEMP_C}, inplace=True)
    df = df.dropna(subset=[C.COL_TEMP_C])
    return df


def process_dwd_files(data_folder, station_df):
    pattern_csv = re.compile(C.GRADTAGE_CREATOR_RX_ANY_CSV_WITH_ID5)
    all_dataframes = []

    valid_indices = set(station_df[C.COL_FILE_INDEX])

    for root, _, files in os.walk(data_folder):
        for filename in files:
            # Only CSV
            if not filename.endswith(C.GRADTAGE_CREATOR_SUFFIX_CSV):
                continue

            file_index = None
            match_csv = pattern_csv.match(filename)
            if match_csv:
                file_index = match_csv.group(1)

            file_path = os.path.join(root, filename)
            df = load_single_dwd_file(file_path)

            if df is None or df.empty:
                continue

            # Fallback: station id from file content (if filename does not contain it)
            if file_index is None and C.COL_STATIONS_ID_RAW in df.columns:
                file_index = (
                    df[C.COL_STATIONS_ID_RAW]
                    .dropna()
                    .astype(int)
                    .astype(str)
                    .str.zfill(C.GRADTAGE_CREATOR_STATION_ID_WIDTH)
                    .iloc[0]
                )

            if file_index is None or file_index not in valid_indices:
                continue

            df[C.COL_FILE_INDEX] = file_index
            all_dataframes.append(df)

    if not all_dataframes:
        return pd.DataFrame()

    combined_df = pd.concat(all_dataframes, ignore_index=True)
    combined_df = combined_df.merge(
        station_df[[C.COL_FILE_INDEX, C.COL_STATIONS_NAME]],
        on=C.COL_FILE_INDEX,
        how=C.GRADTAGE_CREATOR_MERGE_HOW_LEFT,
    )
    combined_df = combined_df.dropna(subset=[C.COL_TEMP_C])
    return combined_df


def calculate_annual_dd(combined_df):
    df = combined_df.copy()
    df[C.COL_YEAR] = df[C.COL_TIME].dt.year
    df[C.COL_DATE_ONLY] = df[C.COL_TIME].dt.date

    daily_avg = (
        df.groupby([C.COL_FILE_INDEX, C.COL_STATIONS_NAME, C.COL_YEAR, C.COL_DATE_ONLY])[C.COL_TEMP_C]
        .mean()
        .reset_index()
        .rename(columns={C.COL_TEMP_C: C.COL_DAILY_AVG})
    )

    daily_avg[C.COL_DEGREE_DAY] = daily_avg[C.COL_DAILY_AVG].apply(
        lambda t: C.GRADTAGE_CREATOR_DD_BASE - t if t < C.GRADTAGE_CREATOR_DD_THRESHOLD else 0
    )

    annual_dd = (
        daily_avg.groupby([C.COL_FILE_INDEX, C.COL_STATIONS_NAME, C.COL_YEAR])[C.COL_DEGREE_DAY]
        .sum()
        .reset_index()
        .rename(columns={C.COL_DEGREE_DAY: C.COL_ANNUAL_DD})
    )

    year_bounds = annual_dd.groupby(C.COL_FILE_INDEX)[C.COL_YEAR].agg([C.GRADTAGE_CREATOR_MIN, C.GRADTAGE_CREATOR_MAX]).reset_index()
    year_bounds.columns = [C.COL_FILE_INDEX, C.GRADTAGE_CREATOR_COL_MIN_YEAR, C.GRADTAGE_CREATOR_COL_MAX_YEAR]

    annual_dd = annual_dd.merge(year_bounds, on=C.COL_FILE_INDEX)
    annual_dd = annual_dd[
        (annual_dd[C.COL_YEAR] != annual_dd[C.GRADTAGE_CREATOR_COL_MIN_YEAR])
        & (annual_dd[C.COL_YEAR] != annual_dd[C.GRADTAGE_CREATOR_COL_MAX_YEAR])
    ]
    annual_dd = annual_dd.drop(columns=[C.GRADTAGE_CREATOR_COL_MIN_YEAR, C.GRADTAGE_CREATOR_COL_MAX_YEAR])

    max_year = annual_dd[C.COL_YEAR].max()
    min_year_cutoff = max_year - C.GRADTAGE_CREATOR_YEAR_WINDOW
    annual_dd = annual_dd[annual_dd[C.COL_YEAR] >= min_year_cutoff]

    return annual_dd


def process_dd_data(input_file, output_file):
    df = pd.read_csv(input_file)

    if C.COL_FILE_INDEX not in df.columns:
        if C.COL_STATIONS_ID in df.columns:
            df = df.rename(columns={C.COL_STATIONS_ID: C.COL_FILE_INDEX})
        elif C.GRADTAGE_CREATOR_ALT_STATIONS_ID_5 in df.columns:
            df = df.rename(columns={C.GRADTAGE_CREATOR_ALT_STATIONS_ID_5: C.COL_FILE_INDEX})
        else:
            raise ValueError(C.GRADTAGE_CREATOR_ERR_NO_ID5_COLUMN_FOUND)

    df[C.COL_FILE_INDEX] = normalize_station_id_5(df[C.COL_FILE_INDEX])
    grouped = df.groupby(C.COL_FILE_INDEX)

    results = []

    for _, group in grouped:
        group = group.sort_values(C.COL_YEAR)
        most_recent_year = group[C.COL_YEAR].max()

        if most_recent_year >= C.GRADTAGE_CREATOR_RECENT_YEAR_MIN:
            last_15_years = group.tail(C.GRADTAGE_CREATOR_MEDIAN_YEARS)
            median_dd = last_15_years[C.COL_ANNUAL_DD].median()

            latest_row = group.iloc[-1].copy()
            result_row = latest_row.drop([C.COL_YEAR, C.COL_ANNUAL_DD]).to_dict()
            result_row[C.GRADTAGE_CREATOR_OUT_COL_MEDIAN_15YR_DD] = median_dd

            results.append(result_row)

    output_df = pd.DataFrame(results)
    if C.COL_FILE_INDEX in output_df.columns:
        output_df[C.COL_FILE_INDEX] = normalize_station_id_5(output_df[C.COL_FILE_INDEX])
        output_df = output_df.rename(columns={C.COL_FILE_INDEX: C.COL_STATIONS_ID})
    output_df.to_csv(output_file, index=False)
    return output_df


def create_gradtage_csv():
    save_folder = C.DWD_DD_OUTPUT_DIR
    save_folder.mkdir(parents=True, exist_ok=True)

    if C.STATION_LIST_PATH and Path(C.STATION_LIST_PATH).exists():
        station_df = load_stations_from_csv(str(C.STATION_LIST_PATH))
    else:
        station_df = download_and_filter_stations(save_folder)
        download_climate_data(station_df, save_folder)

    data_dir = C.DAILY_CSV_DIR if C.DAILY_CSV_DIR else C.DWD_DD_OUTPUT_DIR
    combined_df = process_dwd_files(str(data_dir), station_df)
    if combined_df.empty:
        raise_data_set_error(
            message=C.GRADTAGE_CREATOR_ERR_NO_DWD_DATA_TEMPLATE.format(data_dir=data_dir),
            dataset=str(data_dir),
            column=C.GRADTAGE_CREATOR_NA,
            row=C.GRADTAGE_CREATOR_NA,
        )

    annual_dd = calculate_annual_dd(combined_df)
    annual_dd_out = annual_dd.rename(columns={C.COL_FILE_INDEX: C.COL_STATIONS_ID})
    annual_dd_out[C.COL_STATIONS_ID] = normalize_station_id_5(annual_dd_out[C.COL_STATIONS_ID])
    annual_dd_out.to_csv(C.ANNUAL_CSV, index=False)

    process_dd_data(C.ANNUAL_CSV, C.DWD_DD_DIR)
    logger.info(C.GRADTAGE_CREATOR_LOG_MEDIAN_CREATED_TEMPLATE.format(path=C.DWD_DD_DIR))
