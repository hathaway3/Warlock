import {test} from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {getOrCreateSessionSecret} from '../libs/session_secret.mjs';

test('getOrCreateSessionSecret: honors SESSION_SECRET when set', (t) => {
	const original = process.env.SESSION_SECRET;
	process.env.SESSION_SECRET = 'explicit-secret';
	t.after(() => {
		if (original === undefined) delete process.env.SESSION_SECRET;
		else process.env.SESSION_SECRET = original;
	});

	assert.strictEqual(getOrCreateSessionSecret('/nonexistent/should-not-be-touched'), 'explicit-secret');
});

test('getOrCreateSessionSecret: generates and persists a secret when unset', (t) => {
	const original = process.env.SESSION_SECRET;
	delete process.env.SESSION_SECRET;
	t.after(() => {
		if (original !== undefined) process.env.SESSION_SECRET = original;
	});

	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'warlock_session_secret_test_'));
	t.after(() => fs.rmSync(dir, {recursive: true, force: true}));

	const secret = getOrCreateSessionSecret(dir);
	assert.strictEqual(typeof secret, 'string');
	assert.ok(secret.length >= 64, 'secret should be a long random value');

	const secretPath = path.join(dir, '.session_secret');
	assert.ok(fs.existsSync(secretPath), 'secret should be persisted to disk');
	assert.strictEqual((fs.statSync(secretPath).mode & 0o777).toString(8), '600');
});

test('getOrCreateSessionSecret: reuses the persisted secret across calls', (t) => {
	const original = process.env.SESSION_SECRET;
	delete process.env.SESSION_SECRET;
	t.after(() => {
		if (original !== undefined) process.env.SESSION_SECRET = original;
	});

	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'warlock_session_secret_test_'));
	t.after(() => fs.rmSync(dir, {recursive: true, force: true}));

	const first = getOrCreateSessionSecret(dir);
	const second = getOrCreateSessionSecret(dir);
	assert.strictEqual(first, second);
});
