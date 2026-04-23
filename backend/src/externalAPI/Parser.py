"""
Commune Parser & Data Source Module

This module provides parsing, lookup, and validation functionality for commune-related data.
It integrates multiple data sources (Gemeindeverzeichnis, DWD weather data, RDB/DESTATIS datasets,
and SRTM elevation rasters) to retrieve, process, and validate information used by the application.

Main responsibilities:
- Searching communes by name, key, or postal code
- Retrieving geographic attributes and elevation data
- Selecting the nearest weather station and deriving climate statistics
- Accessing RDB and DESTATIS datasets and extracting filtered values
- Building prefill data for UI inputs with metadata (source, date)
- Detecting outdated datasets and triggering admin notifications
- Validating imported user data and generating update payloads

The module acts as an adapter between external datasets/APIs and the application layer,
implementing CommuneDataSource and validation interfaces.

Author: Jonas Dorner (@OilersLD)
"""

from __future__ import annotations

import pandas as pd
import numpy as np
import json
import rasterio
import logging

import re


from datetime import timezone, datetime
from typing import Any
from pyproj.geod import Geod
from pathlib import Path
from dataclasses import dataclass
from datetime import date

from Exceptions.Data_Set_Error import raise_data_set_error
from externalAPI.ParserHelper.Search_Gemeindeverzeichnis import Search_Gemeindeverzeichnis
from ApplicationLayer.DataApi.interfaces import CommuneDataSource
from ApplicationLayer.Validation.IValidator import IValidator

from externalAPI.Constants import Constants as C
from EMail_Service import send_admin_email



logger = logging.getLogger(__name__)

# ---------------------------------
# Class for concection to API router
# --------------------------------


class CommuneParserDataSource(CommuneDataSource):
    def get_commune_info_by_key(self, key: str) -> dict[str, Any]:
        return get_commune_info_by_key(key)

    def get_commune_info_by_code(self, code: str) -> dict[str, Any]:
        return get_commune_info_by_code(code)

    def get_commune_prefill_by_key(self, key: str) -> dict[str, Any]:
        return get_prefill_data(key)

    def search_communes_by_name(self, query: str) -> list[dict[str, Any]]:
        return get_commune_by_name(query)

    def get_old_warning_communes(self) -> list[dict[str, Any]]:
        return get_outdated_warnings()

class ValidatiorAndUpdater(IValidator):  
    def validate(self, imported_information: dict[str, Any]) -> dict[str, Any]:
        return create_updated_import(imported_information)


# ---------------------------------
# Actual Parser Functions
# ---------------------------------

@dataclass(frozen=True)
class WeatherStationCandidate:
    Stationsname: str
    Stations_id: str
    Stationshoehe: int
    dist_m: float


def get_gv_path() -> Path:
    return C.GV_DIR


def newest_csv() -> Path:
    return _newest_by_name(C.GV_DIR, C.GV_PREFIX, C.GV_SUFFIX)


def newest_srtm() -> Path:
    return _newest_by_name(C.SRTM_DIR, C.SRTM_PREFIX, C.SRTM_SUFFIX)


def _newest_by_name(dir_path: Path, prefix: str, ext: str) -> Path:
    pat = re.compile(rf"^{re.escape(prefix)}(\d{{4}}-\d{{2}}-\d{{2}}){re.escape(ext)}$")
    files = [
        (date.fromisoformat(m.group(1)), p)
        for p in dir_path.glob(f"*{ext}")
        if (m := pat.match(p.name))
    ]
    if not files:
        raise FileNotFoundError(f"Keine passende {ext} Datei gefunden in {dir_path.resolve()}.")
    return max(files, key=lambda x: x[0])[1]


def get_commune_by_name(query: str = "") -> list[dict[str, str]]:
    if not query.strip():
        return []

    engine = Search_Gemeindeverzeichnis(newest_csv(), sep=";", encoding="utf-8-sig")
    results = engine.search_name(query)
    if not results:
        return []

    return [{"name": r.name, "postal_code": r.plz, "key": r.ags} for r in results]


