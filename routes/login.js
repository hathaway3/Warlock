const express = require('express');
const {User} = require("../db");
const csrf = require('@dr.pogodin/csurf');
const bodyParser = require('body-parser');
const twofactor = require("node-2fa");
const { logger } = require("../libs/logger.mjs");
const { is2faSkipped } = require("../libs/auth-utils.js");

const router = express.Router();
const csrfProtection = csrf({ cookie: true });
const parseForm = bodyParser.urlencoded({ extended: false });

router.get('/', csrfProtection, (req, res) => {
	res.locals.csrfToken = req.csrfToken();
	res.locals.twofactor = !is2faSkipped();

	res.render('login');
});

router.post('/', parseForm, csrfProtection, (req, res) => {
	const {username, password, authcode} = req.body;

	res.locals.csrfToken = req.csrfToken();
	res.locals.twofactor = !is2faSkipped();

	let badPasswordOrCode;
	if (!is2faSkipped()) {
		badPasswordOrCode = 'Invalid username, password, or 2FA code.';
	}
	else {
		badPasswordOrCode = 'Invalid username or password.';
	}

	if ( !username || !password ) {
		return res.render('install', {error: 'Username and password are required.'});
	}

	User.findOne({ where: { username } })
		.then(user => {
			if (!user || !user.validatePassword(password)) {
				return res.render('login', { error: badPasswordOrCode });
			}

			if (!is2faSkipped()) {
				if (user.secret_2fa) {
					if ( !authcode ) {
						return res.render('login', { error: badPasswordOrCode });
					}

					const verification = twofactor.verifyToken(user.secret_2fa, authcode);
					if (!verification || verification.delta !== 0) {
						return res.render('login', { error: badPasswordOrCode });
					}
					req.session.twofa_authenticated = true;
				}
				else {
					// User has not set up 2FA yet
					req.session.user = user.id;
					return res.redirect('/2fa-setup');
				}
			}

			// Set session user
			req.session.user = user.id;
			res.redirect('/dashboard');
		})
		.catch(err => {
			logger.error(`Error during login: ${err.message}`, { error: err.stack });
			res.status(500).send('Internal Server Error');
		});
});

module.exports = router;
