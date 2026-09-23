const express = require('express');
const { validate_session } = require('../../libs/validate_session.mjs');
const { User, ApiToken } = require('../../db');
const { logger } = require('../../libs/logger.mjs');
const crypto = require('crypto');

const router = express.Router();

// List users (omit password)
router.get('/', validate_session, async (req, res) => {
	try {
		const users = await User.findAll({ attributes: ['id', 'username', 'secret_2fa', 'createdAt', 'updatedAt'] });
		let userData = [];
		for (let user of users) {
			userData.push({
				id: user.id,
				username: user.username,
				secret_2fa: parseInt(user.id) === parseInt(req.user.id) ? user.secret_2fa : !!user.secret_2fa,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt
			});
		}
		return res.json({ success: true, data: userData });
	} catch (e) {
		logger.error('Error fetching users:', e);
		return res.json({ success: false, error: String(e) });
	}
});

// Create user
router.post('/', validate_session, async (req, res) => {
	const { username, password } = req.body || {};
	if (!username || typeof username !== 'string' || username.trim().length === 0) {
		return res.json({ success: false, error: 'Username is required' });
	}
	if (!password || typeof password !== 'string' || password.length < 8) {
		return res.json({ success: false, error: 'Password is required and must be at least 8 characters' });
	}
	try {
		const exists = await User.findOne({ where: { username } });
		if (exists) return res.json({ success: false, error: 'Username already exists' });
		const user = await User.create({ username, password });
		return res.json({ success: true, data: { id: user.id, username: user.username } });
	} catch (e) {
		logger.error('Error creating user:', e);
		return res.json({ success: false, error: String(e) });
	}
});

// Update username
router.put('/:id', validate_session, async (req, res) => {
	const id = req.params.id;
	const { username } = req.body || {};
	if (!username || typeof username !== 'string' || username.trim().length === 0) {
		return res.json({ success: false, error: 'Username is required' });
	}
	try {
		const user = await User.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });
		const exists = await User.findOne({ where: { username } });
		if (exists && exists.id !== user.id) return res.json({ success: false, error: 'Username already in use' });
		user.username = username;
		await user.save();
		return res.json({ success: true, data: { id: user.id, username: user.username } });
	} catch (e) {
		logger.error('Error updating user:', e);
		return res.json({ success: false, error: String(e) });
	}
});

// Change password (admin reset)
router.post('/:id/password', validate_session, async (req, res) => {
	const id = req.params.id;
	const { password } = req.body || {};
	if (!password || typeof password !== 'string' || password.length < 8) {
		return res.json({ success: false, error: 'Password is required and must be at least 8 characters' });
	}
	try {
		const user = await User.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });
		user.password = password; // model hooks will hash on save
		await user.save();
		return res.json({ success: true });
	} catch (e) {
		logger.error('Error changing password:', e);
		return res.json({ success: false, error: String(e) });
	}
});

// Reset 2FA authentication
router.post('/:id/reset2fa', validate_session, async (req, res) => {
	const id = req.params.id;

	try {
		const user = await User.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });
		// Clearing the 2FA secret to force re-setup
		user.secret_2fa = null;
		await user.save();
		return res.json({ success: true });
	} catch (e) {
		logger.error('Error resetting 2FA:', e);
		return res.json({ success: false, error: String(e) });
	}
});

// List API tokens for current user (Issue #28)
router.get('/tokens', validate_session, async (req, res) => {
	try {
		const tokens = await ApiToken.findAll({
			where: { user_id: req.user.id },
			attributes: ['id', 'name', 'token_prefix', 'createdAt', 'last_used_at', 'expires_at']
		});
		return res.json({ success: true, data: tokens });
	} catch (e) {
		logger.error('Error fetching API tokens:', e);
		return res.status(500).json({ success: false, error: String(e) });
	}
});

// Create a new API token for current user (Issue #28)
router.post('/tokens', validate_session, async (req, res) => {
	const { name, expires_in_days } = req.body || {};
	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return res.status(400).json({ success: false, error: 'Token name is required' });
	}

	try {
		const rawToken = 'wlk_' + crypto.randomBytes(32).toString('hex');
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
		const tokenPrefix = rawToken.slice(0, 8) + '...';

		let expiresAt = null;
		if (expires_in_days && Number.isInteger(Number(expires_in_days)) && Number(expires_in_days) > 0) {
			expiresAt = new Date(Date.now() + Number(expires_in_days) * 86400000);
		}

		const apiToken = await ApiToken.create({
			name: name.trim(),
			token_hash: tokenHash,
			token_prefix: tokenPrefix,
			user_id: req.user.id,
			expires_at: expiresAt
		});

		return res.json({
			success: true,
			data: {
				id: apiToken.id,
				name: apiToken.name,
				token_prefix: tokenPrefix,
				token: rawToken, // Returned only once!
				expires_at: expiresAt,
				createdAt: apiToken.createdAt
			}
		});
	} catch (e) {
		logger.error('Error creating API token:', e);
		return res.status(500).json({ success: false, error: String(e) });
	}
});

// Revoke an API token (Issue #28)
router.delete('/tokens/:id', validate_session, async (req, res) => {
	const id = req.params.id;
	try {
		const token = await ApiToken.findOne({ where: { id, user_id: req.user.id } });
		if (!token) {
			return res.status(404).json({ success: false, error: 'API token not found' });
		}
		await token.destroy();
		return res.json({ success: true });
	} catch (e) {
		logger.error('Error revoking API token:', e);
		return res.status(500).json({ success: false, error: String(e) });
	}
});

// Delete user
router.delete('/:id', validate_session, async (req, res) => {
	const id = req.params.id;
	try {
		const user = await User.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });
		await user.destroy();
		return res.json({ success: true });
	} catch (e) {
		logger.error('Error deleting user:', e);
		return res.json({ success: false, error: String(e) });
	}
});

module.exports = router;

