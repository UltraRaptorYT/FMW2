"use client";

import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format, addDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

type TemplateField = {
  key: string;
  label: string;
  type: "input" | "textarea" | "select" | "date" | "checkbox";
  placeholder?: string;
  options?: string[];
  required?: boolean;
  pattern?: string;
  errorMessage?: string;
  default?: string;
  showIf?: { key: string; equals: string };
};

type TemplateDefinition = {
  name: string;
  fields: TemplateField[];
  generate: (fields: Record<string, string>) => string;
  customUI?: boolean;
};

type ICType = "2IC" | "3IC" | "4IC";

type GuardDutyEntry = {
  date: Date;
  icTypes: ICType[];
  numGuards: number;
};

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
 * Assumes format:
 *   GUARD DUTY FEBRUARY 2026
 *   7/2 (SATURDAY)
 *   ...
 *   ==============
 *   9/2 (MONDAY)
 *   ...
 *
 * Works even if date line has extra tokens like: "16/2 (PM) (MONDAY)".
 */
function pruneGuardDutyList(raw: string, today = new Date()) {
  const text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  // Header: "GUARD DUTY FEBRUARY 2026"
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

  // Remove header from body (keep body for block parsing)
  const body = headerLine ? text.replace(headerLine, "").trimStart() : text;

  // Find date-line indices
  const dateLineRegex = /^\s*(\d{1,2})\/(\d{1,2})\b.*$/gm;
  const matches = Array.from(body.matchAll(dateLineRegex));

  if (matches.length === 0) {
    // If it doesn't match expected structure, just return as-is
    return text;
  }

  const today0 = startOfDay(today);

  // Slice into blocks by date-line positions
  const blocks = matches.map((m, i) => {
    const start = m.index ?? 0;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1].index ?? body.length)
        : body.length;
    const blockText = body.slice(start, end);

    const day = Number(m[1]);
    const monthNum = Number(m[2]); // 1..12 from the line
    const monthIndexFromLine = monthNum - 1;

    // Prefer month from line; fallback to header month if needed
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

  // Strip any trailing separator(s) at the end of each kept block,
  // then join with a single standard separator
  const cleaned = kept.map((b) =>
    b.text
      .replace(/\s+$/g, "")
      .replace(/(\n\s*=+\s*)+\s*$/g, "")
      .trimEnd(),
  );

  if (cleaned.length === 0) {
    // Nothing upcoming: still show header (or blank)
    return headerLine ? headerLine : "";
  }

  const separator = "\n\n==============\n\n";
  const rebuiltBody = cleaned.join(separator);

  return headerLine ? `${headerLine}\n\n${rebuiltBody}` : rebuiltBody;
}

type RecoveryDuty = {
  cmdr: string;
  ic2: string;
  crew: string; // multiline
};

type VehicleRecoveryDuty = {
  cmdr: string;
  driver: string;
  mechanic: string;
};

type RegimentalEntry = {
  date: Date;
  dfo: string;
  udo: string;
  dutyClerk: string;
  rcv: RecoveryDuty;
  arv: VehicleRecoveryDuty;
  hrv: VehicleRecoveryDuty;
};

