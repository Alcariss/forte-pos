// Small DOM + formatting helpers. Keep rendering plain (template literals) —
// no framework, no vDOM. See docs/architecture.md.

/** Escape a string for safe insertion into HTML. */
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a CZK amount for display (no decimals by default). */
export function czk(value, decimals = 0) {
  const n = Number(value) || 0;
  return `${n.toLocaleString("cs-CZ", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} Kč`;
}

/** Format a 0..1 fraction as a percentage string. */
export function pct(value, decimals = 0) {
  return `${(Number(value) * 100).toFixed(decimals)} %`;
}

/** Weekday labels, index 0 = Monday (see docs/data-model.md). */
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Tomorrow's weekday in the 0=Mon..6=Sun scheme. */
export function tomorrowWeekday(today = new Date()) {
  return (today.getDay() + 6 + 1) % 7; // getDay: Sun=0 -> Sat=6; +1 for tomorrow
}

/** Map a semantic status to a badge CSS class. */
export function statusClass(status) {
  return status === "danger" ? "danger" : status === "warn" ? "warn" : "safe";
}
