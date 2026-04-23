# Contributing Guide (KommMa)

## 1) Repository Structure

- `frontend/` – React web client
- `backend/` – Python backend (API)
- `infra/` – Docker Compose & infrastructure files
- `teamscale/` – Teamscale configuration
- `README.md` – Project overview & setup

(The structure is documented in the design notebook.)

---

## 2) Ground Rules

1. **Never commit directly to `main`.**
2. All changes go through **branches + pull requests**.
3. **Small, traceable PRs** instead of massive changes. => one new class or change at a time
4. **Run tests/lint locally** before pushing.
5. **No secrets** (e.g. `.env`, tokens, passwords) in the repository.

---

## 3) Branch Conventions

Please use descriptive branch names:

- `feature/<short-description>` – new features
  Example: `feature/import-validation`
- `fix/<short-description>` – bug fixes
  Example: `fix/null-input-crash`
- `docs/<short-description>` – documentation only
  Example: `docs/docker-setup`
- `refactor/<short-description>` – restructuring without feature/bugfix
  Example: `refactor/service-split`

Optional: The description may include a ticket/issue reference:
`feature/123-result-export`

Everything in `dev` is untested; `main` contains tested code only.

---

## 4) Commit Conventions (Conventional Commits)

Please write commit messages in the following format:

**Types:**

- `feat` – new feature
- `fix` – bug fix
- `refactor` – refactoring
- `docs` – documentation
- `test` – tests
- `chore` – build/CI/configs/dependencies
- `style` – formatting (no logic change)

**Scopes (optional):**

- `frontend`, `backend`, `infra`, `docs`, `ci`, `validation`, `api`

**Examples:**

- `feat(frontend): add pdf export button`
- `fix(backend): validate empty values correctly`
- `docs: add local dev instructions`
- `chore(infra): update docker compose services`

**Guidelines:**

- Use present tense (add/fix/update)
- First line max. ~72 characters
- One commit = one logical change

---

## 5) Pull Request Workflow

### 5.1 Creating a PR

1. Create a branch from `main` (or `develop`, if present)
2. Commit and push your changes
3. Open a pull request

### 5.2 PR Checklist

Please verify before merging:

- [ ] Build/start works locally (frontend/backend)
- [ ] Tests (if any) pass
- [ ] No unnecessary debug output
- [ ] No secrets/keys/passwords in the repository
- [ ] Relevant documentation updated (README/docs), if applicable
- [ ] PR is small enough to be meaningfully reviewed

### 5.3 Review Rules

- At least **1 review** (or as agreed within the team)
- Substantiated comments (not just "looks fine")
- If changes are requested: merge only after they are addressed

---

## 6) Code Style & Quality

- Consistent formatting
- No dead components / unused imports
- Clear separation between e.g. API / Service / Repository / Validators

Note: The project relies on clear interfaces and modularity (among other things, for replaceability & maintainability).

---

## 7) Docker & Local Setup

The project uses Docker for consistent execution. Local startup is done via `infra/docker-compose.yml` (if present) or the respective Dockerfiles for frontend/backend.

If you are working without Docker:

- Make sure your changes **still work** inside the container.

---

## 8) Handling Data / JSON / Import-Export

- Import/export files must remain **backwards-compatible** where possible.
- If a data format is changed:
  - Increment the version field
  - Document the migration/handling
  - Update validation accordingly

---

## 9) Security

- No credentials in the repository
- `.env` stays local
- API keys via environment variables