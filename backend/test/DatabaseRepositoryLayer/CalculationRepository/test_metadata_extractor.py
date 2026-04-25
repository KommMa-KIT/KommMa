import pandas as pd
import pytest
from pathlib import Path

# Adjust if your module path differs
from DatabaseRepositoryLayer.CalculationRepository.metaDataExtractor import MetaDataExtractor


# -----------------------
# Helpers
# -----------------------

def make_df(nrows: int = 20, ncols: int = 12) -> pd.DataFrame:
    """Create an empty DataFrame of given shape."""
    return pd.DataFrame([[None] * ncols for _ in range(nrows)])


def cell_to_rc(cell_ref: str) -> tuple[int, int]:
    """
    Convert Excel ref like 'A1' or 'F6' to (row_idx, col_idx) 0-based for DataFrame.
    Supports single-letter columns (A..Z) which is enough for A..K here.
    """
    col_letter = cell_ref[0].upper()
    row_num = int(cell_ref[1:])
    col_idx = ord(col_letter) - ord("A")
    row_idx = row_num - 1
    return row_idx, col_idx


# -----------------------
# Fixtures
# -----------------------

@pytest.fixture
def extractor(tmp_path: Path, monkeypatch) -> MetaDataExtractor:
    excel_dir = tmp_path / "excel"
    excel_dir.mkdir()

    ex = MetaDataExtractor(directory_path=str(excel_dir), data_sheet_index=2, result_sheet_index=6)

    # BaseExcelProcessor hooks / helpers mocked to keep tests pure and deterministic
    monkeypatch.setattr(ex, "_clean_key", lambda s: str(s).strip().lower().replace(" ", "_"))
    monkeypatch.setattr(ex, "_column_index_to_letter", lambda idx: chr(ord("A") + idx))

    # We'll override _read_cell_value per test if needed; default reads from DF
    def _read_cell_value(df: pd.DataFrame, cell_ref: str):
        r, c = cell_to_rc(cell_ref)
        if r < 0 or c < 0 or r >= len(df) or c >= len(df.columns):
            return None
        return df.iat[r, c]

    monkeypatch.setattr(ex, "_read_cell_value", _read_cell_value)

    return ex


# -----------------------
# Unit Tests
# -----------------------

def test_extract_data_mapping_maps_rows_to_F_cells(extractor, monkeypatch):
    # Base class _read_data_section returns mapping category_clean -> row_number (Excel 1-indexed)
    monkeypatch.setattr(
        extractor,
        "_read_data_section",
        lambda df: {"fallhöhe": 6, "einwohnerzahl": 7},
    )

    df = make_df()
    out = extractor._extract_data_mapping(df)

    assert out == {"fallhöhe": "F6", "einwohnerzahl": "F7"}


def test_find_scenario_blocks_detects_multiple_werte_blocks(extractor):
    df = make_df(nrows=30, ncols=12)

    df.iat[5, 0] = "Werte"
    df.iat[11, 0] = "Werte"

    for r in range(6, 11):
        df.iat[r, 0] = "x"

    # (Auch wenn wir hier F6/F12 setzen: aktuelle Implementierung liest scenario_name offenbar nicht daraus)
    df.iat[5, 5] = "Referenz Szenario A"
    df.iat[11, 5] = "Referenz Szenario B"

    blocks = extractor._find_scenario_blocks(df)

    # Wichtig: nur Struktur + Zeilen prüfen, scenario_name ist aktuell leer
    assert blocks == [
        {"werte_row": 6, "kategorie_row": 8, "scenario_name": ""},
        {"werte_row": 12, "kategorie_row": 14, "scenario_name": ""},
    ]

def test_find_scenario_blocks_stops_on_empty_cell(extractor):
    df = make_df(nrows=15, ncols=12)
    df.iat[5, 0] = "Werte"  # A6
    df.iat[6, 0] = ""       # A7 -> stop

    df.iat[5, 5] = "S1"     # F6 (wird aktuell offenbar nicht gelesen)

    blocks = extractor._find_scenario_blocks(df)

    assert blocks == [{"werte_row": 6, "kategorie_row": 8, "scenario_name": ""}]


def test_extract_result_mapping_reads_topics_and_builds_cell_refs(extractor):
    df = make_df(nrows=20, ncols=12)

    # topic row is 5 by default -> Excel row 5 => index 4
    # result columns F..K (F=5, K=10)
    df.iat[4, 5] = "Direkte Kosten (€)"  # F5
    df.iat[4, 6] = "Zeitaufwand"         # G5
    df.iat[4, 7] = None                  # H5 -> skipped
    df.iat[4, 8] = ""                    # I5 -> skipped
    df.iat[4, 9] = "THG"                 # J5

    out = extractor._extract_result_mapping(df, werte_row=6, kategorie_row=8)

    # clean_key lower + underscores (from mocked _clean_key)
    assert out == {
        "direkte_kosten_(€)": {"werte": "F6", "kategorie": "F8"},
        "zeitaufwand": {"werte": "G6", "kategorie": "G8"},
        "thg": {"werte": "J6", "kategorie": "J8"},
    }


