import {test} from 'node:test';
import assert from 'node:assert';
import {ProxmoxClient, isProxmoxInsecureAllowed} from '../libs/proxmox.mjs';

function withEnv(name, value, fn) {
	const original = process.env[name];
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
	try {
		return fn();
	} finally {
		if (original === undefined) delete process.env[name];
		else process.env[name] = original;
	}
}

test('isProxmoxInsecureAllowed: false unless PROXMOX_INSECURE is set', () => {
	withEnv('PROXMOX_INSECURE', undefined, () => {
		assert.strictEqual(isProxmoxInsecureAllowed(), false);
	});
	withEnv('PROXMOX_INSECURE', 'true', () => {
		assert.strictEqual(isProxmoxInsecureAllowed(), true);
	});
	withEnv('PROXMOX_INSECURE', '1', () => {
		assert.strictEqual(isProxmoxInsecureAllowed(), true);
	});
	withEnv('PROXMOX_INSECURE', 'yes', () => {
		assert.strictEqual(isProxmoxInsecureAllowed(), false);
	});
});

test('ProxmoxClient: defaults to verifying TLS certificates', () => {
	withEnv('PROXMOX_INSECURE', undefined, () => {
		const client = new ProxmoxClient({host: '10.0.0.5', tokenUser: 'root@pam', tokenId: 'warlock', tokenSecret: 'secret'});
		assert.strictEqual(client.agent.options.rejectUnauthorized, true);
	});
});

test('ProxmoxClient: PROXMOX_INSECURE=1 disables TLS verification by default', () => {
	withEnv('PROXMOX_INSECURE', '1', () => {
		const client = new ProxmoxClient({host: '10.0.0.5', tokenUser: 'root@pam', tokenId: 'warlock', tokenSecret: 'secret'});
		assert.strictEqual(client.agent.options.rejectUnauthorized, false);
	});
});

test('ProxmoxClient: explicit rejectUnauthorized still overrides the env-derived default', () => {
	withEnv('PROXMOX_INSECURE', undefined, () => {
		const client = new ProxmoxClient({host: '10.0.0.5', tokenUser: 'root@pam', tokenId: 'warlock', tokenSecret: 'secret', rejectUnauthorized: false});
		assert.strictEqual(client.agent.options.rejectUnauthorized, false);
	});
});
