import pandas as pd
import pytest

from DatabaseRepositoryLayer.MeasureRepository.MeasureRepository import MeasuresInformationExtractor


def test_get_all_measures_skips_first_sheet_and_maps_fields(monkeypatch):
    # 1) Fake workbook: sheet_name=None -> dict of DataFrames
    legend_df = pd.DataFrame([{"foo": "bar"}])  # wird ignoriert

    sheet_df = pd.DataFrame([{
        "titel": "Maßnahme X",
        "socialAcceptance": "high",
        "socialAcceptanceComment": "nice",
        "shortDescription": "short",
        "description": "long",
        "relevantParameters": "A01, A02 ,A03",
        "furtherInfo": "link1, link2",
        "imageURL": "http://img",
        "someUnmappedField": 123,
    }])

    fake_book = {
        "Legend": legend_df,
        "M_20106": sheet_df,   # <- ID prefix "M_" wird abgeschnitten
    }

    def fake_read_excel(path, sheet_name=None):
        assert sheet_name is None
        return fake_book

    monkeypatch.setattr(pd, "read_excel", fake_read_excel)

    ex = MeasuresInformationExtractor(file_path="dummy.xlsx")
    out = ex.get_all_measures()

    assert len(out) == 1
    m = out[0]

    # 2) ID richtig
    assert m["id"] == "20106"

    # 3) Mapping richtig
    assert m["popularity"] == "high"
    assert m["popularityComment"] == "nice"
    assert m["titel"] == "Maßnahme X"

    # 4) CSV -> List
    assert m["relevantParameters"] == ["A01", "A02", "A03"]
    assert m["furtherInfo"] == ["link1", "link2"]

    # 5) Unmapped Feld bleibt erhalten
    assert m["someUnmappedField"] == 123


def test_extract_entity_handles_no_prefix_sheet_name(monkeypatch):
    # Wenn sheetname kürzer als prefix ist, wird komplett genommen
    # (bei dir: else sheet_name)
    df = pd.DataFrame([{"titel": "X"}])
    fake_book = {"Legend": pd.DataFrame([{"x": 1}]), "A": df}  # sheetname length 1

    monkeypatch.setattr(pd, "read_excel", lambda *args, **kwargs: fake_book)

    ex = MeasuresInformationExtractor(file_path="dummy.xlsx")
    out = ex.get_all_measures()

    assert out[0]["id"] == "A"


def test_relevant_parameters_empty_string_becomes_empty_list(monkeypatch):
    df = pd.DataFrame([{"relevantParameters": "   ", "furtherInfo": ""}])
    fake_book = {"Legend": pd.DataFrame([{"x": 1}]), "M_1": df}

    monkeypatch.setattr(pd, "read_excel", lambda *args, **kwargs: fake_book)

    ex = MeasuresInformationExtractor(file_path="dummy.xlsx")
    out = ex.get_all_measures()

    assert out[0]["relevantParameters"] == []
    assert out[0]["furtherInfo"] == []
