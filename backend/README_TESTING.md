# KOMMMA Backend – Testing Guide
docker compose up -d
docker compose exec backend python -m pytest -q

🔹 Coverage (optional)
pip install pytest-cov
python -m pytest --cov=src

📁      
backend/
│
├── src/                     → Applikationscode
│   ├── ApplicationLayer/
│   ├── Exceptions/
│   └── ...
│
├── test/                    → Unit Tests
│   └── ApplicationLayer/
│
├── pytest.ini
└── requirements.txt

⚠️ Wichtig: src-Struktur

Das Projekt verwendet eine src-Struktur.

Das bedeutet:

Import-Root ist der Ordner src

Tests importieren ohne backend.src

✅ Richtig
from ApplicationLayer.api.APIRouter import router

❌ Falsch
from backend.src.ApplicationLayer.api...

🧪 Lokales Testing mit venv
1️⃣ In Backend-Ordner wechseln
cd backend

2️⃣ Virtuelle Umgebung erstellen
python3 -m venv .venv

3️⃣ Aktivieren
source .venv/bin/activate


Wenn erfolgreich, sieht dein Prompt so aus:

(.venv) ubuntu@project:...

4️⃣ Dependencies installieren
pip install -r requirements.txt

5️⃣ Test-Dependencies installieren
pip install pytest httpx

6️⃣ pytest.ini prüfen

Datei: backend/pytest.ini

[pytest]
pythonpath = src
testpaths = test

7️⃣ Tests ausführen
python -m pytest -q

🐳 Tests im Docker-Container (Empfohlen)

Das Backend läuft in Docker mit Python 3.12.
Diese Methode ist am stabilsten.

Container starten
docker compose up -d

Tests ausführen
docker compose exec backend python -m pytest -q

Vorteile

Gleiche Python-Version wie Produktion

Keine lokalen Versionsprobleme

Alle Dependencies vorhanden

❗ Häufige Fehler & Lösungen
❌ ModuleNotFoundError: No module named 'ApplicationLayer'

Ursache:
PYTHONPATH nicht korrekt gesetzt.

Lösung:

PYTHONPATH=src python -m pytest


Oder pytest.ini prüfen.

❌ ModuleNotFoundError: No module named 'fastapi'

Ursache:
Dependencies nicht installiert.

Lösung:

pip install -r requirements.txt

❌ ResponseValidationError in Tests

Ursache:
Fake-Daten passen nicht zum Pydantic ResponseModel.

Lösung:

Enum-Werte prüfen

Listenstruktur prüfen

Pflichtfelder ergänzen

❌ No module named pytest

Ursache:
pytest nicht installiert.

Lösung:

pip install pytest

📊 Testabdeckung (Optional)
pip install pytest-cov
python -m pytest --cov=src

🎯 Empfehlung für das PSE-Projekt

Für das Team sollte gelten:

pytest.ini im Repository behalten

Tests regelmäßig ausführen

Bevorzugt Tests im Docker-Container laufen lassen

Optional CI-Pipeline verwenden (z. B. GitHub Actions / GitLab CI)

✅ Ende des Testing Guides

---

Wenn du willst, kann ich dir auch noch:

- eine **professionellere Version mit Badges**
- oder eine **CI-Ready Version mit GitHub Actions YAML**
- oder eine **Version mit Makefile-Shortcuts (`make test`)**

bauen 🚀