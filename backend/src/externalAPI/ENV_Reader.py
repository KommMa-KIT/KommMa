"""
ENV_Reader.py

Reads passwords and other secrets from an .env file. CANDIDATES lists the
locations that are checked (Docker paths first, then local paths).
Author: Jonas Dorner (@OilersLD)
"""

from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

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

    # With a Compose env_file the variables are already set, no file needed.
    if os.getenv("ADMIN_EMAIL"):
        _loaded = True
        return

    for p in CANDIDATES:
        if p.exists() and p.is_file():
            load_dotenv(dotenv_path=p, override=True)
            _loaded = True
            return

    # No file found -> rely on os.environ
    _loaded = True


def env_required(key: str) -> str:
    _load_project_env()
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"Env var fehlt: {key}")
    return val