import pandas as pd
import pytest


from DatabaseRepositoryLayer.GraphRepository.graphRepository import GraphRepository


def make_complete_df_with_idneu_at(row_idx=2, col_idx=1):
    """
    Baut das erste read_excel(header=None) DF, in dem irgendwo 'ID_neu' steht.
    """
    df = pd.DataFrame([[""] * 6 for _ in range(row_idx + 3)])
    df.iat[row_idx, col_idx] = "ID_neu"
    return df


def make_df_with_header_and_matrix():
    """
    Baut das zweite read_excel(header=header_row_idx) DF:
    - enthält Spalte 'ID_neu'
    - enthält Spalten, die IDs matchen (Adjazenzmatrix)
    """
    return pd.DataFrame(
        {
            "ID_neu": ["20101", "20102", "20103", None, "   "],
            "20101":  ["N",     "S",     None,  None, None],
            "20102":  ["K",     "N",     "A",   None, None],
            "20103":  ["",      "B",     "N",   None, None],
            "MetaX":  ["x",     "y",     "z",   None, None],  # sollte ignoriert werden
        }
    )


def test_extract_relations_matrix_finds_header_and_builds_square(monkeypatch, tmp_path):
    repo = GraphRepository(file_path=str(tmp_path / "graph.xlsx"))

    complete_df = make_complete_df_with_idneu_at(row_idx=2, col_idx=1)
    df_with_header = make_df_with_header_and_matrix()

    def fake_read_excel(path, header=None):
        # erster call: header=None
        if header is None:
            return complete_df
        # zweiter call: header=<idx>
        return df_with_header

    monkeypatch.setattr(pd, "read_excel", fake_read_excel)

    mat = repo._extract_relations_matrix()

    # Index sind die validen IDs (None und whitespace raus)
    assert list(mat.index) == ["20101", "20102", "20103"]

    # Matrix-Spalten sollten nur IDs sein (20101/20102/20103)
    assert list(mat.columns) == ["20101", "20102", "20103"]

    # Beispielwert
    assert mat.loc["20102", "20101"] == "S"


def test_extract_relations_matrix_raises_if_idneu_missing(monkeypatch, tmp_path):
    repo = GraphRepository(file_path=str(tmp_path / "graph.xlsx"))

    monkeypatch.setattr(pd, "read_excel", lambda *args, **kwargs: pd.DataFrame([["x"]]))

    with pytest.raises(ValueError) as e:
        repo._extract_relations_matrix()
    assert "ID_neu" in str(e.value)


def test_adjacency_to_edge_list_maps_and_filters_neutral():
    repo = GraphRepository(file_path="dummy.xlsx")

    adjacency = pd.DataFrame(
        {
            "20101": ["N", "S", None],
            "20102": ["K", "N", "A"],
            "20103": ["",  "B", "N"],
        },
        index=["20101", "20102", "20103"],
    )

    edges = repo._adjacency_to_edge_list(adjacency)

    # neutral (N) muss raus
    assert not (edges["type"] == "neutral").any()

    # Mapping korrekt
    # (20101 -> 20102) = "K" => conflict
    assert ((edges["from"] == "20101") & (edges["to"] == "20102") & (edges["type"] == "conflict")).any()

    # (20103 -> 20102) = "A" => dependency
    assert ((edges["from"] == "20103") & (edges["to"] == "20102") & (edges["type"] == "dependency")).any()

    # Leere strings und None raus
    assert not ((edges["from"] == "20103") & (edges["to"] == "20101")).any()


def test_get_graph_integration(monkeypatch, tmp_path):
    repo = GraphRepository(file_path=str(tmp_path / "graph.xlsx"))

    # Wir mocken nur _extract_relations_matrix, um IO komplett zu vermeiden
    adjacency = pd.DataFrame(
        {"20101": ["N", "S"], "20102": ["K", "N"]},
        index=["20101", "20102"],
    )
    monkeypatch.setattr(repo, "_extract_relations_matrix", lambda: adjacency)

    out = repo.get_graph()

    # Ergebnis ist list[dict]
    assert isinstance(out, list)
    assert all(isinstance(x, dict) for x in out)

    # "S" => synergy muss drin sein
    assert {"from": "20102", "to": "20101", "type": "synergy"} in out or \
           {"from": "20101", "to": "20102", "type": "synergy"} in out
