# environment variables (ENV reader)

## Overview
The `ENV_Reader.py` script is designed to read environment variables from a `.env` file and set them as system environment variables. 
This allows you to manage sensitive information (like API keys, database credentials, etc.) securely without hardcoding them into your codebase.

## Usage
You have to create a `.env` file in one of the following locations:
CANDIDATES = [
    Path("/app/login_data.env"),          # falls du sie doch mountest
    Path("/app/src/login_data.env"),      # falls jemand sie ins src legt
    Path("/app/src/../login_data.env"),   # = /app/login_data.env
    Path("login_data.env"),               # lokal im cwd
    Path("../login_data.env"),            # lokal von src aus
]

You have to define the required environment variables in that file:
- GMAIL_USER: Your Gmail email address
- GMAIL_APP_PASSWORD: An app password generated from your Google account (not your regular password)
- GENESIS_TOKEN: The API token for the Genesis service
- RDB_USER: The username for your relational database
- RDB_PASS: The password for your relational database
- ADMIN_EMAIL: The email address of the administrator (used for notifications, etc.)

# Security recommendations

- Never commit secrets into the repository. Add `.env*` entries to `.gitignore`.
- Use separate credentials for development and production. Keep production secrets in your deployment platform's secret store (e.g., Docker secrets, Kubernetes secrets, or CI/CD secret manager).
- Rotate credentials if real secrets were accidentally committed.


# Summary — Required fields for development

- For backend (development): GMAIL_USER, GMAIL_APP_PASSWORD, GENESIS_TOKEN, RDB_USER, RDB_PASS, ADMIN_EMAIL