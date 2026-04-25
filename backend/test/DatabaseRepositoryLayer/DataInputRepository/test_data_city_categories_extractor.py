import pandas as pd
import pytest
from pathlib import Path

from DatabaseRepositoryLayer.DataInputRepository.dataInputExtractor import DataCityCategoriesExtractor



# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

def raw_with_header_at(idx: int, header_cols: list[str], data_rows: list[dict]):
    """
    Build df_raw (header=None) and df (header=idx) pair.

    df_raw: rows 0..idx-1 junk, row idx contains header values somewhere
    df:     pandas-style     dataframe with columns = header_cols and data_rows
    """
    # df_raw: create a table with enough cols so header marker can exist
    ncols = max(10, len(header_cols))
    nrows = idx + 1 + max(1, len(data_rows))
    df_raw = pd.DataFrame([[None] * ncols for _ in range(nrows)])

    # Put "Themenbereich" marker in header row
    df_raw.iat[idx, 0] = "Themenbereich"
    # Put a few other header names too (not required, but realistic)
    df_raw.iat[idx, 1] = "Datenkategorie"
    df_raw.iat[idx, 2] = "Input Type"
    df_raw.iat[idx, 3] = "Einheit"
    df_raw.iat[idx, 4] = "Selectable"
    df_raw.iat[idx, 5] = "Mandatory"
    df_raw.iat[idx, 6] = "Description"
    df_raw.iat[idx, 7] = "Subinput von"

    df = pd.DataFrame(data_rows, columns=header_cols)
    return df_raw, df


# ------------------------------------------------------------
# Basic helpers
# ------------------------------------------------------------

def test_clean_key_camel_case():
    ex = DataCityCategoriesExtractor(directory_path=".")
    assert ex._clean_key("Kommunaler Haushalt") == "kommunalerHaushalt"
    assert ex._clean_key("foo_bar-baz") == "fooBarBaz"
    assert ex._clean_key("  ") == ""


def test_parse_selectable():
    ex = DataCityCategoriesExtractor(directory_path=".")
    assert ex._parse_selectable("A, B,  C") == ["A", "B", "C"]
    assert ex._parse_selectable("") == []
    assert ex._parse_selectable(None) == []


@pytest.mark.parametrize(
    "input_type, selectable, expected",
    [
        (None, "", "number"),
        ("number", "", "number"),
        ("bool", "", "bool"),
        ("multi", "A,B", "multiSelection"),
        ("multi selection", "A,B", "multiSelection"),
        ("number", "A,B", "selection"),
    ],
)
def test_determine_input_type(input_type, selectable, expected):
    ex = DataCityCategoriesExtractor(directory_path=".")
    assert ex._determine_input_type(input_type, selectable) == expected


# ------------------------------------------------------------
# _build_input_object
# ------------------------------------------------------------

def test_build_input_object_number_with_unit_and_mandatory():
    ex = DataCityCategoriesExtractor(directory_path=".")
    row = pd.Series(
        {
            "Datenkategorie": "Einwohnerzahl",
            "Input Type": "number",
            "Einheit": "E",
            "Description": "desc",
            "Mandatory": True,
            "Selectable": "",
        }
    )
    obj = ex._build_input_object(row, selectable_options={})

    assert obj["id"] == "einwohnerzahl"
    assert obj["title"] == "Einwohnerzahl"
    assert obj["type"] == "number"
    assert obj["unit"] == "E"
    assert obj["description"] == "desc"
    assert obj["critical"] is True
    assert obj["subinputs"] == []


def test_build_input_object_selection_uses_selectable_map():
    ex = DataCityCategoriesExtractor(directory_path=".")
    row = pd.Series(
        {
            "Datenkategorie": "Energieträger",
            "Input Type": "text",
            "Selectable": "ENERGY_SET",
            "Mandatory": False,
        }
    )
    obj = ex._build_input_object(row, selectable_options={"ENERGY_SET": ["Gas", "Strom"]})

    assert obj["type"] == "selection"
    assert obj["selectable"] == ["Gas", "Strom"]
    assert "unit" not in obj  # selection should not have unit


def test_build_input_object_selection_parses_inline_if_missing_key():
    ex = DataCityCategoriesExtractor(directory_path=".")
    row = pd.Series(
        {
            "Datenkategorie": "Foo",
            "Input Type": "text",
            "Selectable": "A, B",
        }
    )
    obj = ex._build_input_object(row, selectable_options={})

    assert obj["type"] == "selection"
    assert obj["selectable"] == ["A", "B"]


# ------------------------------------------------------------
# _extract_categories_from_file
# ------------------------------------------------------------

