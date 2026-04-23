# Updater (Master_Table & Prefill Data)

This README describes how the **Updater** works. It updates the file **`Master_Tabelle.xlsx`** (municipality-independent data) and generates a **degree days CSV** (heating degree days) used for **prefilling**.

---

# Overview

The Updater consists of three main steps:

1. **Generate degree days CSV** (median heating degree days of the last 15 years per station)
2. **Convert municipality directory** (Excel → CSV)
3. **Update Master_Tabelle.xlsx** (pull values from RDB/DESTATIS)

The central entry point is:

- `run_updates()` (script/module containing `create_gradtage_csv()`, `Converter_Gemeindeverzeichnis.convert_folder(...)`, `update_mastertable()`)

---

# Components

## 0) `run_updates()`

Orchestrates the complete workflow:

- `create_gradtage_csv()`
- `Converter_Gemeindeverzeichnis.convert_folder(get_gv_path())`
- `update_mastertable()`

During the municipality directory conversion, each result is logged as:

- `OK: CSV created: ... (Sheet=..., rows=..., deleted_xlsx=...)`
- `WARN: ...` (if `r.error` is set even though `success=True`)
- `ERROR: input_excel | error` (if `success=False`)

---

## 1) Destatis Municipality Directory: `Converter_Gemeindeverzeichnis`

### Purpose

`Converter_Gemeindeverzeichnis.py` converts downloaded **Destatis Excel files** (municipality directory) into **lean search CSV files**.

### Output Columns (CSV)

Exactly the following fields are exported:

- `AGS` (8 digits)
- `PLZ` (5-digit postal code)
- `NAME`
- `LANDKREIS` (district)
- `LAENGENGRAD` (longitude)
- `BREITENGRAD` (latitude)
- `FLAECHE_KM2` (area in km²)
- `EINWOHNER` (population)
- `BEVOELKERUNGSDICHTE` (population density)

Sort order: `NAME`, then `PLZ`.

### Features (as implemented in the code)

- **Auto sheet selection:** Automatically selects the correct sheet by looking for one that contains a column matching "satzart" (case- and whitespace-tolerant).
- **Robust reading:** Tries multiple header layouts (single-line and multi-header), flattens MultiIndex column names to strings.
- **Filtering:**
  - First builds a **district lookup** from rows with **Satzart `"40"`** (district level).
  - Filters the actual municipalities by **Satzart `Constants.SATZART`** (comment says "60"; value comes from `Constants`).
  - Additionally filters for **Baden-Württemberg** via `Constants.LAENDERCODE_BW`.
- **AGS generation (8 digits):** `state(2) + administrative_district(1) + county(2) + municipality(3)` (each zero-padded).
- **Atomic CSV writing:** Writes to `*.tmp` first, then renames/replaces to the final filename.
- **Bypassing OneDrive/Excel locks:** Copies the XLSX into a **TemporaryDirectory** and works only on the local copy (handles are closed cleanly).
- **Folder conversion:** `convert_folder(...)` processes all `*.xlsx` files (excluding `~$...` lock files) and can optionally write to a separate output directory.
- **Optional deletion of input XLSX:** via `delete_input_on_success`.  
  Note: In the current signature, the default is **`False`** (even though the header comment says "default True").

### API

#### Single File
- `Converter_Gemeindeverzeichnis.convert(input_excel, output_csv=None, sep=..., encoding=..., delete_input_on_success=False) -> ConvertResult`

Returns: `ConvertResult` with
- `success`
- `input_excel`, `output_csv`
- `used_sheet`
- `rows`
- `deleted_input`
- `error` (on errors or e.g. delete errors as a warning)

#### Folder
- `Converter_Gemeindeverzeichnis.convert_folder(folder, pattern="*.xlsx", out_dir=None, sep=..., encoding=..., delete_input_on_success=False) -> list[ConvertResult]`

---

## 2) Degree Days Generation (`create_gradtage_csv`)

Goal: Generates a CSV with **median heating degree days of the last 15 years** per weather station (for stations with current data).

**Data source:** DWD Open Data (daily climate data; "kl/historical" ZIPs)

**Process:**

1. **Load station list**
   - If available locally: `STATION_LIST_PATH` is used (`load_stations_from_csv`)
   - Otherwise: Station list is loaded via `STATION_LIST_URL` and filtered (Baden-Württemberg, Bavaria, Hesse, Rhineland-Palatinate)

2. **Download climate data (if station list is not local)**
   - A ZIP URL is constructed for each station (`build_url`)
   - ZIP is downloaded and extracted (only files starting with `produkt_klima_tag...`), then the ZIP is deleted

3. **Read and merge DWD files**
   - Only `.csv` files are processed
   - Station ID is preferably extracted from the filename, otherwise from file contents
   - Merged with station names via station ID

