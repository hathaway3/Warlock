const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * @param {string} version
 * @returns {[number, number, number]}
 */
export function parseVersion(version) {
	const m = SEMVER.exec(version);
	if (!m) {
		throw new Error(`Invalid version "${version}", expected MAJOR.MINOR.PATCH`);
	}
	return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareVersions(a, b) {
	const pa = parseVersion(a), pb = parseVersion(b);
	for (let i = 0; i < 3; i++) {
		if (pa[i] !== pb[i]) return pa[i] - pb[i];
	}
	return 0;
}

/**
 * Compute the next release version.
 *
 * @param {string} current Current MAJOR.MINOR.PATCH version
 * @param {string} kind 'patch' | 'minor' | 'major' | an explicit greater MAJOR.MINOR.PATCH
 * @returns {string}
 */
export function bumpVersion(current, kind) {
	const [major, minor, patch] = parseVersion(current);
	switch (kind) {
		case 'major': return `${major + 1}.0.0`;
		case 'minor': return `${major}.${minor + 1}.0`;
		case 'patch': return `${major}.${minor}.${patch + 1}`;
		default:
			if (compareVersions(kind, current) <= 0) {
				throw new Error(`Explicit version ${kind} must be greater than current ${current}`);
			}
			return kind;
	}
}

/**
 * Version string for a build of the main branch between releases.
 * The commit count only ever grows, so this needs no state and no commit-back.
 *
 * @param {string} baseVersion Version currently in package.json
 * @param {number|string} commitCount `git rev-list --count HEAD`
 * @returns {string}
 */
export function devVersion(baseVersion, commitCount) {
	parseVersion(baseVersion);
	const n = Number(commitCount);
	if (!Number.isInteger(n) || n < 0) {
		throw new Error(`Invalid commit count "${commitCount}"`);
	}
	return `${baseVersion}-dev.${n}`;
}

/**
 * Rewrite the version fields of a package.json (1 field) or package-lock.json (2 fields:
 * top-level and packages[""]) with a targeted text replacement, so the file's existing
 * formatting is untouched. Verifies the result parses and differs only in those fields.
 *
 * @param {string} text File contents
 * @param {string} newVersion
 * @returns {{text: string, oldVersion: string}}
 */
export function setJsonVersion(text, newVersion) {
	const before = JSON.parse(text);
	const oldVersion = before.version;
	parseVersion(oldVersion);
	const isLock = !!(before.packages && before.packages['']);
	const fields = isLock ? 2 : 1;

	const needle = `"version": "${oldVersion}"`;
	let out = text, from = 0;
	for (let i = 0; i < fields; i++) {
		const at = out.indexOf(needle, from);
		if (at === -1) {
			throw new Error(`Could not find version field #${i + 1} (${needle})`);
		}
		const replacement = `"version": "${newVersion}"`;
		out = out.slice(0, at) + replacement + out.slice(at + needle.length);
		from = at + replacement.length;
	}

	const expected = structuredClone(before);
	expected.version = newVersion;
	if (isLock) expected.packages[''].version = newVersion;
	if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(expected)) {
		throw new Error('Refusing to write: version rewrite changed more than the version fields');
	}
	return { text: out, oldVersion };
}

/**
 * Move the current [Unreleased] content under a new dated version heading and leave
 * an empty [Unreleased] on top.
 *
 * @param {string} text CHANGELOG.md contents
 * @param {string} version
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
export function rollChangelog(text, version, date) {
	const heading = '## [Unreleased]';
	const start = text.indexOf(heading);
	if (start === -1) {
		throw new Error('CHANGELOG.md has no "## [Unreleased]" heading');
	}

	const bodyStart = start + heading.length;
	const rest = text.slice(bodyStart);
	const boundary = rest.search(/^(## |\* \*\*🚀)/m);
	const body = boundary === -1 ? rest : rest.slice(0, boundary);
	if (!body.trim()) {
		throw new Error('The [Unreleased] section of CHANGELOG.md is empty; nothing to release');
	}

	return text.slice(0, bodyStart) + `\n\n## [${version}] - ${date}` + rest;
}
