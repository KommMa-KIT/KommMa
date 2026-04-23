# README - Checker (`Checker.json`)

## Purpose
The checker regularly inspects defined sources from a `Checker.json` and detects whether there is "something newer" than the last stored value (`last_seen`).
The result for each source is an `updated: true/false` plus information about `latest` and `previous`. If `updated` is true, `last_seen` is updated in the state.
It is started every six months by `half_year.timer` and `checker.service`, with the help of the script `half_year_job.py`.

---

## Core Idea / Flow
1. `run_check()` loads the current state from `C.CHECKER_JSON_PATH` (the `Checker.json`).
2. All sources are read from `state[C.KEY_FOR_SOURCES_CHECKER_JSON]`.
3. For each source, `source[C.KEY_FOR_TYPE_CHECKER_JSON]` determines which check strategy runs (`check_one()`).
4. The strategy returns:
   - `updated`: whether something new was found
   - `latest`: the newest object found (for example year + URL or download URL)
   - `previous`: what was previously stored in `last_seen`
5. If `updated == True`, the strategy writes the new value to `source[C.KEY_FOR_LAST_SEEN_CHECKER_JSON]`.
6. At the end, the checker can use this to build notifications or save the state, depending on how the rest of your code handles it.

---

## Data Format: `Checker.json`
The file contains an object with at least:

- `sources`: a dictionary mapping arbitrary names to source configurations

Example schema (simplified):

```json
{
  "sources": {
    "some_name": {
      "type": "yearly_page_exists",
      "url_template": "https://example.com/report-{year}.pdf",
      "lookahead_years": 5,
      "last_seen": {
        "year": 2023,
        "url": "https://example.com/report-2023.pdf"
      }
    }
  }
}
```

---

## Source Types (Strategies)

### 1) `yearly_page_exists`
**Use case:** A source publishes content for each year at a distinct URL (for example `.../report-2024.pdf`).
The checker should determine whether there is **a newer year** than `last_seen.year`.

**Required fields in the source:**
- `url_template` (required)  
  Template with `{year}`, for example `https://example.com/report-{year}.pdf`
- `lookahead_years` (optional)  
  How many years ahead should be checked (default: `C.DEFAULT_LOOKAHEAD_YEARS_CHECKER_JSON`)
- `last_seen.year` (optional)  
  The last known year. If it is missing, the checker starts conservatively with `(current year - C.DEFAULT_START_YEAR_OFFSET_CHECKER)`.

**Flow:**
1. Start year = `last_seen.year` (or fallback).
2. Check `last_year + 1 ... last_year + lookahead_years` one after another.
3. For each year, the URL is built with `url_template.format(year=y)`.
4. If the page exists (`_page_exists(url)`):
   - set `latest_year = y` and `latest_url = url`
   - continue checking
5. If a year does **not** exist, the loop stops (`break`) - assumption: later years most likely do not exist either.
6. If `latest_year != last_year`:
   - `updated = True`
   - `source["last_seen"]` is updated to the new year + URL.

**Return format:**
```json
{
  "updated": true,
  "latest": { "year": 2024, "url": "..." },
  "previous": { "year": 2023, "url": "..." }
}
```

---

### 2) `listing_latest_download`
**Use case:** There is a listing page (for example "Downloads") that links to new files.
The checker should find the **latest matching link** and compare it with `last_seen.download_url`.

**Required fields in the source:**
- `listing_url` (required)  
  The page containing the links (HTML).
- `href_must_contain` (optional)  
  Substring that must appear in the `href` (for example `.pdf` or `/downloads/`)
- `must_contain` (optional)  
  List of tokens that must appear in the `href` (for example `["report", "2024"]`)
- `last_seen.download_url` (optional)  
  The last known download link.

**Flow:**
1. HTML is loaded from `listing_url` (`_http_get(listing_url)`).
2. BeautifulSoup collects all `<a href="...">` links.
3. Filtering:
   - If `href_must_contain` is set, it must appear in the `href`.
   - All tokens from `must_contain` must appear in the `href`.
4. Each matching `href` is normalized into an absolute URL with `urljoin(listing_url, href)`.
5. Assumption: **the listing page is sorted by date descending**, so `candidates[0]` is the newest one.
6. Compare `latest_download` with `last_seen.download_url`:
   - Different value -> `updated = True` and `last_seen.download_url` is updated.
7. If no candidates are found -> `raise_dataset_error(...)`.

**Return format:**
```json
{
  "updated": true,
  "latest": { "download_url": "..." },
  "previous": { "download_url": "..." }
}
```

---

## Error Behavior (`DataSetError`)
The checker uses `raise_dataset_error(...)` to report configuration-related errors cleanly:
- No sources in `Checker.json`
- No matching download links on a listing page
- Unknown `source.type`

These errors reference:
- `dataset = C.CHECKER_JSON_PATH`
- `column = ...` (the relevant key)
- `row = source` or `"all"`

---

## Assumptions / Limits
- `yearly_page_exists` stops at the first missing year (heuristic).
- `listing_latest_download` relies on the listing page showing the newest links first.
- `_page_exists`, `_http_get`, and `_load_state` are external helper functions and must exist and work correctly.

---

## Example: Two Sources
```json
{
  "sources": {
    "annual_report": {
      "type": "yearly_page_exists",
      "url_template": "https://example.com/reports/report-{year}.pdf",
      "lookahead_years": 3,
      "last_seen": { "year": 2023, "url": "https://example.com/reports/report-2023.pdf" }
    },
    "downloads_page": {
      "type": "listing_latest_download",
      "listing_url": "https://example.com/downloads",
      "href_must_contain": ".zip",
      "must_contain": ["dataset"],
      "last_seen": { "download_url": "https://example.com/downloads/dataset-2024-01.zip" }
    }
  }
}
```

---

## Extension: Add a New Check Strategy
1. Define a new `type` string as a constant (for example `C.TYPE_..._CHECKER_JSON`).
2. Implement a new function `check_<name>(source: dict) -> dict`.
3. Add a new branch in `check_one()`.
4. Extend the documentation and schema in the README.