def get_commune_info_by_code(query: str = "") -> dict[str, Any]:
    if not query.strip():
        return {}

    engine = Search_Gemeindeverzeichnis(newest_csv(), sep=";", encoding="utf-8-sig")
    result = engine.search_numeric(query)

    if result is None:
        return {}

    return {"name": result.name, "postal_code": result.plz, "key": result.ags}


def get_commune_info_by_key(query: str = "") -> dict[str, Any]:
    return get_commune_info_by_code(query)
    # This method is the same as get_commune_by_code, but for clarity it is usefull to have to methods.
    # Also in future if we want to change something for one of them it is possible without affecting FastAPI.


def _search_weather_station_for_commune(key: str) -> str:
    kommune_laengengrad = search_gv(key, "LAENGENGRAD")
    kommune_breitengrad = search_gv(key, "BREITENGRAD")

    kommune_laengengrad = float(str(kommune_laengengrad).replace(",", "."))
    kommune_breitengrad = float(str(kommune_breitengrad).replace(",", "."))

    candidates = _get_nearest_five_weather_stations(kommune_laengengrad, kommune_breitengrad)

    if candidates is None:
        raise_data_set_error(
            message="No weather stations found near the given commune.",
            dataset="Gemeindeverzeichnis and DWD stations",
            column="Kommune AGS",
            row=key,
        )

    kommunen_hoehe = get_elevation_for_coords(kommune_laengengrad, kommune_breitengrad)
    best = min(
        candidates,
        key=lambda x: (abs(x.Stationshoehe - kommunen_hoehe), x.dist_m),
    )
    return str(best.Stations_id).zfill(5)

def _get_nearest_five_weather_stations(
    kommune_laengengrad: float,
    kommune_breitengrad: float
) -> list[WeatherStationCandidate]:
    geod = Geod(ellps="WGS84")
    df = pd.read_csv(C.STATION_LIST_PATH)

    # sicherstellen, dass die Koordinaten numerisch sind
    df["geoLaenge"] = pd.to_numeric(df["geoLaenge"], errors="coerce")
    df["geoBreite"] = pd.to_numeric(df["geoBreite"], errors="coerce")
    df = df.dropna(subset=["geoLaenge", "geoBreite"])

    # Ziel-Arrays (Stationen)
    lon2 = df["geoLaenge"].to_numpy(dtype=float)
    lat2 = df["geoBreite"].to_numpy(dtype=float)

    # Start-Arrays (Kommune) -> auf gleiche Länge bringen
    lon1 = np.full_like(lon2, float(kommune_laengengrad))
    lat1 = np.full_like(lat2, float(kommune_breitengrad))

    # inv(lon1, lat1, lon2, lat2)
    _, _, dist_m = geod.inv(lon1, lat1, lon2, lat2)  # We ignore Azimuths

    df["dist_m"] = dist_m
    top5 = df.sort_values("dist_m").head(5)
    candidates = [
        WeatherStationCandidate(
            Stationsname=row["Stationsname"],
            Stations_id=row["Stations_id"],
            Stationshoehe=int(row["Stationshoehe"]),
            dist_m=row["dist_m"],
        )
        for _, row in top5.iterrows()
    ]
    return candidates


def search_gv(key: str, category: str) -> str | None:
    if key is None or category is None:
        return ""  # konsistent: "nichts gefunden/ungültig"

    csv_path = newest_csv()
    file = pd.read_csv(csv_path, sep=";", dtype=str)

    # Spalten-Check
    if "AGS" not in file.columns or category not in file.columns:
        return None

    output = file.loc[file["AGS"] == key, category]

    # keine Zeile für AGS
    if output.empty:
        return None

    value = output.iloc[0]

    # Wert leer / NaN
    if pd.isna(value) or str(value).strip() == "":
        return None

    if isinstance(value, str):
        value = value.strip()
    return value
 

