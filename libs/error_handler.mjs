import { logger } from './logger.mjs';

const taglines = [
	'Game over, but the adventure continues.',
	'You missed the jump - try again!',
	'Out of mana, please recharge.',
	'Loot box is empty this time.',
	'Respawn point not found.',
	'The boss dodged your attack.',
	"You've been disconnected from the lobby.",
	"Inventory is full, can't carry more.",
	'Quest objective not completed.',
	'Stealth failed, you’ve been spotted.',
	'No save file found - start a new game.',
	'Your party needs a healer.',
	'Level up before proceeding.',
	'The map is still loading, hang tight.',
	'Achievement locked, requirements not met.',
	'You wandered into a glitch zone.',
	'The server rolled a critical miss.',
	'Your skill is on cooldown.',
	'NPCs are on a coffee break.',
	'The portal is closed for now.',
	'You triggered a hidden trap.',
	'Side quest unavailable at this time.',
	'The game master is AFK.',
	'Your mount ran away - walk instead.',
];

export const errorHandler = (err, req, res, next) => {
	const status = err.status || err.statusCode || 500;

	// Always log the error with request context and stack trace
	const method = req.method || 'GET';
	const url = req.originalUrl || req.url || '/';
	const path = req.path || '';
	logger.error(`[HTTP Error] ${method} ${url} (${status}):`, err);

	// Ensure API and XHR endpoints always receive structured JSON
	const isApiRoute = url.startsWith('/api') || path.startsWith('/api');
	const isXhr = !!req.xhr || (req.headers && req.headers['x-requested-with'] === 'XMLHttpRequest');
	const prefersJson = typeof req.accepts === 'function' ? req.accepts(['json', 'html']) === 'json' : false;

	if (isApiRoute || isXhr || prefersJson) {
		const response = {
			success: false,
			error: err.message || 'An unexpected error occurred',
			code: err.code || (status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR')
		};
		if (process.env.NODE_ENV === 'development') {
			response.stack = err.stack;
		}
		return res.status(status).json(response);
	}

	let tagLine = taglines[Math.floor(Math.random() * taglines.length)];
	return res.status(status).render('error', {error: err, tagLine});
};
