from pathlib import Path
import pandas as pd
import pytest

import externalAPI.ParserHelper.Search_Gemeindeverzeichnis as M


@pytest.fixture(autouse=True)
def patch_constants(monkeypatch):
    C = M.C

    # normalize_text constants
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_UNICODE_NORMAL_FORM", "NFKD", raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_NON_ALNUM_WHITESPACE_REGEX", r"[^0-9a-z\s]+", raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_MULTISPACE_REGEX", r"\s+", raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_REPLACE_WITH_SPACE", " ", raising=False)

    # CSV columns + formatting
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_COL_AGS", "AGS", raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_COL_PLZ", "PLZ", raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_COL_NAME", "NAME", raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_COL_NAME_NORM", "NAME_NORM", raising=False)

    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_AGS_LENGTH", 8, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_PLZ_LENGTH", 5, raising=False)

    # error prefixes
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_ERR_CSV_NOT_FOUND_PREFIX", "CSV not found: ", raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_ERR_MISSING_REQUIRED_COLUMNS_PREFIX", "Missing cols: ", raising=False)

    # search scoring + strings
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_SCORE_EXACT", 100, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_SCORE_AGS_PREFIX", 90, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_SCORE_PLZ_PREFIX", 80, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_MATCH_AGS_PREFIX", "ags_prefix", raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_MATCH_PLZ_PREFIX", "plz_prefix", raising=False)

    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_RESULT_LIMIT", 3, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_SCORE_STARTSWITH", 95, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_SCORE_CONTAINS", 70, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_MATCH_STARTSWITH", "startswith", raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_MATCH_CONTAINS", "contains", raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_MATCH_FUZZY", "fuzzy", raising=False)

    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_CONTAINS_MULTIPLIER", 3, raising=False)

    # fuzzy params
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_FUZZY_MIN_QUERY_LEN", 3, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_FUZZY_LEN_WINDOW_BEFORE", 2, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_FUZZY_LEN_WINDOW_AFTER", 4, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_FUZZY_POOL_LIMIT", 20, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_FUZZY_MIN_SCORE", 60, raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_TMP_LEN_DIFF_COL", "_len_diff", raising=False)

    # CSV read defaults
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_CSV_SEP", ";", raising=False)
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_CSV_ENCODING", "utf-8", raising=False)

    # print_results strings
    monkeypatch.setattr(C, "SEARCH_GEMEINDEVERZEICHNIS_MSG_NO_RESULTS", "no results", raising=False)
    monkeypatch.setattr(
        C,
        "SEARCH_GEMEINDEVERZEICHNIS_RESULT_FORMAT",
        "{score} {match_type} {ags} {plz} {name}",
        raising=False,
    )


@pytest.fixture
def sample_csv(tmp_path) -> Path:
    # include non-normalized PLZ and AGS to test zfill
    df = pd.DataFrame(
        [
            {"AGS": "812000", "PLZ": "7613", "NAME": "Karlsruhe"},
            {"AGS": "12345678", "PLZ": "10115", "NAME": "Berlin"},
            {"AGS": "00000001", "PLZ": "01069", "NAME": "Dresden Altstadt"},
        ]
    )
    p = tmp_path / "gv.csv"
    df.to_csv(p, sep=";", index=False, encoding="utf-8")
    return p


# -----------------------------
# normalize_text + fuzzy_score
# -----------------------------
def test_normalize_text_umlauts_and_spaces():
    assert M.normalize_text("  München!!  Alt-Stadt ") == "munchen alt stadt"


def test_fuzzy_score_empty_returns_0(monkeypatch):
    # make sure fallback is deterministic
    monkeypatch.setattr(M, "HAS_RAPIDFUZZ", False, raising=False)
    assert M.fuzzy_score("", "abc") == 0
    assert M.fuzzy_score("abc", "") == 0


# -----------------------------
# __init__
# -----------------------------
def test_init_file_not_found(tmp_path):
    with pytest.raises(FileNotFoundError):
        M.Search_Gemeindeverzeichnis(tmp_path / "missing.csv")


