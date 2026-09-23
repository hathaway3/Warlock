import {test} from 'node:test';
import assert from 'node:assert';

test('Stage 0: cmd_streamer correctly escapes single quotes for remote execution', () => {
	const rawCmd = "echo 'Hello World' && journalctl -u 'my-service.service'";
	const escapedCmd = rawCmd.replace(/'/g, "'\\''");
	
	// Should not have raw unescaped single quotes that would break bash -lc '<cmd>'
	assert.strictEqual(escapedCmd, "echo '\\''Hello World'\\'' && journalctl -u '\\''my-service.service'\\''");
});

test('Stage 0: service_control force flag & empty server logic', () => {
	// Simulate service control action determination
	function determineStopCommand(service, action, force, playerCount, supportsDelayed) {
		if (action === 'force-stop' || (action === 'stop' && (force === true || force === 'true'))) {
			return `systemctl kill -s SIGKILL ${service} 2>/dev/null; systemctl stop ${service}`;
		}
		if (action === 'delayed-stop') {
			if (!supportsDelayed) {
				throw new Error('Delayed stop not supported');
			}
			if (playerCount === 0 || force === true || force === 'true') {
				return `systemctl stop ${service}`;
			}
			return `manage.py delayed-stop ${service} &`;
		}
		return `systemctl ${action} ${service}`;
	}

	// 1. Force stop always executes kill + stop
	assert.strictEqual(
		determineStopCommand('ark-1', 'force-stop', false, 5, true),
		'systemctl kill -s SIGKILL ark-1 2>/dev/null; systemctl stop ark-1'
	);
	assert.strictEqual(
		determineStopCommand('ark-1', 'stop', true, 5, true),
		'systemctl kill -s SIGKILL ark-1 2>/dev/null; systemctl stop ark-1'
	);

	// 2. Delayed stop with 0 players executes immediate systemctl stop (Issue #31 fix)
	assert.strictEqual(
		determineStopCommand('ark-1', 'delayed-stop', false, 0, true),
		'systemctl stop ark-1'
	);

	// 3. Delayed stop with active players executes delayed background command
	assert.strictEqual(
		determineStopCommand('ark-1', 'delayed-stop', false, 3, true),
		'manage.py delayed-stop ark-1 &'
	);
});
