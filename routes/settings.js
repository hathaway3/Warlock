const express = require('express');
const { validate_session } = require('../libs/validate_session.mjs');
const { isAuthSkipped, is2faSkipped } = require('../libs/auth-utils.js');
const router = express.Router();

// Get package version (cached via require). Fallback to 'unknown' on error.
let version = 'unknown';
try {
    const pkg = require('../package.json');
    if (pkg && pkg.version) version = pkg.version;
} catch (err) {
    console.warn('settings: failed to load package.json:', err && err.message);
}

router.get('/', validate_session, (req, res) => {
	res.render(
		'settings', {
			version,
			twofactor: !is2faSkipped(),
			authentication: !isAuthSkipped(),
		}
	);
});

module.exports = router;
