/**
 * @module auth-utils
 * @description Contains shared utility functions for environment flag checks.
 * These functions centralize checks for security bypass flags (SKIP_AUTHENTICATION, SKIP_2FA)
 * to prevent duplication of '=== 'true' || === '1'' patterns across the codebase.
 *
 * NOTE: These functions assume the environment variables are loaded via process.env.
 */

/**
 * Checks if the authentication system should be bypassed via environment variable.
 * @returns {boolean} True if SKIP_AUTHENTICATION is set to 'true' or '1'.
 */
export function isAuthSkipped() {
    const envVar = process.env.SKIP_AUTHENTICATION;
    return envVar === 'true' || envVar === '1';
}

/**
 * Checks if 2FA requirements should be bypassed via environment variable.
 * @returns {boolean} True if SKIP_2FA is set to 'true' or '1'.
 */
export function is2faSkipped() {
    const envVar = process.env.SKIP_2FA;
    return envVar === 'true' || envVar === '1';
}

/**
 * Helper function to log a loud warning when insecure modes are active.
 * This is crucial for detecting insecure production deployments.
 * @param {string} name - The name of the check (e.g., 'Authentication Bypass').
 */
export function logSecurityWarning(name) {
    console.warn(`[SECURITY WARNING] ${name} is enabled via environment variable. This bypasses critical security checks and should NEVER be used in production. Default to 'false' or remove the environment variable.`);
}