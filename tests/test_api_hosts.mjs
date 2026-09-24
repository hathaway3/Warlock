import { test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import crypto from 'crypto';
import app from '../app.js';
import { sequelize, User, ApiToken, Host } from '../db.js';

// The route guards localhost adds behind a root check (fail-closed). Adapt expectations
// so the suite stays green in non-root dev environments while still covering both branches.
const isRoot = typeof process.getuid !== 'function' || process.getuid() === 0;

test('Host API Management Suite (POST, GET ssh-key, DELETE)', async (t) => {
	let rawToken, testUser;

	before(async () => {
		await sequelize.sync();
		await User.destroy({ where: { username: 'hosts_api_test_user' } });
		await ApiToken.destroy({ where: { name: 'hosts_test_token' } });
		await Host.destroy({ where: { ip: '127.0.0.1' } });
		await Host.destroy({ where: { ip: '10.99.88.77' } });

		testUser = await User.create({
			username: 'hosts_api_test_user',
			password: 'Password123!',
			secret_2fa: 'JBSWY3DPEHPK3PXP'
		});

		rawToken = 'wlk_' + crypto.randomBytes(32).toString('hex');
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

		await ApiToken.create({
			name: 'hosts_test_token',
			token_hash: tokenHash,
			token_prefix: rawToken.slice(0, 8) + '...',
			user_id: testUser.id
		});
	});

	after(async () => {
		await Host.destroy({ where: { ip: '127.0.0.1' } });
		await Host.destroy({ where: { ip: '10.99.88.77' } });
		if (testUser) {
			await ApiToken.destroy({ where: { user_id: testUser.id } });
			await User.destroy({ where: { id: testUser.id } });
		}
	});

	await t.test('Unauthenticated POST /api/hosts returns 401 JSON', async () => {
		const res = await request(app)
			.post('/api/hosts')
			.send({ ip: '10.99.88.77' })
			.set('Accept', 'application/json');

		assert.strictEqual(res.status, 401);
		assert.strictEqual(res.body.success, false);
		assert.strictEqual(res.body.code, 'UNAUTHORIZED');
	});

	await t.test('Unauthenticated GET /api/hosts/ssh-key returns 401 JSON', async () => {
		const res = await request(app)
			.get('/api/hosts/ssh-key')
			.set('Accept', 'application/json');

		assert.strictEqual(res.status, 401);
		assert.strictEqual(res.body.success, false);
		assert.strictEqual(res.body.code, 'UNAUTHORIZED');
	});

	await t.test('GET /api/hosts/ssh-key with valid token returns public key and setup command', async () => {
		const res = await request(app)
			.get('/api/hosts/ssh-key')
			.set('Authorization', `Bearer ${rawToken}`);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.success, true);
		assert.ok(res.body.sshKey, 'Expected sshKey to be returned');
		assert.ok(res.body.setupCommand, 'Expected setupCommand to be returned');
		assert.match(res.body.setupCommand, /authorized_keys/);
	});

	await t.test('POST /api/hosts with missing IP returns 400 JSON', async () => {
		const res = await request(app)
			.post('/api/hosts')
			.set('Authorization', `Bearer ${rawToken}`)
			.send({});

		assert.strictEqual(res.status, 400);
		assert.strictEqual(res.body.success, false);
		assert.match(res.body.error, /IP address is required/i);
	});

	await t.test('POST /api/hosts with valid localhost creates host and returns 201', async () => {
		const res = await request(app)
			.post('/api/hosts')
			.set('Authorization', `Bearer ${rawToken}`)
			.send({ ip: '127.0.0.1' });

		if (!isRoot) {
			// Non-root environment: the route must fail closed and reject the localhost add.
			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.success, false);
			assert.match(res.body.error, /run as root|running in Docker/i);
			return;
		}

		assert.strictEqual(res.status, 201);
		assert.strictEqual(res.body.success, true);
		assert.strictEqual(res.body.host.ip, '127.0.0.1');

		// Verify host exists in DB
		const host = await Host.findOne({ where: { ip: '127.0.0.1' } });
		assert.ok(host);
	});

	await t.test('POST /api/hosts with duplicate IP returns 400 JSON', { skip: isRoot ? false : 'requires root: localhost add is guarded in non-root environments' }, async () => {
		const res = await request(app)
			.post('/api/hosts')
			.set('Authorization', `Bearer ${rawToken}`)
			.send({ ip: '127.0.0.1' });

		assert.strictEqual(res.status, 400);
		assert.strictEqual(res.body.success, false);
		assert.match(res.body.error, /already exists/i);
	});

	await t.test('DELETE /api/hosts/:host removes host and returns 200 JSON', { skip: isRoot ? false : 'requires root: localhost host is never created in non-root environments' }, async () => {
		const res = await request(app)
			.delete('/api/hosts/127.0.0.1')
			.set('Authorization', `Bearer ${rawToken}`);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.success, true);

		// Verify host no longer in DB
		const host = await Host.findOne({ where: { ip: '127.0.0.1' } });
		assert.strictEqual(host, null);
	});

	await t.test('DELETE /api/hosts/:host for non-existent host returns 404 JSON', async () => {
		const res = await request(app)
			.delete('/api/hosts/127.0.0.1')
			.set('Authorization', `Bearer ${rawToken}`);

		assert.strictEqual(res.status, 404);
		assert.strictEqual(res.body.success, false);
	});

	await t.test('DELETE /api/host/:host endpoint also supports deleting hosts', async () => {
		await Host.create({ ip: '127.0.0.1' });

		const res = await request(app)
			.delete('/api/host/127.0.0.1')
			.set('Authorization', `Bearer ${rawToken}`);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.success, true);

		const host = await Host.findOne({ where: { ip: '127.0.0.1' } });
		assert.strictEqual(host, null);
	});
});
