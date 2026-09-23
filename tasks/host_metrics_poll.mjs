import {logger} from "../libs/logger.mjs";
import {Host} from "../db.js";
import {HostData} from "../libs/host_data.mjs";

let isHostPolling = false;

export async function HostMetricsPollTask() {
	if (isHostPolling) {
		logger.debug('HostMetricsPollTask: Previous host poll still active; skipping tick.');
		return;
	}
	isHostPolling = true;

	try {
		const hosts = await Host.findAll();
		const lookups = hosts.map(async (host) => {
			try {
				let hostData = new HostData(host.ip);
				await hostData.getMetrics();
			} catch (error) {
				logger.error(`HostMetricsPollTask: Error retrieving metrics for host ${host.ip}:`, error);
			}
		});
		await Promise.allSettled(lookups);
	} catch (error) {
		logger.error('HostMetricsPollTask: Error retrieving hosts:', error);
	} finally {
		isHostPolling = false;
	}
}
