# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Warlock is a "bring-your-own-server" game server manager. An Express 5 backend (Node.js ≥ 24, `engines` in `package.json`) installs and manages game services on remote Linux hosts over SSH; a React SPA drives the UI; SQLite via Sequelize holds state. This is an independently maintained fork — bug reports and issues go to *this* repository only, never the upstream project (see README.md).

## Commands

### Setup & run
- `npm install && npm run build` — install deps and build the SPA (output goes to `public/dist/`, which the backend serves; required before first run).
- `npm run dev` — nodemon dev server on `http://localhost:3077`.
- `npm run dev:quick` — same, with `SKIP_AUTOMATIONS=1` (skips DB schema sync + metrics timers) for faster restarts.
- `npm run dev:profile` — same, with `WARLOCK_PROFILE=1` (logs per-SSH-command timings to `warlock-profile.csv`).
- `npm start` — production start. `npm run docker` — docker-compose dev stack.
- Frontend HMR: `npm --prefix frontend run dev` (Vite on :3000, proxies `/api` and `/assets/media` to `127.0.0.1:3077`).
- `npm run release -- <patch|minor|major|X.Y.Z> [--dry-run]` — cut a release: bumps all four `package*.json` version fields, rolls the CHANGELOG `[Unreleased]` section under a dated heading, commits, and tags; never pushes (see CONTRIBUTING.md). Pushes to `main` get an auto-derived `<version>-dev.<commit count>` Docker tag.
- Account-recovery CLI: `npm run cli -- list-users | create-user | reset-password | reset-2fa | delete-user`.
- A Vagrant/VMware dev VM setup is documented in `docs/development.md`.

### Tests
- All: `npm test` (backend, then frontend).
- Backend: `npm run test:backend` (`node --test --experimental-test-module-mocks tests/*.mjs`).
  - Single file: `node --test tests/test_api_hosts.mjs`
  - Single case: `node --test --test-name-pattern "pattern" tests/test_api_hosts.mjs`
  - `tests/test_api_*.mjs` boot the full Express app via supertest and create/clean up their own users, API tokens, and hosts against the local `warlock.sqlite`; the other test files exercise `libs/` modules directly.
- Frontend: `npm --prefix frontend test` (Vitest + Testing Library, jsdom).
  - Single file: `npm --prefix frontend test -- src/__tests__/LoginView.test.tsx`

### Lint
- The linter enforced by CI (`.github/workflows/ci-gate.yml`) is oxlint: `npx oxlint .` and `npx oxlint ./frontend`.
- `npm run lint:backend` (ESLint) is currently broken (the `eslint` binary and the plugins referenced by `.eslintrc.js` are not installed) — treat oxlint as authoritative.

## Architecture

### One frontend, one API
- The UI is the React SPA in `frontend/` (React 19 + TypeScript + Tailwind v4 + TanStack Query; xterm.js terminal; CodeMirror 6 editor). It builds into `public/dist/` and is served at `/` (and `/spa`) by `routes/index.js`. Auth, install, and 2FA setup are all handled client-side by the SPA against `/api/auth/*`.
- The former legacy EJS UI has been removed. The only remaining server-rendered page is `views/error.ejs`, a self-contained fallback used by `libs/error_handler.mjs` for non-API, non-JSON requests. `public/assets/` now holds only `media/` (game artwork referenced by `Apps.yaml` and the SPA).
- The SPA consumes the REST + SSE JSON API in `routes/api/*`. Responses follow the `{ success, ... }` shape (plus `error`/`code` on failure); live data flows over SSE endpoints (e.g. `/api/services/stream`).

### How host operations work
Nearly every backend operation against a game host funnels through `libs/cmd_runner.mjs` → `cmdRunner(target, cmd, cacheable, cacheTag)`:
- The host IP must exist in the `Host` table (fail closed — unknown targets are rejected).
- `localhost`/`127.0.0.1` execute directly; other hosts run `ssh root@<ip>` with key-only auth.
- Optional in-process result caching (`libs/cache.mjs`, keyed by host+command) and per-command timing when `WARLOCK_PROFILE=1` (`libs/cmd_profiler.mjs`).

The typical handler shape is therefore: `validate_session` middleware → domain function in `libs/*.mjs` → `cmdRunner` on one or more hosts → JSON response. Keep shared logic in `libs/`, not in route files.

