import {test} from 'node:test';
import assert from 'node:assert';
import {execSync} from 'child_process';
import {shellQuote} from '../libs/shell_quote.mjs';

test('shellQuote: wraps plain values in single quotes', () => {
	assert.strictEqual(shellQuote('hello'), "'hello'");
	assert.strictEqual(shellQuote('/var/log/app.log'), "'/var/log/app.log'");
});

test('shellQuote: escapes embedded single quotes', () => {
	assert.strictEqual(shellQuote("it's a file"), "'it'\\''s a file'");
});

test('shellQuote: coerces non-string input', () => {
	assert.strictEqual(shellQuote(123), "'123'");
});

test('shellQuote: neutralizes command substitution when executed in a real shell', () => {
	const malicious = '$(touch /tmp/warlock_shell_quote_pwned)`touch /tmp/warlock_shell_quote_pwned2`';
	const output = execSync(`echo ${shellQuote(malicious)}`).toString();

	// The payload should be echoed back literally, never executed
	assert.strictEqual(output.trim(), malicious);
});

test('shellQuote: neutralizes command chaining/injection attempts', () => {
	const malicious = 'foo"; rm -rf /tmp/warlock_shell_quote_test; echo "pwned';
	const output = execSync(`echo ${shellQuote(malicious)}`).toString();

	assert.strictEqual(output.trim(), malicious);
});

test('shellQuote: survives round-trip inside a nested command substitution', () => {
	// Mirrors the `"$(dirname ${shellQuote(path)})"` pattern used in routes/api/file.js
	const malicious = "/tmp/evil'; echo pwned; echo '/dir/file.txt";
	const output = execSync(`echo "$(dirname ${shellQuote(malicious)})"`).toString();

	assert.strictEqual(output.trim(), "/tmp/evil'; echo pwned; echo '/dir");
});
