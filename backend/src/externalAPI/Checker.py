from __future__ import annotations

"""
This module periodically checks configured web sources for updates and notifies the admin via email.
You can find more information in README_CHECKER.md
Author: Jonas Dorner (@OilersLD)
"""

# ============================================================
# Imports
# ============================================================

import datetime
import json
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from Exceptions.Data_Set_Error import raise_data_set_error as raise_dataset_error
from externalAPI.Constants import Constants as C
from EMail_Service import send_admin_email


# ============================================================
# Configuration / Constants
# ============================================================

HEADERS = {
    # A stable, explicit user agent helps avoid being blocked by some servers.
    "User-Agent": "Mozilla/5.0 (checker script)",
    "Accept-Language": "de-DE,de;q=0.9",
}

DEFAULT_STATE_FILE = "Checker.json"


# ============================================================
# State I/O Helpers
# ============================================================

def _load_state(path: Path) -> dict:
    """
    Load the persisted checker state from a JSON file.

    Args:
        path: Path to the JSON state file.

    Returns:
        A dict containing the state (must include the configured sources).
    """
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _save_state(path: Path, state: dict) -> None:
    """
    Persist the checker state to disk using an atomic write strategy.

    We first write to "<file>.tmp" and then replace the original file to reduce the chance
    of ending up with a partially written JSON file if the process crashes.

    Args:
        path: Target path of the JSON state file.
        state: The full state dict to write.
    """
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    tmp.replace(path)


# ============================================================
# HTTP / Web Helpers
# ============================================================

def _http_get(url: str, timeout: int = 30) -> requests.Response:
    """
    Perform a GET request with shared headers and a configurable timeout.

    Args:
        url: The URL to request.
        timeout: Timeout in seconds.

    Returns:
        The requests.Response object.
    """
    return requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)


def _page_exists(url: str) -> bool:
    """
    Robust existence check for a URL.

    Rules:
    - HTTP 200 or 3xx (after redirects) => True
    - HTTP 404 => False
    - Any other HTTP error => raise an exception via response.raise_for_status()

    Args:
        url: The URL to check.

    Returns:
        True if the resource exists, False if it is a 404.

    Raises:
        requests.HTTPError: For unexpected HTTP status codes.
        requests.RequestException: For network issues, timeouts, etc.
    """
    r = _http_get(url)
    if r.status_code == 404:
        return False
    r.raise_for_status()
    return True


# ============================================================
# Checker / Search Methods
# ============================================================

def check_yearly_page_exists(source: dict) -> dict:
    """
    Checker type: yearly_page_exists

    Goal:
        Determine whether a newer "year" page/resource exists than the one stored in last_seen.

    Expected source fields (via Constants):
        - url_template: A template containing "{year}" placeholder
        - lookahead_years (optional): How many future years to test
        - last_seen (optional): {"year": <int>, "url": <str>}

    Strategy:
        Starting from last_seen.year (or a reasonable default if not set),
        probe successive years up to lookahead. Stop at the first missing year (404),
        assuming years appear in order without gaps.

    Side effects:
        If a newer year is found, updates source["last_seen"] in-place.

    Args:
        source: Source configuration dict.

    Returns:
        A standardized result dict:
        {
          "updated": bool,
          "latest": {"year": int, "url": str},
          "previous": {"year": int, "url": str|None}
        }
    """
    template = source[C.KEY_FOR_URL_TEMPLATE_CHECKER_JSON]
    lookahead = int(source.get(C.KEY_FOR_LOOKAHEAD_YEARS_CHECKER_JSON, C.DEFAULT_LOOKAHEAD_YEARS_CHECKER_JSON))

    last_seen = source.get(C.KEY_FOR_LAST_SEEN_CHECKER_JSON) or {}
    last_year = last_seen.get(C.KEY_FOR_YEAR_CHECKER_JSON)

    # If last_year is not set, start from (current year - offset).
    # This prevents starting too far in the past when bootstrapping a new config.
    if last_year is None:
        last_year = datetime.date.today().year - C.DEFAULT_START_YEAR_OFFSET_CHECKER

    latest_year = int(last_year)
    latest_url = template.format(year=latest_year)

    # Check subsequent years up to the configured lookahead window.
    for y in range(int(last_year) + 1, int(last_year) + lookahead + 1):
        url = template.format(year=y)
        if _page_exists(url):
            latest_year = y
            latest_url = url
        else:
            # Once a year is missing (404), assume no later years exist.
            # This matches the common pattern where yearly pages are published sequentially.
            break

    updated = latest_year != int(last_year)
    if updated:
        source[C.KEY_FOR_LAST_SEEN_CHECKER_JSON] = {
            C.KEY_FOR_YEAR_CHECKER_JSON: latest_year,
            C.KEY_FOR_URL_CHECKER_JSON: latest_url,
        }

    return {
        C.KEY_FOR_UPDATED_CHECK_RESULT: updated,
        C.KEY_FOR_LATEST_CHECK_RESULT: {
            C.KEY_FOR_YEAR_CHECKER_JSON: latest_year,
            C.KEY_FOR_URL_CHECKER_JSON: latest_url,
        },
        C.KEY_FOR_PREVIOUS_CHECK_RESULT: {
            C.KEY_FOR_YEAR_CHECKER_JSON: last_year,
            C.KEY_FOR_URL_CHECKER_JSON: last_seen.get(C.KEY_FOR_URL_CHECKER_JSON),
        },
    }