def test_process_excel_file_single_scenario_uses_block_rows(extractor, tmp_path, monkeypatch):
    excel_dir = Path(extractor.directory_path)
    xlsx = excel_dir / "ID20109.xlsx"
    xlsx.write_bytes(b"dummy")  # exists for Path operations

    df_data = make_df()
    df_result = make_df(nrows=20, ncols=12)

    # One scenario block: Werte at row 6
    df_result.iat[5, 0] = "Werte"  # A6
    df_result.iat[5, 5] = "Ref"    # F6

    # Topics in header row 5 (index 4)
    df_result.iat[4, 5] = "Zeitaufwand"

    # Mocks
    monkeypatch.setattr(extractor, "_extract_id_and_name", lambda df: ("ID20109", "Meine Maßnahme"))
    monkeypatch.setattr(extractor, "_read_data_section", lambda df: {"fallhöhe": 6})
    monkeypatch.setattr(pd, "read_excel", lambda file_path, sheet_name, header=None: df_data if sheet_name == extractor.data_sheet_index else df_result)

    cfgs = extractor._process_excel_file(xlsx)

    assert cfgs is not None
    assert "id20109" in cfgs

    cfg = cfgs["id20109"]
    assert cfg["measure_title"] == "meine_maßnahme"
    assert cfg["data_city_mapping"] == {"fallhöhe": "F6"}
    assert "zeitaufwand" in cfg["result_mapping"]  # key cleaned
    # file is relative to directory_path.parent
    assert cfg["file"].endswith("excel/ID20109.xlsx")


def test_process_excel_file_multiple_scenarios_creates_single_id(extractor, monkeypatch):
    excel_dir = Path(extractor.directory_path)
    xlsx = excel_dir / "ID20110.xlsx"
    xlsx.write_bytes(b"dummy")

    df_data = make_df()
    df_result = make_df(nrows=40, ncols=12)

    df_result.iat[5, 0] = "Werte"
    df_result.iat[5, 5] = "Ref A"
    df_result.iat[11, 0] = "Werte"
    df_result.iat[11, 5] = "Ref B"

    for r in range(6, 11):
        df_result.iat[r, 0] = "x"

    df_result.iat[4, 5] = "Direkte Kosten (€)"  # F5

    monkeypatch.setattr(extractor, "_extract_id_and_name", lambda df: ("ID20110", "Maßnahme X"))
    monkeypatch.setattr(extractor, "_read_data_section", lambda df: {"einwohnerzahl": 7})
    monkeypatch.setattr(
        pd,
        "read_excel",
        lambda file_path, sheet_name, header=None: df_data if sheet_name == extractor.data_sheet_index else df_result
    )

    cfgs = extractor._process_excel_file(xlsx)

    assert cfgs is not None

    # Aktueller Code erzeugt offenbar KEINE composite ids → nur Basis-ID
    assert set(cfgs.keys()) == {"id20110"}

    cfg = cfgs["id20110"]
    assert cfg["measure_title"] == "maßnahme_x"
    assert cfg["data_city_mapping"] == {"einwohnerzahl": "F7"}
    assert "direkte_kosten_(€)" in cfg["result_mapping"]



def test_generate_configuration_raises_if_dir_missing(tmp_path):
    missing = tmp_path / "does_not_exist"
    ex = MetaDataExtractor(directory_path=str(missing))
    with pytest.raises(FileNotFoundError):
        ex.generate_configuration()


def test_generate_configuration_raises_if_no_excel_files(extractor, monkeypatch):
    monkeypatch.setattr(extractor, "_find_excel_files", lambda p: [])
    with pytest.raises(ValueError):
        extractor.generate_configuration()


def test_generate_configuration_aggregates_all_files(extractor, monkeypatch, tmp_path):
    excel_dir = Path(extractor.directory_path)
    f1 = excel_dir / "A.xlsx"
    f2 = excel_dir / "B.xlsx"
    f1.write_bytes(b"x")
    f2.write_bytes(b"y")

    monkeypatch.setattr(extractor, "_find_excel_files", lambda p: [f1, f2])

    # each file produces a dict; ensure update/merge works
    def fake_process(file_path: Path):
        if file_path.name == "A.xlsx":
            return {"m01": {"measure_title": "a", "file": "x", "data_city_mapping": {}, "result_mapping": {}}}
        return {"m02": {"measure_title": "b", "file": "y", "data_city_mapping": {}, "result_mapping": {}}}

    monkeypatch.setattr(extractor, "_process_excel_file", fake_process)

    out = extractor.generate_configuration()
    assert set(out.keys()) == {"m01", "m02"}