def get_elevation_for_coords(latitude, longitude):
    """
    Return elevation (m) for given WGS84 coordinates from the SRTM raster.
    Author: Julian Kragler
    """
    dataset = rasterio.open(newest_srtm())  # type: ignore
    try:
        value = next(dataset.sample([(latitude, longitude)]))
        return float(value[0]) if value is not None and not np.isnan(value[0]) else np.nan
    finally:
        close = getattr(dataset, "close", None)
        if callable(close):
            close()


def _dwd_get_averages(key: str, category: str) -> str | None:
    station_id = _search_weather_station_for_commune(key)
    search_element = ""
    if category == "Durchschnittstemperatur":
        search_element = "mean_temp_last_10y_c"
    elif category == "Durchschnittsniederschlag":
        search_element = "mean_yearly_precip_mm"
    elif category == "Sonnenstunden":
        search_element = "mean_yearly_sun_hours"
    else:
        return None

    csv_path = C.DWD_AVERAGES_CSV
    if not csv_path.exists():
        logger.warning("DWD averages CSV not found at path: %s", csv_path)
        return None

    station_id_name = "station_id_5"
    file = pd.read_csv(csv_path, sep=";", dtype=str)
    if station_id_name not in file.columns or search_element not in file.columns:
        logger.warning("DWD averages CSV does not contain expected columns.")
        return None
    output = file.loc[file[station_id_name] == station_id, search_element]
    if output.empty:
        return None
    return str(output.iloc[0])


def _get_gradtage(key: str) -> str | None:
    station_id = _search_weather_station_for_commune(key)
    if not C.DWD_DD_DIR.exists():
        return None
    file = pd.read_csv(C.DWD_DD_DIR, sep=",", dtype=str)
    station_id_name = "station_id_5"
    gradtage_column = "median_15yr_dd"
    if station_id_name not in file.columns or gradtage_column not in file.columns:
        return None
    output = file.loc[file[station_id_name] == station_id, gradtage_column]
    if output.empty:
        return None
    return str(output.iloc[0])


def _get_haushalt(key: str) -> str:
    """Haushalt is defined as 'Einnahmen des Verwaltungshaushalts' minus 'Ausgaben des Vermögenshaushalts'."""
    einnahmen_value = get_rdb_genesis_data(
        key, "71517-01-03-5", "2_variable_attribute_label",
        "Einnahmen des Verwaltungshaushalts, insgesamt", "value", "RDB"
    )
    ausgaben_value = get_rdb_genesis_data(
        key, "71517-02-03-5", "2_variable_attribute_label",
        "Ausgaben des Vermögenshaushalts, insgesamt", "value", "RDB"
    )
    haushalt = float(einnahmen_value) - float(ausgaben_value)
    return str(haushalt)

def get_path_to_rdb_file(dataset_id: str) -> str | None:
    folder = C.RDB_DIR
    pattern = re.compile(rf"^{re.escape(dataset_id)}_rdb_(\d{{4}}-\d{{2}}-\d{{2}})\.csv$")

    files = [p for p in folder.glob(f"{dataset_id}_rdb_*.csv") if pattern.match(p.name)]
    if not files:
        return None
    rdb_csv = max(files, key=lambda p: pattern.match(p.name).group(1)).as_posix()
    return rdb_csv