def check_listing_latest_download(source: dict) -> dict:
    """
    Checker type: listing_latest_download

    Goal:
        Find the newest matching download link on a listing page and compare it with last_seen.download_url.

    Expected source fields (via Constants):
        - listing_url: URL of the page containing links
        - href_must_contain (optional): substring that must be present in href
        - must_contain (optional): list of tokens that all must be present in href
        - last_seen (optional): {"download_url": <str>}

    Strategy:
        - Fetch listing_url
        - Parse HTML and collect candidate links (<a href="...">) matching filters
        - Convert relative links to absolute links via urljoin
        - Assume the page is sorted with the newest link first and pick candidates[0]

    Side effects:
        If a new download link is found, updates source["last_seen"] in-place.

    Args:
        source: Source configuration dict.

    Returns:
        A standardized result dict:
        {
          "updated": bool,
          "latest": {"download_url": str},
          "previous": {"download_url": str|None}
        }

    Raises:
        Data set error if no matching links are found (misconfiguration or page layout changes).
    """
    listing_url = source[C.KEY_FOR_LISTING_URL_CHECKER_JSON]
    href_must_contain = source.get(C.KEY_FOR_HREF_MUST_CONTAIN_CHECKER_JSON, "")
    must_contain = source.get(C.KEY_FOR_MUST_CONTAIN_CHECKER_JSON, [])

    r = _http_get(listing_url)
    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")

    # Collect all <a href="..."> candidates that match the configured criteria.
    candidates: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]

        if href_must_contain and href_must_contain not in href:
            continue

        ok = True
        for token in must_contain:
            if token not in href:
                ok = False
                break
        if not ok:
            continue

        full_url = urljoin(listing_url, href)
        candidates.append(full_url)

    if not candidates:
        raise_dataset_error(
            C.ERR_NO_DOWNLOAD_LINKS_FOUND_CHECKER_JSON.format(listing_url=listing_url),
            dataset=C.CHECKER_JSON_PATH,
            column=C.KEY_FOR_LISTING_URL_CHECKER_JSON,
            row=source,
        )

    # Important assumption:
    # The listing page is sorted in descending order by date, so the first match is the newest.
    # If that is not true for a specific site, this logic needs to be extended (e.g. parse dates).
    latest_download = candidates[0]

    last_seen = source.get(C.KEY_FOR_LAST_SEEN_CHECKER_JSON) or {}
    prev_download = last_seen.get(C.KEY_FOR_DOWNLOAD_URL_CHECKER_JSON)

    updated = latest_download != prev_download
    if updated:
        source[C.KEY_FOR_LAST_SEEN_CHECKER_JSON] = {C.KEY_FOR_DOWNLOAD_URL_CHECKER_JSON: latest_download}

    return {
        C.KEY_FOR_UPDATED_CHECK_RESULT: updated,
        C.KEY_FOR_LATEST_CHECK_RESULT: {C.KEY_FOR_DOWNLOAD_URL_CHECKER_JSON: latest_download},
        C.KEY_FOR_PREVIOUS_CHECK_RESULT: {C.KEY_FOR_DOWNLOAD_URL_CHECKER_JSON: prev_download},
    }


def check_one(name: str, source: dict) -> dict:
    """
    Dispatch a single configured source to its checker function based on source["type"].

    Args:
        name: The human-readable name/key of the source.
        source: The source config dict.

    Returns:
        The standardized checker result dict.

    Raises:
        Data set error if an unknown checker type is configured.
    """
    t = source.get(C.KEY_FOR_TYPE_CHECKER_JSON)

    if t == C.TYPE_YEARLY_PAGE_EXISTS_CHECKER_JSON:
        return check_yearly_page_exists(source)
    if t == C.TYPE_LISTING_LATEST_DOWNLOAD_CHECKER_JSON:
        return check_listing_latest_download(source)

    raise_dataset_error(
        C.ERR_UNKNOWN_SOURCE_TYPE_CHECKER_JSON.format(type=t, name=name),
        dataset=C.CHECKER_JSON_PATH,
        column=C.KEY_FOR_TYPE_CHECKER_JSON,
        row=source,
    )


