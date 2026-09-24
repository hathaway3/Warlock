import {test} from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import {parseVersion, bumpVersion, devVersion, setJsonVersion, rollChangelog} from '../libs/release.mjs';

test('bumpVersion: patch/minor/major reset lower fields', () => {
	assert.strictEqual(bumpVersion('1.3.0', 'patch'), '1.3.1');
	assert.strictEqual(bumpVersion('1.3.9', 'minor'), '1.4.0');
	assert.strictEqual(bumpVersion('1.3.9', 'major'), '2.0.0');
});

test('bumpVersion: explicit version must be greater and well-formed', () => {
	assert.strictEqual(bumpVersion('1.3.0', '1.10.0'), '1.10.0');
	assert.throws(() => bumpVersion('1.3.0', '1.3.0'), /must be greater/);
	assert.throws(() => bumpVersion('1.3.0', '1.2.9'), /must be greater/);
	assert.throws(() => bumpVersion('1.3.0', 'banana'), /Invalid version/);
	assert.throws(() => parseVersion('1.3'), /Invalid version/);
});

test('devVersion: base version plus monotonic commit count', () => {
	assert.strictEqual(devVersion('1.3.0', 412), '1.3.0-dev.412');
	assert.strictEqual(devVersion('1.3.0', '7'), '1.3.0-dev.7');
	assert.throws(() => devVersion('1.3.0', 'abc'), /Invalid commit count/);
	assert.throws(() => devVersion('nope', 1), /Invalid version/);
});

test('setJsonVersion: package.json changes only the version and keeps formatting', () => {
	const text = '{\n  "name": "x",\n  "version": "1.3.0",\n  "scripts": {"a": "1", "b": "2"},\n  "dependencies": {"y": "1.3.0"}\n}';
	const {text: out, oldVersion} = setJsonVersion(text, '1.4.0');
	assert.strictEqual(oldVersion, '1.3.0');
	assert.strictEqual(out, text.replace('"version": "1.3.0"', '"version": "1.4.0"'));
});

test('setJsonVersion: lockfile updates both top-level and packages[""] but not a dependency with the same version', () => {
	const lock = JSON.stringify({
		name: 'x', version: '1.2.2', lockfileVersion: 3,
		packages: {'': {name: 'x', version: '1.2.2'}, 'node_modules/dep': {version: '1.2.2'}},
	}, null, 2);
	const {text: out} = setJsonVersion(lock, '1.3.0');
	const parsed = JSON.parse(out);
	assert.strictEqual(parsed.version, '1.3.0');
	assert.strictEqual(parsed.packages[''].version, '1.3.0');
	assert.strictEqual(parsed.packages['node_modules/dep'].version, '1.2.2');
});

test('setJsonVersion: works on this repo\'s real version files', () => {
	for (const file of ['package.json', 'package-lock.json', 'frontend/package.json', 'frontend/package-lock.json']) {
		const text = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
		const {text: out} = setJsonVersion(text, '99.0.0');
		assert.strictEqual(JSON.parse(out).version, '99.0.0', file);

		const before = text.split('\n'), after = out.split('\n');
		assert.strictEqual(after.length, before.length, file);
		const changed = after.filter((line, i) => line !== before[i]);
		assert.ok(changed.length >= 1 && changed.length <= 2, `${file}: ${changed.length} lines changed`);
		assert.ok(changed.every((line) => line.includes('"version": "99.0.0"')), file);
	}
});

test('rollChangelog: moves Unreleased content under a dated heading and leaves an empty Unreleased', () => {
	const text = '# Changelog\n\n## [Unreleased]\n*   **Fixed:**\n    *   thing\n\n* **🚀 v1.3.0 - 2026-09-23**\n    *   old\n';
	const out = rollChangelog(text, '1.4.0', '2026-10-01');
	assert.ok(out.includes('## [Unreleased]\n\n## [1.4.0] - 2026-10-01\n*   **Fixed:**'));
	assert.ok(out.indexOf('## [1.4.0]') < out.indexOf('v1.3.0'));
});

test('rollChangelog: refuses an empty Unreleased section or a missing heading', () => {
	assert.throws(() => rollChangelog('# C\n\n## [Unreleased]\n\n## [1.2.2] - 2026-05-25\n- x\n', '1.3.0', '2026-01-01'), /empty/);
	assert.throws(() => rollChangelog('# C\n', '1.3.0', '2026-01-01'), /no "## \[Unreleased\]"/);
});

test('rollChangelog: works on this repo\'s real CHANGELOG', () => {
	const text = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
	const out = rollChangelog(text, '9.9.9', '2099-01-01');
	assert.ok(out.includes('## [Unreleased]\n\n## [9.9.9] - 2099-01-01'));
});
