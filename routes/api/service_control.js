const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const {clearTaggedCache} = require("../../libs/cache.mjs");
const {shellQuote} = require("../../libs/shell_quote.mjs");

const router = express.Router();

/**
 * Control a service on a host
 *
 * API endpoint: POST /api/service/control/:guid/:host/:service
 *
 * Requires a JSON body with the following properties:
 * - action: The action to perform (start, stop, restart, enable, disable, delayed-stop, delayed-restart)
 *
 * (Note, delayed-stop and delayed-restart are only available if the host application has the 'delayed-stop' and 'delayed-restart' options enabled)
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.post('/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	const guid = req.appInstallData.guid,
		host = req.appInstallData.host,
		service = req.serviceData.service,
		{ action, force } = req.body || {};

	const validActions = ['start', 'stop', 'restart', 'enable', 'disable', 'delayed-stop', 'delayed-restart', 'force-stop'];
	if (!validActions.includes(action)) {
		return res.json({
			success: false,
			error: `Invalid action. Must be one of: ${validActions.join(', ')}`
		});
	}

	let clearNeeded = true, cmd;
	// `service` is a lookup value resolved via validateHostService, and `action` is checked
	// against the allowlist above, but both are quoted here defensively before hitting the shell.
	const qService = shellQuote(service),
		qAction = shellQuote(action);

	if (action === 'force-stop' || (action === 'stop' && (force === true || force === 'true'))) {
		// Immediately kill and stop the service without waiting for pre-stop or graceful timeouts
		clearNeeded = false;
		cmd = `systemctl kill -s SIGKILL ${qService} 2>/dev/null; systemctl stop ${qService}`;
	}
	else if (action === 'delayed-stop') {
		if (!req.appInstallData.options.includes('delayed-stop')) {
			return res.json({
				success: false,
				error: `Delayed stop not enabled for host '${host}' in application '${guid}'`
			});
		}

		// If there are zero players connected or force is requested, stop immediately instead of delaying
		const playerCount = typeof req.serviceData.player_count === 'number' ? req.serviceData.player_count : 0;
		if (playerCount === 0 || force === true || force === 'true') {
			clearNeeded = false;
			cmd = `systemctl stop ${qService}`;
		} else {
			clearNeeded = false;
			cmd = req.appInstallData.getServiceCommandString(action, service) + ' &'; // Run in background to avoid waiting for completion
		}
	}
	else if (action === 'delayed-restart') {
		if (!req.appInstallData.options.includes('delayed-restart')) {
			return res.json({
				success: false,
				error: `Delayed restart not enabled for host '${host}' in application '${guid}'`
			});
		}

		const playerCount = typeof req.serviceData.player_count === 'number' ? req.serviceData.player_count : 0;
		if (playerCount === 0 || force === true || force === 'true') {
			clearNeeded = false;
			cmd = `systemctl restart ${qService}`;
		} else {
			clearNeeded = false;
			cmd = req.appInstallData.getServiceCommandString(action, service) + ' &';
		}
	}
	else if (action === 'enable' || action === 'disable') {
		clearNeeded = true;
		cmd = `systemctl ${qAction} ${qService}`;
	}
	else {
		clearNeeded = false;
		cmd = `systemctl ${qAction} ${qService}`;
	}


	cmdRunner(host, cmd)
		.then(result => {
			if (clearNeeded) {
				// On updates to the service state, clear the cache for the application
				clearTaggedCache(req.appInstallData.host, req.appInstallData.guid);
			}

			return res.json({
				success: true,
				output: result.stdout,
				stderr: result.stderr
			});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: e.error ? e.error.message : e.message
			});
		});
});

module.exports = router;
