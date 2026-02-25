"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { templates } from "@/lib/templates";
import { TemplateField } from "@/lib/template-types";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";

import GuardDutyUI from "@/components/templates/GuardDutyUI";
import RoutineOrderUI from "@/components/templates/RoutineOrderUI";

const STORAGE_KEY = "fmw2";
const STORAGE_TYPE_KEY = `${STORAGE_KEY}:selectedType`;

function fieldsKeyFor(type: string) {
  return `${STORAGE_KEY}:fields:${type}`;
}

function getDefaultsFor(type: string) {
  const defaults: Record<string, string> = {};
  templates[type].fields.forEach((f) => {
    if (f.default !== undefined) defaults[f.key] = f.default;
  });
  return defaults;
}

function isFieldVisible(field: TemplateField, values: Record<string, string>) {
  if (!field.showIf) return true;
  return values[field.showIf.key] === field.showIf.equals;
}

export default function Page() {
  const firstType = useMemo(() => Object.keys(templates)[0], []);
  const [selectedType, setSelectedType] = useState<string>(firstType);
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState("");
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const template = templates[selectedType];

  // single init
  useEffect(() => {
    const savedType = localStorage.getItem(STORAGE_TYPE_KEY);
    const initialType =
      savedType && templates[savedType] ? savedType : firstType;

    setSelectedType(initialType);

    const defaults = getDefaultsFor(initialType);
    const savedRaw = localStorage.getItem(fieldsKeyFor(initialType));

    if (savedRaw) {
      try {
        const savedParsed = JSON.parse(savedRaw);
        setFieldValues({ ...defaults, ...savedParsed });
      } catch {
        setFieldValues(defaults);
      }
    } else {
      setFieldValues(defaults);
    }
  }, [firstType]);

  const handleSelectType = (type: string) => {
    localStorage.setItem(STORAGE_TYPE_KEY, type);
    setSelectedType(type);
    setGenerated("");

    const defaults = getDefaultsFor(type);
    const savedRaw = localStorage.getItem(fieldsKeyFor(type));

    if (savedRaw) {
      try {
        const savedParsed = JSON.parse(savedRaw);
        setFieldValues({ ...defaults, ...savedParsed });
      } catch {
        setFieldValues(defaults);
      }
    } else {
      setFieldValues(defaults);
    }
  };

  const handleChange = (key: string, value: string) => {
    setFieldValues((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(fieldsKeyFor(selectedType), JSON.stringify(next));
      return next;
    });
  };

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
      if (missing)
        return toast.error(`Please fill in the "${missing.label}" field.`);

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

      // date sanity
      const startKey = template.fields.find(
        (f) => f.key.toLowerCase().includes("start") && f.type === "date",
      )?.key;
      const endKey = template.fields.find(
        (f) => f.key.toLowerCase().includes("end") && f.type === "date",
      )?.key;

      if (startKey && endKey) {
        const start = new Date(fieldValues[startKey]);
        const end = new Date(fieldValues[endKey]);
        if (end < start)
          return toast.error("End date must be after or same as start date.");
      }

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
      }).catch(() => {});
    } catch {
      toast.error("An unexpected error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!textareaRef.current) return;
    navigator.clipboard.writeText(textareaRef.current.value).then(() => {
      toast.success("Copied to clipboard!");
    });
  };

  return (
    <main className="max-w-xl mx-auto py-10 px-4 space-y-6">
      <h1 className="text-3xl font-bold text-center">📝 Template Generator</h1>

      <div>
        <Label>Choose a Template</Label>
        <Select value={selectedType} onValueChange={handleSelectType}>
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

      {template.customUI ? (
        selectedType === "guardDuty" ? (
          <GuardDutyUI onGenerate={setGenerated} />
        ) : selectedType === "routineOrder" ? (
          <RoutineOrderUI onGenerate={setGenerated} />
        ) : null
      ) : (
        <div className="space-y-4">
          {template.fields
            .filter((field) => isFieldVisible(field, fieldValues))
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
                      checked={fieldValues[field.key] === "true"}
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
                if (template.customUI) {
                  // the custom UIs manage their own keys + clearing, so you can handle separately if needed
                  toast.info(
                    "Use the Clear button inside the template UI (or clear its localStorage key).",
                  );
                  return;
                }

                localStorage.removeItem(fieldsKeyFor(selectedType));
                const defaults = getDefaultsFor(selectedType);
                setFieldValues(defaults);
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
