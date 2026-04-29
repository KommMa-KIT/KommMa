import json
import shutil
from pathlib import Path

import pytest

# 🔧 TODO: passe den Import an dein echtes Modul an
# Beispiel:
# from externalAPI.downloader import run_downloads, _folder_key, _is_enabled
from externalAPI.Downloader import run_downloads, _folder_key, _is_enabled  # <- anpassen!
from Exceptions.External_Connection_Error import ExternalConnection

from externalAPI.Constants import Constants


# -------------------------
# Helpers
# -------------------------

def write_cfg(tmp_path: Path, cfg: dict) -> Path:
    p = tmp_path / "cfg.json"
    p.write_text(json.dumps(cfg), encoding="utf-8")
    return p


def base_cfg_with_sources(sources: dict) -> dict:
    # cfg structure: cfg[Constants.JSON_NAME][Constants.KEY_FOR_SOURCES]
    return {
        Constants.JSON_NAME: {
            Constants.KEY_FOR_SOURCES: sources
        }
    }


# -------------------------
# Small unit tests: helpers
# -------------------------

def test_is_enabled():
    assert _is_enabled(None) is False
    assert _is_enabled({"enabled": True}) is True
    assert _is_enabled({"enabled": False}) is False
    assert _is_enabled({}) is False  # because source_cfg must be truthy (your implementation)


@pytest.mark.parametrize(
    "inp, expected",
    [
        (" climate_environment/CDC/observations_germany ", "observations_germany"),
        ("http://opendata.dwd.de/climate_environment/CDC/observations_germany/", "observations_germany"),
        ("////", "dwd_folder"),
        ("abc/def", "abc_def"),
    ],
)
def test_folder_key(inp, expected):
    assert _folder_key(inp) == expected


# -------------------------
# run_downloads: config + output rotation
# -------------------------

def test_run_downloads_raises_if_config_missing(tmp_path):
    missing = tmp_path / "nope.json"
    out = tmp_path / "out"

    # raise_output_not_defined_error wirft bei euch vermutlich eine Exception-Klasse
    with pytest.raises(Exception):
        run_downloads(missing, out)


def test_run_downloads_raises_if_no_sources_defined(tmp_path):
    cfg = write_cfg(tmp_path, {Constants.JSON_NAME: {Constants.KEY_FOR_SOURCES: {}}})
    out = tmp_path / "out"

    with pytest.raises(Exception):
        run_downloads(cfg, out)


def test_run_downloads_creates_old_and_moves_existing_content(monkeypatch, tmp_path):
    # output_root exists with content -> should be moved to _old
    out = tmp_path / "downloads"
    out.mkdir()
    (out / "some_file.txt").write_text("x", encoding="utf-8")
    (out / "some_dir").mkdir()

    # minimal config: one disabled source so loop does nothing
    cfg = write_cfg(tmp_path, base_cfg_with_sources({
        Constants.SOURCE_ORDER[0]: {"enabled": False}
    }))

    moved = []
    rmtree_called = []

    def fake_move(src, dst):
        moved.append((Path(src).name, Path(dst).name))

    def fake_rmtree(path, *args, **kwargs):
        rmtree_called.append(Path(path).name)

    monkeypatch.setattr(shutil, "move", fake_move)
    monkeypatch.setattr(shutil, "rmtree", fake_rmtree)

    run_downloads(cfg, out)

    # it should have tried to move some_file.txt and some_dir into downloads_old
    assert ("some_file.txt", "some_file.txt") in moved
    assert ("some_dir", "some_dir") in moved


# -------------------------
# run_downloads: Destatis / RDB
# -------------------------

def test_run_downloads_calls_statbund_for_each_item(monkeypatch, tmp_path):
    out = tmp_path / "out"
    cfg = write_cfg(tmp_path, base_cfg_with_sources({
        Constants.SOURCE_NAME_STATBUND: {
            "enabled": True,
            Constants.KEY_FOR_ITEMS_BLOCK_IN_JSON: [
                {Constants.KEY_FOR_ID_OF_ITEMS_IN_JSON: "123"},
                {Constants.KEY_FOR_ID_OF_ITEMS_IN_JSON: "456"},
            ],
        }
    }))

    calls = []

    # patch the module-level STATBUND object that run_downloads uses
    import externalAPI.DownloadHelper.Downloader_StatBund as STATBUND

    monkeypatch.setattr(
        STATBUND,
        "download_table_and_save",
        lambda table_id, output_dir: calls.append((table_id, output_dir)),
    )

    run_downloads(cfg, out)

    assert [c[0] for c in calls] == ["123", "456"]
    assert all(Path(c[1]).name == Constants.DIRECTORY_NAME_FOR_STATBUND for c in calls)


