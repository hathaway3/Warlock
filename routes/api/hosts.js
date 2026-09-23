const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {injectHosts} = require("../../libs/inject_hosts.mjs");
const {diffObjects} = require("../../libs/diff_objects.mjs");
const {setupEventStream} = require("../../libs/setup_event_stream.mjs");
const {Host} = require("../../db.js");
const {get_ssh_key} = require("../../libs/get_ssh_key.mjs");
const {exec} = require('child_process');
const {hostPostAdd} = require("../../libs/host_post_add.mjs");
const {clearTaggedCache} = require("../../libs/cache.mjs");
const {logger} = require("../../libs/logger.mjs");
const fs = require('fs');
const crypto = require('crypto');
const cache = require('../../libs/cache.mjs').default;

const router = express.Router();

/**
 * API endpoint to get all enabled hosts and their general information
 *
 * API endpoint: GET /api/hosts
 */
router.get(
	'/',
	validate_session,
	injectHosts,
	(req, res) => {
		return res.json({
			success: true,
			hosts: res.locals.hosts
		});
	}
);

/**
 * API endpoint to get all metrics for enabled hosts
 *
 * API endpoint: GET /api/hosts
 */
router.get(
	'/metrics',
	validate_session,
	injectHosts,
	async (req, res) => {
		let metrics = [];
		for (let host of res.locals.hosts) {
			let m = await host.getMetrics();
			metrics.push(m);
		}

		return res.json({
			success: true,
			metrics: metrics
		});
	}
);

/**
 * Stream "live" metrics and stats for a given service
 *
 * Only updates are sent to the client every 5 seconds.
 */
router.get(
	'/metrics/stream',
	validate_session,
	injectHosts,
	setupEventStream,
	(req, res) => {
		let clientGone = false,
			hosts = res.locals.hosts,
			data = {};

		const lookup = async (host) => {
			if (res.locals.clientGone) return;

			// Get the live metrics for this host
			let metrics = await host.getMetrics();

			if (clientGone) return;
			const diffData = diffObjects(data[host.host], metrics);
			data[host.host] = metrics;

			// Write a response if we have differences.
			if (Object.keys(diffData).length > 0) {
				// Ensure the resulting data contains the host ID, as this will support multiple hosts.
				diffData.host = host.host;
				res.write(`json: ${JSON.stringify(diffData)}\n\n`);
			}

			// Schedule the next lookup in 5 seconds
			setTimeout(lookup,5000, host);
		};

		// Build the initial set of data to use as a local cache.
		// Since we only want to send _changes_, we need to know what we've sent previously.
		for(let host of hosts) {
			data[host.host] = {};
			lookup(host);
		}
	}
);

/**
 * API endpoint to get public SSH key and setup command for new hosts
 *
 * API endpoint: GET /api/hosts/ssh-key
 */
router.get(
	'/ssh-key',
	validate_session,
	(req, res) => {
		try {
			const localKey = get_ssh_key();
			const setupCommand = `if which sudo; then echo "If prompted, please enter your user password."; sudo mkdir -p /root/.ssh && echo "${localKey}" | sudo tee -a /root/.ssh/authorized_keys > /dev/null && sudo chmod og-rwx /root/.ssh -R; else echo "Please enter the ROOT password when prompted."; su - root -c 'mkdir -p /root/.ssh && echo "${localKey}" >> /root/.ssh/authorized_keys && chmod og-rwx /root/.ssh -R'; fi`;
			return res.json({
				success: true,
				sshKey: localKey,
				setupCommand
			});
		} catch (err) {
			logger.error(`Error retrieving SSH key: ${err.message}`, { error: err.stack });
			return res.status(500).json({ success: false, error: 'Failed to retrieve SSH key' });
		}
	}
);

/**
 * Generate a temporary enrollment token and one-line bootstrap command
 *
 * API endpoint: GET /api/hosts/enroll-token
 */
router.get(
	'/enroll-token',
	validate_session,
	(req, res) => {
		try {
			const token = crypto.randomBytes(16).toString('hex');
			cache.set(`enroll_${token}`, { createdAt: Date.now() }, 1800);

			const hostHeader = req.get('host') || '127.0.0.1:3077';
			const protocol = req.protocol || 'http';
			const serverUrl = `${protocol}://${hostHeader}`;
			const command = `curl -sSL "${serverUrl}/api/hosts/enroll.sh?token=${token}" | sudo bash`;

			return res.json({
				success: true,
				token,
				command,
				serverUrl,
				expiresIn: 1800
			});
		} catch (err) {
			logger.error(`Error generating enrollment token: ${err.message}`, { error: err.stack });
			return res.status(500).json({ success: false, error: 'Failed to generate enrollment token' });
		}
	}
);

