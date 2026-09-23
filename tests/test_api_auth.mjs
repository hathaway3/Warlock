import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import twofactor from 'node-2fa';
import app from '../app.js';
import { User, sequelize } from '../db.js';

describe('Auth API & Modern SPA Routing Suite', () => {
	const testUsername = `authtest_${Date.now()}`;
	const testPassword = 'Password123!Secure';
	let user;
	let sessionCookie;
	let totpSecret;

	before(async () => {
		await sequelize.sync();
		user = await User.create({
			username: testUsername,
			password: testPassword,
		});
	});

	after(async () => {
		if (user) {
			await user.destroy().catch(() => {});
		}
	});

	it('POST /api/auth/login with missing fields returns 400 JSON', async () => {
		const res = await request(app)
			.post('/api/auth/login')
			.send({ username: testUsername })
			.expect('Content-Type', /json/)
			.expect(400);

		assert.equal(res.body.success, false);
		assert.match(res.body.error, /Username and password are required/i);
	});

	it('POST /api/auth/login with invalid password returns 401 JSON', async () => {
		const res = await request(app)
			.post('/api/auth/login')
			.send({ username: testUsername, password: 'WrongPassword999!' })
			.expect('Content-Type', /json/)
			.expect(401);

		assert.equal(res.body.success, false);
		assert.match(res.body.error, /Invalid username or password/i);
	});

	it('POST /api/auth/login for user without 2FA triggers require2faSetup and establishes setup session', async () => {
		const res = await request(app)
			.post('/api/auth/login')
			.send({ username: testUsername, password: testPassword })
			.expect('Content-Type', /json/)
			.expect(200);

		assert.equal(res.body.success, false);
		assert.equal(res.body.require2faSetup, true);

		const cookies = res.headers['set-cookie'];
		assert.ok(cookies && cookies.length > 0, 'Expected session cookie to be set');
		sessionCookie = cookies[0];
	});

	it('2FA Setup: GET /api/auth/2fa/setup returns secret and QR', async () => {
		const res = await request(app)
			.get('/api/auth/2fa/setup')
			.set('Cookie', sessionCookie)
			.expect('Content-Type', /json/)
			.expect(200);

		assert.equal(res.body.success, true);
		assert.ok(res.body.secret, 'Expected 2FA secret');
		totpSecret = res.body.secret;
	});

	it('2FA Verify: POST /api/auth/2fa/verify with invalid code fails', async () => {
		const res = await request(app)
			.post('/api/auth/2fa/verify')
			.set('Cookie', sessionCookie)
			.send({ authcode: '000000' })
			.expect('Content-Type', /json/)
			.expect(400);

		assert.equal(res.body.success, false);
	});

	it('2FA Verify: POST /api/auth/2fa/verify with valid token activates 2FA', async () => {
		const validCode = twofactor.generateToken(totpSecret).token;

		const res = await request(app)
			.post('/api/auth/2fa/verify')
			.set('Cookie', sessionCookie)
			.send({ authcode: validCode })
			.expect('Content-Type', /json/)
			.expect(200);

		assert.equal(res.body.success, true);

		// Refresh user from DB and verify secret_2fa is set
		const updated = await User.findByPk(user.id);
		assert.equal(updated.secret_2fa, totpSecret);
	});

	it('GET /api/auth/me with active session returns authenticated user', async () => {
		const res = await request(app)
			.get('/api/auth/me')
			.set('Cookie', sessionCookie)
			.expect('Content-Type', /json/)
			.expect(200);

		assert.equal(res.body.success, true);
		assert.equal(res.body.authenticated, true);
		assert.equal(res.body.user.username, testUsername);
		assert.equal(res.body.user.has2fa, true);
	});

	it('GET /api/auth/me without session cookie returns 401 UNAUTHORIZED', async () => {
		const res = await request(app)
			.get('/api/auth/me')
			.expect('Content-Type', /json/)
			.expect(401);

		assert.equal(res.body.success, false);
		assert.equal(res.body.code, 'UNAUTHORIZED');
	});

	it('POST /api/auth/login for 2FA user without code prompts for 2FA code', async () => {
		const res = await request(app)
			.post('/api/auth/login')
			.send({ username: testUsername, password: testPassword })
			.expect('Content-Type', /json/)
			.expect(200);

		assert.equal(res.body.success, false);
		assert.equal(res.body.require2fa, true);
	});

	it('POST /api/auth/login with valid password and valid 2FA code authenticates successfully', async () => {
		const code = twofactor.generateToken(totpSecret).token;

		const res = await request(app)
			.post('/api/auth/login')
			.send({ username: testUsername, password: testPassword, authcode: code })
			.expect('Content-Type', /json/)
			.expect(200);

		assert.equal(res.body.success, true);
		assert.equal(res.body.user.username, testUsername);
		assert.equal(res.body.user.has2fa, true);
	});

	it('POST /api/auth/logout terminates the session', async () => {
		const res = await request(app)
			.post('/api/auth/logout')
			.set('Cookie', sessionCookie)
			.expect('Content-Type', /json/)
			.expect(200);

		assert.equal(res.body.success, true);

		// Subsequent /api/auth/me should return 401
		await request(app)
			.get('/api/auth/me')
			.set('Cookie', sessionCookie)
			.expect(401);
	});

	it('GET / serves the compiled SPA index.html', async () => {
		const res = await request(app)
			.get('/')
			.expect(200);

		assert.match(res.text, /<div id="root"><\/div>/);
		assert.match(res.text, /Warlock/i);
	});
});