def test_run_downloads_optional_item_skips_on_error(monkeypatch, tmp_path):
    out = tmp_path / "out"
    cfg = write_cfg(tmp_path, base_cfg_with_sources({
        Constants.SOURCE_NAME_STATBUND: {
            "enabled": True,
            Constants.KEY_FOR_ITEMS_BLOCK_IN_JSON: [
                {Constants.KEY_FOR_ID_OF_ITEMS_IN_JSON: "OK"},
                {Constants.KEY_FOR_ID_OF_ITEMS_IN_JSON: "BAD", Constants.KEY_FOR_OPTIONAL_IN_JSON: True},
                {Constants.KEY_FOR_ID_OF_ITEMS_IN_JSON: "OK2"},
            ],
        }
    }))

    import externalAPI.DownloadHelper.Downloader_StatBund as STATBUND

    calls = []

    def fake_download(table_id, output_dir):
        if table_id == "BAD":
            raise RuntimeError("boom")
        calls.append(table_id)

    monkeypatch.setattr(STATBUND, "download_table_and_save", fake_download)

    with pytest.raises(ExternalConnection):
        run_downloads(cfg, out)

    # Optional: bis zum Fehler wurden die vorherigen noch gemacht
    assert calls == ["OK"]

def test_run_downloads_nonoptional_item_raises_on_error(monkeypatch, tmp_path):
    out = tmp_path / "out"
    cfg = write_cfg(tmp_path, base_cfg_with_sources({
        Constants.SOURCE_NAME_STATBUND: {
            "enabled": True,
            Constants.KEY_FOR_ITEMS_BLOCK_IN_JSON: [
                {Constants.KEY_FOR_ID_OF_ITEMS_IN_JSON: "BAD"},
            ],
        }
    }))

    import externalAPI.DownloadHelper.Downloader_StatBund as STATBUND
    monkeypatch.setattr(STATBUND, "download_table_and_save", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))

    with pytest.raises(Exception):
        run_downloads(cfg, out)


# -------------------------
# run_downloads: DWD
# -------------------------

def test_run_downloads_dwd_downloads_station_list_once_and_folders(monkeypatch, tmp_path):
    out = tmp_path / "out"
    cfg = write_cfg(tmp_path, base_cfg_with_sources({
        Constants.SOURCE_NAME_DWD: {
            "enabled": True,
            Constants.KEY_FOR_STATION_LIST: {
                Constants.KEY_FOR_PATHES_IN_DWD: "stations",
                Constants.KEY_FOR_OPTIONAL_IN_JSON: False,
            },
            Constants.KEY_FOR_FOLDERS_IN_DWD_JSON: [
                {Constants.KEY_FOR_PATHES_IN_DWD: "climate_environment/CDC/observations_germany"},
                {Constants.KEY_FOR_PATHES_IN_DWD: "climate_environment/CDC/another_folder"},
            ],
        }
    }))

    import externalAPI.DownloadHelper.Downloader_DeutscherWetterdienst as DWD

    stations_calls = {"get": 0, "save": 0}
    folders = []

    class FakeClient:
        def get_stations(self):
            stations_calls["get"] += 1
            # can be any object; save_stations_csv is patched anyway
            return {"df": "stations"}

    monkeypatch.setattr(DWD, "DwdCdcClient", FakeClient)
    monkeypatch.setattr(DWD, "save_stations_csv", lambda df, path: stations_calls.__setitem__("save", stations_calls["save"] + 1))
    monkeypatch.setattr(DWD, "download_dwd_tree", lambda folder_path, outdir: folders.append((folder_path, Path(outdir).name)))

    run_downloads(cfg, out)

    # station list done once
    assert stations_calls["get"] == 1
    assert stations_calls["save"] == 1

    # folders downloaded into sanitized subdirs
    assert len(folders) == 2
    assert folders[0][1] == "observations_germany"
    assert folders[1][1] == "another_folder"


# -------------------------
# run_downloads: GV / SRTM
# -------------------------

def test_run_downloads_calls_gv_and_srtm(monkeypatch, tmp_path):
    out = tmp_path / "out"
    cfg = write_cfg(tmp_path, base_cfg_with_sources({
        Constants.SOURCE_NAME_GV: {"enabled": True},
        Constants.SOURCE_NAME_SRTM: {"enabled": True, Constants.KEY_FOR_TARGET_SRTM: "x.tif"},
    }))

    import externalAPI.DownloadHelper.Downloader_Gemeindeverzeichnis as GV
    import externalAPI.DownloadHelper.Downloader_SRTM as SRTM

    gv_calls = []
    srtm_calls = []

    monkeypatch.setattr(GV, "download_gv_excel", lambda outdir: gv_calls.append(outdir))
    monkeypatch.setattr(SRTM, "download_srtm_dtm", lambda outdir, name: srtm_calls.append((outdir, name)))

    run_downloads(cfg, out)

    assert len(gv_calls) == 1
    assert Path(gv_calls[0]).name == Constants.DIRECTORY_NAME_FOR_GV

    assert srtm_calls == [(str(out / Constants.DIRECTORY_NAME_FOR_SRTM), "x.tif")]
