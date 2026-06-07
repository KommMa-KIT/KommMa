
# Overview
This module group implements a small framework to download several external datasets (Destatis / Regionaldatenbank / DWD / Gemeindeverzeichnis / SRTM). The central coordinator is `Downloader.run_downloads(config_path, output_root)` which:
- reads a JSON configuration file (default location: `config/DownloadConfig.json`, the runtime path is `Constants.CONFIG_PATH`)
- prepares temporary output directories (_second, _old) and final `output_root`
- iterates sources in the order defined by `Constants.SOURCE_ORDER`
- for each enabled source it calls the appropriate helper in `externalAPI/DownloadHelper`
- only when all downloads succeeded the contents from `_second` are moved into `output_root`

## How the download flow works (high level)
1. Load JSON config (top-level key: `downloader`). The relevant block is `downloader.sources`.
2. Create/clean helper directories under `output_root` (and `_second` / `_old` backups).
3. Iterate over sources according to `Constants.SOURCE_ORDER`. For each source name the downloader checks if a configuration exists and whether it is enabled (the `enabled` flag defaults to true if omitted).
4. For each source a helper function/module is called to perform the actual download(s). Helpers live in `externalAPI/DownloadHelper`.
5. Errors are either raised (and abort the whole run) or skipped if the item/source is marked as `optional` in the JSON.
6. When everything completed successfully the newly downloaded data from `_second` is moved into the final `output_root` and old data moved to `_old`.

## Configuration (DownloadConfig.json)
The config file in `config/DownloadConfig.json` contains a `downloader` object with a `sources` map. Each key in that map corresponds to a source name (strings used in `Constants`, e.g. `destatis_genesis`, `rdb_genesis`, `dwd_opendata`, `gemeindeverzeichnis`, `srtm_elevation`).

Common patterns in the JSON:
- `enabled` (boolean, optional): if omitted it's treated as true. Set to `false` to disable a source.
- `optional` (boolean, optional) used on items: if true, failures for that item won't abort the whole downloader run.

Examples of source entries (see `config/DownloadConfig.json` in the repo for the real examples):

- Destatis / StatBund (destatis_genesis)
  - expected keys: `items` (array), in each item at least `id` (table id) and optionally `optional`.
  - the downloader calls the helper function: `Downloader_StatBund.download_table_and_save(table_id, output_dir=...)`.

- Regionaldatenbank (rdb_genesis)
  - same shape as Destatis: `items` with `id` and optional `optional`.
  - the downloader calls: `Downloader_Regionaldatenbank.download_table_and_save(table_id, out_dir=...)`.

- Deutscher Wetterdienst (dwd_opendata)
  - keys: `station_list` and `folders`.
  - `station_list` (object) may contain `path` (the DWD path to the stations file) and `optional`.
  - `folders` is an array of objects with `path` and optional `optional`.
  - the downloader uses the DWD helper's `DwdCdcClient.get_stations()`, `save_stations_csv(...)` and `download_dwd_tree(folder_path, out_dir)` functions.

- Gemeindeverzeichnis (gemeindeverzeichnis)
  - usually only a single download: the helper exposes `download_gv_excel(out_dir)` which downloads the latest Excel.

- SRTM (srtm_elevation)
  - expected key: `raw_target` (name of the .tif inside the ZIP) — the downloader passes this value to `Downloader_SRTM.download_srtm_dtm(out_dir, name_tif)`.

## Download helpers (how to add a new helper)
Helpers are Python modules in `externalAPI/DownloadHelper`. The `Downloader` imports some helpers directly and calls known function names. When you add a new download target you typically need to:

1) Implement a new helper module. The required functions depend on the kind of source:

  - Table-like sources (Destatis / Regionaldatenbank style)
	- Provide: `download_table_and_save(table_name: str, out_dir: str, ...) -> bool`
	  - The downloader will call it with an item `id` and `out_dir` (string path). It should save a CSV (or similar) and return True on success or raise/return False on failure.
	- Optional: `test_login()` to validate credentials early.

  - DWD-style index/tree sources
	- Provide: `download_dwd_tree(base_url: str, output_dir: str, **kwargs) -> DwdTreeDownloadStats` (see `Downloader_DeutscherWetterdienst.download_dwd_tree`).
	- Provide station helpers: `DwdCdcClient.get_stations()` and `save_stations_csv(df, path)` if the source needs a stations list.

  - Single-file sources (GV or SRTM style)
	- Provide a simple function like `download_gv_excel(out_dir: str) -> bool` or `download_srtm_dtm(out_dir: str, tif_name: str) -> str`.

