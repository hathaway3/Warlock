* **Security:**
  * [x] **Shell command injection hardening**: (Completed — added `libs/shell_quote.mjs` (`shellQuote()`, single-quote escaping) and applied it to all user/host-influenced values interpolated into shell command strings in `routes/api/file.js`, `libs/file_push_runner.mjs`, `routes/api/service_control.js`, and `libs/app_install_data.mjs`; covered by `tests/test_shell_quote.mjs`. Path values are still otherwise unconstrained — consider a base-directory allowlist as a follow-up.)
  * [x] **Session secret fallback**: (Completed — added `libs/session_secret.mjs` (`getOrCreateSessionSecret()`); `app.js` no longer falls back to a hardcoded secret, instead generating and persisting a random one (mode `0600`) alongside the session store on first run when `SESSION_SECRET` is unset. Covered by `tests/test_session_secret.mjs`.)
  * [x] **Proxmox TLS verification**: (Completed — `libs/proxmox.mjs` now defaults `rejectUnauthorized` to `true` unless `PROXMOX_INSECURE=1`/`true` is set (`isProxmoxInsecureAllowed()`), documented in `CLAUDE.md`. `routes/api/proxmox.js` no longer accepts a client-supplied `rejectUnauthorized` — it's a server-side policy, not a request parameter — and the frontend's hardcoded `rejectUnauthorized: false` was removed from `HostsView.tsx`/`client.ts`. Covered by `tests/test_proxmox_tls.mjs`.)
  * [x] **Auth bypass flags**: (Completed — checks centralized in `libs/auth-utils.js` and reused across `routes/login.js`, `routes/settings.js`, `routes/api/auth.js`, `libs/validate_session.mjs`; loud startup warnings in `app.js`; Dockerfile and docker-compose explicitly set both flags to `false`)
  * [x] **Misleading security claim**: (Completed — `frontend/src/views/LoginView.tsx` footer now reads "Secured with TLS encryption")
  * [x] **Password policy**: (Completed — raised the initial-install minimum from 6 to 8 characters in `frontend/src/views/LoginView.tsx`, `routes/install.js`, and `routes/api/auth.js`'s `/setup` endpoint, matching the 8-char minimum already enforced by `routes/api/users.js` and `cli.js`.)
  * [x] **Download temp file naming**: (Completed — `routes/api/file.js`'s download handler now uses `fs.mkdtempSync` to create a fresh, unpredictable, owner-only (`0700`) temp directory per request instead of a fixed `/tmp/warlock_download_<ts>_<basename>` path, closing the /tmp symlink-preplant and collision risk. Note: the save/upload handlers in the same file still build predictable `/tmp/warlock_edit_<ts>.tmp` / `/tmp/warlock_upload_<hash>.tmp` paths — same class of risk, not in scope here.)

* **Documentation:**
  * [x] **Rewrite `.github/copilot-instructions.md`**: (Completed)
  * [x] **Populate `CLAUDE.md`**: (Completed)
  * [ ] **Strip upstream frontmatter from `docs/`**: the `title`/`description`/`order`/`sidebar: cms-pagelist` frontmatter blocks from the upstream CMS site are still present in `docs/index.md`, `docs/install.md`, `docs/dashboard.md`, and the other page files — remove them (manual per-file cleanup).
  * [x] **Add governance docs**: (Security, Contributing, Conduct files created)

* **Testing / CI:**
  * [x] **Add a CI quality gate**: (Completed — `.github/workflows/ci-gate.yml` runs backend tests, frontend tests, and oxlint on PR + push to main)
  * [ ] **Workflow hygiene**: `sync-release.yml` pins `actions/checkout@v6` while the others use `@v4`, and its source-branch detection (`git branch -r --contains ... | head -n 1`) is fragile — pin action versions consistently and simplify branch selection.
  * [ ] **Type-check frontend tests**: `frontend/tsconfig.app.json` excludes `src/__tests__`, so `tsc -b` never type-checks them — include them (or add a test tsconfig to the build).
  * [ ] **Test coverage**: no coverage provider on either side — add `@vitest/coverage-v8` for the frontend and `--experimental-test-coverage` for the backend, with a baseline threshold in CI.
  * [ ] **Dead test dependency**: `@testing-library/jest-dom` is in frontend devDependencies but never imported — remove it or actually use it (`expect.extend`).
  * [ ] **Dependabot**: no `.github/dependabot.yml` — add it for `npm` (root + `frontend/`) and GitHub Actions.

* **Code Quality:**
  * [ ] **Hardcoded Palworld GUID**: `routes/api/service.js:72` and `routes/api/service_configs.js:63` special-case GUID `e4cd1462-87ec-213b-f0fa-7e2a1ba72e2d` — move to a named constant or a data-driven flag in `Apps.yaml`.
  * [x] **Centralize env-flag checks**: (Completed — `libs/auth-utils.js` provides `isAuthSkipped()` / `is2faSkipped()`; used by `routes/login.js`, `routes/settings.js`, `routes/api/auth.js`, `libs/validate_session.mjs`, and `app.js`)
  * [x] **Lint the backend**: (Completed implementation and verification gate added)
  * [x] **API client robustness**: (Updated to support AbortController and standardized error handling)
  * [ ] **Production sourcemaps**: `frontend/vite.config.ts` sets `build.sourcemap: true` — disable for production builds.
  * [ ] **Accessibility pass**: no `aria-*`/`role=` anywhere in the SPA; login labels aren't associated with inputs (no `htmlFor`/`id`), error text isn't `aria-live`, the 2FA field lacks `inputMode`, and there's no ErrorBoundary or modal focus management — add a baseline a11y pass and consider a jsx-a11y lint rule.
  * [ ] **Legacy UI duplication**: the full EJS+JS legacy UI (`views/` + `public/assets/`) duplicates the React SPA and stays mounted behind `USE_LEGACY_UI` — plan deprecation/removal (or document which UI is canonical) to cut the maintenance surface.

* **Repo Hygiene:**
  * [ ] **Stop committing `public/dist`**: (Add to .gitignore and Dockerfile build stage)
  * [ ] **Release discipline**: (Completed sync of versioning and need to script tag/release flow)
  * [x] **Populate `CHANGELOG.md` [Unreleased]**: (Completed — SPA migration, Proxmox provisioning, URL hash routing, and telemetry recorded; v1.3.0 cut 2026-09-23)
  * [x] **`package.json` metadata**: (Completed — author set and description updated to reflect the Express API + React SPA)
  * [ ] **Script hardening (remaining)**: `install-warlock.sh` / `update-warlock.sh` / `uninstall-warlock.sh` now use `set -euo pipefail`; still open — `bootstrap.sh` has only bare `set -e`, `uninstall-warlock.sh` leaves nginx config/app files behind, and there is no `shellcheck` step in CI.
  * [ ] **Formatting + IDE leftovers (remaining)**: `.editorconfig` added and `FUNDING.yml` removed; still open — committed `.idea/` in a Node project (including `dataSources.xml` pointing at local sqlite files) — remove or ignore it.
  * [x] **Docker/Vagrant polish**: (Completed — `HEALTHCHECK` in the Dockerfile; Vagrantfile supports vmware_desktop, virtualbox, and libvirt)