def test_init_missing_columns(tmp_path):
    p = tmp_path / "bad.csv"
    pd.DataFrame([{"AGS": "1"}]).to_csv(p, sep=";", index=False, encoding="utf-8")
    with pytest.raises(ValueError) as e:
        M.Search_Gemeindeverzeichnis(p)
    assert "Missing cols" in str(e.value)


def test_init_creates_norm_and_zfills(sample_csv):
    s = M.Search_Gemeindeverzeichnis(sample_csv)
    assert "NAME_NORM" in s.df.columns

    # zfill check
    assert s.df.loc[0, "AGS"] == "00812000"
    assert s.df.loc[0, "PLZ"] == "07613"
    assert s.df.loc[0, "NAME_NORM"] == "karlsruhe"


# -----------------------------
# search_numeric
# -----------------------------
def test_search_numeric_ags_prefix(sample_csv):
    s = M.Search_Gemeindeverzeichnis(sample_csv)
    r = s.search_numeric("0081")
    assert r is not None
    assert r.match_type == "ags_prefix"
    assert r.ags == "00812000"
    assert r.score == 90


def test_search_numeric_ags_exact(sample_csv):
    s = M.Search_Gemeindeverzeichnis(sample_csv)
    r = s.search_numeric("00812000")
    assert r is not None
    assert r.score == 100


def test_search_numeric_plz_prefix(sample_csv):
    s = M.Search_Gemeindeverzeichnis(sample_csv)
    r = s.search_numeric("101")
    assert r is not None
    assert r.match_type == "plz_prefix"
    assert r.plz == "10115"
    assert r.score == 80


def test_search_numeric_plz_exact(sample_csv):
    s = M.Search_Gemeindeverzeichnis(sample_csv)
    r = s.search_numeric("10115")
    assert r is not None
    assert r.score == 100


def test_search_numeric_no_match(sample_csv):
    s = M.Search_Gemeindeverzeichnis(sample_csv)
    assert s.search_numeric("99999") is None


# -----------------------------
# search_name
# -----------------------------
def test_search_name_empty_returns_empty(sample_csv):
    s = M.Search_Gemeindeverzeichnis(sample_csv)
    assert s.search_name("   ") == []


def test_search_name_startswith(sample_csv):
    s = M.Search_Gemeindeverzeichnis(sample_csv)
    res = s.search_name("Kar")
    assert res[0].name == "Karlsruhe"
    assert res[0].match_type == "startswith"
    assert res[0].score == 95


def test_search_name_contains(sample_csv):
    s = M.Search_Gemeindeverzeichnis(sample_csv)
    res = s.search_name("alt")
    # "Dresden Altstadt" should match contains
    assert any(r.name == "Dresden Altstadt" for r in res)


def test_search_name_fuzzy_adds_when_room_left(sample_csv, monkeypatch):
    # Force fuzzy part deterministically:
    # return 80 only for berlin, low for others
    monkeypatch.setattr(M, "HAS_RAPIDFUZZ", False, raising=False)

    def fake_fuzzy(q, cand):
        return 80 if "berlin" in cand else 0

    monkeypatch.setattr(M, "fuzzy_score", fake_fuzzy)

    s = M.Search_Gemeindeverzeichnis(sample_csv)

    # query doesn't startswith/contain "berlin", but fuzzy should catch
    res = s.search_name("brlin")
    assert any(r.name == "Berlin" and r.match_type == "fuzzy" for r in res)


# -----------------------------
# print_results
# -----------------------------
def test_print_results_no_results_logs(caplog):
    caplog.clear()
    with caplog.at_level("INFO"):
        M.print_results([])
    assert any("no results" in rec.message for rec in caplog.records)


def test_print_results_logs_results(caplog, sample_csv):
    s = M.Search_Gemeindeverzeichnis(sample_csv)
    res = s.search_name("Kar")

    caplog.clear()
    with caplog.at_level("INFO"):
        M.print_results(res)

    assert any("Karlsruhe" in rec.message for rec in caplog.records)