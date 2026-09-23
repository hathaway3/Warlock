import {getAllApplications} from "../libs/get_all_applications.mjs";
import {logger} from "../libs/logger.mjs";
import {getApplicationMetrics} from "../libs/get_application_metrics.mjs";

let isPolling = false;

export async function MetricsPollTask() {
	if (isPolling) {
		logger.debug('MetricsPollTask: Previous poll still active; skipping tick to avoid overlap.');
		return;
	}
	isPolling = true;

	try {
		const results = await getAllApplications();
		let allLookups = [];

		results.forEach(app => {
			for (let hostData of app.installs) {
				allLookups.push(getApplicationMetrics(hostData));
			}
		});

		await Promise.allSettled(allLookups);
		logger.debug('MetricsPollTask: All lookups completed');
	} catch (e) {
		logger.warn('MetricsPollTask: Error polling metrics:', e.message);
	} finally {
		isPolling = false;
	}
}