### Game install pipeline
- `Apps.yaml` is the game catalog (guid → GitHub repo + installer script path + CLI syntax).
- `libs/get_app_installer.mjs` resolves the installer URL from raw.githubusercontent.com (branch preference `stable` > `main` > `master`); install routes download and execute it on the host.
- Most games use the Warlock Manager Python library (reference code in `scriptlets/warlock/`), which runs as a per-service local API on the host; its auth token is read from `/var/lib/warlock/.auth`.

### Auth (dual-mode)
`validate_session` (`libs/validate_session.mjs`) is the single auth gate on protected routes:
1. `Authorization: Bearer <token>` — API tokens stored in the `ApiToken` table (sha256-hashed, `wlk_` prefix, issued via `/api/users/tokens`). Used by the SPA (`frontend/src/api/client.ts` keeps the token in `localStorage.warlock_api_token`), the CLI, and automation.
2. Browser session — express-session (connect-sqlite3 store, `warlock-sessions.sqlite`) with TOTP 2FA (`node-2fa`, `User.secret_2fa`).

For `/api/*` paths it returns JSON 401/403 with a `code`; page routes redirect to `/login`. Dev-only env bypasses `SKIP_AUTHENTICATION`/`SKIP_2FA` exist — route any new checks through `libs/auth-utils.js` (`isAuthSkipped()`/`is2faSkipped()`) instead of inlining `=== 'true' || === '1'` comparisons, and never enable them in production.

### Data & background jobs
- `db.js` defines all Sequelize models (`User`, `Host`, `Meta`, `Metric`, `HostMetric`, `ApiToken`). There are no migrations — the schema is applied at startup via `sequelize.sync({alter:true})` (skipped under `SKIP_AUTOMATIONS=1`). Resetting the dev DB = delete `warlock.sqlite` (server restart recreates it and redirects to `/install`).
- `tasks/*.mjs` poll service metrics (`Metric`) and host metrics (`HostMetric`) every 60s and downsample/merge hourly. The timers start only inside the `require.main === module` block in `app.js`, so importing `app.js` in tests does not start them.

### Module system
The backend is a CJS/ESM hybrid: `app.js` and `routes/*.js` are CommonJS; domain logic in `libs/*.mjs` is ESM, loaded via `require()`. This relies on Node ≥ 24's `require(esm)` support — do not lower the Node requirement. Match the module style of the file you are editing.

## Key Environment Variables
`PORT` (default 3077), `IP` (bind address; use `0.0.0.0` inside Docker), `DB_PATH`, `SESSION_SECRET` (if unset, a random secret is generated and persisted next to the database on first run), `COOKIE_SECURE`, `SKIP_AUTOMATIONS`, `SKIP_AUTHENTICATION`, `SKIP_2FA`, `WARLOCK_PROFILE`, `PROXMOX_INSECURE` (disables TLS certificate verification for Proxmox VE API calls — only for self-signed lab/home installs, never production). All secrets must come from the environment, and services must fail closed when configuration is missing or invalid.

## Conventions

### Grouped Declarations (Mandatory)
Order declarations in every file: 1) imports (`require`/`import`), 2) constants/globals, 3) middleware definitions, 4) route handlers/service logic, 5) exports. Do not scatter related declarations or rely on hoisting.

### Commit Hygiene (Conventional Commits)
All commits: `type(scope): description` — e.g. `feat(auth): add bearer token validation`, `fix(db): prevent session leakage on logout`.

### Change Logging
All user-visible changes must be recorded in `CHANGELOG.md` (Keep a Changelog format: Added / Changed / Fixed / Deprecated / Security) with SemVer versioning.

### Security Practices
- **Fail closed:** auth, DB, and API handlers default to the denied state when config is missing or validation fails.
- **Input validation:** all host IPs, service names, and file paths from user input must be validated against allow-lists before being interpolated into shell commands (known gaps are tracked in TODO.md — do not add new raw interpolation).
- **Tokens:** Bearer tokens for all authenticated API calls; store only hashes in the DB.
- **Formatting:** match the surrounding file (tabs in most committed backend code, 2-space in the SPA).

## Contribution Workflow
1. Feature branch (`feature/your-ticket-id`).
2. Implement changes; `npm test` (both suites) must pass locally.
3. Conventional Commit + CHANGELOG entry.
4. PR against `main` referencing the ticket; the CI quality gate (tests + oxlint) must pass before merge.
