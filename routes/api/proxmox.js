const express = require('express');
const { validate_session } = require('../../libs/validate_session.mjs');
const { logger } = require('../../libs/logger.mjs');
const { Host } = require('../../db.js');
const { clearTaggedCache } = require('../../libs/cache.mjs');
const { hostPostAdd } = require('../../libs/host_post_add.mjs');

const router = express.Router();

/**
 * Helper to dynamically load the ESM ProxmoxClient module
 */
async function getProxmoxClient(config) {
	const mod = await import('../../libs/proxmox.mjs');
	return new mod.ProxmoxClient(config);
}

/**
 * Verify Proxmox VE connection credentials
 *
 * POST /api/proxmox/test
 * Payload: { host, tokenUser, tokenId, tokenSecret }
 */
router.post('/test', validate_session, async (req, res) => {
	const { host, tokenUser, tokenId, tokenSecret } = req.body || {};

	if (!host || !tokenUser || !tokenId || !tokenSecret) {
		return res.status(400).json({
			success: false,
			error: 'Host, tokenUser, tokenId, and tokenSecret are required.'
		});
	}

	try {
		// TLS verification policy is controlled server-side (PROXMOX_INSECURE env var), never by the client.
		const client = await getProxmoxClient({ host, tokenUser, tokenId, tokenSecret });
		const version = await client.getVersion();
		return res.json({
			success: true,
			message: 'Connected to Proxmox VE successfully',
			version
		});
	} catch (err) {
		logger.error('Proxmox test connection error:', err);
		return res.status(502).json({
			success: false,
			error: `Failed to connect to Proxmox VE: ${err.message}`
		});
	}
});

/**
 * Discover cluster nodes and storage pools
 *
 * POST /api/proxmox/nodes
 * Payload: { host, tokenUser, tokenId, tokenSecret }
 */
router.post('/nodes', validate_session, async (req, res) => {
	const { host, tokenUser, tokenId, tokenSecret } = req.body || {};

	if (!host || !tokenUser || !tokenId || !tokenSecret) {
		return res.status(400).json({
			success: false,
			error: 'Proxmox connection credentials are required.'
		});
	}

	try {
		// TLS verification policy is controlled server-side (PROXMOX_INSECURE env var), never by the client.
		const client = await getProxmoxClient({ host, tokenUser, tokenId, tokenSecret });
		const nodes = await client.getNodes();

		const nodesWithStorage = await Promise.all(
			nodes.map(async (n) => {
				try {
					const storages = await client.getStorages(n.node);
					return {
						...n,
						storages: storages.filter((s) => s.active && (s.content.includes('rootdir') || s.content.includes('images')))
					};
				} catch {
					return { ...n, storages: [] };
				}
			})
		);

		return res.json({
			success: true,
			nodes: nodesWithStorage
		});
	} catch (err) {
		logger.error('Proxmox nodes query error:', err);
		return res.status(502).json({
			success: false,
			error: `Error querying Proxmox nodes: ${err.message}`
		});
	}
});

/**
 * Generate community-scripts.org helper command
 *
 * POST /api/proxmox/community-script
 */
router.post('/community-script', validate_session, async (req, res) => {
	const { disk, cores, ram, bridge, vlan } = req.body || {};
	try {
		const mod = await import('../../libs/proxmox.mjs');
		const command = mod.ProxmoxClient.generateCommunityScriptCommand({ disk, cores, ram, bridge, vlan });
		return res.json({
			success: true,
			command
		});
	} catch (err) {
		return res.status(500).json({ success: false, error: err.message });
	}
});

/**
 * Provision a new Debian LXC container on Proxmox VE and auto-register it as a Warlock host
 *
 * POST /api/proxmox/provision
 */
router.post('/provision', validate_session, async (req, res) => {
	const {
		host,
		tokenUser,
		tokenId,
		tokenSecret,
		node,
		hostname = 'warlock-game-node',
		storage = 'local-lvm',
		cores = 2,
		memory = 2048,
		disk = 20,
		bridge = 'vmbr0'
	} = req.body || {};

	if (!host || !tokenUser || !tokenId || !tokenSecret || !node) {
		return res.status(400).json({
			success: false,
			error: 'Host, credentials, and target Proxmox node are required.'
		});
	}

	try {
		// TLS verification policy is controlled server-side (PROXMOX_INSECURE env var), never by the client.
		const client = await getProxmoxClient({ host, tokenUser, tokenId, tokenSecret });

		// 1. Create the container with Warlock SSH key injected
		const createResult = await client.createDebianLxc({
			node,
			hostname,
			storage,
			cores,
			memory,
			disk,
			bridge,
			start: true
		});

		logger.info(`Proxmox: Created LXC CT ${createResult.vmid} on node ${node}`);

		return res.status(202).json({
			success: true,
			message: `Debian container (CT ${createResult.vmid}) creation started on Proxmox node ${node}.`,
			vmid: createResult.vmid,
			hostname: createResult.hostname
		});
	} catch (err) {
		logger.error('Proxmox provisioning error:', err);
		return res.status(502).json({
			success: false,
			error: `Proxmox container provisioning failed: ${err.message}`
		});
	}
});

module.exports = router;
