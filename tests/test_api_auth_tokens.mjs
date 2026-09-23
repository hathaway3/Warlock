import { test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import crypto from 'crypto';
import app from '../app.js';
import { sequelize, User, ApiToken } from '../db.js';

test('Stage 1 API Suite: Authentication & Bearer Tokens (Issue #28)', async (t) => {
	before(async () => {
		// Sync database tables
		await sequelize.sync();
		// Create a test user
		await User.destroy({ where: { username: 'api_test_user' } });
		await ApiToken.destroy({ where: { name: 'test_token' } });
	});

	after(async () => {
		await User.destroy({ where: { username: 'api_test_user' } });
		await ApiToken.destroy({ where: { name: 'test_token' } });
	});

	await t.test('Unauthenticated /api/applications returns 401 JSON (not 302 HTML)', async () => {
		const res = await request(app)
			.get('/api/applications')
			.set('Accept', 'application/json');

		assert.strictEqual(res.status, 401, 'Expected 401 Unauthorized status');
		assert.strictEqual(res.body.success, false);
		assert.strictEqual(res.body.code, 'UNAUTHORIZED');
	});

	let rawToken, testUser;

	await t.test('Create user and provision API Token in database', async () => {
		testUser = await User.create({
			username: 'api_test_user',
			password: 'Password123!',
			secret_2fa: 'JBSWY3DPEHPK3PXP'
		});

		rawToken = 'wlk_' + crypto.randomBytes(32).toString('hex');
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

		const token = await ApiToken.create({
			name: 'test_token',
			token_hash: tokenHash,
			token_prefix: rawToken.slice(0, 8) + '...',
			user_id: testUser.id
		});

		assert.ok(token.id);
	});

	await t.test('Call /api/applications with invalid Bearer token returns 401 JSON', async () => {
		const res = await request(app)
			.get('/api/applications')
			.set('Authorization', 'Bearer invalid_random_token_123');

		assert.strictEqual(res.status, 401);
		assert.strictEqual(res.body.code, 'UNAUTHORIZED');
	});

	await t.test('Call /api/users with valid Bearer token returns 200 JSON', async () => {
		const res = await request(app)
			.get('/api/users')
			.set('Authorization', `Bearer ${rawToken}`);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.success, true);
		assert.ok(Array.isArray(res.body.data), 'Expected users data array');
	});

	await t.test('Token Management: List user tokens via GET /api/users/tokens', async () => {
		const res = await request(app)
			.get('/api/users/tokens')
			.set('Authorization', `Bearer ${rawToken}`);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.success, true);
		assert.ok(Array.isArray(res.body.data));
		assert.ok(res.body.data.some(tok => tok.name === 'test_token'));
	});

	let newlyCreatedTokenId;

	await t.test('Token Management: Create new token via POST /api/users/tokens', async () => {
		const res = await request(app)
			.post('/api/users/tokens')
			.set('Authorization', `Bearer ${rawToken}`)
			.send({ name: 'ci_bot_token', expires_in_days: 30 });

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.success, true);
		assert.ok(res.body.data.token.startsWith('wlk_'), 'Expected wlk_ token prefix');
		newlyCreatedTokenId = res.body.data.id;
	});

	await t.test('Token Management: Revoke token via DELETE /api/users/tokens/:id', async () => {
		const res = await request(app)
			.delete(`/api/users/tokens/${newlyCreatedTokenId}`)
			.set('Authorization', `Bearer ${rawToken}`);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.success, true);
	});

	await t.test('Modern SPA: GET /spa serves compiled index.html', async () => {
		const res = await request(app).get('/spa');
		assert.strictEqual(res.status, 200);
		assert.ok(res.text.includes('/dist/assets/'), 'Expected compiled asset references in SPA index.html');
	});
});
