import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { Host } from '../db.js';
import { getAllApplications } from '../libs/get_all_applications.mjs';
import cache from '../libs/cache.mjs';

test('getAllApplications catalog resolution suite', async (t) => {
	let existingHosts = [];

	before(async () => {
		// Save existing hosts and clear table to test 0-host behavior
		existingHosts = await Host.findAll();
		await Host.destroy({ where: {}, truncate: true });
		cache.del('all_applications');
	});

	after(async () => {
		// Restore any previously existing hosts
		for (const h of existingHosts) {
			await Host.create({ ip: h.ip, os: h.os }).catch(() => {});
		}
		cache.del('all_applications');
	});

	await t.test('resolves applications from Apps.yaml when no hosts exist in database', async () => {
		const apps = await getAllApplications();
		assert.ok(Array.isArray(apps), 'Result should be an array');
		assert.ok(apps.length > 0, 'Applications array should not be empty');

		const titles = apps.map(a => a.title);
		assert.ok(titles.includes('Minecraft'), 'Catalog should include Minecraft');
		assert.ok(titles.includes('Palworld'), 'Catalog should include Palworld');

		for (const app of apps) {
			assert.deepStrictEqual(app.installs, [], 'Installs should be empty array when 0 hosts exist');
		}
	});

	await t.test('subsequent calls use cache without mutating installs', async () => {
		const appsFirst = await getAllApplications();
		const appsSecond = await getAllApplications();

		assert.strictEqual(appsFirst.length, appsSecond.length);
		for (const app of appsSecond) {
			assert.deepStrictEqual(app.installs, [], 'Installs should remain empty on cached calls');
		}
	});
});
