/**
 * Escapes a string for safe insertion into an AppleScript double-quoted string literal.
 *
 * AppleScript string literals are delimited by `"`. Within them:
 *   - Backslash must be escaped first: \ → \\
 *   - Double-quote must then be escaped: " → \"
 *
 * Callers should always wrap the result in double-quotes, e.g.:
 *   `set myVar to "${escapeAppleScriptString(userInput)}"`
 */
export function escapeAppleScriptString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

/**
 * Formats a JavaScript Date for reliable AppleScript date parsing.
 *
 * Uses en-US locale explicitly so the format is locale-independent
 * (the system locale can vary). AppleScript recognises long-month-name
 * dates such as "March 30, 2026 at 2:30:00 PM".
 */
export function formatDateForAppleScript(d: Date): string {
  return d.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
