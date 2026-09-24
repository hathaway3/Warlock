# Changelog

All notable changes to Warlock will be documented in this file.

## [Unreleased]
*   **✨ Features:**
    *   **SPA Migration:** Completed migration from legacy EJS templates to a modern React Single Page Application (SPA). All core user flows (Dashboard, Settings, Hosting) are now managed client-side.
    *   **Proxmox Integration:** Added full API client (`libs/proxmox.mjs`) for automated provisioning, state management, and lifecycle operations of virtual machines and containers.
    *   **Routing:** Implemented modern URL hash routing for deeper client-side navigation.
    *   **Telemetry:** Integrated and standardized analytics tracking (`libs/push_analytics.mjs`) for basic usage monitoring.
*   **🔒 Security:**
    *   **Shell command injection hardening:** Added a shared `shellQuote()` helper (`libs/shell_quote.mjs`) and applied it to every user-supplied value interpolated into shell commands in `routes/api/file.js` (file view/rename/save/delete/extract/compress), `libs/file_push_runner.mjs` (scp/cp/chown), `routes/api/service_control.js` (`systemctl`), and `libs/app_install_data.mjs` (`manage.py --service`). Values are now single-quote-escaped instead of loosely wrapped in double quotes, closing `$(...)`/backtick/metacharacter injection via file paths and service names.
    *   **Session secret:** `app.js` no longer falls back to a hardcoded session-signing secret — a random one is generated and persisted (`libs/session_secret.mjs`) alongside the session store on first run if `SESSION_SECRET` isn't set.
    *   **Proxmox TLS verification:** Certificate verification now defaults to on; disabling it requires the server operator to explicitly set `PROXMOX_INSECURE=1`. The client can no longer request insecure mode via the API payload.
    *   **Password policy:** Raised the initial-install minimum from 6 to 8 characters, matching the limit already enforced elsewhere (user creation, CLI).
    *   **Download temp files:** File downloads now write into a freshly created, unpredictable, owner-only temp directory instead of a fixed, guessable `/tmp` path, closing a symlink-preplant / collision risk.
*   **Changed:**
    *   Reworded the login footer from "End-to-end encrypted session" to "Secured with TLS encryption" — the prior claim overstated what TLS-in-transit actually provides.
    *   Palworld's REST-API requirement (`routes/api/service.js`, `routes/api/service_configs.js`) is now declared via a `requiresRestApi` flag on its `Apps.yaml` entry instead of a hardcoded GUID string comparison.
    *   `frontend/vite.config.ts` no longer emits sourcemaps for production builds (`npm run build`); they're still generated for `--mode development` builds.
*   **Fixed:**
    *   Removed placeholder/stub scripts under `scripts/install-warlock.sh`, `scripts/update-warlock.sh`, `scripts/uninstall-warlock.sh`, and `scripts/bootstrap.sh` that shadow-named and did nothing, left over from an earlier pass. Hardened the real root-level `bootstrap.sh` and `uninstall-warlock.sh` with `set -euo pipefail`.
    *   **`npm run build` was broken on `main`:** `ApiClient.request()` never gained a `signal` parameter when `AbortSignal` support was added, so every call site passing one failed `tsc -b` type-checking (CI never ran `npm run build`, only tests/lint, so this went undetected). Fixed the signature and threaded the signal into the underlying `fetch` call.
    *   Corrected 5 stale/incorrect type mismatches in frontend test mocks (`AppRouting.test.tsx`, `HostDetailsView.test.tsx`) that surfaced once test files were included in type-checking (see Testing/CI below).
*   **Repo Hygiene:**
    *   Stopped committing the built SPA (`public/dist/`) and the local JetBrains project config (`.idea/`, including a `dataSources.xml` pointing at a local sqlite path) — both untracked and gitignored; files remain on disk locally.
    *   Removed the unused `@testing-library/jest-dom` frontend devDependency.
*   **Testing / CI:**
    *   Added `.github/dependabot.yml` for npm (root + `frontend/`) and GitHub Actions.
    *   `frontend/tsconfig.app.json` no longer excludes `src/__tests__` from `tsc -b`, so test files are now type-checked as part of the build.
    *   Added a `shellcheck` step to `ci-gate.yml` (error severity only) covering the root and `scripts/` shell scripts.
    *   `sync-release.yml`: pinned `actions/checkout` to `@v4` (matching the other workflows) and replaced its arbitrary `git branch -r --contains | head -n 1` branch detection with a deterministic `git merge-base --is-ancestor` check.
    *   Added test coverage thresholds for both suites: `@vitest/coverage-v8` for the frontend (`vite.config.ts`, run via a new `npm run test:coverage` script to keep the plain single-file `test` script fast) and `--experimental-test-coverage` for the backend (baked into `test:backend`). Thresholds are set a few points below the measured baseline to catch regressions without blocking on the existing gap.
*   **Documentation:**
    *   Stripped the upstream CMS frontmatter (`title`/`description`/`order`/`sidebar`/`image`) from 8 `docs/*.md` pages — they now start directly with their heading.
*   **♿ Accessibility (login/install, dashboard, hosts, host details):**
    *   Associated every form label with its input via `htmlFor`/`id` (previously visual-only); inputs sharing one visual label (e.g. Cores/RAM) get individual `aria-label`s instead.
    *   Added `aria-label` to icon-only buttons that had no accessible name (delete/start/stop/restart/close actions) — some had only a `title`, several had neither.
    *   Added `role="alert"`/`role="status"` to every error and status banner, and `aria-pressed` to the Cards/Table view toggle.
    *   Added `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` to all ~8 modals across these views (semantic only — focus trapping and Escape-to-close are deliberately deferred).
    *   `inputMode="numeric"` and `autoComplete="one-time-code"` on the 2FA code field.
    *   Added a top-level `ErrorBoundary` so a render crash shows a recoverable message instead of a blank white screen.
    *   Enabled oxlint's `--jsx-a11y-plugin` in CI and both `lint` scripts as a floor against regressions — it does not catch the label-association issue on this codebase's markup, so it isn't a substitute for manual review.

* **🚀 v1.3.0 - 2026-09-23**
    *   **Backend:** Centralized security checks for authentication and 2FA bypass flags by creating `libs/auth-utils.js`, eliminating duplication and simplifying maintenance.
    *   **Security:** Hardened deployment pipeline by introducing `HEALTHCHECK` in the `Dockerfile` and using a multi-stage build to create a minimal image.
    *   **Tooling:** Added robust shell scripting practices (`set -euo pipefail`) to all provisioning scripts (`*.sh`).
    *   **Structure:** Established root-level ESLint configuration (`.eslintrc.js`) to enforce code quality across all backend modules.
    *   **Build:** Updated `package.json` to reflect the current version and added the `lint:backend` script.

## [1.2.2] - 2026-05-25
*   **✨ Features:**
    *   Initial implementation of the modern React SPA dashboard.
    *   Added support for basic webhooks and initial host monitoring.
*   **🐛 Bug Fixes:**
    *   Fixed a bug causing the metrics polling to stop after the first successful run.