def get_rdb_genesis_data(
    key: str,
    dataset_id: str,
    filter_category: str,
    filter_value: str,
    target: str,
    source: str,
    third_filter_category: str = "",
    third_filter_value: str = ""
) -> str | float | None:
    if source == "RDB":
        folder = C.RDB_DIR
        pattern_middle = "rdb"
        first_filter = "1_variable_attribute_label"
    elif source == "DESTATIS":
        folder = C.DESTATIS_DIR
        pattern_middle = "destatis"
        first_filter = "time"
    else:
        return None
    pattern = re.compile(rf"^{re.escape(dataset_id)}_{pattern_middle}_(\d{{4}}-\d{{2}}-\d{{2}})\.csv$")


    files = [p for p in folder.glob(f"{dataset_id}_{pattern_middle}_*.csv") if pattern.match(p.name)]

    if not files:
        return None
    
    csv = max(files, key=lambda p: pattern.match(p.name).group(1)).as_posix()
    file = pd.read_csv(csv, sep=";", engine="python")
    if file is None:
        return None

    if source == "DESTATIS":
        mask_one = file["time"] == file["time"].max()
    else:
        first_target = search_gv(key, "NAME")

        col = file[first_filter].astype("string").str.replace(r"\.0$", "", regex=True)
        mask_one = col.str.startswith(str(first_target), na=False)

        if file.loc[mask_one, target].empty:
            first_target = search_gv(key, "LANDKREIS")
            first_target = f"{first_target}, Landkreis"
            mask_one = col.str.startswith(str(first_target), na=False)

    mask_two = (
        file[filter_category]
        .astype("string")
        .str.strip()
        .eq(str(filter_value).strip())
    )
    
    mask_three = True  # default: kein dritter Filter -> lässt alles durch

    # optional third filter
    if third_filter_category and third_filter_value:
        mask_three = (
            file[third_filter_category]
            .astype("string")
            .str.strip()
            .eq(str(third_filter_value).strip())
        )

    mask = mask_one & mask_two & mask_three

    vals = file.loc[mask, target]

    nums = pd.to_numeric(vals, errors="coerce")
    if nums.notna().sum() == 0:
        vals_de = vals.astype("string").str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
        nums = pd.to_numeric(vals_de, errors="coerce")

    # if we have the case of having more than one value we take the sum. Cause this are only the cases we need it.
    value = float(nums.sum())
    #If there is a error, sum returns 0.0
    if value == 0.0:
        return None
    return None if pd.isna(value) else value

def _get_age_of_table(category: str, table: str, key: str) -> str:
    _check_existing_folders()
    target = None
    match category:
        case "destatis" | "rdb":
            folder = C.RDB_DIR
            if category == "destatis":
                folder = C.DESTATIS_DIR
            target = max(
                re.search(r"\d{4}-\d{2}-\d{2}", p.name).group()
                for p in folder.glob(f"{table}_*.csv")
            )

        case "gv":
            folder = C.GV_DIR
            target = re.search(
                r"\d{4}-\d{2}-\d{2}",
                max(folder.glob(f"{C.GV_PREFIX}*.csv")).name
            ).group()

        case "dwd_tree":
            folder_path = C.DWD_DIR / "observations_germany_climate_daily_kl_recent"
            folder_second_option_path = C.DWD_DIR / "observations_germany_climate_daily_kl_historical"
            folder = Path(folder_path)
            folder_second_option = Path(folder_second_option_path)
            station_id = _search_weather_station_for_commune(key)

            files = list(folder.glob(f"*{station_id}*.csv"))

            if len(files) == 0:
                files = list(folder_second_option.glob(f"*{station_id}*.csv"))
            if len(files) == 1:
                csv_for_station = files[0]
            elif len(files) == 0:
                raise_data_set_error(
                    message="No DWD data found for the given commune. Communekey: " + key
                    + " Station ID: " + station_id + ". Searched in folders: " + str(folder_path)
                    + " and " + str(folder_second_option_path),
                    dataset="DWD observations",
                    column="Kommune AGS",
                    row=key,
                )
                return ""
            else:
                raise_data_set_error(
                    message="Multiple DWD data files found for the given commune.",
                    dataset="DWD observations",
                    column="Kommune AGS",
                    row=key,
                )
                return ""
            df = pd.read_csv(csv_for_station)
            return pd.to_datetime(df["MESS_DATUM"]).max().strftime("%Y-%m-%d")

        case _:
            raise_data_set_error(
                message="Invalid category for age of table retrieval.",
                dataset="N/A",
                column="category",
                row=category,
            )
            return ""

    if target is None:
        raise_data_set_error(
            message="No data found for the given category and table.",
            dataset=f"{category} dataset",
            column="table",
            row=table,
        )
        return ""
    return str(target)


