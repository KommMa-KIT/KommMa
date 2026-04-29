import pandas as pd
import pytest
from pathlib import Path

from DatabaseRepositoryLayer.ReferenceCommuneRepository.referenceCommuneRepository import (
    ReferenceCommuneRepository,
)


# ============================================================
# Constructor / Init
# ============================================================

def test_init_raises_if_commune_dir_missing(tmp_path):
    missing = tmp_path / "does_not_exist"
    with pytest.raises(FileNotFoundError):
        ReferenceCommuneRepository(commune_directory=str(missing))


def test_init_allows_empty_commune_directory():
    repo = ReferenceCommuneRepository(commune_directory="")
    assert repo.commune_directory is None


# ============================================================
# _convert_to_camel_case
# ============================================================

def test_convert_to_camel_case_simple():
    repo = ReferenceCommuneRepository(commune_directory="")
    assert repo._convert_to_camel_case("kommunaler_haushalt") == "kommunalerHaushalt"
    assert repo._convert_to_camel_case("einwohnerzahl") == "einwohnerzahl"


def test_convert_to_camel_case_with_parentheses():
    repo = ReferenceCommuneRepository(commune_directory="")
    s = "durchschnittliche_abwassermenge_(ohne_regenwasser)"
    assert repo._convert_to_camel_case(s) == "durchschnittlicheAbwassermenge(ohneRegenwasser)"


# ============================================================
# load_all_communes
# ============================================================

def test_load_all_communes_lists_sorted(tmp_path):
    (tmp_path / "Wiesenhall").mkdir()
    (tmp_path / "Sonnenburg").mkdir()
    (tmp_path / "not_a_dir.txt").write_text("x")

    repo = ReferenceCommuneRepository(commune_directory=str(tmp_path))
    assert repo.load_all_communes() == ["Sonnenburg", "Wiesenhall"]


# ============================================================
# get_reference_commune_prefill
# ============================================================

def test_get_reference_commune_prefill_happy_path_and_cache(monkeypatch, tmp_path):
    # Setup directory structure
    commune_root = tmp_path / "ReferenceCommuneCalculationSheets"
    commune_root.mkdir()
    (commune_root / "Wiesenhall").mkdir()

    repo = ReferenceCommuneRepository(commune_directory=str(commune_root))

    # Stub directory discovery
    monkeypatch.setattr(
        repo,
        "_get_commune_directories",
        lambda: {"Wiesenhall": commune_root / "Wiesenhall"},
    )

    # Stub data extraction
    monkeypatch.setattr(
        repo,
        "_extract_commune_data",
        lambda path: {"einwohnerzahl": 1234, "foo": None},
    )

    # First call (normal extraction)
    result1 = repo.get_reference_commune_prefill("Wiesenhall")

    assert result1["id"] == "Wiesenhall"
    assert result1["name"] == "Wiesenhall"
    assert result1["inputs"] == [{"id": "einwohnerzahl", "value": 1234}]

    # Ensure cache works (force failure if extraction is called again)
    monkeypatch.setattr(
        repo,
        "_extract_commune_data",
        lambda path: (_ for _ in ()).throw(Exception("Should not be called")),
    )

    result2 = repo.get_reference_commune_prefill("Wiesenhall")
    assert result2 == result1


@pytest.mark.parametrize("invalid_name", ["", "undefined", "null", "none", None])
def test_get_reference_commune_prefill_rejects_invalid_names(tmp_path, invalid_name):
    repo = ReferenceCommuneRepository(commune_directory=str(tmp_path))
    with pytest.raises(ValueError):
        repo.get_reference_commune_prefill(invalid_name)  # type: ignore


def test_get_reference_commune_prefill_raises_if_not_found(monkeypatch, tmp_path):
    (tmp_path / "A").mkdir()

    repo = ReferenceCommuneRepository(commune_directory=str(tmp_path))

    monkeypatch.setattr(repo, "_get_commune_directories", lambda: {"A": tmp_path / "A"})

    with pytest.raises(ValueError) as e:
        repo.get_reference_commune_prefill("B")

    assert "Available communes" in str(e.value)


def test_get_reference_commune_prefill_raises_if_directory_not_configured():
    repo = ReferenceCommuneRepository(commune_directory="")
    with pytest.raises(ValueError):
        repo.get_reference_commune_prefill("Wiesenhall")


# ============================================================
# list_all_reference_communes_info
# ============================================================

def test_list_all_reference_communes_info_happy_path(monkeypatch, tmp_path):
    info_file = tmp_path / "ReferenceCommuneInformationSheet.xlsx"
    info_file.write_text("dummy")  # only needed so exists() is True

    df = pd.DataFrame([
        {"name": "Wiesenhall", "population": 1000, "description": "desc"},
        {"name": None, "population": 5, "description": "skip"},  # skipped
        {"name": "  Sonnenburg  ", "population": None, "description": None},
    ])

    monkeypatch.setattr(pd, "read_excel", lambda *args, **kwargs: df)

    repo = ReferenceCommuneRepository(
        commune_directory="",
        info_file_path=str(info_file),
    )

    out = repo.list_all_reference_communes_info()

    assert out == [
        {"id": "Wiesenhall", "name": "Wiesenhall", "population": 1000, "description": "desc"},
        {"id": "Sonnenburg", "name": "Sonnenburg", "population": 0, "description": ""},
    ]


def test_list_all_reference_communes_info_raises_if_missing_columns(monkeypatch, tmp_path):
    info_file = tmp_path / "ReferenceCommuneInformationSheet.xlsx"
    info_file.write_text("dummy")

    monkeypatch.setattr(
        pd,
        "read_excel",
        lambda *args, **kwargs: pd.DataFrame([{"name": "OnlyName"}]),
    )

    repo = ReferenceCommuneRepository(
        commune_directory="",
        info_file_path=str(info_file),
    )

    with pytest.raises(ValueError):
        repo.list_all_reference_communes_info()