from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

"""
This script is there to read passwords and other information out of an .env file.
Therefore it got multiple canidates wherer the .env can be located.
Author: Jonas Dorner (@OilersLD)
"""

CANDIDATES = [
    Path("/app/login_data.env"),
    Path("/app/src/login_data.env"),
    Path("/app/src/../login_data.env"),
    Path("login_data.env"),
    Path("../login_data.env"),
]

_loaded = False

def _load_project_env() -> None:
    global _loaded
    if _loaded:
        return

    # Falls Compose env_file genutzt wird, sind Variablen bereits gesetzt.
    # Dann müssen wir gar keine Datei laden.
    if os.getenv("ADMIN_EMAIL"):
        _loaded = True
        return

    # Sonst versuchen wir eine env-Datei zu finden und zu laden (optional).
    for p in CANDIDATES:
        if p.exists() and p.is_file():
            load_dotenv(dotenv_path=p, override=True)
            _loaded = True
            return

    # Keine Datei gefunden -> ok, wir verlassen uns auf os.environ
    _loaded = True


def env_required(key: str) -> str:
    _load_project_env()
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"Env var fehlt: {key}")
    return val