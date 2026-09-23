const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

router.get('/', (req, res) => {
	if (process.env.USE_LEGACY_UI === 'true' || process.env.USE_LEGACY_UI === '1') {
		return res.redirect('/dashboard');
	}

	const spaIndex = path.join(__dirname, '..', 'public', 'dist', 'index.html');
	if (fs.existsSync(spaIndex)) {
		return res.sendFile(spaIndex);
	}

	return res.redirect('/spa');
});

module.exports = router;