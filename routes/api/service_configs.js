const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const cache = require("../../libs/cache.mjs");
const {clearTaggedCache} = require("../../libs/cache.mjs");

const router = express.Router();

/**
 * Get the configuration values and settings for a given service
 *
 * API endpoint: GET /api/service/configs/:guid/:host/:service
 *
 * Returns JSON data with success (True/False) and configs [{Object}]
 * Each config contains:
 * - option: The name of the config
 * - value: The value of the config
 * - default: The default value of the config
 * - type: The type of the config (string, int, bool, etc.)
 * - help: A description of the config
 * - options: List of values available for this config (if applicable)
 * - group: Display group for this config (if applicable)
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.get('/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	cmdRunner(req.appInstallData.host, req.appInstallData.getServiceCommandString('get-configs', req.serviceData.service))
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
				error: (e && e.error && e.error.message) || (e && e.message) || String(e)
			});
		});
});

/**
 * Update the configuration values for a given service
 *
 * API endpoint: POST /api/service/configs/:guid/:host/:service
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.post('/:guid/:host/:service', validate_session, validateHostService, async (req, res) => {
	const configUpdates = req.body;

	// Multiple updates can be sent in a single request, but run them one-at-a-time.
	let errors = '';
	// Some applications (e.g. Palworld) require their REST API enabled for Warlock monitoring;
	// declared per-app via `requiresRestApi` in Apps.yaml rather than hardcoding a GUID here.
	const requiresRestApi = req.applicationData?.requiresRestApi === true;

	for (let option in configUpdates) {
		const value = configUpdates[option];

		if (requiresRestApi && (option === 'RESTAPIEnabled' || option === 'bEnableRESTAPI')) {
			if (value === false || value === 'False' || value === '0' || value === 0) {
				errors += `RESTAPIEnabled is required by Warlock and cannot be disabled for ${req.applicationData?.title || 'this application'}.\n`;
				continue;
			}
		}

		try {
			await cmdRunner(req.appInstallData.host, req.appInstallData.getServiceCommandString('set-config', req.serviceData.service, option, value));
		}
		catch (e) {
			errors += (e.error ? e.error.message : e.message) + '\n';
		}
	}

	// Clear the cache data for this service, useful for keys like name or port.
	clearTaggedCache(req.appInstallData.host, req.appInstallData.guid);

	if (errors) {
		return res.json({
			success: false,
			error: errors
		});
	}
	else {
		return res.json({
			success: true,
		});
	}
});

module.exports = router;
