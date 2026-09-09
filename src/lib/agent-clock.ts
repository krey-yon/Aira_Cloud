export function formatAgentClock(now = new Date()): string {
  const utc = now.toISOString();
  const local = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "shortOffset",
  }).format(now);
  return `UTC: ${utc}\nLocal: ${local}`;
}
