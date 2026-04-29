import pandas as pd
import pytest
from unittest.mock import patch

from DatabaseRepositoryLayer.multiSheetInfoExtractor import MultiSheetInfoExtractor


# --------------------------------------------------
# Helper DataFrames
# --------------------------------------------------

def make_df(row_dict):
    return pd.DataFrame([row_dict])


# --------------------------------------------------
# _extract_entity_from_sheet
# --------------------------------------------------

def test_extract_entity_from_sheet_strips_prefix():
    extractor = MultiSheetInfoExtractor("dummy.xlsx", id_prefix_length=2)

    df = make_df({"name": "Measure A", "value": 100})
    entity = extractor._extract_entity_from_sheet("M_20106", df)

    assert entity["id"] == "20106"
    assert entity["name"] == "Measure A"
    assert entity["value"] == 100


def test_extract_entity_from_sheet_no_prefix_if_short():
    extractor = MultiSheetInfoExtractor("dummy.xlsx", id_prefix_length=10)

    df = make_df({"a": 1})
    entity = extractor._extract_entity_from_sheet("X1", df)

    assert entity["id"] == "x1"


# --------------------------------------------------
# _process_all_sheets
# --------------------------------------------------

@patch("pandas.read_excel")
def test_process_all_sheets_reads_all_non_empty(mock_read_excel):
    mock_read_excel.return_value = {
        "M_100": make_df({"name": "A"}),
        "M_200": make_df({"name": "B"}),
    }

    extractor = MultiSheetInfoExtractor("dummy.xlsx", id_prefix_length=2)

    result = extractor.get_all()

    assert len(result) == 2
    assert result[0]["id"] == "100"
    assert result[1]["id"] == "200"


@patch("pandas.read_excel")
def test_process_skips_empty_sheets(mock_read_excel):
    mock_read_excel.return_value = {
        "M_100": make_df({"name": "A"}),
        "EMPTY": pd.DataFrame(),  # empty sheet
    }

    extractor = MultiSheetInfoExtractor("dummy.xlsx", id_prefix_length=2)

    result = extractor.get_all()

    assert len(result) == 1
    assert result[0]["id"] == "100"


@patch("pandas.read_excel")
def test_sheet_start_index_skips_first_sheets(mock_read_excel):
    mock_read_excel.return_value = {
        "Legend": make_df({"a": 1}),
        "M_100": make_df({"name": "A"}),
        "M_200": make_df({"name": "B"}),
    }

    extractor = MultiSheetInfoExtractor(
        "dummy.xlsx",
        id_prefix_length=2,
        sheet_start_index=1
    )

    result = extractor.get_all()

    assert len(result) == 2
    assert result[0]["id"] == "100"


# --------------------------------------------------
# Error Handling
# --------------------------------------------------

@patch("pandas.read_excel", side_effect=FileNotFoundError)
def test_file_not_found(mock_read_excel):
    extractor = MultiSheetInfoExtractor("missing.xlsx")

    with pytest.raises(FileNotFoundError):
        extractor.get_all()


@patch("pandas.read_excel", side_effect=Exception("Corrupt file"))
def test_other_read_errors_raise_value_error(mock_read_excel):
    extractor = MultiSheetInfoExtractor("broken.xlsx")

    with pytest.raises(ValueError):
        extractor.get_all()
