/**
 * Safely quote a value for embedding in a POSIX shell command string.
 *
 * Wraps the value in single quotes, which neutralize every shell metacharacter
 * (including `$()`, backticks, `;`, `|`, `&`, and glob characters) except the
 * single quote itself; any embedded single quotes are escaped by closing the
 * quoted string, emitting an escaped literal quote, and reopening it.
 *
 * @param {*} value
 * @returns {string}
 */
export function shellQuote(value) {
	return `'${String(value).replace(/'/g, `'\\''`)}'`;
}
