"""
Backend + CLI for live search in the municipality directory.

- Loads a slim CSV (e.g., produced by your converter)
- Supports searching by:
  - Name (startswith/contains + typo tolerance via fuzzy matching)
  - ZIP code / PLZ (prefix/exact)
  - AGS (8 digits, prefix/exact)
- Returns uniform result objects that a UI can render easily.

Optional:
- For better typo search:
    pip install rapidfuzz
Author: Jonas Dorner (@OilersLD)
"""

from __future__ import annotations
from typing import Optional
from dataclasses import dataclass
from pathlib import Path

import logging
import re
import unicodedata
import pandas as pd

from externalAPI.Constants import Constants as C


logger = logging.getLogger(__name__)


# Optional fuzzy backend
try:
    from rapidfuzz import fuzz  # type: ignore
    HAS_RAPIDFUZZ = True
except Exception:
    from difflib import SequenceMatcher
    HAS_RAPIDFUZZ = False


@dataclass(frozen=True)
class SearchResult:
    """One search hit/result entry."""
    ags: str
    plz: str
    name: str
    score: int
    match_type: str


def normalize_text(s: str) -> str:
    """
    Normalize text for stable searching:
    - Unicode NFKD + remove accents (München -> Munchen)
    - casefold (stronger than lower)
    - remove special characters
    - collapse whitespace
    """
    s = unicodedata.normalize(C.SEARCH_GEMEINDEVERZEICHNIS_UNICODE_NORMAL_FORM, s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.casefold()
    s = re.sub(C.SEARCH_GEMEINDEVERZEICHNIS_NON_ALNUM_WHITESPACE_REGEX, C.SEARCH_GEMEINDEVERZEICHNIS_REPLACE_WITH_SPACE, s)
    s = re.sub(C.SEARCH_GEMEINDEVERZEICHNIS_MULTISPACE_REGEX, C.SEARCH_GEMEINDEVERZEICHNIS_REPLACE_WITH_SPACE, s).strip()
    return s


def fuzzy_score(q: str, cand: str) -> int:
    """
    Fuzzy score 0..100.
    - With rapidfuzz: token_set_ratio (robust with extra words)
    - Fallback: difflib ratio
    """
    if not q or not cand:
        return 0
    if HAS_RAPIDFUZZ:
        return int(fuzz.token_set_ratio(q, cand))
    return int(SequenceMatcher(None, q, cand).ratio() * 100)


class Search_Gemeindeverzeichnis:
    """
    Search engine for municipalities.

    Expected CSV columns:
      - AGS (8 digits, may include leading zeros)
      - PLZ (ZIP code, 5 digits, may be shorter before normalization)
      - NAME

    Other columns are ignored.
    """

    def __init__(self, csv_path: Path, sep: str = C.SEARCH_GEMEINDEVERZEICHNIS_CSV_SEP, encoding: str = C.SEARCH_GEMEINDEVERZEICHNIS_CSV_ENCODING) -> None:
        csv_path = Path(csv_path)
        if not csv_path.exists():
            raise FileNotFoundError(f"{C.SEARCH_GEMEINDEVERZEICHNIS_ERR_CSV_NOT_FOUND_PREFIX}{csv_path}")

        self.csv_path = csv_path
        self.df = pd.read_csv(csv_path, sep=sep, encoding=encoding, dtype=str)

        # Validate required columns
        required = {C.SEARCH_GEMEINDEVERZEICHNIS_COL_AGS, C.SEARCH_GEMEINDEVERZEICHNIS_COL_PLZ, C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME}
        missing = required - set(self.df.columns)
        if missing:
            raise ValueError(f"{C.SEARCH_GEMEINDEVERZEICHNIS_ERR_MISSING_REQUIRED_COLUMNS_PREFIX}{sorted(missing)}")

        # Enforce leading zeros / stable formatting
        self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_AGS] = (
            self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_AGS].astype(str).str.strip().str.zfill(C.SEARCH_GEMEINDEVERZEICHNIS_AGS_LENGTH)
        )
        self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_PLZ] = (
            self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_PLZ].astype(str).str.strip().str.zfill(C.SEARCH_GEMEINDEVERZEICHNIS_PLZ_LENGTH)
        )
        self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME] = self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME].astype(str).str.strip()

        # Precomputed normalized names for faster text search
        self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME_NORM] = self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME].map(normalize_text)

    def search_numeric(self, q: str) -> Optional[SearchResult]:
        """
        Numeric search:
        - AGS (<= 8 digits): prefix/exact, returns first match
        - PLZ (<= 5 digits): prefix/exact, returns first match
        """
        # AGS (8 digits) prefix/exact -> first match
        if len(q) <= C.SEARCH_GEMEINDEVERZEICHNIS_AGS_LENGTH:
            m = self.df[self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_AGS].str.startswith(q, na=False)].head(1)
            for _, r in m.iterrows():
                score = C.SEARCH_GEMEINDEVERZEICHNIS_SCORE_EXACT if len(q) == C.SEARCH_GEMEINDEVERZEICHNIS_AGS_LENGTH else C.SEARCH_GEMEINDEVERZEICHNIS_SCORE_AGS_PREFIX
                return SearchResult(r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_AGS], r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_PLZ], r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME], score, C.SEARCH_GEMEINDEVERZEICHNIS_MATCH_AGS_PREFIX)

        # PLZ (5 digits) prefix/exact -> first match
        if len(q) <= C.SEARCH_GEMEINDEVERZEICHNIS_PLZ_LENGTH:
            m = self.df[self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_PLZ].str.startswith(q, na=False)].head(1)
            for _, r in m.iterrows():
                score = C.SEARCH_GEMEINDEVERZEICHNIS_SCORE_EXACT if len(q) == C.SEARCH_GEMEINDEVERZEICHNIS_PLZ_LENGTH else C.SEARCH_GEMEINDEVERZEICHNIS_SCORE_PLZ_PREFIX
                return SearchResult(r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_AGS], r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_PLZ], r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME], score, C.SEARCH_GEMEINDEVERZEICHNIS_MATCH_PLZ_PREFIX)

        return None

    def search_name(self, q: str) -> list[SearchResult]:
        """
        Name search with staged matching:
        1) startswith
        2) contains
        3) fuzzy (if still below limit)
        """
        limit = C.SEARCH_GEMEINDEVERZEICHNIS_RESULT_LIMIT
        qn = normalize_text(q)
        if not qn:
            return []

        results: list[SearchResult] = []

        # 1) startswith
        sw = self.df[self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME_NORM].str.startswith(qn, na=False)].head(limit)
        for _, r in sw.iterrows():
            results.append(SearchResult(
                r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_AGS],
                r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_PLZ],
                r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME],
                C.SEARCH_GEMEINDEVERZEICHNIS_SCORE_STARTSWITH,
                C.SEARCH_GEMEINDEVERZEICHNIS_MATCH_STARTSWITH
            ))

        # 2) contains
        if len(results) < limit:
            ct = self.df[self.df[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME_NORM].str.contains(qn, na=False)].head(limit * C.SEARCH_GEMEINDEVERZEICHNIS_CONTAINS_MULTIPLIER)
            for _, r in ct.iterrows():
                if len(results) >= limit:
                    break
                if any(x.ags == r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_AGS] for x in results):
                    continue
                results.append(SearchResult(
                    r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_AGS],
                    r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_PLZ],
                    r[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME],
                    C.SEARCH_GEMEINDEVERZEICHNIS_SCORE_CONTAINS,
                    C.SEARCH_GEMEINDEVERZEICHNIS_MATCH_CONTAINS
                ))

        # 3) fuzzy (only if there is room left)
        if len(results) < limit:
            qlen = len(qn)
            pool = self.df

            if qlen >= C.SEARCH_GEMEINDEVERZEICHNIS_FUZZY_MIN_QUERY_LEN:
                pool = pool[pool[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME_NORM].str.len().between(
                    max(1, qlen - C.SEARCH_GEMEINDEVERZEICHNIS_FUZZY_LEN_WINDOW_BEFORE),
                    qlen + C.SEARCH_GEMEINDEVERZEICHNIS_FUZZY_LEN_WINDOW_AFTER
                )]

            pool = pool.copy()
            pool[C.SEARCH_GEMEINDEVERZEICHNIS_TMP_LEN_DIFF_COL] = (pool[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME_NORM].str.len() - qlen).abs()
            pool = pool.sort_values(C.SEARCH_GEMEINDEVERZEICHNIS_TMP_LEN_DIFF_COL).head(C.SEARCH_GEMEINDEVERZEICHNIS_FUZZY_POOL_LIMIT)
            pool = pool.drop(columns=[C.SEARCH_GEMEINDEVERZEICHNIS_TMP_LEN_DIFF_COL])

            scored: list[tuple[int, int]] = []
            for idx, cand in zip(pool.index, pool[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME_NORM]):
                s = fuzzy_score(qn, cand)
                if s >= C.SEARCH_GEMEINDEVERZEICHNIS_FUZZY_MIN_SCORE:
                    scored.append((s, idx))

            scored.sort(key=lambda x: x[0], reverse=True)

            for s, idx in scored:
                if len(results) >= limit:
                    break
                row = self.df.loc[idx]
                if any(x.ags == row[C.SEARCH_GEMEINDEVERZEICHNIS_COL_AGS] for x in results):
                    continue
                results.append(SearchResult(
                    row[C.SEARCH_GEMEINDEVERZEICHNIS_COL_AGS],
                    row[C.SEARCH_GEMEINDEVERZEICHNIS_COL_PLZ],
                    row[C.SEARCH_GEMEINDEVERZEICHNIS_COL_NAME],
                    s,
                    C.SEARCH_GEMEINDEVERZEICHNIS_MATCH_FUZZY
                ))

        results.sort(key=lambda r: (-r.score, r.name))
        return results[:limit]


def print_results(results: list[SearchResult]) -> None:
    if not results:
        logger.info(C.SEARCH_GEMEINDEVERZEICHNIS_MSG_NO_RESULTS)
        return

    for r in results:
        logger.info(C.SEARCH_GEMEINDEVERZEICHNIS_RESULT_FORMAT.format(
            score=r.score,
            match_type=r.match_type,
            ags=r.ags,
            plz=r.plz,
            name=r.name,
        ))