const ROUTINE_STORAGE_KEY = "fmw2:routineOrder";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDaysLocal(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// Mon–Thu: 2 days (today+tomorrow), Fri: 4 days (Fri–Mon), Sat: 3 (Sat–Mon), Sun: 2 (Sun–Mon)
function defaultSpanDaysForToday(today: Date) {
  const dow = startOfDay(today).getDay(); // 0 Sun ... 5 Fri ... 6 Sat
  if (dow === 5) return 4;
  if (dow === 6) return 3;
  return 2;
}

function formatDdMmYy(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function formatRegimental(entries: RegimentalEntry[]) {
  return entries
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

function buildRoutineOrderText(args: {
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

**🪖—REGIMENTAL DUTIES—🪖**${regimentalDutiesText ? `\n${regimentalDutiesText}\n` : "\n"}**🪖—REGIMENTAL DUTIES—🪖**

**🧙🏻‍♂️—GUARD DUTY—🧙🏻‍♂️**${guardDutyText ? `\n${guardDutyText}\n` : "\n"}**🧙🏻‍♂️—GUARD DUTY—🧙🏻‍♂️**
`;
}

function RoutineOrderUI({
  onGenerate,
}: {
  onGenerate: (result: string) => void;
}) {
  const todayRef = useRef<Date>(startOfDay(new Date()));
  const today = todayRef.current;

  const [hydrated, setHydrated] = useState(false);

  const [safetyMessage, setSafetyMessage] = useState("");
  const [eventUpdate, setEventUpdate] = useState("");
  const [guardDutyText, setGuardDutyText] = useState("");

  const [spanDays, setSpanDays] = useState(() =>
    defaultSpanDaysForToday(today),
  );
  const [entries, setEntries] = useState<RegimentalEntry[]>([]);

  // init entries (today -> today+spanDays-1)
  const ensureEntries = (baseDate: Date, days: number) => {
    const base0 = startOfDay(baseDate);
    const wanted = Array.from({ length: days }, (_, i) =>
      startOfDay(addDaysLocal(base0, i)),
    );

    setEntries((prev) => {
      // keep existing values by matching date
      const byKey = new Map(
        prev.map((e) => [startOfDay(e.date).toDateString(), e]),
      );

      return wanted.map((d) => {
        const key = d.toDateString();
        const existing = byKey.get(key);
        if (existing) return { ...existing, date: d };

        return {
          date: d,
          dfo: "",
          udo: "",
          dutyClerk: "",
          rcv: { cmdr: "", ic2: "", crew: "" },
          arv: { cmdr: "", driver: "", mechanic: "" },
          hrv: { cmdr: "", driver: "", mechanic: "" },
        };
      });
    });
  };

  // load saved
  useEffect(() => {
    const saved = localStorage.getItem(ROUTINE_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        setSafetyMessage(parsed.safetyMessage ?? "");
        setEventUpdate(parsed.eventUpdate ?? "");
        setGuardDutyText(parsed.guardDutyText ?? "");
        setSpanDays(parsed.spanDays ?? defaultSpanDaysForToday(today));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsedEntries = (parsed.entries ?? []).map((e: any) => ({
          ...e,
          date: new Date(e.date),
        }));
        setEntries(parsedEntries);
        setHydrated(true);
        return;
      } catch {
        // fallback to default
        // ensureEntries(today, defaultSpanDaysForToday(today));
      }
    } else {
      // ensureEntries(today, defaultSpanDaysForToday(today));
    }
    const def = defaultSpanDaysForToday(today);
    setSpanDays(def);
    ensureEntries(today, def);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep entries aligned when spanDays changes (AFTER hydration)
  useEffect(() => {
    if (!hydrated) return;
    ensureEntries(today, spanDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, spanDays]);

  // save (AFTER hydration)
  useEffect(() => {
    if (!hydrated) return;

    localStorage.setItem(
      ROUTINE_STORAGE_KEY,
      JSON.stringify({
        safetyMessage,
        eventUpdate,
        guardDutyText,
        spanDays,
        entries,
      }),
    );
  }, [hydrated, safetyMessage, eventUpdate, guardDutyText, spanDays, entries]);

  const updateEntry = (idx: number, patch: Partial<RegimentalEntry>) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  };

  const handleGenerate = () => {
    const regimentalDutiesText = formatRegimental(entries);

    const prunedGuardDuty = pruneGuardDutyList(guardDutyText, today);

    const result = buildRoutineOrderText({
      safetyMessage,
      eventUpdate,
      regimentalDutiesText,
      guardDutyText: prunedGuardDuty,
      today,
    });

    onGenerate(result.trimEnd());
    toast.success("Routine Order Generated!");
  };

  return (
    <div className="space-y-5">
      <div>
        <Label>Safety Message</Label>
        <Input
          value={safetyMessage}
          onChange={(e) => setSafetyMessage(e.target.value)}
          placeholder="Input Safety Message"
        />
      </div>

      <div>
        <Label>Upcoming Events / Notice</Label>
        <Textarea
          value={eventUpdate}
          onChange={(e) => setEventUpdate(e.target.value)}
          placeholder="e.g. upcoming launch discussion"
          className="min-h-[100px]"
        />
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label>Send which days?</Label>
          <Select
            value={String(spanDays)}
            onValueChange={(v) => setSpanDays(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Today only</SelectItem>
              <SelectItem value="2">Today + Tomorrow (default)</SelectItem>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="4">4 days (Fri–Mon)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setSpanDays(defaultSpanDaysForToday(today));
            toast.info("Reset to default span for today");
          }}
        >
          Use Default Rule
        </Button>
      </div>

      <div className="space-y-3">
        <Label>Regimental Duties</Label>

        {entries.map((entry, idx) => (
          <div
            key={entry.date.toISOString()}
            className="border rounded-lg p-3 space-y-3"
          >
            <div className="font-medium">
              {format(entry.date, "d MMM yyyy")} (
              {DAY_NAMES[entry.date.getDay()]})
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">DFO</Label>
                <Input
                  value={entry.dfo}
                  onChange={(e) => updateEntry(idx, { dfo: e.target.value })}
                  placeholder="[12] ME4 ONG SOON KWEE"
                />
              </div>
              <div>
                <Label className="text-xs">UDO</Label>
                <Input
                  value={entry.udo}
                  onChange={(e) => updateEntry(idx, { udo: e.target.value })}
                  placeholder="[11] 2LT XANDER LIEW YI"
                />
              </div>
              <div>
                <Label className="text-xs">Duty Clerk</Label>
                <Input
                  value={entry.dutyClerk}
                  onChange={(e) =>
                    updateEntry(idx, { dutyClerk: e.target.value })
                  }
                  placeholder="[S4] 3SG YONG YONG LIANG"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">RCV CMDR</Label>
                <Input
                  value={entry.rcv.cmdr}
                  onChange={(e) =>
                    updateEntry(idx, {
                      rcv: { ...entry.rcv, cmdr: e.target.value },
                    })
                  }
                  placeholder="[]"
                />
              </div>
              <div>
                <Label className="text-xs">RCV 2IC</Label>
                <Input
                  value={entry.rcv.ic2}
                  onChange={(e) =>
                    updateEntry(idx, {
                      rcv: { ...entry.rcv, ic2: e.target.value },
                    })
                  }
                  placeholder="[]"
                />
              </div>
              <div>
                <Label className="text-xs">RCV CREW</Label>
                <Input
                  value={entry.rcv.crew}
                  onChange={(e) =>
                    updateEntry(idx, {
                      rcv: { ...entry.rcv, crew: e.target.value },
                    })
                  }
                  placeholder="[]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">ARV CMDR</Label>
                <Input
                  value={entry.arv.cmdr}
                  onChange={(e) =>
                    updateEntry(idx, {
                      arv: { ...entry.arv, cmdr: e.target.value },
                    })
                  }
                  placeholder="[]"
                />
              </div>
              <div>
                <Label className="text-xs">ARV DRIVER</Label>
                <Input
                  value={entry.arv.driver}
                  onChange={(e) =>
                    updateEntry(idx, {
                      arv: { ...entry.arv, driver: e.target.value },
                    })
                  }
                  placeholder="[]"
                />
              </div>
              <div>
                <Label className="text-xs">ARV MECHANIC</Label>
                <Input
                  value={entry.arv.mechanic}
                  onChange={(e) =>
                    updateEntry(idx, {
                      arv: { ...entry.arv, mechanic: e.target.value },
                    })
                  }
                  placeholder="[]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">HRV CMDR</Label>
                <Input
                  value={entry.hrv.cmdr}
                  onChange={(e) =>
                    updateEntry(idx, {
                      hrv: { ...entry.hrv, cmdr: e.target.value },
                    })
                  }
                  placeholder="[]"
                />
              </div>
              <div>
                <Label className="text-xs">HRV DRIVER</Label>
                <Input
                  value={entry.hrv.driver}
                  onChange={(e) =>
                    updateEntry(idx, {
                      hrv: { ...entry.hrv, driver: e.target.value },
                    })
                  }
                  placeholder="[]"
                />
              </div>
              <div>
                <Label className="text-xs">HRV MECHANIC</Label>
                <Input
                  value={entry.hrv.mechanic}
                  onChange={(e) =>
                    updateEntry(idx, {
                      hrv: { ...entry.hrv, mechanic: e.target.value },
                    })
                  }
                  placeholder="[]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <Label>Guard Duty (paste your generated list)</Label>
        <Textarea
          value={guardDutyText}
          onChange={(e) => setGuardDutyText(e.target.value)}
          placeholder="Paste guard duty list here"
          className="min-h-[140px] max-h-[250px]"
        />
      </div>

      <Button onClick={handleGenerate} className="w-full">
        Generate Routine Order
      </Button>
    </div>
  );
}

const templates: Record<string, TemplateDefinition> = {
  offAwarded: {
    name: "Off Awarded",
    fields: [
      {
        key: "rank",
        label: "Rank",
        type: "select",
        options: [
          "REC",
          "PTE",
          "LCP",
          "CPL",
          "CFC",
          "3SG",
          "2SG",
          "2LT",
          "LTA",
          "ME1T",
          "ME1",
          "ME2",
        ],
      },
      { key: "name", label: "Name", type: "input", placeholder: "Your Name" },
      {
        key: "offAwardReason",
        label: "Reason for Off Awarded",
        type: "input",
        placeholder: "e.g. Support for weekend tasking, holiday duty, etc.",
      },
      { key: "startDate", label: "Start Date", type: "date" },
      { key: "endDate", label: "End Date", type: "date" },
      {
        key: "balance",
        label: "Balance Left",
        type: "input",
        placeholder: "Balance Left",
        pattern: "^\\d+(\\.\\d+)?$",
      },
      {
        key: "recommendedBy",
        label: "Recommended By",
        type: "input",
        placeholder: "Rank/Name of AMTT/MTT",
        default: "ME3 Alex",
      },
    ],
    generate: ({
      rank,
      name,
      offAwardReason,
      startDate,
      endDate,
      balance,
      recommendedBy,
    }) =>
      `• Rank/Name: ${rank} ${name.toUpperCase()}
• Reason for Accumulation: ${offAwardReason}
• Dates Accumulated: ${
        startDate === endDate
          ? format(new Date(startDate), "d MMMM")
          : `${format(new Date(startDate), "d MMMM")} to ${format(
              new Date(endDate),
              "d MMMM",
            )}`
      }
• Balance (After Accumulation): ${balance}
• Recommended By: ${recommendedBy}`,
  },
  offTemplate: {
    name: "Leave/Off Application Template",
    fields: [
      {
        key: "rank",
        label: "Rank",
        type: "select",
        options: [
          "REC",
          "PTE",
          "LCP",
          "CPL",
          "CFC",
          "3SG",
          "2SG",
          "2LT",
          "LTA",
          "ME1T",
          "ME1",
          "ME2",
        ],
      },
      { key: "name", label: "Name", type: "input", placeholder: "Your Name" },
      {
        key: "typeOff",
        label: "Type",
        type: "input",
        placeholder: "Leave / Off if OL, indicate country",
        pattern: "^(Off|Leave|OL - .+)$",
        errorMessage: 'Must be "Off", "Leave", or "OL - [country]"',
      },
      { key: "startDate", label: "Start Date", type: "date" },
      { key: "endDate", label: "End Date", type: "date" },
      {
        key: "isHalfDay",
        label: "Is Half Day?",
        type: "checkbox",
      },
      {
        key: "timeOff",
        label: "AM OFF/PM OFF",
        type: "select",
        options: ["AM", "PM"],
        showIf: { key: "isHalfDay", equals: "true" },
      },
      {
        key: "balance",
        label: "Balance Left",
        type: "input",
        placeholder: "Balance Left",
        pattern: "^\\d+(\\.\\d+)?$",
      },
      {
        key: "recommendedBy",
        label: "Recommended By",
        type: "input",
        placeholder: "Rank/Name of AMTT/MTT",
        default: "ME3 Alex",
      },
    ],
    generate: ({
      rank,
      name,
      typeOff,
      startDate,
      endDate,
      isHalfDay,
      timeOff,
      balance,
      recommendedBy,
    }) =>
      ` • Rank/Name: ${rank} ${name.toUpperCase()}
 • Type: ${typeOff}
 • Dates: ${
   startDate === endDate
     ? format(new Date(startDate), "d MMMM")
     : `${format(new Date(startDate), "d MMMM")} to ${format(
         new Date(endDate),
         "d MMMM",
       )}`
 } ${isHalfDay && timeOff && `[${timeOff}]`}
 • Balance Left: ${balance}
 • Recommended By: ${recommendedBy}`,
  },
  reportSick: {
    name: "RSI/RSO/MA Reporting Template",
    fields: [
      {
        key: "newStatus",
        label: "Status",
        type: "select",
        options: ["NEW", "UPDATED"],
      },
      {
        key: "rank",
        label: "Rank",
        type: "select",
        options: [
          "REC",
          "PTE",
          "LCP",
          "CPL",
          "CFC",
          "3SG",
          "2SG",
          "2LT",
          "LTA",
          "ME1T",
          "ME1",
          "ME2",
        ],
      },
      { key: "name", label: "Name", type: "input", placeholder: "Your Name" },
      {
        key: "location",
        label: "Location",
        type: "input",
        placeholder: "Location of Medical Center",
        default: "Sungei Gedong Medical Centre",
      },
      {
        key: "typeSick",
        label: "Status",
        type: "select",
        options: ["RSI", "RSO", "MA", "FFI", "ORD FFI"],
      },
      { key: "dateIncident", label: "Date of Incident", type: "date" },
      {
        key: "startTimeIncident",
        label: "Start Time of Incident",
        type: "input",
        placeholder: "e.g. 1320",
        pattern: "^([01][0-9]|2[0-3])[0-5][0-9]$",
        errorMessage: "Time must be in 24hr format (e.g. 1320)",
      },
      {
        key: "reasonSick",
        label: "Reason for Report",
        type: "input",
        placeholder: "e.g. Support for weekend tasking, holiday duty, etc.",
      },
      {
        key: "endTimeIncident",
        label: "End Time of Incident",
        type: "input",
        placeholder: "e.g. 1320",
        pattern: "^([01][0-9]|2[0-3])[0-5][0-9]$",
        errorMessage: "Time must be in 24hr format (e.g. 1320)",
        showIf: { key: "newStatus", equals: "UPDATED" },
      },
      {
        key: "sickStatus",
        label: "Status Sick",
        type: "input",
        placeholder: "e.g. LD, MC, Excuse Dust etc.",
        showIf: { key: "newStatus", equals: "UPDATED" },
      },
      {
        key: "dayStatus",
        label: "Number of Days for Status",
        type: "input",
        pattern: "^\\d+$",
        showIf: { key: "newStatus", equals: "UPDATED" },
      },
      {
        key: "mcRefNo",
        label: "MC Ref No",
        type: "input",
        pattern: "^\\d+$",
        showIf: { key: "newStatus", equals: "UPDATED" },
        required: false,
      },
      {
        key: "recommendedBy",
        label: "Recommended By",
        type: "input",
        placeholder: "Rank/Name of AMTT/MTT",
        default: "ME3 Alex",
      },
    ],
    generate: ({
      newStatus,
      rank,
      name,
      typeSick,
      reasonSick,
      location,
      dateIncident,
      startTimeIncident,
      endTimeIncident,
      dayStatus,
      sickStatus,
      mcRefNo,
      recommendedBy,
    }) =>
      `*${newStatus}*

RSI/RSO/MA Reporting Template
(Serviceman do not need to fill out SN 10 and 11)

1. Type of Incident:
Non-Training Related

2. Date & Time of Incident:
${format(new Date(dateIncident), "ddMMyy")}/ ${startTimeIncident}hrs

3. Serviceman/Woman Involved: Rank/Name: ${rank} ${name.toUpperCase()}

4. Serviceman/woman Unit/ Company Unit:
1AMB/ 11FMD/ FMW2

5. Location: ${location}

6. Details of Incident:
At ${format(
        new Date(dateIncident),
        "ddMMyy",
      )} around ${startTimeIncident}hrs, serviceman went to ${typeSick} at ${
        location == "Sungei Gedong Medical Centre" ? "SGMC" : location
      } for ${reasonSick.toUpperCase()}.
${
  newStatus == "UPDATED"
    ? `
At around ${endTimeIncident}hrs, serviceman was given ${dayStatus} day ${sickStatus} from ${format(
        new Date(dateIncident),
        "ddMMyy",
      )} to ${format(
        addDays(new Date(dateIncident), Number(dayStatus) - 1),
        "ddMMyy",
      )}. ${mcRefNo ? `Ref No.: ${mcRefNo}` : ""}
`
    : ""
}
7. Injury/ Damages: NIL

8. Follow-up Updates: NIL

9. NOK informed: Yes

10. Date/ Time Verbal Report to IHQ & GSOC:

11. Date/ Time of ESIS to GSOC:

12. Reporting Person: ${recommendedBy}`,
  },
  hullBOS: {
    name: "HULL BOS Template",
    fields: [
      {
        key: "mid",
        label: "Vehicle MID",
        type: "input",
        placeholder: "MID Number",
        pattern: "^\\d{5}$",
      },
      {
        key: "vehiclePresent",
        label: "Is Vehicle Present?",
        type: "checkbox",
        default: "true",
      },
      {
        key: "vehicleStatus",
        label: "Vehicle Not Present Reason",
        type: "input",
        showIf: { key: "vehiclePresent", equals: "false" },
      },
      {
        key: "vehicleLocation",
        label: "Vehicle Location",
        type: "input",
        placeholder: "Vehicle Location",
        default: "MSVS Level ",
      },
      {
        key: "bosDate",
        label: "Date of BOS",
        type: "date",
        showIf: { key: "vehiclePresent", equals: "true" },
      },
      {
        key: "bosTime",
        label: "Time of BOS",
        type: "input",
        placeholder: "e.g. 1320",
        pattern: "^([01][0-9]|2[0-3])[0-5][0-9]$",
        errorMessage: "Time must be in 24hr format (e.g. 1320)",
        showIf: { key: "vehiclePresent", equals: "true" },
      },
      {
        key: "odo",
        label: "Odometer",
        type: "input",
        placeholder: "Odo",
        pattern: "^\\d+(\\.\\d+)?$",
        showIf: { key: "vehiclePresent", equals: "true" },
      },
      {
        key: "eh",
        label: "Engine Hour",
        type: "input",
        placeholder: "Engine Hour",
        pattern: "^\\d+$",
        showIf: { key: "vehiclePresent", equals: "true" },
      },
      {
        key: "auxPercent",
        label: "Auxiliary Battery Percent",
        type: "input",
        placeholder: "Auxiliary Battery Percent",
        pattern: "^\\d+$",
        showIf: { key: "vehiclePresent", equals: "true" },
      },
      {
        key: "auxVolt",
        label: "Auxiliary Battery",
        type: "input",
        placeholder: "Auxiliary Battery Voltage",
        pattern: "^\\d+(\\.\\d+)?$",
        showIf: { key: "vehiclePresent", equals: "true" },
      },
      {
        key: "starterPercent",
        label: "Starter Battery Percent",
        type: "input",
        placeholder: "Starter Battery Percent",
        pattern: "^\\d+$",
        showIf: { key: "vehiclePresent", equals: "true" },
      },
      {
        key: "starterVolt",
        label: "Starter Battery",
        type: "input",
        placeholder: "Starter Battery Voltage",
        pattern: "^\\d+(\\.\\d+)?$",
        showIf: { key: "vehiclePresent", equals: "true" },
      },
      {
        key: "fuelPercent",
        label: "Fuel Percent",
        type: "input",
        placeholder: "Fuel Percent",
        pattern: "^\\d+$",
        showIf: { key: "vehiclePresent", equals: "true" },
      },
      {
        key: "fuelLitre",
        label: "Fuel Litre",
        type: "input",
        placeholder: "Fuel Litre",
        pattern: "^\\d+$",
        showIf: { key: "vehiclePresent", equals: "true" },
      },
      {
        key: "afesExpiry",
        label: "AFES Expiry (Remember it is +5 years from the labelled AFES)",
        type: "input",
        placeholder: "AFES Expiry eg. 01/2025, 12/2030 etc.",
        pattern: "^(0[1-9]|1[0-2])/20\\d{2}$",
        showIf: { key: "vehiclePresent", equals: "true" },
      },
      {
        key: "faults",
        label: "Faults",
        type: "textarea",
        placeholder: "e.g. upcoming launch discussion",
        required: false,
        showIf: { key: "vehiclePresent", equals: "true" },
      },
    ],
    generate: ({
      mid,
      vehiclePresent,
      vehicleStatus,
      vehicleLocation,
      bosDate,
      bosTime,
      odo,
      eh,
      auxPercent,
      auxVolt,
      starterPercent,
      starterVolt,
      fuelPercent,
      fuelLitre,
      afesExpiry,
      faults,
    }) => `MID ${mid}${vehiclePresent === "true" ? "✅" : "⏳"} ${
      vehiclePresent !== "true" ? `(${vehicleStatus})` : ""
    }
📍 ${vehicleLocation}
📅 ${bosDate ? format(new Date(bosDate), "dd/MM/yy") : "[Date]"} 🕚 ${
      bosTime ? `${bosTime}hrs` : "[Time]"
    }
ODO: ${odo ? `${odo}km` : "[xx]"} | EH: ${eh ? `${eh}hrs` : "[xx]"}
🔋 AUX: ${auxPercent ? `${auxPercent}%` : "[%]"} ${
      auxVolt ? `${auxVolt}V` : "[V]"
    } | STARTER: ${starterPercent ? `${starterPercent}%` : "[%]"} ${
      starterVolt ? `${starterVolt}V` : "[V]"
    }
⛽️ FUEL: ${fuelPercent ? `${fuelPercent}%` : "[%]"} ${
      fuelLitre ? `${fuelLitre}L` : "[L]"
    }
🔥 AFES EXPIRY: ${afesExpiry ? `${afesExpiry}` : "[MM/YYYY]"}
🛠️ Faults: ${
      vehiclePresent === "true"
        ? faults
          ? `\n${faults
              .split("\n")
              .map((e) => `• ${e}`)
              .join("\n")}`
          : "NIL"
        : "\n• [Fault Description]"
    }`,
  },
  nightStrength: {
    name: "Night Strength",
    fields: [
      {
        key: "rank",
        label: "Rank",
        type: "select",
        options: [
          "REC",
          "PTE",
          "LCP",
          "CPL",
          "CFC",
          "3SG",
          "2SG",
          "2LT",
          "LTA",
          "ME1T",
          "ME1",
          "ME2",
        ],
      },
      { key: "name", label: "Name", type: "input", placeholder: "Your Name" },
      {
        key: "psNightStrength",
        label: "PS Night Strength",
        type: "textarea",
        placeholder: "HERE IS THE NIGHT STRENGTH FOR TODAY ...",
      },
      {
        key: "blk210",
        label: "Blk 210 Strength",
        type: "input",
        placeholder: "Blk 210 Strength",
      },
    ],
    generate: ({ rank, name, psNightStrength, blk210 }) => {
      const todayDate = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const stayIn = Number(
        psNightStrength.match(/^\s*STAYIN:\s*(\d+)\s*$/m)?.[1] ?? 0,
      );
      const stayOut = Number(
        psNightStrength.match(/^\s*STAYOUT:\s*(\d+)\s*$/m)?.[1] ?? 0,
      );

      const outstation = Number(
        psNightStrength.match(/^\s*OS:\s*(\d+)\s*$/m)?.[1] ?? 0,
      );
      const others = Number(
        psNightStrength.match(/^\s*OTHERS:\s*(\d+)\s*$/m)?.[1] ?? 0,
      );
      const rso = Number(
        psNightStrength.match(/^\s*RSO:\s*(\d+)\s*$/m)?.[1] ?? 0,
      );
      const rsi = Number(
        psNightStrength.match(/^\s*RSI:\s*(\d+)\s*$/m)?.[1] ?? 0,
      );

      const blk420 = stayIn - Number(blk210);

      const moved = outstation + others + rso + rsi;
      const newStayOut = stayOut + moved;

      const psNightStrengthAdj = psNightStrength
        .replace(/^\s*OS:\s*\d+\s*$/m, "OS: 0")
        .replace(/^\s*OTHERS:\s*\d+\s*$/m, "OTHERS: 0")
        .replace(/^\s*RSO:\s*\d+\s*$/m, "RSO: 0")
        .replace(/^\s*RSI:\s*\d+\s*$/m, "RSI: 0")
        .replace(/^\s*STAYOUT:\s*\d+\s*$/m, `STAYOUT: ${newStayOut}`);

      return `11FMD NIGHT STRENGTH ${todayDate} BY ${rank} ${name.toUpperCase()}

${psNightStrengthAdj}

STAYIN DETAILS
BLK210: ${blk210}
BLK420: ${blk420}`;
    },
  },
  guardDuty: {
    name: "Guard Duty Template",
    fields: [],
    generate: () => "",
    customUI: true,
  },
  routineOrder: {
    name: "Routine Order Template",
    fields: [],
    generate: () => "",
    customUI: true,
  },
};

const MONTHS = [
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
];

const DAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const GUARD_DUTY_STORAGE_KEY = "fmw2:guardDuty";

const STORAGE_KEY = "fmw2";
const STORAGE_TYPE_KEY = `${STORAGE_KEY}:selectedType`;

function GuardDutyUI({ onGenerate }: { onGenerate: (result: string) => void }) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [entries, setEntries] = useState<GuardDutyEntry[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Load saved state
  useEffect(() => {
    const saved = localStorage.getItem(GUARD_DUTY_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSelectedMonth(parsed.selectedMonth ?? now.getMonth());
        setSelectedYear(parsed.selectedYear ?? now.getFullYear());
        setEntries(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (parsed.entries ?? []).map((e: any) => ({
            ...e,
            date: new Date(e.date),
          })),
        );
      } catch {
        console.warn("Failed to parse guard duty saved data");
      }
    }
  }, []);

  // Save state on change
  useEffect(() => {
    localStorage.setItem(
      GUARD_DUTY_STORAGE_KEY,
      JSON.stringify({ selectedMonth, selectedYear, entries }),
    );
  }, [selectedMonth, selectedYear, entries]);

  const addDate = (date: Date) => {
    // Check if date already exists
    const exists = entries.find(
      (e) => e.date.toDateString() === date.toDateString(),
    );
    if (exists) {
      toast.error("This date is already added.");
      return;
    }
    setEntries((prev) =>
      [...prev, { date, icTypes: [] as ICType[], numGuards: 3 }].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      ),
    );
  };

  const removeDate = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: "numGuards", value: number) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    );
  };

  const toggleIC = (index: number, ic: ICType) => {
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const has = e.icTypes.includes(ic);
        const newTypes = has
          ? e.icTypes.filter((t) => t !== ic)
          : [...e.icTypes, ic].sort(
              (a, b) =>
                ["2IC", "3IC", "4IC"].indexOf(a) -
                ["2IC", "3IC", "4IC"].indexOf(b),
            );
        return { ...e, icTypes: newTypes };
      }),
    );
  };

  const handleGenerate = () => {
    if (entries.length === 0) {
      toast.error("Please add at least one date.");
      return;
    }

    const monthName = MONTHS[selectedMonth].toUpperCase();
    let result = `GUARD DUTY ${monthName} ${selectedYear}\n`;

    entries.forEach((entry, idx) => {
      const dayNum = entry.date.getDate();
      const monthNum = entry.date.getMonth() + 1;
      const dayName = DAY_NAMES[entry.date.getDay()];

      result += `${dayNum}/${monthNum} (${dayName})\n`;

      // Output each IC type with NUMBER field
      for (const ic of entry.icTypes) {
        result += `${ic}: \nNUMBER: \n \n`;
      }

      for (let g = 0; g < entry.numGuards; g++) {
        result += `G: \nNUMBER: \n \n`;
      }

      if (idx < entries.length - 1) {
        result += `==========\n`;
      }
    });

    onGenerate(result.trimEnd());
    toast.success("Guard Duty Template Generated!");

    // Log
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "guardDuty",
        fields: {
          month: MONTHS[selectedMonth],
          year: selectedYear,
          entries: entries.length,
        },
        template_type: "Guard Duty Template",
        user_agent: navigator.userAgent,
      }),
    }).catch(() => {});
  };

  // Generate calendar month start/end for the selected month
  const calendarMonth = new Date(selectedYear, selectedMonth, 1);

  return (
    <div className="space-y-4">
      {/* Month and Year Selection */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Month</Label>
          <Select
            value={String(selectedMonth)}
            onValueChange={(val) => setSelectedMonth(Number(val))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label>Year</Label>
          <Select
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(Number(val))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[now.getFullYear(), now.getFullYear() + 1].map((yr) => (
                <SelectItem key={yr} value={String(yr)}>
                  {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date Picker (multi-date via calendar) */}
      <div>
        <Label>Select Dates</Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
            >
              {entries.length > 0
                ? `${entries.length} date(s) selected`
                : "Click to add dates"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              month={calendarMonth}
              onMonthChange={(m) => {
                setSelectedMonth(m.getMonth());
                setSelectedYear(m.getFullYear());
              }}
              selected={undefined}
              onSelect={(date) => {
                if (date) {
                  addDate(date);
                  // Don't close — allow multiple selections
                }
              }}
              modifiers={{
                selected: entries.map((e) => e.date),
              }}
              modifiersClassNames={{
                selected: "bg-primary text-primary-foreground",
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Per-date configuration */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <Label>Configure Each Date</Label>
          {entries.map((entry, idx) => (
            <div
              key={entry.date.toISOString()}
              className="border rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {format(entry.date, "d MMM yyyy")} (
                  {DAY_NAMES[entry.date.getDay()]})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDate(idx)}
                  className="text-destructive hover:text-destructive"
                >
                  ✕
                </Button>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-xs">IC Types (optional)</Label>
                  <div className="flex gap-3 mt-1">
                    {(["2IC", "3IC", "4IC"] as ICType[]).map((ic) => (
                      <div key={ic} className="flex items-center space-x-1">
                        <Checkbox
                          id={`${entry.date.toISOString()}-${ic}`}
                          checked={entry.icTypes.includes(ic)}
                          onCheckedChange={() => toggleIC(idx, ic)}
                        />
                        <Label
                          htmlFor={`${entry.date.toISOString()}-${ic}`}
                          className="text-xs cursor-pointer"
                        >
                          {ic}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Number of Guards</Label>
                  <Select
                    value={String(entry.numGuards)}
                    onValueChange={(val) =>
                      updateEntry(idx, "numGuards", Number(val))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button onClick={handleGenerate} className="w-full">
        Generate Template
      </Button>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>(
    Object.keys(templates)[0],
  );
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const template = templates[selectedType];

  useEffect(() => {
    const savedType = localStorage.getItem(STORAGE_TYPE_KEY);
    const initialType =
      savedType && templates[savedType] ? savedType : Object.keys(templates)[0];

    setSelectedType(initialType);

    const saved = localStorage.getItem(STORAGE_KEY);

    const initialValues: Record<string, string> = {};
    templates[initialType].fields.forEach((field) => {
      if (field.default !== undefined) initialValues[field.key] = field.default;
    });

    if (saved) {
      try {
        const savedParsed = JSON.parse(saved);
        setFieldValues({ ...initialValues, ...savedParsed });
      } catch {
        console.warn("Failed to parse saved field values");
        setFieldValues(initialValues);
      }
    } else {
      setFieldValues(initialValues);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initialValues: Record<string, string> = {};

    const defaultTemplate = templates[selectedType];

    defaultTemplate.fields.forEach((field) => {
      if (field.default !== undefined) {
        initialValues[field.key] = field.default;
      }
    });

    if (saved) {
      try {
        const savedParsed = JSON.parse(saved);
        setFieldValues({ ...initialValues, ...savedParsed });
      } catch {
        console.warn("Failed to parse saved field values");
        setFieldValues(initialValues);
      }
    } else {
      setFieldValues(initialValues);
    }
  }, []);

  const handleChange = (key: string, value: string) => {
    const newValues = { ...fieldValues, [key]: value };
    setFieldValues(newValues);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newValues));
  };

  function isFieldVisible(
    field: TemplateField,
    values: Record<string, string>,
  ) {
    if (!field.showIf) return true;
    return values[field.showIf.key] === field.showIf.equals;
  }

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const relevantFields: Record<string, string> = {};
      template.fields.forEach(({ key }) => {
        relevantFields[key] = fieldValues[key] || "";
      });

      const missing = template.fields.find((field) => {
        const isRequired = field.required ?? true;
        return (
          isFieldVisible(field, fieldValues) &&
          isRequired &&
          (fieldValues[field.key] === undefined ||
            fieldValues[field.key].trim() === "")
        );
      });
      if (missing) {
        return toast.error(`Please fill in the "${missing.label}" field.`);
      }

      for (const field of template.fields) {
        if (!isFieldVisible(field, fieldValues)) continue;

        if (field.pattern && fieldValues[field.key]) {
          const regex = new RegExp(field.pattern);
          if (!regex.test(fieldValues[field.key])) {
            return toast.error(
              field.errorMessage || `Invalid input in "${field.label}".`,
            );
          }
        }
      }

      const dateFields = template.fields.filter(
        (f) =>
          f.type === "date" &&
          isFieldVisible(f, fieldValues) &&
          f.required !== false &&
          (fieldValues[f.key] === undefined ||
            fieldValues[f.key].trim() === ""),
      );
      for (const field of dateFields) {
        const value = fieldValues[field.key];
        if (!value || isNaN(new Date(value).getTime())) {
          return toast.error(
            `Please select a valid date for "${field.label}".`,
          );
        }
      }

      const startKey = template.fields.find(
        (f) => f.key.toLowerCase().includes("start") && f.type === "date",
      )?.key;
      const endKey = template.fields.find(
        (f) => f.key.toLowerCase().includes("end") && f.type === "date",
      )?.key;

      if (startKey && endKey) {
        const start = new Date(fieldValues[startKey]);
        const end = new Date(fieldValues[endKey]);

        if (end < start) {
          return toast.error("End date must be after or same as start date.");
        }
      }

      console.log(relevantFields);
      const result = template.generate(relevantFields);
      setGenerated(result);
      toast.success("Template Generated!");

      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedType,
          fields: relevantFields,
          template_type: template.name,
          user_agent: navigator.userAgent,
        }),
      });
    } catch {
      toast.error("An unexpected error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (textareaRef.current) {
      navigator.clipboard.writeText(textareaRef.current.value).then(() => {
        toast.success("Copied to clipboard!");
      });
    }
  };

  return (
    <main className="max-w-xl mx-auto py-10 px-4 space-y-6">
      <h1 className="text-3xl font-bold text-center">📝 Template Generator</h1>

      <div>
        <Label>Choose a Template</Label>
        <Select
          value={selectedType}
          onValueChange={(val) => {
            localStorage.setItem(STORAGE_TYPE_KEY, val);
            setSelectedType(val);
            setGenerated("");

            const defaults: Record<string, string> = {};
            templates[val].fields.forEach((f) => {
              if (f.default !== undefined) {
                defaults[f.key] = f.default;
              }
            });

            setFieldValues((prev) => ({
              ...defaults,
              ...prev,
            }));
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(templates).map(([key, tpl]) => (
              <SelectItem key={key} value={key}>
                {tpl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Guard Duty has its own custom UI */}
      {template.customUI ? (
        selectedType === "guardDuty" ? (
          <GuardDutyUI onGenerate={(result) => setGenerated(result)} />
        ) : selectedType === "routineOrder" ? (
          <RoutineOrderUI onGenerate={(result) => setGenerated(result)} />
        ) : null
      ) : (
        <div className="space-y-4">
          {template.fields
            .filter((field) => {
              if (!field.showIf) return true;
              return fieldValues[field.showIf.key] === field.showIf.equals;
            })
            .map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key}>{field.label}</Label>
                {field.type === "input" && (
                  <Input
                    id={field.key}
                    value={fieldValues[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
                {field.type === "textarea" && (
                  <Textarea
                    id={field.key}
                    value={fieldValues[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="min-h-[100px] max-h-[200px]"
                  />
                )}
                {field.type === "select" && field.options && (
                  <Select
                    value={fieldValues[field.key] || ""}
                    onValueChange={(value) => handleChange(field.key, value)}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={field.placeholder || "Select an option"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {field.type === "date" && (
                  <Popover
                    open={openPopoverKey === field.key}
                    onOpenChange={(open) =>
                      setOpenPopoverKey(open ? field.key : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${
                          fieldValues[field.key] ? "" : "text-muted-foreground"
                        }`}
                      >
                        {fieldValues[field.key]
                          ? format(
                              new Date(fieldValues[field.key]),
                              "yyyy-MM-dd",
                            )
                          : field.placeholder || "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          fieldValues[field.key]
                            ? new Date(fieldValues[field.key])
                            : undefined
                        }
                        onSelect={(date) => {
                          if (date) {
                            handleChange(field.key, date.toISOString());
                            setOpenPopoverKey(null);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
                {field.type === "checkbox" && (
                  <div className="flex items-center space-x-2 mt-1">
                    <Checkbox
                      id={field.key}
                      checked={fieldValues[field.key] == "true"}
                      onCheckedChange={(checked) =>
                        handleChange(field.key, checked ? "true" : "false")
                      }
                    />
                  </div>
                )}
              </div>
            ))}

          <Button
            onClick={handleGenerate}
            className="w-full"
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate Template"}
          </Button>
        </div>
      )}

      {generated && (
        <div className="space-y-2">
          <Label>Generated Result</Label>
          <Textarea
            ref={textareaRef}
            value={generated}
            readOnly
            className="min-h-[120px] max-h-[250px]"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleCopy}>
              📋 Copy
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedType === "guardDuty") {
                  localStorage.removeItem(GUARD_DUTY_STORAGE_KEY);
                  setGenerated("");
                  toast.info("Guard duty data cleared");
                  // Force re-render by toggling type
                  setSelectedType("");
                  setTimeout(() => setSelectedType("guardDuty"), 0);
                } else if (selectedType === "routineOrder") {
                  localStorage.removeItem(ROUTINE_STORAGE_KEY);
                  setGenerated("");
                  toast.info("Routine order cleared");
                  setSelectedType("");
                  setTimeout(() => setSelectedType("routineOrder"), 0);
                  return;
                } else {
                  localStorage.removeItem(STORAGE_KEY);
                  const newDefaults: Record<string, string> = {};
                  templates[selectedType].fields.forEach((field) => {
                    if (field.default !== undefined) {
                      newDefaults[field.key] = field.default;
                    }
                  });
                  setFieldValues(newDefaults);
                  toast.info("Reset to default values");
                }
              }}
            >
              Reset to Default
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
