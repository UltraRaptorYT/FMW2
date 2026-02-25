export type TemplateField = {
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

export type TemplateDefinition = {
  name: string;
  fields: TemplateField[];
  generate: (fields: Record<string, string>) => string;
  customUI?: boolean;
};

export type ICType = "2IC" | "3IC" | "4IC";

export type GuardDutyEntry = {
  date: Date;
  icTypes: ICType[];
  numGuards: number;
};

export type RecoveryDuty = {
  cmdr: string;
  ic2: string;
  crew: string; // multiline
};

export type VehicleRecoveryDuty = {
  cmdr: string;
  driver: string;
  mechanic: string;
};

export type RegimentalEntry = {
  date: Date;
  dfo: string;
  udo: string;
  dutyClerk: string;
  rcv: RecoveryDuty;
  arv: VehicleRecoveryDuty;
  hrv: VehicleRecoveryDuty;
};
