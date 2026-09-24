const express = require('express');
const { User } = require('../../db');
const { validate_session } = require('../../libs/validate_session.mjs');
const twofactor = require('node-2fa');
const { logger } = require('../../libs/logger.mjs');
const { is2faSkipped } = require('../../libs/auth-utils.js');

const router = express.Router();

/**
 * Check Authentication & Installation Status
 * GET /api/auth/status
 */
router.get('/status', async (req, res) => {
	try {
		const userCount = await User.count();
		if (userCount === 0) {
			return res.json({
				success: true,
				needsInstall: true,
				authenticated: false,
			});
		}

		if (req.session && req.session.user) {
			const user = await User.findByPk(req.session.user);
			if (user) {
				const skip2FA = is2faSkipped();
				const is2faSatisfied = skip2FA || !user.secret_2fa || !!req.session.twofa_authenticated;

				return res.json({
					success: true,
					needsInstall: false,
					authenticated: is2faSatisfied,
					user: {
						id: user.id,
						username: user.username,
						has2fa: !!user.secret_2fa,
					},
				});
			}
		}

		return res.json({
			success: true,
			needsInstall: false,
			authenticated: false,
		});
	} catch (err) {
		logger.error('Error checking auth status:', err);
		return res.status(500).json({ success: false, error: 'Internal Server Error' });
	}
});

/**
 * Initial Admin Account Setup
 * POST /api/auth/setup
 * Body: { username, password }
 */
router.post('/setup', async (req, res) => {
	const { username, password } = req.body || {};

	if (!username || !password) {
		return res.status(400).json({
			success: false,
			error: 'Username and password are required',
		});
	}

	if (password.length < 8) {
		return res.status(400).json({
			success: false,
			error: 'Password must be at least 8 characters long',
		});
	}

	try {
		const count = await User.count();
		if (count > 0) {
			return res.status(403).json({
				success: false,
				error: 'Setup already completed. Please log in.',
			});
		}

		const user = await User.create({ username, password });
		req.session.user = user.id;

		const isRoot = process.getuid && process.getuid() === 0;
		const isDocker = require('fs').existsSync('/.dockerenv');
		if (isRoot && !isDocker) {
			const { Host } = require('../../db');
			await Host.create({ ip: '127.0.0.1' }).catch(() => {});
		}

		const skip2FA = is2faSkipped();
		if (skip2FA) {
			req.session.twofa_authenticated = true;
		}

		return res.json({
			success: true,
			user: {
				id: user.id,
				username: user.username,
				has2fa: false,
			},
			require2faSetup: !skip2FA,
		});
	} catch (err) {
		logger.error('Error during initial admin setup:', err);
		return res.status(500).json({
			success: false,
			error: 'Error creating admin user',
		});
	}
});

/**
 * Headless API Login Endpoint
 * POST /api/auth/login
 * Body: { username, password, authcode }
 */
router.post('/login', async (req, res) => {
	const { username, password, authcode } = req.body || {};

	if (!username || !password) {
		return res.status(400).json({
			success: false,
			error: 'Username and password are required',
		});
	}

	const skip2FA = is2faSkipped();

	try {
		const user = await User.findOne({ where: { username } });
		if (!user || !user.validatePassword(password)) {
			return res.status(401).json({
				success: false,
				error: 'Invalid username or password',
			});
		}

		if (!skip2FA) {
			if (user.secret_2fa) {
				if (!authcode) {
					return res.status(200).json({
						success: false,
						require2fa: true,
						error: '2FA authentication code required',
					});
				}

				const verification = twofactor.verifyToken(user.secret_2fa, String(authcode).trim());
				if (!verification || verification.delta !== 0) {
					return res.status(401).json({
						success: false,
						require2fa: true,
						error: 'Invalid 2FA code',
					});
				}
				req.session.twofa_authenticated = true;
			} else {
				// User has not set up 2FA yet
				req.session.user = user.id;
				return res.status(200).json({
					success: false,
					require2faSetup: true,
					userId: user.id,
					message: 'Two-factor authentication setup is required',
				});
			}
		} else {
			req.session.twofa_authenticated = true;
		}

		// Set authenticated user in session
		req.session.user = user.id;

		return res.json({
			success: true,
			user: {
				id: user.id,
				username: user.username,
				has2fa: !!user.secret_2fa,
			},
		});
	} catch (err) {
		logger.error('Error in API login:', err);
		return res.status(500).json({
			success: false,
			error: 'Internal Server Error',
		});
	}
});

/**
 * Get current authenticated user status
 * GET /api/auth/me
 */
router.get('/me', validate_session, async (req, res) => {
	try {
		const user = await User.findByPk(req.user.id);
		if (!user) {
			return res.status(401).json({
				success: false,
				authenticated: false,
				error: 'User not found',
			});
		}

		return res.json({
			success: true,
			authenticated: true,
			user: {
				id: user.id,
				username: user.username,
				has2fa: !!user.secret_2fa,
			},
		});
	} catch (err) {
		logger.error('Error fetching current user:', err);
		return res.status(500).json({
			success: false,
			error: 'Internal Server Error',
		});
	}
});

/**
 * Logout
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
	if (req.session) {
		req.session.destroy(() => {
			res.clearCookie('connect.sid');
			return res.json({ success: true, message: 'Logged out successfully' });
		});
	} else {
		return res.json({ success: true });
	}
});

/**
 * Generate 2FA Secret & QR URI
 * GET /api/auth/2fa/setup
 */
router.get('/2fa/setup', validate_session, async (req, res) => {
	try {
		const user = await User.findByPk(req.user.id);
		if (!user) {
			return res.status(401).json({ success: false, error: 'User not found' });
		}

		const secretObj = twofactor.generateSecret({
			name: 'Warlock',
			account: user.username,
		});

		req.session.setup_2fa = secretObj.secret;

		return res.json({
			success: true,
			secret: secretObj.secret,
			uri: secretObj.uri,
			qr: secretObj.qr,
		});
	} catch (err) {
		logger.error('Error in 2FA setup generation:', err);
		return res.status(500).json({ success: false, error: 'Internal Server Error' });
	}
});

/**
 * Verify and Activate 2FA
 * POST /api/auth/2fa/verify
 * Body: { authcode }
 */
router.post('/2fa/verify', validate_session, async (req, res) => {
	const { authcode } = req.body || {};

	if (!req.session || !req.session.setup_2fa) {
		return res.status(400).json({
			success: false,
			error: 'No active 2FA setup session found. Please re-initiate setup.',
		});
	}

	if (!authcode) {
		return res.status(400).json({
			success: false,
			error: '2FA authentication code is required',
		});
	}

	const verification = twofactor.verifyToken(req.session.setup_2fa, String(authcode).trim());
	if (!verification || verification.delta !== 0) {
		return res.status(400).json({
			success: false,
			error: 'Invalid 2FA verification code. Please check your authenticator app and try again.',
		});
	}

	try {
		const user = await User.findByPk(req.user.id);
		if (!user) {
			return res.status(401).json({ success: false, error: 'User not found' });
		}

		user.secret_2fa = req.session.setup_2fa;
		await user.save();

		delete req.session.setup_2fa;
		req.session.twofa_authenticated = true;

		return res.json({
			success: true,
			message: 'Two-factor authentication successfully enabled',
		});
	} catch (err) {
		logger.error('Error activating 2FA:', err);
		return res.status(500).json({
			success: false,
			error: 'Internal Server Error',
		});
	}
});

module.exports = router;
