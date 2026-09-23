import { User, ApiToken } from '../db.js';
import crypto from 'crypto';

export const validate_session = async (req, res, next) => {
	const isApiRequest = (req.originalUrl && req.originalUrl.startsWith('/api')) ||
		(req.baseUrl && req.baseUrl.startsWith('/api')) ||
		(req.path && req.path.startsWith('/api'));

	if (process.env.SKIP_AUTHENTICATION === 'true' || process.env.SKIP_AUTHENTICATION === '1') {
		// If authentication is skipped, attach a default user object
		req.user = {
			id: 1,
			username: 'admin',
		};
		return next();
	}

	// 1. Check for Bearer API token in Authorization header (Issue #28)
	const authHeader = req.headers.authorization || req.headers.Authorization;
	if (authHeader && authHeader.startsWith('Bearer ')) {
		const tokenString = authHeader.slice(7).trim();
		if (tokenString) {
			const tokenHash = crypto.createHash('sha256').update(tokenString).digest('hex');
			try {
				const apiToken = await ApiToken.findOne({ where: { token_hash: tokenHash } });
				if (apiToken) {
					// Check expiration if set
					if (apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
						if (isApiRequest) {
							return res.status(401).json({ success: false, error: 'API token expired', code: 'TOKEN_EXPIRED' });
						}
						return res.redirect('/login');
					}

					// Update last used timestamp asynchronously
					apiToken.update({ last_used_at: new Date() }).catch(() => {});

					// Lookup associated user
					const user = await User.findByPk(apiToken.user_id);
					if (user) {
						req.user = {
							id: user.id,
							username: user.username,
							apiTokenId: apiToken.id
						};
						return next();
					}
				}
			} catch (err) {
				console.error('Error validating API token:', err);
				if (isApiRequest) {
					return res.status(500).json({ success: false, error: 'Internal Server Error' });
				}
				return res.status(500).send('Internal Server Error');
			}
		}

		if (isApiRequest) {
			return res.status(401).json({ success: false, error: 'Invalid API token', code: 'UNAUTHORIZED' });
		}
	}

	// 2. Check for cookie-based session
	if (req.session && req.session.user) {
		// Lookup the user in the database to ensure session is valid
		const userId = req.session.user;
		try {
			const user = await User.findByPk(userId);
			if (user) {
				// User exists, proceed to next middleware
				req.user = {
					id: user.id,
					username: user.username,
				};

				// Redirect to a 2FA setup page if 2FA is not configured and we're not already on 2FA setup endpoints
				if (!(process.env.SKIP_2FA === 'true' || process.env.SKIP_2FA === '1')) {
					const is2faSetupEndpoint = req.baseUrl === '/2fa-setup' || (req.originalUrl && req.originalUrl.startsWith('/api/auth/2fa'));
					if (!user.secret_2fa && !is2faSetupEndpoint) {
						if (isApiRequest) {
							return res.status(403).json({ success: false, error: '2FA setup required', code: '2FA_REQUIRED' });
						}
						return res.redirect('/2fa-setup');
					}

					// Check to see if the 2fa successful flag is set in the session for users with 2FA enabled
					if (!req.session.twofa_authenticated && !is2faSetupEndpoint) {
						req.session.destroy(() => {
							if (isApiRequest) {
								return res.status(401).json({ success: false, error: '2FA authentication required', code: 'UNAUTHORIZED' });
							}
							return res.redirect('/login');
						});
						return;
					}
				}

				return next();
			} else {
				// User not found, destroy session and redirect or return 401
				req.session.destroy(() => {
					if (isApiRequest) {
						return res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
					}
					return res.redirect('/login');
				});
				return;
			}
		} catch (err) {
			console.error('Database error during session validation:', err);
			if (isApiRequest) {
				return res.status(500).json({ success: false, error: 'Internal Server Error' });
			}
			return res.status(500).send('Internal Server Error');
		}
	} else {
		// No session or token
		if (isApiRequest) {
			return res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
		}

		User.count().then((count) => {
			if (count === 0) {
				return res.redirect('/install');
			}
			else {
				return res.redirect('/login');
			}
		});
	}
};
