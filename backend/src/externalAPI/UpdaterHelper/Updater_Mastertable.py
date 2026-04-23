"""
This module contains the main function to update the mastertable, which is the central configuration file for the updater. It reads the mastertable, iterates through each row, and updates the values based on the specified source and source_id. It also handles special cases like the RDB sludge production median and sends notifications to the admin if needed.
Author: Jonas Dorner (@OilersLD)
"""

from datetime import date, datetime

from externalAPI.Parser import get_path_to_rdb_file, get_rdb_genesis_data
from externalAPI.Constants import Constants as C
from EMail_Service import send_admin_email
from Exceptions.Data_Set_Error import raise_data_set_error

import pandas as pd
import json
import logging

logger = logging.getLogger(__name__)


def update_mastertable():
    master_table = pd.read_excel(C.MASTER_XLSX_PATH, sheet_name=C.UPDATER_MASTERTABEL_SHEET_INDEX)

    if master_table is None or master_table.empty:
        raise_data_set_error(
            message=C.UPDATER_MASTERTABEL_ERR_MASTER_EMPTY_TEMPLATE.format(path=C.MASTER_XLSX_PATH),
            dataset=C.MASTER_XLSX_PATH,
            column=C.UPDATER_MASTERTABEL_NA,
            row=C.UPDATER_MASTERTABEL_NA,
        )

    today_str = date.today().strftime(C.UPDATER_MASTERTABEL_DATE_FORMAT_DDMMYYYY)

    # Important: iterate WITH index so we can write back into the correct row
    for idx, row in master_table.iterrows():
        name = _clean(row.get(C.UPDATER_MASTERTABEL_COL_DATENKATEGORIE, C.UPDATER_MASTERTABEL_EMPTY))
        source_name = _clean(row.get(C.UPDATER_MASTERTABEL_COL_SOURCE_NAME, C.UPDATER_MASTERTABEL_EMPTY))
        source_id = _clean(row.get(C.UPDATER_MASTERTABEL_COL_SOURCE_ID, C.UPDATER_MASTERTABEL_EMPTY))

        if not name:
            raise_data_set_error(
                message=C.UPDATER_MASTERTABEL_ERR_MISSING_REQUIRED_FIELDS,
                dataset=C.MASTER_XLSX_PATH,
                column=C.UPDATER_MASTERTABEL_COL_DATENKATEGORIE,
                row=str(idx + C.UPDATER_MASTERTABEL_EXCEL_ROW_OFFSET),
            )

        if not source_name and not source_id:
            continue

        if not source_name or not source_id:
            raise_data_set_error(
                message=C.UPDATER_MASTERTABEL_ERR_MISSING_SOURCE_FIELDS,
                dataset=C.MASTER_XLSX_PATH,
                column=C.UPDATER_MASTERTABEL_COL_SOURCE_NAME_SOURCE_ID,
                row=str(idx + C.UPDATER_MASTERTABEL_EXCEL_ROW_OFFSET),
            )

        new_value = None

        # Special case: RDB sludge production median
        if (
            source_name == C.UPDATER_MASTERTABEL_SOURCE_RDB
            and C.UPDATER_MASTERTABEL_NAME_CONTAINS_MEDIAN in name
            and C.UPDATER_MASTERTABEL_NAME_CONTAINS_KL in name
            and C.UPDATER_MASTERTABEL_NAME_CONTAINS_SLUDGE in name
        ):
            if _median_klaerschlamm(source_id):
                # Only update the date if there is no new value.
                # If there is a new value, it has not yet been updated by the administrator, so it is outdated.
                master_table.loc[idx, C.UPDATER_MASTERTABEL_COL_LAST_UPDATED] = today_str
        else:
            if source_name in (C.UPDATER_MASTERTABEL_SOURCE_RDB, C.UPDATER_MASTERTABEL_SOURCE_DESTATIS):
                filter_category = C.NAME_TO_FILTER.get(name)
                filter_value = C.NAME_TO_FILTER_TARGET.get(name)
                target = C.NAME_TO_TARGET.get(name)
                third_filter = C.NAME_TO_THIRD_FILTER.get(name)
                third_filter_value = C.NAME_TO_THIRD_FILTER_VALUE.get(name)

                if not filter_category or not filter_value or not target:
                    raise_data_set_error(
                        message=C.UPDATER_MASTERTABEL_ERR_MISSING_MAPPING_TEMPLATE.format(name=name),
                        dataset=C.MASTER_XLSX_PATH,
                        column=C.UPDATER_MASTERTABEL_COL_DATENKATEGORIE,
                        row=str(idx + C.UPDATER_MASTERTABEL_EXCEL_ROW_OFFSET),
                    )

                new_value = get_rdb_genesis_data(
                    key=C.UPDATER_MASTERTABEL_EMPTY,
                    dataset_id=source_id,
                    filter_category=filter_category,
                    filter_value=filter_value,
                    target=target,
                    source=source_name,
                    third_filter_category=third_filter,
                    third_filter_value=third_filter_value,
                )
            else:
                raise_data_set_error(
                    message=C.UPDATER_MASTERTABEL_ERR_UNKNOWN_SOURCE_TEMPLATE.format(source=source_name, name=name),
                    dataset=C.MASTER_XLSX_PATH,
                    column=C.UPDATER_MASTERTABEL_COL_SOURCE_NAME,
                    row=str(idx + C.UPDATER_MASTERTABEL_EXCEL_ROW_OFFSET),
                )

            if new_value is None or (isinstance(new_value, float) and pd.isna(new_value)):
                raise_data_set_error(
                    message=C.UPDATER_MASTERTABEL_ERR_VALUE_UPDATE_FAILED_TEMPLATE.format(
                        name=name,
                        source_name=source_name,
                        source_id=source_id,
                        value=new_value,
                    ),
                    dataset=C.MASTER_XLSX_PATH,
                    column=C.UPDATER_MASTERTABEL_COL_WERT,
                    row=str(idx + C.UPDATER_MASTERTABEL_EXCEL_ROW_OFFSET),
                )

            master_table.loc[idx, C.UPDATER_MASTERTABEL_COL_WERT] = new_value
            master_table.loc[idx, C.UPDATER_MASTERTABEL_COL_LAST_UPDATED] = today_str

        # Persist (overwrite sheet)
        with pd.ExcelWriter(C.MASTER_XLSX_PATH, engine=C.UPDATER_MASTERTABEL_EXCEL_ENGINE, mode=C.UPDATER_MASTERTABEL_EXCEL_WRITE_MODE) as writer:
            master_table.to_excel(writer, index=False, sheet_name=C.UPDATER_MASTERTABEL_EXCEL_SHEET_NAME)

    logger.info(C.UPDATER_MASTERTABEL_LOG_SUCCESS, flush=True)


