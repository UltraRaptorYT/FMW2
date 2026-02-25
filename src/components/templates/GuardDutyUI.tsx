"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { GuardDutyEntry, ICType } from "@/lib/template-types";
import { DAY_NAMES, MONTHS } from "@/lib/template-utils";

const GUARD_DUTY_STORAGE_KEY = "fmw2:guardDuty";

function serializeGuardDuty(state: {
  selectedMonth: number;
  selectedYear: number;
  entries: GuardDutyEntry[];
}) {
  return JSON.stringify({
    ...state,
    entries: state.entries.map((e) => ({
      ...e,
      date: e.date.toISOString(),
    })),
  });
}

function deserializeGuardDuty(raw: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = JSON.parse(raw) as any;
  return {
    selectedMonth: parsed.selectedMonth ?? new Date().getMonth(),
    selectedYear: parsed.selectedYear ?? new Date().getFullYear(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entries: (parsed.entries ?? []).map((e: any) => ({
      ...e,
      date: new Date(e.date),
    })) as GuardDutyEntry[],
  };
}

export default function GuardDutyUI({
  onGenerate,
}: {
  onGenerate: (result: string) => void;
}) {
  const now = new Date();

  const {
    value: state,
    setValue: setState,
    hydrated,
  } = useLocalStorageState(
    GUARD_DUTY_STORAGE_KEY,
    {
      selectedMonth: now.getMonth(),
      selectedYear: now.getFullYear(),
      entries: [] as GuardDutyEntry[],
    },
    { serialize: serializeGuardDuty, deserialize: deserializeGuardDuty },
  );

  const { selectedMonth, selectedYear, entries } = state;

  const [calendarOpen, setCalendarOpen] = useState(false);

  const calendarMonth = useMemo(
    () => new Date(selectedYear, selectedMonth, 1),
    [selectedYear, selectedMonth],
  );

  const addDate = (date: Date) => {
    const exists = entries.find(
      (e) => e.date.toDateString() === date.toDateString(),
    );
    if (exists) return toast.error("This date is already added.");

    setState((prev) => ({
      ...prev,
      entries: [...prev.entries, { date, icTypes: [], numGuards: 3 }].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      ),
    }));
  };

  const removeDate = (index: number) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== index),
    }));
  };

  const updateNumGuards = (index: number, value: number) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.map((e, i) =>
        i === index ? { ...e, numGuards: value } : e,
      ),
    }));
  };

  const toggleIC = (index: number, ic: ICType) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.map((e, i) => {
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
    }));
  };

  const handleGenerate = () => {
    if (entries.length === 0)
      return toast.error("Please add at least one date.");

    const monthName = MONTHS[selectedMonth].toUpperCase();
    let result = `GUARD DUTY ${monthName} ${selectedYear}\n`;

    entries.forEach((entry, idx) => {
      const dayNum = entry.date.getDate();
      const monthNum = entry.date.getMonth() + 1;
      const dayName = DAY_NAMES[entry.date.getDay()];

      result += `${dayNum}/${monthNum} (${dayName})\n`;

      for (const ic of entry.icTypes) {
        result += `${ic}: \nNUMBER: \n \n`;
      }

      for (let g = 0; g < entry.numGuards; g++) {
        result += `G: \nNUMBER: \n \n`;
      }

      if (idx < entries.length - 1) result += `==========\n`;
    });

    onGenerate(result.trimEnd());
    toast.success("Guard Duty Template Generated!");
  };

  const setSelectedMonthYear = (m: number, y: number) => {
    setState((prev) => ({ ...prev, selectedMonth: m, selectedYear: y }));
  };

  if (!hydrated) return null;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Month</Label>
          <Select
            value={String(selectedMonth)}
            onValueChange={(val) =>
              setSelectedMonthYear(Number(val), selectedYear)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, idx) => (
                <SelectItem key={month} value={String(idx)}>
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
            onValueChange={(val) =>
              setSelectedMonthYear(selectedMonth, Number(val))
            }
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
              onMonthChange={(m) =>
                setSelectedMonthYear(m.getMonth(), m.getFullYear())
              }
              selected={undefined}
              onSelect={(date) => date && addDate(date)}
              modifiers={{ selected: entries.map((e) => e.date) }}
              modifiersClassNames={{
                selected: "bg-primary text-primary-foreground",
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

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
                    onValueChange={(val) => updateNumGuards(idx, Number(val))}
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
