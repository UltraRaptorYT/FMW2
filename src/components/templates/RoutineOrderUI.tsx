"use client";

import { useMemo, useRef } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { RegimentalEntry } from "@/lib/template-types";
import {
  DAY_NAMES,
  addDaysLocal,
  buildRoutineOrderText,
  defaultSpanDaysForToday,
  formatRegimental,
  pruneGuardDutyList,
  startOfDay,
} from "@/lib/template-utils";

const ROUTINE_STORAGE_KEY = "fmw2:routineOrder";

function emptyEntry(date: Date): RegimentalEntry {
  return {
    date,
    dfo: "",
    udo: "",
    dutyClerk: "",
    rcv: { cmdr: "", ic2: "", crew: "" },
    arv: { cmdr: "", driver: "", mechanic: "" },
    hrv: { cmdr: "", driver: "", mechanic: "" },
  };
}

function serializeRoutine(state: {
  safetyMessage: string;
  eventUpdate: string;
  guardDutyText: string;
  spanDays: number;
  entries: RegimentalEntry[];
}) {
  return JSON.stringify({
    ...state,
    entries: state.entries.map((e) => ({
      ...e,
      date: e.date.toISOString(),
    })),
  });
}

function deserializeRoutine(raw: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = JSON.parse(raw) as any;
  return {
    safetyMessage: parsed.safetyMessage ?? "",
    eventUpdate: parsed.eventUpdate ?? "",
    guardDutyText: parsed.guardDutyText ?? "",
    spanDays: parsed.spanDays ?? defaultSpanDaysForToday(new Date()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entries: (parsed.entries ?? []).map((e: any) => ({
      ...e,
      date: new Date(e.date),
    })) as RegimentalEntry[],
  };
}

export default function RoutineOrderUI({
  onGenerate,
}: {
  onGenerate: (result: string) => void;
}) {
  const todayRef = useRef<Date>(startOfDay(new Date()));
  const today = todayRef.current;

  const defaultSpan = useMemo(() => defaultSpanDaysForToday(today), [today]);

  const {
    value: state,
    setValue: setState,
    hydrated,
  } = useLocalStorageState(
    ROUTINE_STORAGE_KEY,
    {
      safetyMessage: "",
      eventUpdate: "",
      guardDutyText: "",
      spanDays: defaultSpan,
      entries: [],
    },
    { serialize: serializeRoutine, deserialize: deserializeRoutine },
  );

  const ensureEntries = (days: number) => {
    const base0 = startOfDay(today);
    const wanted = Array.from({ length: days }, (_, i) =>
      startOfDay(addDaysLocal(base0, i)),
    );

    const byKey = new Map(
      state.entries.map((e) => [startOfDay(e.date).toDateString(), e]),
    );

    const next = wanted.map((d) => {
      const existing = byKey.get(d.toDateString());
      return existing ? { ...existing, date: d } : emptyEntry(d);
    });

    setState((prev) => ({ ...prev, entries: next }));
  };

  const setSpanDays = (days: number) => {
    setState((prev) => ({ ...prev, spanDays: days }));
    ensureEntries(days);
  };

  const updateEntry = (idx: number, patch: Partial<RegimentalEntry>) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  };

  const handleGenerate = () => {
    const regimentalDutiesText = formatRegimental(state.entries);
    const prunedGuardDuty = pruneGuardDutyList(state.guardDutyText, today);

    const result = buildRoutineOrderText({
      safetyMessage: state.safetyMessage,
      eventUpdate: state.eventUpdate,
      regimentalDutiesText,
      guardDutyText: prunedGuardDuty,
      today,
    });

    onGenerate(result.trimEnd());
    toast.success("Routine Order Generated!");
  };

  // after hydration, make sure entries exist for current spanDays
  if (hydrated && state.entries.length === 0) {
    // one-time “soft init”
    ensureEntries(state.spanDays || defaultSpan);
  }

  if (!hydrated) return null;

  return (
    <div className="space-y-5">
      <div>
        <Label>Safety Message</Label>
        <Input
          value={state.safetyMessage}
          onChange={(e) =>
            setState((p) => ({ ...p, safetyMessage: e.target.value }))
          }
          placeholder="Input Safety Message"
        />
      </div>

      <div>
        <Label>Upcoming Events / Notice</Label>
        <Textarea
          value={state.eventUpdate}
          onChange={(e) =>
            setState((p) => ({ ...p, eventUpdate: e.target.value }))
          }
          placeholder="e.g. upcoming launch discussion"
          className="min-h-[100px]"
        />
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label>Send which days?</Label>
          <Select
            value={String(state.spanDays)}
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
            const def = defaultSpanDaysForToday(today);
            setSpanDays(def);
            toast.info("Reset to default span for today");
          }}
        >
          Use Default Rule
        </Button>
      </div>

      <div className="space-y-3">
        <Label>Regimental Duties</Label>

        {state.entries.map((entry, idx) => (
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
                <Label className="text-xs">RCV CREW (one per line)</Label>
                <Textarea
                  value={entry.rcv.crew}
                  onChange={(e) =>
                    updateEntry(idx, {
                      rcv: { ...entry.rcv, crew: e.target.value },
                    })
                  }
                  placeholder={`ME1 ...\nCPL ...\nPTE ...`}
                  className="min-h-[80px]"
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
          value={state.guardDutyText}
          onChange={(e) =>
            setState((p) => ({ ...p, guardDutyText: e.target.value }))
          }
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
