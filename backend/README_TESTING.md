# KOMMMA Backend – Testing Guide

This README explains the most reliable way to run backend tests.

## Recommended: Run Tests with Docker

Start the containers from the project root:

```bash
docker compose up -d
```

Then run the tests inside the backend container:

```bash
docker compose exec backend python -m pytest -q
```

The backend container uses Python 3.12, preventing discrepancies between local
Python installations.

## Alternative: Run Tests Locally with a Virtual Environment

Use this option when Docker is unavailable. First, switch to the backend
directory and create a virtual environment:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

Install the project and test dependencies:

```bash
pip install -r requirements.txt
pip install pytest httpx
```

Run the tests:

```bash
python -m pytest -q
```

## Important: `src` Structure and Imports

The backend uses a `src` structure. Therefore, the import root is
`backend/src`, not the repository root.

Correct:

```python
from ApplicationLayer.api.APIRouter import router
```

Incorrect:

```python
from backend.src.ApplicationLayer.api.APIRouter import router
```

The `backend/pytest.ini` file must define the import path and test directory:

```ini
[pytest]
pythonpath = src
testpaths = test
```

## Common Errors

### `ModuleNotFoundError: No module named 'ApplicationLayer'`

**Cause:** The import path is not configured, or the tests are not being run
from the `backend` directory.

**Solution:** Run the tests from `backend` and check `pytest.ini`. As a
one-time alternative, set the import path explicitly:

```bash
PYTHONPATH=src python -m pytest -q
```

### `ModuleNotFoundError: No module named 'fastapi'`

**Cause:** The Python dependencies are missing from the local environment.

**Solution:**

```bash
pip install -r requirements.txt
```

### `No module named pytest`

**Cause:** `pytest` is not installed in the active virtual environment.

**Solution:**

```bash
pip install pytest
```

### `ResponseValidationError` in Tests

**Cause:** The fake data does not match the expected Pydantic response model.

**Solution:** Check enum values, list structures, and required fields in the
response model. Add or correct the fake data until it matches the model.