2) Export the helper module's name in `externalAPI/Downloader.py` (add an import). Example existing imports:

	from externalAPI.DownloadHelper import Downloader_DeutscherWetterdienst as DWD, \
		Downloader_StatBund as STATBUND, Downloader_Gemeindeverzeichnis as GV, Downloader_Regionaldatenbank as RDB, \
		Downloader_SRTM as SRTM

   Add your helper next to those (use a short alias) so the coordinator can call it.

3) Add constants and an entry in `Constants.py`:
   - Define a unique source key string: e.g. `SOURCE_NAME_MYDATA = "mydata_source"`.
   - Define an output directory constant: `DIRECTORY_NAME_FOR_MYDATA = "mydata"`.
   - Add the new source key to `SOURCE_ORDER` in the desired position so the downloader will process it.

4) Add JSON configuration for the new source under `downloader.sources` (see examples below). Choose a shape similar to existing sources. Include `enabled` and the source-specific fields your helper expects.

5) Update `Downloader.run_downloads(...)` to handle your new source name. There are two options:
   - If the new helper matches an existing pattern (tables/items, simple download, or dwd-tree), you can reuse the same code path and call the helper from the corresponding branch.
   - Otherwise add an elif branch for your new `source_name` in the run loop and call your helper functions there. Remember to honour the `optional` flag semantics.

## Example: adding a generic "table" source
1) Create `externalAPI/DownloadHelper/Downloader_MyData.py` exposing `download_table_and_save(table_id, out_dir)`.
2) Import it in `Downloader.py` as `import Downloader_MyData as MYDATA`.
3) Add to `Constants.py`:
   - SOURCE_NAME_MYDATA = "mydata"
   - DIRECTORY_NAME_FOR_MYDATA = "mydata"
   - Add `SOURCE_NAME_MYDATA` to `SOURCE_ORDER`.
4) Add JSON entry in `config/DownloadConfig.json`:

  "mydata": {
	"enabled": true,
	"items": [
	  { "id": "ABC-123", "optional": false }
	]
  }

5) In `Downloader.run_downloads` add an elif branch similar to the StatBund/RDB block to call `MYDATA.download_table_and_save(id, str(output_dir))`.

## JSON schema snippets (quick reference)
- Destatis / RDB style
  {
	"destatis_genesis": {
	  "enabled": true,
	  "items": [ { "id": "12411-0001", "optional": false } ]
	}
  }

- DWD style
  {
	"dwd_opendata": {
	  "enabled": true,
	  "station_list": { "path": "/climate_environment/CDC/.../Stations.txt", "optional": false },
	  "folders": [ { "path": "/climate_environment/CDC/.../historical/", "optional": true } ]
	}
  }

- SRTM style
  {
	"srtm_elevation": {
	  "enabled": true,
	  "raw_target": "srtm_germany_dtm.tif"
	}
  }

## Tips and notes
- Keep helper APIs simple and predictable. The downloader expects specific function names and signatures (see above). Following the established function names makes integration frictionless.
- Respect the `optional` flag in item-level configs to avoid aborting the whole run for non-critical resources.
- If you add credentials or tokens, prefer reading them from environment variables and referencing these in `Constants` (see how `GENESIS_TOKEN`, `RDB_USER`, `RDB_PASS` are used).
- Add unit tests (there is a `backend/test` folder) for your new helper to ensure stable behavior.

## Where to look for examples
- `externalAPI/DownloadHelper/Downloader_DeutscherWetterdienst.py` — complex example with recursive index crawling and ZIP handling.
- `externalAPI/DownloadHelper/Downloader_StatBund.py` and `Downloader_Regionaldatenbank.py` — examples of table downloads using the GENESIS APIs.
- `externalAPI/DownloadHelper/Downloader_Gemeindeverzeichnis.py` and `Downloader_SRTM.py` — single-file download examples.

If you need help integrating a new source, paste the config you plan to use and the minimal helper API you will implement and I can provide the exact edits needed in `Constants.py` and `Downloader.py` to register it.

