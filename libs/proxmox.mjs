import https from 'https';
import { logger } from './logger.mjs';
import { get_ssh_key } from './get_ssh_key.mjs';

/**
 * Proxmox VE API Client
 *
 * Interacts with Proxmox VE REST API (v2) on port 8006.
 * Supports authentication via Proxmox API Tokens:
 * Authorization: PVEAPIToken=USER@REALM!TOKENID=SECRET
 */
export class ProxmoxClient {
	/**
	 * @param {Object} config
	 * @param {string} config.host - Proxmox host or URL (e.g. "https://192.168.1.50:8006" or "192.168.1.50")
	 * @param {string} config.tokenUser - Proxmox user (e.g. "root@pam" or "warlock@pve")
	 * @param {string} config.tokenId - API token ID (e.g. "warlock")
	 * @param {string} config.tokenSecret - API token secret (UUID)
	 * @param {boolean} [config.rejectUnauthorized=false] - Whether to enforce SSL cert validation
	 */
	constructor({ host, tokenUser, tokenId, tokenSecret, rejectUnauthorized = false }) {
		let cleanHost = host.trim().replace(/\/+$/, '');
		if (!/^https?:\/\//i.test(cleanHost)) {
			cleanHost = `https://${cleanHost}`;
		}
		if (!/:\d+$/.test(cleanHost)) {
			cleanHost = `${cleanHost}:8006`;
		}

		this.baseUrl = cleanHost;
		this.tokenUser = tokenUser;
		this.tokenId = tokenId;
		this.tokenSecret = tokenSecret;
		this.agent = new https.Agent({ rejectUnauthorized });
	}

	/**
	 * Make an HTTP request to Proxmox VE API
	 * @private
	 */
	async request(endpoint, method = 'GET', data = null) {
		const url = new URL(`${this.baseUrl}/api2/json${endpoint}`);
		const authHeader = `PVEAPIToken=${this.tokenUser}!${this.tokenId}=${this.tokenSecret}`;

		let bodyData = null;
		const headers = {
			'Authorization': authHeader,
			'Accept': 'application/json',
		};

		if (data && (method === 'POST' || method === 'PUT')) {
			headers['Content-Type'] = 'application/x-www-form-urlencoded';
			const params = new URLSearchParams();
			for (const [key, value] of Object.entries(data)) {
				if (value !== undefined && value !== null) {
					params.append(key, String(value));
				}
			}
			bodyData = params.toString();
			headers['Content-Length'] = Buffer.byteLength(bodyData);
		}

		return new Promise((resolve, reject) => {
			const req = https.request(
				url,
				{
					method,
					headers,
					agent: this.agent,
					timeout: 15000,
				},
				(res) => {
					let rawData = '';
					res.on('data', (chunk) => {
						rawData += chunk;
					});
					res.on('end', () => {
						try {
							const json = JSON.parse(rawData);
							if (res.statusCode >= 200 && res.statusCode < 300) {
								resolve(json.data !== undefined ? json.data : json);
							} else {
								const errMsg = json.errors ? JSON.stringify(json.errors) : (json.message || `Proxmox returned HTTP ${res.statusCode}`);
								reject(new Error(errMsg));
							}
						} catch (e) {
							if (res.statusCode >= 200 && res.statusCode < 300) {
								resolve(rawData);
							} else {
								reject(new Error(`Proxmox API HTTP ${res.statusCode}: ${rawData.slice(0, 200)}`));
							}
						}
					});
				}
			);

			req.on('timeout', () => {
				req.destroy();
				reject(new Error('Proxmox API request timed out after 15 seconds'));
			});

			req.on('error', (err) => {
				reject(err);
			});

			if (bodyData) {
				req.write(bodyData);
			}
			req.end();
		});
	}

	/**
	 * Verify connection & retrieve Proxmox VE version
	 * @returns {Promise<{release: string, version: string, repoid: string}>}
	 */
	async getVersion() {
		return this.request('/version');
	}

	/**
	 * Retrieve all nodes in the Proxmox cluster
	 * @returns {Promise<Array<{node: string, status: string, cpu: number, maxcpu: number, mem: number, maxmem: number}>>}
	 */
	async getNodes() {
		return this.request('/nodes');
	}

	/**
	 * Retrieve storage pools available on a given node
	 * @param {string} node
	 * @returns {Promise<Array<{storage: string, type: string, content: string, shared: number, active: number}>>}
	 */
	async getStorages(node) {
		return this.request(`/nodes/${encodeURIComponent(node)}/storage`);
	}

	/**
	 * Query the next available VM/CT ID in the cluster
	 * @returns {Promise<number>}
	 */
	async getNextVmId() {
		const nextId = await this.request('/cluster/nextid');
		return parseInt(nextId, 10);
	}

