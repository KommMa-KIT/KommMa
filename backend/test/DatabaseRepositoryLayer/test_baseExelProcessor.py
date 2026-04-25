from pathlib import Path

import pandas as pd
import pytest

from DatabaseRepositoryLayer.baseExcelProcessor import BaseExcelProcessor


def make_df(nrows=20, ncols=10):
    # DataFrame with None values
    return pd.DataFrame([[None] * ncols for _ in range(nrows)])


@pytest.fixture
def proc():
    return BaseExcelProcessor(data_sheet_index=2)


# ---------------------------
# _read_cell_value
# ---------------------------

def test_read_cell_value_reads_correct_cell(proc):
    df = make_df()
    # B2 => row 1, col 1
    df.iat[1, 1] = "hello"
    assert proc._read_cell_value(df, "B2") == "hello"

    # F6 => row 5, col 5
    df.iat[5, 5] = 123
    assert proc._read_cell_value(df, "F6") == 123


def test_read_cell_value_out_of_bounds_returns_none(proc):
    df = make_df(nrows=3, ncols=3)
    assert proc._read_cell_value(df, "Z99") is None
    assert proc._read_cell_value(df, "B100") is None


# ---------------------------
# _column_index_to_letter
# ---------------------------

@pytest.mark.parametrize(
    "idx, expected",
    [
        (0, "A"),
        (1, "B"),
        (25, "Z"),
        (26, "AA"),
        (27, "AB"),
        (51, "AZ"),
        (52, "BA"),
    ],
)
def test_column_index_to_letter(proc, idx, expected):
    assert proc._column_index_to_letter(idx) == expected


# ---------------------------
# _clean_key
# ---------------------------

@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Kommunaler Haushalt", "kommunaler_haushalt"),
        ("  Fallhöhe  ", "fallhöhe"),
        ("THG-Einsparung", "thg_einsparung"),
        ("A - B", "a___b"),  # spaces + hyphen => underscores; (genau wie implementiert)
    ],
)
def test_clean_key(proc, raw, expected):
    assert proc._clean_key(raw) == expected


# ---------------------------
# _read_data_section
# ---------------------------

def test_read_data_section_reads_until_empty(proc):
    df = make_df(nrows=20, ncols=10)

    # Column B has categories starting at Excel row 6 (index 5)
    # B6, B7, B8 then stop at B9 empty
    df.iat[5, 1] = "Einwohnerzahl"
    df.iat[6, 1] = "Fallhöhe"
    df.iat[7, 1] = "Kommunaler Haushalt"
    df.iat[8, 1] = None  # stop

    out = proc._read_data_section(df)

    assert out == {
        "einwohnerzahl": 6,
        "fallhöhe": 7,
        "kommunaler_haushalt": 8,
    }


def test_read_data_section_stops_on_blank_string(proc):
    df = make_df(nrows=20, ncols=10)
    df.iat[5, 1] = "A"
    df.iat[6, 1] = "   "   # should stop here
    df.iat[7, 1] = "B"     # should not be read

    out = proc._read_data_section(df)
    assert out == {"a": 6}


# ---------------------------
# _extract_id_and_name
# ---------------------------

def test_extract_id_and_name_reads_B2_B3(proc):
    df = make_df()
    df.iat[1, 1] = "  ID20110  "   # B2
    df.iat[2, 1] = "  Maßnahme X " # B3

    id_, name = proc._extract_id_and_name(df)
    assert id_ == "ID20110"
    assert name == "Maßnahme X"


def test_extract_id_and_name_returns_none_if_missing(proc):
    df = make_df()
    df.iat[1, 1] = None
    df.iat[2, 1] = "Name"
    assert proc._extract_id_and_name(df) == (None, None)

    df = make_df()
    df.iat[1, 1] = "ID"
    df.iat[2, 1] = None
    assert proc._extract_id_and_name(df) == (None, None)


# ---------------------------
# _find_excel_files
# ---------------------------

def test_find_excel_files_filters_temp_files(proc, tmp_path: Path):
    (tmp_path / "A.xlsx").write_bytes(b"x")
    (tmp_path / "B.xlsx").write_bytes(b"x")
    (tmp_path / "~$lock.xlsx").write_bytes(b"x")
    (tmp_path / "not_excel.txt").write_text("no")

    files = proc._find_excel_files(tmp_path)
    names = sorted([p.name for p in files])

    assert names == ["A.xlsx", "B.xlsx"]
