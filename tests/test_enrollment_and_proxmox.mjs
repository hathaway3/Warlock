import { test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import crypto from 'crypto';
import app from '../app.js';
import { sequelize, User, ApiToken } from '../db.js';
import { ProxmoxClient } from '../libs/proxmox.mjs';

test('Enrollment Bootstrap and Proxmox Integration Suite', async (t) => {
	let rawToken, testUser;

	before(async () => {
		await sequelize.sync();
		await User.destroy({ where: { username: 'enroll_test_user' } });
		await ApiToken.destroy({ where: { name: 'enroll_test_token' } });

		testUser = await User.create({
			username: 'enroll_test_user',
			password: 'Password123!',
			secret_2fa: 'JBSWY3DPEHPK3PXP'
		});

		rawToken = 'wlk_' + crypto.randomBytes(32).toString('hex');
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

		await ApiToken.create({
			name: 'enroll_test_token',
			token_hash: tokenHash,
			token_prefix: rawToken.slice(0, 8) + '...',
			user_id: testUser.id
		});
	});

	after(async () => {
		if (testUser) {
			await ApiToken.destroy({ where: { user_id: testUser.id } });
			await User.destroy({ where: { id: testUser.id } });
		}
	});

	// 1. Enrollment Token Generation
	await t.test('GET /api/hosts/enroll-token requires authentication', async () => {
		const res = await request(app)
			.get('/api/hosts/enroll-token')
			.set('Accept', 'application/json');

		assert.strictEqual(res.status, 401);
		assert.strictEqual(res.body.success, false);
	});

	let validEnrollToken = null;
	await t.test('GET /api/hosts/enroll-token returns temporary token and bootstrap command', async () => {
		const res = await request(app)
			.get('/api/hosts/enroll-token')
			.set('Authorization', `Bearer ${rawToken}`)
			.set('Accept', 'application/json');

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.success, true);
		assert.ok(res.body.token, 'Token must be present');
		assert.ok(res.body.command.includes('curl -sSL'), 'Command must be curl bootstrap');
		assert.ok(res.body.command.includes(res.body.token), 'Command must include the token');
		validEnrollToken = res.body.token;
	});

	// 2. Dynamic Enrollment Script Serving
	await t.test('GET /api/hosts/enroll.sh rejects request with missing or invalid token', async () => {
		const resNoToken = await request(app).get('/api/hosts/enroll.sh');
		assert.strictEqual(resNoToken.status, 403);
		assert.ok(resNoToken.text.includes('Invalid or expired Warlock enrollment token'));

		const resBadToken = await request(app).get('/api/hosts/enroll.sh?token=not-a-valid-token');
		assert.strictEqual(resBadToken.status, 403);
		assert.ok(resBadToken.text.includes('Invalid or expired Warlock enrollment token'));
	});

	await t.test('GET /api/hosts/enroll.sh serves valid bash script when token is active', async () => {
		assert.ok(validEnrollToken, 'Valid token from previous test is required');

		const res = await request(app).get(`/api/hosts/enroll.sh?token=${validEnrollToken}`);
		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.headers['content-type'], 'text/x-shellscript; charset=utf-8');
		assert.ok(res.text.startsWith('#!/usr/bin/env bash'), 'Script must have bash shebang');
		assert.ok(res.text.includes('authorized_keys'), 'Script must write to authorized_keys');
		assert.ok(res.text.includes('/api/hosts/enroll'), 'Script must call back to /api/hosts/enroll');
		assert.ok(res.text.includes(validEnrollToken), 'Script must contain enrollment token');
	});

	// 3. Callback Registration Endpoint
	await t.test('POST /api/hosts/enroll validates token and parameters', async () => {
		const resNoToken = await request(app)
			.post('/api/hosts/enroll')
			.send({ ip: '10.0.0.99' });
		assert.strictEqual(resNoToken.status, 403);

		const resNoIp = await request(app)
			.post('/api/hosts/enroll')
			.send({ token: validEnrollToken });
		assert.strictEqual(resNoIp.status, 400);
		assert.strictEqual(resNoIp.body.success, false);
	});

	// 4. Proxmox VE Community Script Helper
	await t.test('ProxmoxClient.generateCommunityScriptCommand returns default community-scripts command', () => {
		const cmd = ProxmoxClient.generateCommunityScriptCommand();
		assert.ok(cmd.includes('ct/debian.sh'), 'Command must invoke debian.sh');
		assert.ok(cmd.includes('community-scripts'), 'Command must reference community-scripts');
		assert.ok(cmd.includes('DISK_SIZE=20'), 'Command must set default disk size');
	});

	await t.test('POST /api/proxmox/community-script generates command via API', async () => {
		const res = await request(app)
			.post('/api/proxmox/community-script')
			.set('Authorization', `Bearer ${rawToken}`)
			.send({ cores: 4, ram: 4096 });

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.success, true);
		assert.ok(res.body.command.includes('debian.sh'));
	});

	// 5. Proxmox VE Validation Checks
	await t.test('POST /api/proxmox/test returns 400 when missing credentials', async () => {
		const res = await request(app)
			.post('/api/proxmox/test')
			.set('Authorization', `Bearer ${rawToken}`)
			.send({});

		assert.strictEqual(res.status, 400);
		assert.strictEqual(res.body.success, false);
		assert.ok(res.body.error.includes('required'));
	});

	await t.test('POST /api/proxmox/nodes returns 400 when missing credentials', async () => {
		const res = await request(app)
			.post('/api/proxmox/nodes')
			.set('Authorization', `Bearer ${rawToken}`)
			.send({ host: 'https://pve.local:8006' });

		assert.strictEqual(res.status, 400);
		assert.strictEqual(res.body.success, false);
	});

	await t.test('POST /api/proxmox/provision returns 400 when missing node or credentials', async () => {
		const res = await request(app)
			.post('/api/proxmox/provision')
			.set('Authorization', `Bearer ${rawToken}`)
			.send({ host: 'https://pve.local:8006', tokenUser: 'root@pam' });

		assert.strictEqual(res.status, 400);
		assert.strictEqual(res.body.success, false);
	});
});
