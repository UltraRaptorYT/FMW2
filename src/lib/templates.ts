import { format, addDays } from "date-fns";
import { TemplateDefinition } from "./template-types";

export const templates: Record<string, TemplateDefinition> = {
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
          : `${format(new Date(startDate), "d MMMM")} to ${format(new Date(endDate), "d MMMM")}`
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
      { key: "isHalfDay", label: "Is Half Day?", type: "checkbox" },
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
     : `${format(new Date(startDate), "d MMMM")} to ${format(new Date(endDate), "d MMMM")}`
 } ${isHalfDay && timeOff ? `[${timeOff}]` : ""}
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
        placeholder: "e.g. fever, cough, etc.",
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
At ${format(new Date(dateIncident), "ddMMyy")} around ${startTimeIncident}hrs, serviceman went to ${typeSick} at ${
        location === "Sungei Gedong Medical Centre" ? "SGMC" : location
      } for ${reasonSick.toUpperCase()}.${
        newStatus === "UPDATED"
          ? `
At around ${endTimeIncident}hrs, serviceman was given ${dayStatus} day ${sickStatus} from ${format(
              new Date(dateIncident),
              "ddMMyy",
            )} to ${format(addDays(new Date(dateIncident), Number(dayStatus) - 1), "ddMMyy")}. ${
              mcRefNo ? `Ref No.: ${mcRefNo}` : ""
            }
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
        placeholder: "One fault per line",
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
              .map((e) => e.trim())
              .filter(Boolean)
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
        placeholder: "Paste the PS night strength text here...",
      },
      {
        key: "blk210",
        label: "Blk 210 Strength",
        type: "input",
        placeholder: "Blk 210 Strength",
        pattern: "^\\d+$",
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
