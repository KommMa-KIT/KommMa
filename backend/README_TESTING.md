# Backend-Testing

Dieses README erklärt, wie das Testing im Backend am zuverlässigsten funktioniert.

## Empfohlen: Tests mit Docker

Starte die Container im Projektverzeichnis:

```bash
docker compose up -d
```

Führe anschließend die Tests im Backend-Container aus:

```bash
docker compose exec backend python -m pytest -q
```

Der Backend-Container verwendet Python 3.12. Dadurch werden Unterschiede in
lokalen Python-Installationen vermieden.

## Alternative: lokal mit virtueller Umgebung

Wenn Docker nicht verfügbar ist. Wechsle zunächst in den
Backend-Ordner und erstelle eine virtuelle Umgebung:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

Installiere die Projekt- und Test-Abhängigkeiten:

```bash
pip install -r requirements.txt
pip install pytest httpx
```

Führe die Tests aus:

```bash
python -m pytest -q
```

## Wichtig: `src`-Struktur und Imports

Das Backend verwendet eine `src`-Struktur. Der Import-Root ist daher
`backend/src`, nicht das gesamte Repository.

Richtig:

```python
from ApplicationLayer.api.APIRouter import router
```

Falsch:

```python
from backend.src.ApplicationLayer.api.APIRouter import router
```

Die Datei `backend/pytest.ini` muss den Import-Pfad und den Testordner
festlegen:

```ini
[pytest]
pythonpath = src
testpaths = test
```

## Häufige Fehler

### `ModuleNotFoundError: No module named 'ApplicationLayer'`

**Ursache:** Der Import-Pfad ist nicht gesetzt oder die Tests werden nicht aus
dem Ordner `backend` gestartet.

**Lösung:** Führe die Tests aus `backend` aus und prüfe `pytest.ini`.
Als einmalige Alternative kann der Import-Pfad explizit gesetzt werden:

```bash
PYTHONPATH=src python -m pytest -q
```

### `ModuleNotFoundError: No module named 'fastapi'`

**Ursache:** Die Python-Abhängigkeiten fehlen in der lokalen Umgebung.

**Lösung:**

```bash
pip install -r requirements.txt
```

### `No module named pytest`

**Ursache:** `pytest` ist in der aktiven virtuellen Umgebung nicht
installiert.

**Lösung:**

```bash
pip install pytest
```

### `ResponseValidationError` in Tests

**Lösung:** Prüfe insbesondere Enum-Werte, Listenstrukturen und Pflichtfelder
des Response-Modells. Ergänze oder korrigiere die Fake-Daten, bis sie dem
Modell entsprechen.