# ============================================================
# Formatting / Human-readable Output
# ============================================================

def _fmt(v) -> str:
    """
    Convert values into a friendly string representation for emails.
    """
    return str(v) if v not in (None, "") else "-"


def _format_update_block(name: str, res: dict) -> str:
    """
    Format a single update result into a readable text block for email notifications.

    Args:
        name: Source name.
        res: Result dict from a checker.

    Returns:
        A formatted string block.
    """
    latest = res.get(C.KEY_FOR_LATEST_CHECK_RESULT, {}) or {}
    prev = res.get(C.KEY_FOR_PREVIOUS_CHECK_RESULT, {}) or {}

    # yearly_page_exists
    if C.KEY_FOR_YEAR_CHECKER_JSON in latest:
        return (
            f"- {name}\n"
            f"  Year: {_fmt(prev.get(C.KEY_FOR_YEAR_CHECKER_JSON))} -> {_fmt(latest.get(C.KEY_FOR_YEAR_CHECKER_JSON))}\n"
            f"  URL (latest): {_fmt(latest.get(C.KEY_FOR_URL_CHECKER_JSON))}\n"
        )

    # listing_latest_download
    if C.KEY_FOR_DOWNLOAD_URL_CHECKER_JSON in latest:
        return (
            f"- {name}\n"
            f"  Download (latest): {_fmt(latest.get(C.KEY_FOR_DOWNLOAD_URL_CHECKER_JSON))}\n"
        )

    # Fallback (should rarely be needed if result formats stay consistent)
    return f"- {name}\n"


# ============================================================
# Runner / Orchestration
# ============================================================

def run_check() -> dict:
    """
    Run all configured checks once.

    Workflow:
      1) Load state JSON (contains all source configs and last_seen values)
      2) Run each source checker and collect results
      3) If ANY source was updated, persist the state and send an "Update" email
      4) If no updates were found, send a "No Update" email
      5) If a source check fails, send a dedicated error email for that source

    Returns:
        A dict mapping source name -> result dict (or {"error": "..."} on failure).
    """
    state = _load_state(C.CHECKER_JSON_PATH)
    sources = state.get(C.KEY_FOR_SOURCES_CHECKER_JSON, {})

    if not sources:
        raise_dataset_error(
            C.ERR_NO_SOURCES_CHECKER_JSON,
            dataset=C.CHECKER_JSON_PATH,
            column=C.KEY_FOR_SOURCES_CHECKER_JSON,
            row=C.ROW_ALL_CHECKER_JSON,
        )

    results: dict[str, dict] = {}
    any_updated = False

    for name, source in sources.items():
        try:
            res = check_one(name, source)
            results[name] = res

            if res.get(C.KEY_FOR_UPDATED_CHECK_RESULT):
                any_updated = True

        except Exception as e:
            # Store error in results and notify admin with more context.
            results[name] = {"error": str(e)}
            send_admin_email(
                subject=f"KommMa Checker Error! {name}",
                body=(
                    f"Error with the source {name}: {e!r}\n"
                    "Please check the source configuration and the checker function for this source.\n\n"
                    f"Source: {name}\n"
                    f"Error: {e!r}"
                ),
            )

    checked_names = list(sources.keys())

    if any_updated:
        _save_state(C.CHECKER_JSON_PATH, state)

        updated_only = {
            n: r for n, r in results.items()
            if isinstance(r, dict) and r.get(C.KEY_FOR_UPDATED_CHECK_RESULT) is True
        }

        blocks = [_format_update_block(n, r) for n, r in updated_only.items()]

        send_admin_email(
            subject="KommMa Checker Update!",
            body=(
                "The KommMa Tool has checked if there are new values for the mastertable available.\n"
                f"Please check the sources below and update them in {C.MASTER_XLSX_PATH}\n\n"
                "Updates found:\n"
                + "".join(blocks)
            ),
        )
    else:
        send_admin_email(
            subject="KommMa Checker No Update",
            body=(
                "The KommMa Tool has checked if there are new values for the mastertable available.\n"
                "No updates were found.\n\n"
                "We searched for:\n- " + "\n- ".join(checked_names)
            ),
        )

    return results