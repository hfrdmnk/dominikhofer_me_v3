import { SITE } from "../site";

const zoneParts = new Intl.DateTimeFormat("en-US", {
  timeZone: SITE.timeZone,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zoneOffsetMinutes(date: Date): number {
  const parts = Object.fromEntries(
    zoneParts.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  const wallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((wallClock - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * YAML reads timestamps without an offset as UTC, while Hugo read them in the
 * site time zone. Reinterprets such a value as wall-clock time in Zurich.
 */
export function siteDate(value: string | Date): Date {
  if (value instanceof Date) {
    const guess = new Date(value.getTime() - zoneOffsetMinutes(value) * 60000);
    return new Date(value.getTime() - zoneOffsetMinutes(guess) * 60000);
  }
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return new Date(value);
  return siteDate(new Date(`${value.length === 10 ? `${value}T00:00:00` : value}Z`));
}

const formats = {
  long: { month: "long", day: "numeric", year: "numeric" },
  short: { month: "short", day: "numeric", year: "numeric" },
} as const;

/** "January 2, 2006" or "Jan 2, 2006" */
export function formatDate(date: Date, style: keyof typeof formats = "long"): string {
  return date.toLocaleDateString("en-US", { timeZone: SITE.timeZone, ...formats[style] });
}

/** "2 Jan 2006" */
export function formatDayMonthYear(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    timeZone: SITE.timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2006-01-02" */
export function isoDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: SITE.timeZone });
}

export function year(date: Date): string {
  return isoDate(date).slice(0, 4);
}

function offset(date: Date, separator: string): string {
  const minutes = zoneOffsetMinutes(date);
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}${separator}${String(absolute % 60).padStart(2, "0")}`;
}

function wallClock(date: Date) {
  return Object.fromEntries(
    zoneParts.formatToParts(date).map(({ type, value }) => [type, value]),
  );
}

/** "Mon, 02 Jan 2006 15:04:05 -0700" */
export function rfc822(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { timeZone: SITE.timeZone, weekday: "short" });
  const month = date.toLocaleDateString("en-US", { timeZone: SITE.timeZone, month: "short" });
  const p = wallClock(date);
  return `${weekday}, ${p.day} ${month} ${p.year} ${p.hour}:${p.minute}:${p.second} ${offset(date, "")}`;
}

/** "2006-01-02T15:04:05-07:00" */
export function rfc3339(date: Date): string {
  const p = wallClock(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset(date, ":")}`;
}

/** "15:04" in Zurich */
export function clockTime(date: Date): string {
  const p = wallClock(date);
  return `${p.hour}:${p.minute}`;
}

export function weekday(date: Date): string {
  return date
    .toLocaleDateString("en-US", { timeZone: SITE.timeZone, weekday: "long" })
    .toLowerCase();
}
