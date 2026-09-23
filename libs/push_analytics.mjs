// Telemetry and upstream analytics reporting are disabled in this fork.
// Upstream metrics endpoint (https://metrics.eval.bz/matomo.php) has been removed to avoid
// sending fork usage data or telemetry to the parent project's infrastructure.
// TODO: Implement self-hosted opt-in telemetry if desired in the future.

export function push_analytics(_action) {
	// No-op: Telemetry disabled in this fork
}