4. **Calculate heating degree days**
   - Daily mean temperature per station/date
   - Degree day definition:
     - if `T < 15°C`: `degree_day = 20 - T`
     - otherwise: `degree_day = 0`
   - Annual values = sum of degree day values per year

5. **Cleanup & time window**
   - The **first** and **last** year are removed per station (typically incomplete)
   - Only the last ~30 years (cutoff) are considered
   - Median is calculated over the **last 15 years** (only if the most recent year is ≥ 2020)

6. **Outputs**
   - `ANNUAL_CSV` (annual values)
   - `MEDIAN15_CSV` (result: 15-year median, e.g. `median_15yr_dd`)

**Error case:**
- If no DWD data was loaded, `raise_data_set_error(...)` is thrown (the dataset path is included).

---

## 3) Master Table Update (`update_mastertable`)

Goal: Updates values in **`Master_Tabelle.xlsx`** based on the sources defined therein (e.g. RDB/DESTATIS) and writes the `last_updated` field.

**Process:**

1. Load Excel: `pd.read_excel(C.MASTER_XLSX_PATH, sheet_name=0)`
2. Validation:
   - File must not be empty
   - Column `Datenkategorie` must be set
   - `source_name` and `source_id` must either both be set or both be empty (empty → row is skipped)
3. For supported sources (`RDB`, `DESTATIS`):
   - Mapping via `Constants`:
     - `NAME_TO_FILTER`, `NAME_TO_FILTER_TARGET`, `NAME_TO_TARGET`
     - optionally `NAME_TO_THIRD_FILTER`, `NAME_TO_THIRD_FILTER_VALUE`
   - Retrieval via `get_rdb_genesis_data(...)`
4. Result check:
   - `None` or `NaN` → `raise_data_set_error(...)`
5. Writing:
   - `Wert` (value) is set
   - `last_updated` is set to today's date (`dd.mm.yyyy`)
   - Saved via `pd.ExcelWriter(..., mode="w")`

> Note: In the shown code, saving happens **inside the loop**. This means the file is persisted after every row (robust against interruptions), but it is I/O-intensive.

---

## Special Case: "Median of Sewage Sludge Production …" (RDB)

If `source_name == "RDB"` and the `Datenkategorie` matches the pattern (contains "Median der …", "Kl", "rschlammproduktion"), the **normal update is skipped** and instead:

- `_median_klaerschlamm(source_id)` checks whether new years have appeared in the source data.
- If discrepancies are detected:
  - (with a cooldown) an email is sent to `C.ADMIN_EMAIL`
  - Cooldown/status data is stored in `C.CONSTANTS_CHANGES_CONFIG` (JSON)
- In this special case, the updater code **only sets `last_updated`** if `_median_klaerschlamm(...)` returns **False** (see comment in the code).

---

## Prerequisites

- Python environment including:
  - `pandas`
  - `requests`
  - `openpyxl`
- Write permissions to the paths configured in `externalAPI.Constants`
- Internet access (for DWD downloads; possibly also for the master table data source)

---

## Configuration (via `externalAPI.Constants`)

The most important paths/parameters are controlled via `Constants` (alias `C`), e.g.:

- `MASTER_XLSX_PATH` (path to Master_Tabelle.xlsx)
- DWD/degree days paths:
  - `DWD_DD_OUTPUT_DIR`, `DAILY_CSV_DIR`, `ANNUAL_CSV`, `DWD_DD_DIR` / `MEDIAN15_CSV`
  - optionally `STATION_LIST_PATH` (local station list)
- DWD URL: `STATION_LIST_URL`
- Master table mappings:
  - `NAME_TO_FILTER`, `NAME_TO_FILTER_TARGET`, `NAME_TO_TARGET`
  - optionally `NAME_TO_THIRD_FILTER`, `NAME_TO_THIRD_FILTER_VALUE`
- Sewage sludge monitoring:
  - `CONSTANTS_CHANGES_CONFIG`
  - `ADMIN_EMAIL`
  - Cooldown/date format constants

---

## Outputs / Artifacts

- **Updated master table**
  - `Master_Tabelle.xlsx` (overwritten)
- **Degree days**
  - Annual values: `ANNUAL_CSV`
  - 15-year median: `MEDIAN15_CSV`
- **Municipality directory**
  - CSV outputs per converted file (path/name is printed in the log)

---

## Logging & Error Handling

- Runtime logs via `print(...)` (OK/WARN/ERROR + progress messages)
- Hard validation errors go through `raise_data_set_error(...)` and typically abort (with dataset/row/column for diagnosis).

---

## Running

The Updater is executed by `DaemonJob.py` but can also be used like this:

```python
from externalAPI.Updater import run_updates

run_updates()
```