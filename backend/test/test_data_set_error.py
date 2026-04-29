import pytest

import Exceptions.Data_Set_Error as M


def test_dataseterror_sends_email(monkeypatch):
    calls = []

    def fake_send(subject, body):
        calls.append((subject, body))

    # WICHTIG: patch im Modul, wo send_admin_email verwendet wird
    monkeypatch.setattr(M, "send_admin_email", fake_send)

    with pytest.raises(M.DataSetError) as e:
        M.raise_data_set_error(
            message="Value not found",
            dataset="file.xlsx",
            column="population",
            row="08337027",
        )

    err = e.value
    assert err.dataset == "file.xlsx"
    assert err.column == "population"
    assert err.row == "08337027"

    assert len(calls) == 1
    subject, body = calls[0]
    assert "DataSetError in KommMa Tool" in subject
    assert "Value not found" in body
    assert "file.xlsx" in body
    assert "population" in body
    assert "08337027" in body


def test_dataseterror_email_failure_propagates(monkeypatch):
    # zeigt dir ein wichtiges Verhalten:
    # wenn send_admin_email crasht, crasht auch das Werfen der Exception
    def boom(subject, body):
        raise RuntimeError("smtp down")

    monkeypatch.setattr(M, "send_admin_email", boom)

    with pytest.raises(RuntimeError) as e:
        M.raise_data_set_error(
            message="x",
            dataset="d",
            column="c",
            row="r",
        )
    assert "smtp down" in str(e.value)