/**
 * Dynamic shell script for one-line host enrollment
 *
 * API endpoint: GET /api/hosts/enroll.sh?token=<token>
 */
router.get(
	'/enroll.sh',
	(req, res) => {
		const token = req.query.token;
		if (!token || !cache.get(`enroll_${token}`)) {
			res.setHeader('Content-Type', 'text/x-shellscript');
			return res.status(403).send('#!/usr/bin/env bash\necho "Error: Invalid or expired Warlock enrollment token." >&2\nexit 1\n');
		}

		let localKey;
		try {
			localKey = get_ssh_key();
		} catch (e) {
			res.setHeader('Content-Type', 'text/x-shellscript');
			return res.status(500).send('#!/usr/bin/env bash\necho "Error: Server failed to load SSH key." >&2\nexit 1\n');
		}

		const hostHeader = req.get('host') || '127.0.0.1:3077';
		const protocol = req.protocol || 'http';
		const serverUrl = `${protocol}://${hostHeader}`;

		const script = `#!/usr/bin/env bash
set -e

echo "========================================="
echo "   Warlock Host Enrollment Bootstrap     "
echo "========================================="

if [ "$(id -u)" -ne 0 ]; then
    echo "Error: This script must be run as root (e.g. curl ... | sudo bash)" >&2
    exit 1
fi

echo "[*] Ensuring .ssh directory exists..."
mkdir -p /root/.ssh
chmod 700 /root/.ssh

PUB_KEY="${localKey}"

if ! grep -qF "$PUB_KEY" /root/.ssh/authorized_keys 2>/dev/null; then
    echo "$PUB_KEY" >> /root/.ssh/authorized_keys
    echo "[✓] Warlock public key authorized."
else
    echo "[✓] Warlock public key already present in authorized_keys."
fi
chmod 600 /root/.ssh/authorized_keys

# Detect Primary IPv4
HOST_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -n1 || hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$HOST_IP" ]; then
    HOST_IP=$(hostname -i 2>/dev/null | awk '{print $1}')
fi

echo "[*] Detected host IP address: $HOST_IP"

# Call back to Warlock server for automatic registration
echo "[*] Registering host with Warlock fleet manager..."
CALLBACK_RES=$(curl -s -X POST "${serverUrl}/api/hosts/enroll" \\
    -H "Content-Type: application/json" \\
    -d "{\\"token\\":\\"${token}\\",\\"ip\\":\\"$HOST_IP\\"}" 2>/dev/null || true)

if echo "$CALLBACK_RES" | grep -q '"success":true'; then
    echo "========================================="
    echo " [✓] SUCCESS: Host enrolled successfully!"
    echo " Host $HOST_IP is now active in your Warlock fleet."
    echo "========================================="
else
    echo "========================================="
    echo " [✓] SSH key installed successfully."
    echo " Host $HOST_IP is ready. You can now complete"
    echo " registration in the Warlock web console."
    echo "========================================="
fi
`;

		res.setHeader('Content-Type', 'text/x-shellscript');
		return res.send(script);
	}
);

/**
 * Callback endpoint to register an enrolled host
 *
 * API endpoint: POST /api/hosts/enroll
 */
router.post(
	'/enroll',
	async (req, res) => {
		const { token, ip } = req.body || {};
		if (!token || !cache.get(`enroll_${token}`)) {
			return res.status(403).json({ success: false, error: 'Invalid or expired enrollment token.' });
		}
		if (!ip || typeof ip !== 'string' || !ip.trim()) {
			return res.status(400).json({ success: false, error: 'IP address is required for enrollment.' });
		}

		const cleanIp = ip.trim();

		// Check if already registered
		const existing = await Host.findOne({ where: { ip: cleanIp } });
		if (existing) {
			cache.del(`enroll_${token}`);
			return res.json({ success: true, message: 'Host already registered in fleet.', host: existing });
		}

		// Verify SSH connection
		const cmd = `ssh -o LogLevel=quiet -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=5 -o PasswordAuthentication=no root@${cleanIp} echo "SSH Connection Successful"`;
		exec(cmd, async (error) => {
			if (error) {
				logger.warn(`Enrollment SSH verification failed for ${cleanIp}: ${error.message}`);
				return res.status(422).json({
					success: false,
					error: `SSH connection verification failed for ${cleanIp}. Please verify SSH service is running.`
				});
			}

			try {
				const newHost = await Host.create({ ip: cleanIp });
				clearTaggedCache(cleanIp);
				cache.del(`enroll_${token}`);

				hostPostAdd(newHost).catch(err => {
					logger.error(`Error in hostPostAdd for enrolled host ${cleanIp}: ${err.message}`);
				});

				logger.info(`Host ${cleanIp} enrolled successfully via one-line bootstrap.`);
				return res.status(201).json({
					success: true,
					message: 'Host enrolled and registered successfully.',
					host: newHost
				});
			} catch (dbErr) {
				logger.error(`Database error registering host ${cleanIp}: ${dbErr.message}`);
				return res.status(500).json({ success: false, error: 'Database error registering host.' });
			}
		});
	}
);