def _check_existing_folders():
    folders = {
        C.GV_DIR: "Gemeindeverzeichnis",
        C.DWD_DIR: "DWD data",
        C.RDB_DIR: "RDB data",
        C.DESTATIS_DIR: "Destatis data",
    }

    for path, name in folders.items():
        if not path.exists() or not path.is_dir():
            raise_data_set_error(
                message=f"Required folder '{name}' not found at path: {path.resolve()}",
                dataset="N/A",
                column="N/A",
                row="N/A",
            )


_THOUSANDS_RE = re.compile(r"^\d{1,3}(\.\d{3})+$")  # 1.000 / 12.345 / 1.234.567


def parse_de_number(s: str):
    s = str(s).strip()
    if s == "" or s.lower() == "nan":
        return None

    # Dezimalkomma → float (Tausenderpunkte vorher entfernen)
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
        x = float(s)
        return int(x) if x.is_integer() else x

    # Nur Punkte: wenn es wie Tausender-Trenner aussieht → int
    if _THOUSANDS_RE.match(s):
        return int(s.replace(".", ""))

    # Sonst normal parsen (z.B. "49.0" oder "12")
    x = float(s)
    return int(x) if x.is_integer() else x

def _read_value(path, category):
    p = Path(path)
    if not p.exists():
        raise_data_set_error(
            message=f"Input fields config file not found at path: {p.resolve()}",
            dataset="Input fields config",
            column="N/A",
            row="N/A",
        )
        return category
    data = json.loads(p.read_text(encoding="utf-8"))
    return data.get(str(category), category)


def get_prefill_data(key: str) -> dict[str, Any]:
    if not key:
        return {}

    def _to_number(x: Any):
        if x is None:
            return None
        if isinstance(x, (int, float)):
            return x
        # alles andere (str etc.) -> parse_de_number versuchen
        try:
            return parse_de_number(str(x))
        except ValueError:
            return x

    gv_date = _get_age_of_table("gv", "gemeindeverzeichnis", key)
    dwd_date = _get_age_of_table("dwd_tree", "", key)
    haushalt_date = _get_age_of_table("rdb", "71517-01-03-5", key)
    abwasser_date = _get_age_of_table("rdb", "32213-01-01c-4", key)



    fields = [
    {
        "id": _read_value(C.PATH_FOR_JSON_INPUT_FIELDS, "Einwohnerzahl"),
        "value": search_gv(key, "EINWOHNER"),
        "source": "Gemeindeverzeichnis",
        "date": gv_date,
    },
    {
        "id": _read_value(C.PATH_FOR_JSON_INPUT_FIELDS, "Bevölkerungsdichte"),
        "value": search_gv(key, "BEVOELKERUNGSDICHTE"),
        "source": "Gemeindeverzeichnis",
        "date": gv_date,
    },
    {
        "id": _read_value(C.PATH_FOR_JSON_INPUT_FIELDS, "Sonnenstunden"),
        "value": _dwd_get_averages(key, "Sonnenstunden"),
        "source": "DWD Durchschnittswerte",
        "date": dwd_date,
    },
    {
        "id": _read_value(C.PATH_FOR_JSON_INPUT_FIELDS, "Durchschnittstemperatur"),
        "value": _dwd_get_averages(key, "Durchschnittstemperatur"),
        "source": "DWD Durchschnittswerte",
        "date": dwd_date,
    },
    {
        "id": _read_value(C.PATH_FOR_JSON_INPUT_FIELDS, "Durchschnittsniederschlag"),
        "value": _dwd_get_averages(key, "Durchschnittsniederschlag"),
        "source": "DWD Durchschnittswerte",
        "date": dwd_date,
    },
    {
        "id": _read_value(C.PATH_FOR_JSON_INPUT_FIELDS, "Kommunaler Haushalt"),
        "value": _get_haushalt(key),
        "source": "RDB Haushalt",
        "date": haushalt_date,
    },
    {
        "id": _read_value(C.PATH_FOR_JSON_INPUT_FIELDS, "Jahresabwassermenge"),
        "value": get_rdb_genesis_data(
            key,
            "32213-01-01c-4",
            "value_variable_label",
            "häusliches und betriebliches Schmutzwasser",
            "value",
            "RDB",
        ),
        "source": "RDB Abwasser",
        "date": abwasser_date,
    },
    {
        "id": _read_value(C.PATH_FOR_JSON_INPUT_FIELDS, "Gradtage"),
        "value": _get_gradtage(key),
        "source": "Estimated degree days based on the nearest weather station.",
        "date": dwd_date,
    },
    ]

    data = [
        {
            "id": f["id"],
            "value": _to_number(f["value"]),
            "source": f["source"],
            "date": f["date"],
            "individual": True,
        }
        for f in fields
        if f.get("value") is not None and str(f.get("value")).strip() != ""
    ]
    return data