	/**
	 * List LXC OS templates available on a node/storage
	 * @param {string} node
	 * @param {string} storage
	 * @returns {Promise<Array<{volid: string, format: string, size: number}>>}
	 */
	async getTemplates(node, storage) {
		return this.request(`/nodes/${encodeURIComponent(node)}/storage/${encodeURIComponent(storage)}/content?content=vztmpl`);
	}

	/**
	 * Create a new Debian LXC container with Warlock SSH public key injected
	 *
	 * @param {Object} options
	 * @param {string} options.node - Proxmox node name
	 * @param {number} [options.vmid] - CT ID (auto-generated if omitted)
	 * @param {string} [options.hostname] - Hostname (e.g. "warlock-node-01")
	 * @param {string} [options.template] - Full template volid (e.g. "local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst")
	 * @param {string} [options.storage="local-lvm"] - Storage pool for container rootfs
	 * @param {number} [options.disk=20] - Root disk size in GB
	 * @param {number} [options.cores=2] - Allocated CPU cores
	 * @param {number} [options.memory=2048] - Memory in MB
	 * @param {number} [options.swap=512] - Swap in MB
	 * @param {string} [options.bridge="vmbr0"] - Network bridge
	 * @param {string} [options.ip="dhcp"] - IP configuration (default "dhcp")
	 * @param {string} [options.sshKey] - Custom SSH public key (defaults to Warlock's local key)
	 * @param {boolean} [options.start=true] - Auto-start container after creation
	 * @returns {Promise<{vmid: number, upid: string, hostname: string}>}
	 */
	async createDebianLxc({
		node,
		vmid,
		hostname = 'warlock-server-node',
		template,
		storage = 'local-lvm',
		disk = 20,
		cores = 2,
		memory = 2048,
		swap = 512,
		bridge = 'vmbr0',
		ip = 'dhcp',
		sshKey,
		start = true
	}) {
		if (!node) throw new Error('Proxmox node is required to create a container');

		const targetVmId = vmid || await this.getNextVmId();
		const targetSshKey = sshKey || get_ssh_key();

		// Net0 configuration (e.g. "name=eth0,bridge=vmbr0,ip=dhcp,firewall=1")
		const net0 = ip === 'dhcp'
			? `name=eth0,bridge=${bridge},ip=dhcp,firewall=1`
			: `name=eth0,bridge=${bridge},ip=${ip},firewall=1`;

		// Build creation payload
		const payload = {
			vmid: targetVmId,
			hostname,
			cores,
			memory,
			swap,
			rootfs: `${storage}:${disk}`,
			net0,
			'ssh-public-keys': targetSshKey,
			start: start ? 1 : 0,
			features: 'nesting=1',
			unprivileged: 1,
			onboot: 1,
		};

		if (template) {
			payload.ostemplate = template;
		}

		logger.info(`Proxmox: Creating container ${targetVmId} (${hostname}) on node ${node}...`);
		const upid = await this.request(`/nodes/${encodeURIComponent(node)}/lxc`, 'POST', payload);

		return {
			vmid: targetVmId,
			upid,
			hostname
		};
	}

	/**
	 * Retrieve container status
	 * @param {string} node
	 * @param {number} vmid
	 */
	async getContainerStatus(node, vmid) {
		return this.request(`/nodes/${encodeURIComponent(node)}/lxc/${vmid}/status/current`);
	}

	/**
	 * Start a container
	 * @param {string} node
	 * @param {number} vmid
	 */
	async startContainer(node, vmid) {
		return this.request(`/nodes/${encodeURIComponent(node)}/lxc/${vmid}/status/start`, 'POST');
	}

	/**
	 * Retrieve assigned network interfaces and IP addresses of a running container
	 * @param {string} node
	 * @param {number} vmid
	 * @returns {Promise<Array<{name: string, inet?: string, inet6?: string}>>}
	 */
	async getContainerInterfaces(node, vmid) {
		return this.request(`/nodes/${encodeURIComponent(node)}/lxc/${vmid}/interfaces`);
	}

	/**
	 * Generate an unattended community-scripts.org installation command
	 * for users who prefer running the script directly inside Proxmox VE shell.
	 *
	 * Reference: https://community-scripts.org/scripts/debian
	 */
	static generateCommunityScriptCommand({
		disk = 20,
		cores = 2,
		ram = 2048,
		bridge = 'vmbr0',
		vlan = '',
		sshKey
	} = {}) {
		const key = sshKey || get_ssh_key();
		const escapedKey = key.replace(/"/g, '\\"');

		return `bash -c "$(wget -qLO - https://github.com/community-scripts/ProxmoxVE/raw/main/ct/debian.sh)"` +
			` -s CT_TYPE=0 DISK_SIZE=${disk} CORE_COUNT=${cores} RAM_SIZE=${ram} BRG=${bridge}` +
			(vlan ? ` VLAN=${vlan}` : '') +
			` SSH_KEY="${escapedKey}"`;
	}
}
