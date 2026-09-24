#!/usr/bin/env node
// Cut a release: bump every version file, roll the CHANGELOG, commit, and tag.
// Nothing is pushed — pushing the tag is what triggers the release workflows.
//
// Usage: npm run release -- <patch|minor|major|X.Y.Z> [--dry-run]

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { bumpVersion, setJsonVersion, rollChangelog } from '../libs/release.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_FILES = ['package.json', 'package-lock.json', 'frontend/package.json', 'frontend/package-lock.json'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const kind = args.find((a) => !a.startsWith('--'));

const git = (...gitArgs) => execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).trim();
const fail = (msg) => {
	console.error(`release: ${msg}`);
	process.exit(1);
};

if (!kind) {
	fail('usage: npm run release -- <patch|minor|major|X.Y.Z> [--dry-run]');
}

if (git('status', '--porcelain')) {
	fail('working tree is not clean; commit or stash your changes first');
}
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch !== 'main') {
	fail(`releases are cut from main, but the current branch is "${branch}"`);
}

const current = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
let next;
try {
	next = bumpVersion(current, kind);
} catch (e) {
	fail(e.message);
}
const tag = `v${next}`;
if (git('tag', '--list', tag)) {
	fail(`tag ${tag} already exists`);
}

const date = new Date().toISOString().slice(0, 10);
const writes = new Map();
try {
	for (const file of VERSION_FILES) {
		const { text, oldVersion } = setJsonVersion(fs.readFileSync(path.join(root, file), 'utf8'), next);
		if (oldVersion !== current) {
			console.warn(`release: ${file} was at ${oldVersion} (package.json is at ${current}); syncing it to ${next}`);
		}
		writes.set(file, text);
	}
	writes.set('CHANGELOG.md', rollChangelog(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), next, date));
} catch (e) {
	fail(e.message);
}

console.log(`${current} -> ${next} (${tag}, ${date})`);
for (const file of writes.keys()) console.log(`  update ${file}`);

if (dryRun) {
	console.log('dry run: nothing written, committed, or tagged');
	process.exit(0);
}

for (const [file, text] of writes) {
	fs.writeFileSync(path.join(root, file), text);
}
git('add', ...writes.keys());
git('commit', '-m', `chore(release): ${tag}`);
git('tag', '-a', tag, '-m', `Release ${tag}`);

console.log(`\nCommitted and tagged ${tag}. To publish it (this triggers the Docker Hub and release-branch workflows):\n`);
console.log('  git push origin main --follow-tags');