def _clean(v) -> str:
    if pd.isna(v):
        return C.UPDATER_MASTERTABEL_EMPTY
    s = str(v).strip()
    return C.UPDATER_MASTERTABEL_EMPTY if s.lower() == C.UPDATER_MASTERTABEL_NAN else s


def _median_klaerschlamm(table_id: str) -> bool:
    """
    Checks whether the source data changed (new years) and notifies admin if needed.
    Returns True if no new value was found.
    """
    file = get_path_to_rdb_file(table_id)
    df = pd.read_csv(file, sep=C.UPDATER_MASTERTABEL_CSV_SEP_SEMICOLON, dtype=str, engine=C.UPDATER_MASTERTABEL_PANDAS_ENGINE)

    json_file_path = C.CONSTANTS_CHANGES_CONFIG

    if not json_file_path.exists():
        raise_data_set_error(
            C.UPDATER_MASTERTABEL_ERR_CHANGES_CONFIG_MISSING,
            json_file_path,
            C.UPDATER_MASTERTABEL_NA,
            C.UPDATER_MASTERTABEL_NA,
        )

    with json_file_path.open(C.UPDATER_MASTERTABEL_FILE_READ_MODE, encoding=C.UPDATER_MASTERTABEL_FILE_ENCODING) as f:
        json_file = json.load(f)

    expected_year = json_file.get(C.KEY_IN_JSON_FOR_KLAERSCHLAMM_YEAR)

    years_series = (
        df[C.UPDATER_MASTERTABEL_COL_TIME]
        .astype(str)
        .str.extract(C.UPDATER_MASTERTABEL_RX_YEAR_EXTRACT)[0]
        .dropna()
    )

    if not years_series.eq(expected_year).all():
        date_json = json_file.get(C.KEY_IN_JSON_FOR_KLAERSCHLAMM_LAST_MAIL)

        date_last_mail = datetime.strptime(
            date_json,
            C.KLAERSCHLAMM_NOTIFICATION_LAST_DAY_FORMAT,
        ).date()

        if date.today() - date_last_mail >= pd.Timedelta(days=C.KLAERSCHLAMM_NOTIFICATION_GAP_IN_DAYS):
            send_admin_email(
                subject=C.UPDATER_MASTERTABEL_MAIL_SUBJECT_KLAERSCHLAMM_UPDATED,
                body=(
                    C.UPDATER_MASTERTABEL_MAIL_BODY_KLAERSCHLAMM_PREFIX
                    + C.UPDATER_MASTERTABEL_SPACE
                    + C.UPDATER_MASTERTABEL_MAIL_BODY_KLAERSCHLAMM_PREV_YEAR_TEMPLATE.format(prev_year=C.YEAR_OF_KLAERSCHLAMM_VALUES)
                    + C.UPDATER_MASTERTABEL_SPACE
                    + C.UPDATER_MASTERTABEL_MAIL_BODY_KLAERSCHLAMM_REVIEW_TEMPLATE.format(table_id=table_id)
                ),
            )

            json_file[C.KEY_IN_JSON_FOR_KLAERSCHLAMM_LAST_MAIL] = date.today().strftime(C.KLAERSCHLAMM_NOTIFICATION_LAST_DAY_FORMAT)
            C.CONSTANTS_CHANGES_CONFIG.parent.mkdir(parents=True, exist_ok=True)
            with C.CONSTANTS_CHANGES_CONFIG.open(C.UPDATER_MASTERTABEL_FILE_WRITE_MODE, encoding=C.UPDATER_MASTERTABEL_FILE_ENCODING) as f:
                json.dump(json_file, f, indent=C.UPDATER_MASTERTABEL_JSON_INDENT)

            return False

    return True
