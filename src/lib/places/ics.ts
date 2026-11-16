import { normalizePlanTime } from "@/lib/validation/plans";

export interface PlanIcsSource {
  id: string;
  plannedFor: string;
  plannedTime: string | null;
  note: string | null;
  restaurant: {
    name: string;
    address: string | null;
    city: string | null;
    cuisines: string[];
    googleMapsUri: string | null;
  };
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return parts.join("\r\n");
}

function formatUtcTimestamp(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function addDaysYmd(isoDate: string, deltaDays: number): string {
  const [y = 1970, m = 1, d = 1] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = String(dt.getUTCFullYear()).padStart(4, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export function buildPlanIcsContent(plan: PlanIcsSource, now: Date = new Date()): string {
  const ymd = plan.plannedFor.replace(/-/g, "");
  const time = normalizePlanTime(plan.plannedTime);

  let dtStartLine: string;
  let dtEndLine: string;

  if (time) {
    const [hh = "19", mm = "00"] = time.split(":");
    const startTotalMins = Number(hh) * 60 + Number(mm);
    const endTotalMins = startTotalMins + 90;
    const endDayOffset = Math.floor(endTotalMins / (24 * 60));
    const endMinutesInDay = endTotalMins % (24 * 60);
    const endYmd = addDaysYmd(plan.plannedFor, endDayOffset);
    const endHh = String(Math.floor(endMinutesInDay / 60)).padStart(2, "0");
    const endMm = String(endMinutesInDay % 60).padStart(2, "0");

    dtStartLine = `DTSTART:${ymd}T${hh}${mm}00`;
    dtEndLine = `DTEND:${endYmd}T${endHh}${endMm}00`;
  } else {
    dtStartLine = `DTSTART;VALUE=DATE:${ymd}`;
    dtEndLine = `DTEND;VALUE=DATE:${addDaysYmd(plan.plannedFor, 1)}`;
  }

  const location = plan.restaurant.address ?? plan.restaurant.city ?? "";
  const descriptionParts: string[] = [];
  if (plan.note?.trim()) {
    descriptionParts.push(plan.note.trim());
  }
  if (plan.restaurant.cuisines.length > 0) {
    descriptionParts.push(`Cuisines: ${plan.restaurant.cuisines.slice(0, 3).join(", ")}`);
  }
  if (plan.restaurant.googleMapsUri) {
    descriptionParts.push(`Google Maps: ${plan.restaurant.googleMapsUri}`);
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Resker//Restaurant Tracker//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${plan.id}@resker.app`,
    `DTSTAMP:${formatUtcTimestamp(now)}`,
    dtStartLine,
    dtEndLine,
    `SUMMARY:${escapeIcsText(`Dinner at ${plan.restaurant.name}`)}`,
  ];

  if (location) {
    lines.push(`LOCATION:${escapeIcsText(location)}`);
  }
  if (descriptionParts.length > 0) {
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`);
  }
  if (plan.restaurant.googleMapsUri) {
    lines.push(`URL:${plan.restaurant.googleMapsUri}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function buildPlanIcsFilename(name: string, plannedFor: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "reservation"}-${plannedFor}.ics`;
}

export function downloadPlanIcs(plan: PlanIcsSource): void {
  const ics = buildPlanIcsContent(plan);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildPlanIcsFilename(plan.restaurant.name, plan.plannedFor);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
