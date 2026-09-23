import { test } from 'node:test';
import assert from 'node:assert';
import cache, { tagCacheKey, clearTaggedCache, getTagMapSize } from '../libs/cache.mjs';
import { errorHandler } from '../libs/error_handler.mjs';
import { sequelize, pragmaInitPromise } from '../db.js';

test('Resilience, Cache Eviction, and Error Handler Suite', async (t) => {
	await t.test('Cache: tagCacheKey and clearTaggedCache work with automatic tag eviction', () => {
		const host = 'host_test_resilience';
		cache.set('key_resilience_1', { data: 'test1' }, 60);
		tagCacheKey('key_resilience_1', host, 'metrics');
		cache.set('key_resilience_2', { data: 'test2' }, 60);
		tagCacheKey('key_resilience_2', host, 'metrics');

		assert.deepStrictEqual(cache.get('key_resilience_1'), { data: 'test1' });
		assert.deepStrictEqual(cache.get('key_resilience_2'), { data: 'test2' });
		assert.strictEqual(getTagMapSize(host), 2);

		// Clear by tag
		clearTaggedCache(host);
		assert.strictEqual(cache.get('key_resilience_1'), undefined);
		assert.strictEqual(cache.get('key_resilience_2'), undefined);
		assert.strictEqual(getTagMapSize(host), 0);
	});

	await t.test('Cache: node-cache del event cleans up tag map automatically', () => {
		const host = 'host_del_test';
		cache.set('key_del_1', { test: true }, 60);
		tagCacheKey('key_del_1', host, 'apps');
		assert.strictEqual(getTagMapSize(host), 1);

		// Direct cache.del should trigger the 'del' listener and clean the tag map
		cache.del('key_del_1');
		assert.strictEqual(getTagMapSize(host), 0);
	});

	await t.test('Error Handler: returns JSON for API routes without HTML leak', () => {
		let statusCode = null;
		let jsonPayload = null;

		const mockReq = {
			originalUrl: '/api/test/resource',
			method: 'POST',
			headers: { accept: 'application/json' },
			xhr: false
		};
		const mockRes = {
			headersSent: false,
			status(code) {
				statusCode = code;
				return this;
			},
			json(payload) {
				jsonPayload = payload;
				return this;
			},
			send() {
				throw new Error('Should not call send for API route');
			},
			render() {
				throw new Error('Should not render view for API route');
			}
		};

		const testError = new Error('Database query timed out');
		testError.status = 504;
		testError.code = 'GATEWAY_TIMEOUT';

		errorHandler(testError, mockReq, mockRes, () => {});

		assert.strictEqual(statusCode, 504);
		assert.strictEqual(jsonPayload.success, false);
		assert.strictEqual(jsonPayload.error, 'Database query timed out');
		assert.strictEqual(jsonPayload.code, 'GATEWAY_TIMEOUT');
	});

	await t.test('Error Handler: renders error template for non-API web UI requests', () => {
		let renderedView = null;
		let renderContext = null;
		let statusCode = null;

		const mockReq = {
			originalUrl: '/dashboard',
			method: 'GET',
			headers: { accept: 'text/html' },
			xhr: false
		};
		const mockRes = {
			headersSent: false,
			status(code) {
				statusCode = code;
				return this;
			},
			render(view, context) {
				renderedView = view;
				renderContext = context;
				return this;
			}
		};

		const testError = new Error('Template render failed');
		testError.status = 500;

		errorHandler(testError, mockReq, mockRes, () => {});

		assert.strictEqual(statusCode, 500);
		assert.strictEqual(renderedView, 'error');
		assert.strictEqual(renderContext.error.message, 'Template render failed');
	});

	await t.test('Database: WAL mode and busy timeout configured', async () => {
		await pragmaInitPromise;
		const [journalMode] = await sequelize.query('PRAGMA journal_mode;');
		assert.ok(journalMode && journalMode.length > 0);
		const mode = Object.values(journalMode[0])[0];
		assert.strictEqual(mode.toLowerCase(), 'wal', 'SQLite journal_mode should be WAL');

		const [busyTimeout] = await sequelize.query('PRAGMA busy_timeout;');
		assert.ok(busyTimeout && busyTimeout.length > 0);
		const timeout = Object.values(busyTimeout[0])[0];
		assert.strictEqual(Number(timeout), 5000, 'SQLite busy_timeout should be 5000ms');
	});
});
