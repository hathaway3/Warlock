import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.mjs';

/**
 * Resolve the secret used to sign session cookies.
 *
 * Prefers SESSION_SECRET from the environment. If unset, a random secret is
 * generated once and persisted alongside the session store so restarts don't
 * invalidate every session, and no deployment ever falls back to a shared,
 * hardcoded value.
 *
 * @param {string} secretDir Directory to persist the generated secret in.
 * @returns {string}
 */
export function getOrCreateSessionSecret(secretDir) {
	if (process.env.SESSION_SECRET) {
		return process.env.SESSION_SECRET;
	}

	const secretPath = path.join(secretDir, '.session_secret');

	try {
		const existing = fs.readFileSync(secretPath, 'utf8').trim();
		if (existing) {
			return existing;
		}
	} catch {
		// No persisted secret yet, fall through to generate one.
	}

	const secret = crypto.randomBytes(64).toString('hex');
	fs.writeFileSync(secretPath, secret, { mode: 0o600 });
	logger.warn(`SESSION_SECRET not set — generated and persisted a random secret at ${secretPath}. Set SESSION_SECRET explicitly to control this value (e.g. when running multiple instances behind a load balancer).`);
	return secret;
}