def get_outdated_warnings() -> list[dict[str, Any]]:
    path = C.MASTER_XLSX_PATH

    df = pd.read_excel(path, sheet_name=0, dtype=str)
    df.columns = df.columns.str.strip()

    # Spalten-Check
    required_cols = (
        C.TITLE_COL_OUTDATED_WARNING,
        C.DATE_COL_OUTDATED_WARNING,
        C.SOURCE_COL_OUTDATED_WARNING,
    )
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise KeyError(
            f"Fehlende Spalten in Mastertable: {missing}. Vorhanden: {list(df.columns)}"
        )

    titles = df[C.TITLE_COL_OUTDATED_WARNING].astype("string").str.strip()
    source = df[C.SOURCE_COL_OUTDATED_WARNING].astype("string").str.strip()
    dates = pd.to_datetime(df[C.DATE_COL_OUTDATED_WARNING], errors="coerce", utc=True)

    now = pd.Timestamp.now(tz="UTC")
    out: list[dict[str, Any]] = []

    # --- State JSON laden ---
    json_file_path = C.CONSTANTS_CHANGES_CONFIG
    if not json_file_path.exists():
        raise_data_set_error(
            message=f"The config with the constants that can change is not there! Path {json_file_path}",
            dataset=json_file_path,
            column="N/A",
            row="N/A",
        )

    with json_file_path.open("r", encoding="utf-8") as f:
        json_file = json.load(f)

    # --- Outdated bestimmen (pro Zeile, abhängig von source_name) ---
    for title, d, src in zip(titles, dates, source):
        if not title or pd.isna(d):
            continue

        if src is None or pd.isna(src):
            s = ""
            has_source = False
        else:
            s = str(src).strip()
            has_source = (s != "") and (s.casefold() not in ("nan", "none", "<na>"))

        if has_source:
            gap_days = C.AGE_OUTDATED_WARNING_IN_DATES_WITH_AUTOMATIC_UPDATE
        else:
            gap_days = C.AGE_OUTDATED_WARNING_IN_DATES_WITHOUT_AUTOMATIC_UPDATE
    
        cutoff = now - pd.Timedelta(days=gap_days)

        if d < cutoff:
            dt_utc = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=timezone.utc)
            out.append(
                {
                    "title": str(title),
                    "last_update": dt_utc.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                    "source_name": s,
                    "threshold_days": gap_days,
                }
            )

    # --- Letztes Mail-Datum robust lesen ---
    last_mail_date = json_file.get(C.KEY_IN_JSON_LAST_MAIL_OUTDATED_WARNING)
    try:
        date_last_mail = datetime.strptime(
            last_mail_date, C.LAST_MAIL_OUTDATED_WARNING_FORMAT
        ).date()
    except Exception:
        # falls Key fehlt/kaputt ist: so behandeln, als wäre noch nie eine Mail geschickt worden
        date_last_mail = date(1970, 1, 1)

    # --- Mail senden + JSON updaten ---
    if out and (date.today() - date_last_mail >= pd.Timedelta(days=C.GAP_MAILS_OUTDATED_DAYS)):
        send_admin_email(
            subject="Outdated data in KommMa detected",
            body=(
                "The following data categories in the Mastertable are outdated.\n"
                f"- With source_name: threshold = {C.AGE_OUTDATED_WARNING_IN_DATES_WITH_AUTOMATIC_UPDATE} days\n"
                f"- Without source_name: threshold = {C.AGE_OUTDATED_WARNING_IN_DATES_WITHOUT_AUTOMATIC_UPDATE} days\n\n"
                f"{out}\n\n"
                "Please check the data sources and update the Mastertable accordingly or the date if you checked it."
            ),
        )

        json_file[C.KEY_IN_JSON_LAST_MAIL_OUTDATED_WARNING] = date.today().strftime(
            C.LAST_MAIL_OUTDATED_WARNING_FORMAT
        )
        json_file_path.parent.mkdir(parents=True, exist_ok=True)
        with json_file_path.open("w", encoding="utf-8") as f:
            json.dump(json_file, f, indent=2)

    return out


