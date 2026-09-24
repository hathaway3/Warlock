# Warlock Project - Development Guide

## Overview
Warlock is a sophisticated, containerized platform designed for managing and playing networked game services. The system is built upon a modern **React Single Page Application (SPA) frontend** that communicates with a robust **Express 5 API backend**.

### Architecture Breakdown
*   **Client (Frontend):** React SPA. Handles all user interface logic, state management, and direct API calls.
*   **Server (Backend):** Node.js/Express 5. Handles authentication, routing, business logic, database interaction (Sequelize/SQLite), and service management.
*   **Communication:** Communication is via RESTful endpoints, following a standard JSON payload structure and utilizing Bearer Tokens for authorization.

### Core Conventions
*   **API Versioning:** All API calls should be designed with versioning in mind (e.g., `/api/v2/`).
*   **Configuration:** Use environment variables (`process.env`) for all secrets and dynamic configurations. Configuration overrides should follow a clear hierarchy (CLI Args > ENV > `app.js` defaults).
*   **Error Handling:** Always handle both HTTP status codes and business logic errors in the response structure.

### Developer Rules
*   **Grouped Declarations:** Adhere strictly to the principle of grouping related declarations (constants, types, functions, routes) within files. Avoid hoisting or scattering related declarations.
*   **Data Flow:** Follow the principle of centralized security checking. Utility modules (e.g., `libs/auth-utils.js`) must be used for common logic like authentication status checks (`isAuthSkipped()`).

### File Structure Reference
*   `routes/api/*`: Contains the main API middleware and routes.
*   `libs/`: Contains reusable, pure utility modules (e.g., `auth-utils.js`, `logger.mjs`).
*   `frontend/`: Contains the entire React/SPA client source code.

---
*This guide was updated to reflect the modern SPA architecture.*