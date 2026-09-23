const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {validateHostApplication} = require("../../libs/validate_host_application.mjs");

const router = express.Router();

/**
 * Get the configuration values and settings for a given application
 *
 * API endpoint: GET /api/application/configs/:guid/:host
 *
 * @property {AppInstallData} req.appInstallData
 */
router.get('/:guid/:host', validate_session, validateHostApplication, (req, res) => {

	cmdRunner(req.appInstallData.host, req.appInstallData.getCommandString('get-configs'))
		.then(result => {
			let configs = [];
			try {
				configs = JSON.parse(result.stdout || '[]');
			} catch {
				configs = [];
			}
			return res.json({
				success: true,
				configs: Array.isArray(configs) ? configs : []
			});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: (e && e.error && e.error.message) || (e && e.message) || String(e),
			});
		});
});

/**
 * Update the configuration values and settings for a given application
 *
 * API endpoint: POST /api/application/configs/:guid/:host
 *
 * @property {AppInstallData} req.appInstallData
 */
router.post('/:guid/:host', validate_session, validateHostApplication, async (req, res) => {

	const configUpdates = req.body;
	for (let option in configUpdates) {
		const value = configUpdates[option];
		await cmdRunner(req.appInstallData.host, req.appInstallData.getCommandString('set-config', option, value));
	}

	return res.json({
		success: true,
	});
});

module.exports = router;