def _build_inputs_by_id(information: dict[str, Any]) -> dict[str, dict[str, Any]]:
    # 1) community_key prüfen (falls du ihn brauchst)
    community_key = information.get("community_key")
    if not isinstance(community_key, str) or not community_key:
        raise ValueError("community_key missing or not a non-empty string")

    # 2) inputs prüfen
    inputs = information.get("inputs")
    if not isinstance(inputs, list):
        raise ValueError("inputs missing or not a list")

    # 3) in Mapping umwandeln: id -> item
    by_id: dict[str, dict[str, Any]] = {}
    for idx, item in enumerate(inputs):
        if not isinstance(item, dict):
            raise ValueError(f"inputs[{idx}] is not an object")

        _id = item.get("id")
        if not isinstance(_id, str) or not _id:
            raise ValueError(f"inputs[{idx}].id missing or invalid")

        # source optional; value optional (je nach Use-Case)
        source = item.get("source")
        if source is not None and not isinstance(source, str):
            raise ValueError(f"inputs[{idx}].source must be a string if present")

        by_id[_id] = item

    return by_id

def to_canonical_str(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, int) and not isinstance(x, bool):
        return str(x)
    if isinstance(x, float):
        # stabile Darstellung ohne wissenschaftliche Notation-Überraschungen,
        # entfernt unnötige trailing zeros
        s = format(x, ".15g")
        return s
    return str(x).strip()



def create_updated_import(imported_information: dict[str, Any]) -> dict[str, Any]:
    """
    This method gets the imported information by the user and checks for each field if the value is the same as the current value in our database.
    So it returns all values that are different to the current values.
    :param imported_information: The imported information by the user.
    :return: A dict of all changed values.
    """
    try:
        inputs_by_id = _build_inputs_by_id(imported_information)
    except ValueError as e:
        raise_data_set_error(
            message=f"Invalid imported information: {e}",
            dataset="Imported information",
            column="N/A",
            row="N/A",
        )
        return {}
    community_key = imported_information.get("community_key", "")

    current_data = get_prefill_data(community_key)

    changed_or_missing: list[str] = []

    for field_id, cur in current_data.items():
        imp = inputs_by_id.get(field_id)

        cur_val = cur.get("value")
        imp_val = imp.get("value")

        if to_canonical_str(cur_val) != to_canonical_str(imp_val):
            changed_or_missing.append(field_id)

    updated_import = {
    "community_key": community_key,
    "inputs": [
        {
            "id": field_id,
            "value": current_data[field_id].get("value"),
            "source": current_data[field_id].get("source"),
            "date": current_data[field_id].get("date"),
            "individual": current_data[field_id].get("individual", True),
        }
        for field_id in changed_or_missing
        if field_id in current_data  # safety
    ],
    }

    return updated_import