/**
 * API endpoint to add a new server host
 *
 * API endpoint: POST /api/hosts
 */
router.post(
	'/',
	validate_session,
	async (req, res) => {
		let { ip } = req.body || {};
		if (!ip || typeof ip !== 'string' || !ip.trim()) {
			return res.status(400).json({ success: false, error: 'IP address is required.' });
		}

		ip = ip.trim();

		if (ip === 'localhost' || ip === '127.0.0.1') {
			if (typeof process.getuid === 'function' && process.getuid() !== 0) {
				return res.status(400).json({ success: false, error: 'Adding localhost requires the application to be run as root.' });
			}

			if (fs.existsSync('/.dockerenv')) {
				return res.status(400).json({ success: false, error: 'Adding localhost is not allowed when running in Docker.' });
			}
		}

		// Verify it's not already in the host database
		const existingHost = await Host.findOne({ where: { ip } });
		if (existingHost) {
			return res.status(400).json({ success: false, error: 'Host with this IP already exists.' });
		}

		if (ip === 'localhost' || ip === '127.0.0.1') {
			try {
				const newHost = await Host.create({ ip });
				clearTaggedCache(ip);
				return res.status(201).json({
					success: true,
					message: 'Host added successfully.',
					host: newHost
				});
			} catch (err) {
				logger.error(`Error adding host ${ip} to database: ${err.message}`, { error: err.stack });
				return res.status(500).json({ success: false, error: 'Error adding host to database. Please try again.' });
			}
		}

		// Ensure the local key is available
		let localKey;
		try {
			localKey = get_ssh_key();
		} catch (err) {
			logger.error(`Error retrieving SSH key: ${err.message}`, { error: err.stack });
			return res.status(500).json({ success: false, error: 'Failed to retrieve or generate SSH key.' });
		}

		const setupCommand = `if which sudo; then echo "If prompted, please enter your user password."; sudo mkdir -p /root/.ssh && echo "${localKey}" | sudo tee -a /root/.ssh/authorized_keys > /dev/null && sudo chmod og-rwx /root/.ssh -R; else echo "Please enter the ROOT password when prompted."; su - root -c 'mkdir -p /root/.ssh && echo "${localKey}" >> /root/.ssh/authorized_keys && chmod og-rwx /root/.ssh -R'; fi`;

		// Try a simple SSH connection to verify access
		const cmd = `ssh -o LogLevel=quiet -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=5 -o PasswordAuthentication=no root@${ip} echo "SSH Connection Successful"`;
		exec(cmd, async (error, stdout, stderr) => {
			if (error) {
				logger.error(`SSH connection error for host ${ip}: ${error.message}`);
				return res.status(422).json({
					success: false,
					error: 'Failed to connect via SSH. Please ensure the host is reachable and the SSH key is authorized.',
					sshKey: localKey,
					setupCommand
				});
			}

			if (stderr) {
				logger.warn(`SSH connection stderr for host ${ip}: ${stderr}`);
			}
			logger.debug(`SSH connection stdout for host ${ip}: ${stdout}`);

			try {
				const newHost = await Host.create({ ip });
				hostPostAdd(ip).catch(e => {
					logger.error(`Error during post-add operations for host ${ip}: ${e.message}`, { error: e.stack });
				});
				clearTaggedCache(ip);
				return res.status(201).json({
					success: true,
					message: 'Host added successfully.',
					host: newHost
				});
			} catch (err) {
				logger.error(`Error adding host ${ip} to database: ${err.message}`, { error: err.stack });
				return res.status(500).json({ success: false, error: 'Error adding host to database. Please try again.' });
			}
		});
	}
);

/**
 * API endpoint to delete a host
 *
 * API endpoint: DELETE /api/hosts/:host
 */
router.delete(
	'/:host',
	validate_session,
	async (req, res) => {
		const ip = req.params.host;
		if (!ip) {
			return res.status(400).json({ success: false, error: 'Host IP is required.' });
		}

		try {
			const deletedCount = await Host.destroy({ where: { ip } });
			if (!deletedCount) {
				return res.status(404).json({ success: false, error: 'Host not found or already deleted.' });
			}
			clearTaggedCache(ip);
			return res.json({ success: true, message: 'Host deleted successfully.' });
		} catch (err) {
			logger.error(`Error deleting host ${ip}: ${err.message}`, { error: err.stack });
			return res.status(500).json({ success: false, error: 'Failed to delete host.' });
		}
	}
);

module.exports = router;
