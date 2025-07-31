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

type TemplateField = {
  key: string;
  label: string;
  type: "input" | "textarea" | "select" | "date";
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
};

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
        default: "ME3 Hoon",
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
• Dates Accumulated: ${format(new Date(startDate), "dd MMMM")} to ${format(
        new Date(endDate),
        "dd MMMM"
      )}
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
        default: "ME3 Hoon",
      },
    ],
    generate: ({
      rank,
      name,
      typeOff,
      startDate,
      endDate,
      balance,
      recommendedBy,
    }) =>
      ` • Rank/Name: ${rank} ${name.toUpperCase()}
 • Type: ${typeOff}
 • Dates: ${format(new Date(startDate), "dd MMMM")} to ${format(
        new Date(endDate),
        "dd MMMM"
      )}
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
        default: "ME3 Hoon",
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
      startStatusDate,
      endStatusDate,
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
        "ddMMyy"
      )} around ${startTimeIncident}hrs, serviceman went to ${typeSick} at ${
        location == "Sungei Gedong Medical Centre" ? "SGMC" : location
      } for ${reasonSick.toUpperCase()}.
${
  newStatus == "UPDATED"
    ? `
At around ${endTimeIncident}hrs, serviceman was given ${dayStatus} day ${sickStatus} from ${format(
        new Date(dateIncident),
        "ddMMyy"
      )} to ${format(
        addDays(new Date(dateIncident), Number(dayStatus) - 1),
        "ddMMyy"
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
};

const STORAGE_KEY = "fmw2";

export default function Home() {
  const [selectedType, setSelectedType] = useState<string>(
    Object.keys(templates)[0]
  );
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const template = templates[selectedType];

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
        setFieldValues({ ...initialValues, ...savedParsed }); // 👈 merge default first, then saved
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
    values: Record<string, string>
  ) {
    if (!field.showIf) return true;
    return values[field.showIf.key] === field.showIf.equals;
  }

  const handleGenerate = async () => {
    try {
      const relevantFields: Record<string, string> = {};
      template.fields.forEach(({ key }) => {
        relevantFields[key] = fieldValues[key] || "";
      });

      const missing = template.fields.find(
        (field) =>
          isFieldVisible(field, fieldValues) &&
          field.required !== false &&
          (fieldValues[field.key] === undefined ||
            fieldValues[field.key].trim() === "")
      );
      if (missing) {
        return toast.error(`Please fill in the "${missing.label}" field.`);
      }

      for (const field of template.fields) {
        if (!isFieldVisible(field, fieldValues)) continue;

        if (field.pattern && fieldValues[field.key]) {
          const regex = new RegExp(field.pattern);
          if (!regex.test(fieldValues[field.key])) {
            return toast.error(
              field.errorMessage || `Invalid input in "${field.label}".`
            );
          }
        }
      }

      const dateFields = template.fields.filter((f) => f.type === "date");
      for (const field of dateFields) {
        const value = fieldValues[field.key];
        if (!value || isNaN(new Date(value).getTime())) {
          return toast.error(
            `Please select a valid date for "${field.label}".`
          );
        }
      }

      const startKey = template.fields.find(
        (f) => f.key.toLowerCase().includes("start") && f.type === "date"
      )?.key;
      const endKey = template.fields.find(
        (f) => f.key.toLowerCase().includes("end") && f.type === "date"
      )?.key;

      if (startKey && endKey) {
        const start = new Date(fieldValues[startKey]);
        const end = new Date(fieldValues[endKey]);

        if (end < start) {
          return toast.error("End date must be after or same as start date.");
        }
      }

      // 4. Generate result
      const result = template.generate(relevantFields);
      setGenerated(result);
      toast.success("Template Generated!");

      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedType,
          fields: relevantFields,
          user_agent: navigator.userAgent,
        }),
      });
    } catch {
      toast.error("An unexpected error occurred. Try again.");
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
            setSelectedType(val);
            setGenerated("");

            const defaults: Record<string, string> = {};
            templates[val].fields.forEach((f) => {
              if (f.default !== undefined) {
                defaults[f.key] = f.default;
              }
            });

            setFieldValues((prev) => ({
              ...prev,
              ...defaults,
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
                  className="min-h-[100px]"
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
                        ? format(new Date(fieldValues[field.key]), "yyyy-MM-dd")
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
                          setOpenPopoverKey(null); // 👈 Close the popover after selecting
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          ))}

        <Button onClick={handleGenerate} className="w-full">
          Generate Template
        </Button>
      </div>

      {generated && (
        <div className="space-y-2">
          <Label>Generated Result</Label>
          <Textarea
            ref={textareaRef}
            value={generated}
            readOnly
            className="min-h-[120px]"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleCopy}>
              📋 Copy
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                const newDefaults: Record<string, string> = {};
                templates[selectedType].fields.forEach((field) => {
                  if (field.default !== undefined) {
                    newDefaults[field.key] = field.default;
                  }
                });
                setFieldValues(newDefaults);
                toast.info("Reset to default values");
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
