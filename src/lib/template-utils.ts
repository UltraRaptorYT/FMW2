import { RegimentalEntry } from "./template-types";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const DAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDaysLocal(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// Mon–Thu: 2 days (today+tomorrow), Fri: 4 days (Fri–Mon), Sat: 3 (Sat–Mon), Sun: 2 (Sun–Mon)
export function defaultSpanDaysForToday(today: Date) {
  const dow = startOfDay(today).getDay(); // 0 Sun ... 5 Fri ... 6 Sat
  if (dow === 5) return 4;
  if (dow === 6) return 3;
  return 2;
}

export function formatDdMmYy(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function formatRegimental(entries: RegimentalEntry[]) {
  return entries
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((e) => {
      const dayName = DAY_NAMES[e.date.getDay()];
      const dateStr = formatDdMmYy(e.date);

      const crewLines = (e.rcv.crew || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      return `-<${dayName} ${dateStr}>-
DFO- ${e.dfo || "[]"}
UDO- ${e.udo || "[]"}
DUTY CLERK- ${e.dutyClerk || "[]"}

RCV Recovery Duty
CMDR- ${e.rcv.cmdr || "[]"}
2IC- ${e.rcv.ic2 || "[]"}
CREW- ${crewLines.length ? crewLines.map((c) => `\n- ${c}`).join("") : "[]"}

ARV Recover duty
CMDR- ${e.arv.cmdr || "[]"}
DRIVER- ${e.arv.driver || "[]"}
MECHANIC- ${e.arv.mechanic || "[]"}

HRV Recover duty
CMDR- ${e.hrv.cmdr || "[]"}
DRIVER- ${e.hrv.driver || "[]"}
MECHANIC- ${e.hrv.mechanic || "[]"}

-<${dayName} ${dateStr}>-`;
    })
    .join("\n\n");
}

export function buildRoutineOrderText(args: {
  safetyMessage: string;
  eventUpdate: string;
  regimentalDutiesText: string;
  guardDutyText: string;
  today: Date;
}) {
  const {
    safetyMessage,
    eventUpdate,
    regimentalDutiesText,
    guardDutyText,
    today,
  } = args;

  const todayDateString = today.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const dayName = DAY_NAMES[today.getDay()];

  return `**11FMD DRO ${dayName} ${todayDateString}**
**⚠️—CO SAFETY MESSAGE—⚠️**
1. Zero Fatal Injuries
2. Zero Major Injuries
3. Zero Heat Stroke
4. Zero Negligent Discharge of Live Ammunition
5. Zero Severe Vehicle Incidents
6. Zero Severe Workplace Incidents
**⚠️—CO SAFETY MESSAGE—⚠️**

**—SAFETY MESSAGE OF THE DAY—**
${(safetyMessage || "").toUpperCase()}
**—SAFETY MESSAGE OF THE DAY—**

*—UPCOMING EVENTS/NOTICE—*${eventUpdate ? `\n${eventUpdate}\n` : "\n"}*—UPCOMING EVENTS/NOTICE—*

**🪖—REGIMENTAL DUTIES—🪖**${
    regimentalDutiesText ? `\n${regimentalDutiesText}\n` : "\n"
  }**🪖—REGIMENTAL DUTIES—🪖**

**🧙🏻‍♂️—GUARD DUTY—🧙🏻‍♂️**${
    guardDutyText ? `\n${guardDutyText}\n` : "\n"
  }**🧙🏻‍♂️—GUARD DUTY—🧙🏻‍♂️**
`;
}

function monthNameToIndex(name: string) {
  const m = name.trim().toLowerCase();
  const map: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };
  return map[m];
}

/**
 * Keeps only guard duty blocks whose date is >= "today" (inclusive).
 * Works even if date line has extra tokens like: "16/2 (PM) (MONDAY)".
 */
export function pruneGuardDutyList(raw: string, today = new Date()) {
  const text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  const headerMatch = text.match(/^GUARD DUTY\s+([A-Z]+)\s+(\d{4})\s*$/im);

  const headerLine = headerMatch?.[0]?.trim() ?? "";
  const headerMonthName = headerMatch?.[1] ?? "";
  const headerYearStr = headerMatch?.[2] ?? "";

  const headerYear = headerYearStr
    ? Number(headerYearStr)
    : new Date().getFullYear();
  const headerMonthIndex = headerMonthName
    ? monthNameToIndex(headerMonthName)
    : undefined;

  const body = headerLine ? text.replace(headerLine, "").trimStart() : text;

  const dateLineRegex = /^\s*(\d{1,2})\/(\d{1,2})\b.*$/gm;
  const matches = Array.from(body.matchAll(dateLineRegex));
  if (matches.length === 0) return text;

  const today0 = startOfDay(today);

  const blocks = matches.map((m, i) => {
    const start = m.index ?? 0;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1].index ?? body.length)
        : body.length;
    const blockText = body.slice(start, end);

    const day = Number(m[1]);
    const monthNum = Number(m[2]);
    const monthIndexFromLine = monthNum - 1;

    const monthIndex =
      Number.isFinite(monthIndexFromLine) &&
      monthIndexFromLine >= 0 &&
      monthIndexFromLine <= 11
        ? monthIndexFromLine
        : (headerMonthIndex ?? 0);

    const date = new Date(headerYear, monthIndex, day);
    date.setHours(0, 0, 0, 0);

    return { date, text: blockText };
  });

  const kept = blocks.filter((b) => b.date.getTime() >= today0.getTime());

  const cleaned = kept.map((b) =>
    b.text
      .replace(/\s+$/g, "")
      .replace(/(\n\s*=+\s*)+\s*$/g, "")
      .trimEnd(),
  );

  if (cleaned.length === 0) return headerLine ? headerLine : "";

  const separator = "\n\n==============\n\n";
  const rebuiltBody = cleaned.join(separator);

  return headerLine ? `${headerLine}\n\n${rebuiltBody}` : rebuiltBody;
}
