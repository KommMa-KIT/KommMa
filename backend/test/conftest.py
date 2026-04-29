import os
import pytest

import pytest

@pytest.fixture(autouse=True)  # default = function scope
def _test_env(monkeypatch): 
    """
    Prevent externalAPI ENV loading from crashing test collection.
    """
    # Provide values that might be required
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.com")

    # Optional: if your env reader checks for this exact path, avoid it
    # monkeypatch.setenv("PATH_FOR_ENV", "/dev/null")

    # Hard-stub the loader so it never tries to read /app/login_data.env
    try:
        import externalAPI.ENV_Reader as env_reader
        monkeypatch.setattr(env_reader, "_load_project_env", lambda: None)
    except Exception:
        # Module might not exist yet during very early collection in some setups
        pass