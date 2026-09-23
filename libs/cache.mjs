import NodeCache from 'node-cache';
import {logger} from "./logger.mjs";

// Bounded cache with 5-minute default TTL, 60s sweep, max 5000 keys, and zero-clone memory efficiency
const cache = new NodeCache({
	stdTTL: 300,
	checkperiod: 60,
	maxKeys: 5000,
	useClones: false
});

const hostTagMap = new Map();

// Evict deleted/expired cache keys from the hostTagMap to prevent memory growth over time
function evictKeyFromTagMap(key) {
	for (const [host, hostEntry] of hostTagMap.entries()) {
		let emptyTags = true;
		for (const tag in hostEntry) {
			const keySet = hostEntry[tag];
			if (keySet && keySet.has(key)) {
				keySet.delete(key);
			}
			if (keySet && keySet.size > 0) {
				emptyTags = false;
			}
		}
		if (emptyTags) {
			hostTagMap.delete(host);
		}
	}
}

cache.on('expired', evictKeyFromTagMap);
cache.on('del', evictKeyFromTagMap);

export default cache;

export const clearCache = () => {
	cache.flushAll();
	hostTagMap.clear();
};

/**
 * Tag a cache key with a host and tag so it can be selectively cleared
 *
 * @param {string}               key  Cache key to tag
 * @param {string}               host Host identifier (IP or hostname) to tag
 * @param {string[]|string|null} tags  Additional tags to support selective cache clearing (e.g. 'app_data', 'service_data')
 */
export const tagCacheKey = (key, host, tags) => {
	tags = tags || '__default__';
	if (!Array.isArray(tags)) {
		tags = [tags];
	}

	tags.forEach(tag => {
		const tagKey = tag || '__default__';
		const hostEntry = hostTagMap.get(host) || {};
		const keySet = hostEntry[tagKey] || new Set();
		keySet.add(key);
		hostEntry[tagKey] = keySet;
		hostTagMap.set(host, hostEntry);
	});
};

/**
 * Clear all values for a given host and optionally only a specific group of tags.
 *
 * @param {string}      host
 * @param {string|null} tag
 */
export const clearTaggedCache = (host, tag = null) => {
	const tagKey = tag || null;
	const hostEntry = hostTagMap.get(host) || {};

	if (tagKey) {
		logger.debug(`Clearing tagged cache for host ${host} with tag ${tagKey}`);
	}
	else {
		logger.debug(`Clearing all cache for host ${host}`);
	}

	if (tagKey === null) {
		// Clear all tagged keys for the specific host
		for (const key in hostEntry) {
			const keys = hostEntry[key] || new Set();
			keys.forEach(k => {
				cache.del(k);
				logger.debug(`Cleared tagged cache key ${k}`);
			});
			delete hostEntry[key];
		}
		hostTagMap.delete(host);
	}
	else {
		const keys = hostEntry[tagKey] || new Set();
		keys.forEach(key => {
			cache.del(key);
			logger.debug(`Cleared cache key ${key}`);
		});
		delete hostEntry[tagKey];
	}
};

/**
 * Returns count of tracked keys in tag map (for monitoring and testing)
 *
 * @param {string|null} host
 * @returns {number}
 */
export const getTagMapSize = (host = null) => {
	if (host) {
		const entry = hostTagMap.get(host);
		if (!entry) return 0;
		let total = 0;
		for (const tag in entry) {
			if (entry[tag] && entry[tag].size) {
				total += entry[tag].size;
			}
		}
		return total;
	}
	return hostTagMap.size;
};