def test_extract_categories_from_file_groups_by_theme_and_resolves_subinputs(monkeypatch, tmp_path):
    ex = DataCityCategoriesExtractor(directory_path=str(tmp_path), sheet_index=2)

    header_cols = [
        "Themenbereich",
        "Datenkategorie",
        "Input Type",
        "Einheit",
        "Selectable",
        "Mandatory",
        "Description",
        "Subinput von",
    ]

    # parent + child
    data_rows = [
        {
            "Themenbereich": "Wasser",
            "Datenkategorie": "Kommunaler Haushalt",
            "Input Type": "number",
            "Einheit": "E",
            "Selectable": "",
            "Mandatory": True,
            "Description": "parent",
            "Subinput von": "",
        },
        {
            "Themenbereich": "Wasser",
            "Datenkategorie": "Abwassermenge",
            "Input Type": "number",
            "Einheit": "m3/a",
            "Selectable": "",
            "Mandatory": False,
            "Description": "child",
            "Subinput von": "Kommunaler Haushalt",
        },
    ]

    df_raw, df = raw_with_header_at(idx=3, header_cols=header_cols, data_rows=data_rows)

   
    # ensure df_raw has at least 21 rows (index 0..20)
    if len(df_raw) <= 20:
        df_raw = pd.concat(
            [df_raw, pd.DataFrame([[None] * df_raw.shape[1]] * (21 - len(df_raw)))],
            ignore_index=True,
        )
    # also embed selectable options in df_raw (key/value style):
    # your extractor searches for 'Selectable' in first column string
    df_raw.iat[20, 0] = "Selectable ENERGY_SET"
    df_raw.iat[20, 1] = "Strom, Gas, Öl"


    file = tmp_path / "X.xlsx"
    file.write_bytes(b"dummy")

    def fake_read_excel(file_path, sheet_name, header=None):
        # first read is header=None => df_raw
        if header is None:
            return df_raw
        # second read uses header_row_idx => df
        return df

    monkeypatch.setattr(pd, "read_excel", fake_read_excel)

    out = ex._extract_categories_from_file(file)

    assert "Wasser" in out
    assert len(out["Wasser"]) == 1  # only parent at top-level
    parent = out["Wasser"][0]
    assert parent["id"] == "kommunalerHaushalt"
    assert parent["critical"] is True
    assert len(parent["subinputs"]) == 1
    assert parent["subinputs"][0]["id"] == "abwassermenge"
    assert "subinputs" not in parent["subinputs"][0]  # removed for subinput


def test_extract_categories_from_file_skips_if_header_missing(monkeypatch, tmp_path):
    ex = DataCityCategoriesExtractor(directory_path=str(tmp_path), sheet_index=2)

    df_raw = pd.DataFrame([[None, None], [None, None]])  # no 'Themenbereich'
    file = tmp_path / "X.xlsx"
    file.write_bytes(b"dummy")

    monkeypatch.setattr(pd, "read_excel", lambda *args, **kwargs: df_raw)

    out = ex._extract_categories_from_file(file)
    assert out == {}


def test_extract_categories_from_file_returns_empty_on_missing_sheet_index(monkeypatch, tmp_path):
    ex = DataCityCategoriesExtractor(directory_path=str(tmp_path), sheet_index=99)
    file = tmp_path / "X.xlsx"
    file.write_bytes(b"dummy")

    def raise_index(*args, **kwargs):
        raise IndexError("sheet index out of range")

    monkeypatch.setattr(pd, "read_excel", raise_index)
    assert ex._extract_categories_from_file(file) == {}


# ------------------------------------------------------------
# _merge_categories
# ------------------------------------------------------------

def test_merge_categories_deduplicates_by_id_and_sorts():
    ex = DataCityCategoriesExtractor(directory_path=".")

    all_cats = [
        {"Wasser": [{"id": "b"}, {"id": "a"}]},
        {"Wasser": [{"id": "a"}, {"id": "c"}]},  # "a" duplicate -> ignored
        {"Energie": [{"id": "x"}]},
    ]

    merged = ex._merge_categories(all_cats)

    assert list(map(lambda d: d["id"], merged["Wasser"])) == ["a", "b", "c"]
    assert merged["Energie"][0]["id"] == "x"


# ------------------------------------------------------------
# _extract_categories_from_all_files
# ------------------------------------------------------------

def test_extract_categories_from_all_files_filters_temp_files_and_merges(monkeypatch, tmp_path):
    ex = DataCityCategoriesExtractor(directory_path=str(tmp_path), sheet_index=2)

    # create fake xlsx files
    f1 = tmp_path / "A.xlsx"
    f2 = tmp_path / "~$temp.xlsx"
    sub = tmp_path / "sub"
    sub.mkdir()
    f3 = sub / "B.xlsx"
    for f in (f1, f2, f3):
        f.write_bytes(b"dummy")

    # avoid running the real _extract_categories_from_file
    def fake_extract(file_path):
        if file_path.name == "A.xlsx":
            return {"Wasser": [{"id": "a"}]}
        if file_path.name == "B.xlsx":
            return {"Wasser": [{"id": "b"}]}
        return {}

    monkeypatch.setattr(ex, "_extract_categories_from_file", fake_extract)

    merged = ex._extract_categories_from_all_files()

    assert "Wasser" in merged
    assert [x["id"] for x in merged["Wasser"]] == ["a", "b"]


def test_extract_categories_from_all_files_raises_if_dir_missing(tmp_path):
    missing = tmp_path / "does_not_exist"
    ex = DataCityCategoriesExtractor(directory_path=str(missing))
    with pytest.raises(FileNotFoundError):
        ex._extract_categories_from_all_files()


def test_extract_categories_from_all_files_raises_if_no_xlsx(monkeypatch, tmp_path):
    ex = DataCityCategoriesExtractor(directory_path=str(tmp_path))
    # directory exists but no xlsx files
    with pytest.raises(ValueError):
        ex._extract_categories_from_all_files()


def test_get_input_parameters_delegates(monkeypatch):
    ex = DataCityCategoriesExtractor(directory_path=".")
    monkeypatch.setattr(ex, "_extract_categories_from_all_files", lambda: {"Wasser": []})
    assert ex.get_input_parameters() == {"Wasser": []}
