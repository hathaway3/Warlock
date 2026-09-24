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
