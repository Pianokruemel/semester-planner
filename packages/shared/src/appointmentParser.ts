export type AppointmentType = "Vorlesung" | "Uebung";

export type ParsedAppointment = {
  date: string;
  time_from: string;
  time_to: string;
  room: string;
  type: AppointmentType;
};

export type TextareaAppointment = {
  date: string;
  timeFrom?: string;
  timeTo?: string;
  time_from?: string;
  time_to?: string;
  room: string;
  type: AppointmentType;
};

const monthMap: Record<string, number> = {
  "Jan.": 1,
  "Feb.": 2,
  "Mar.": 3,
  "Mär.": 3,
  "Apr.": 4,
  Mai: 5,
  "Jun.": 6,
  "Jul.": 7,
  "Aug.": 8,
  "Sep.": 9,
  "Okt.": 10,
  "Nov.": 11,
  "Dez.": 12
};

type TokenizedRow = {
  lineNumber: number;
  columns: string[];
};

function parseGermanDate(raw: string, lineNumber: number): { date: string; hasAsterisk: boolean } {
  const hasAsterisk = raw.trim().endsWith("*");
  const cleaned = raw.replace(/\*$/, "").trim();
  const match = cleaned.match(/^[^,]+,\s*(\d{1,2})\.\s*([A-Za-zäÄöÖüÜß\.]+)\s+(\d{4})$/);

  if (!match) {
    throw new Error(`Ungültiges Datumsformat in Zeile ${lineNumber}.`);
  }

  const day = Number(match[1]);
  const monthToken = match[2] as string;
  const year = Number(match[3]);
  const month = monthMap[monthToken];

  if (!month) {
    throw new Error(`Unbekannter Monat '${monthToken}' in Zeile ${lineNumber}.`);
  }

  return {
    date: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    hasAsterisk
  };
}

function parseTime(raw: string, lineNumber: number): string {
  const match = raw.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Ungültige Uhrzeit in Zeile ${lineNumber}.`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`Ungültige Uhrzeit in Zeile ${lineNumber}.`);
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function stripMarkdownLink(value: string): string {
  const match = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  return match ? (match[1] as string).trim() : value.trim();
}

function tokenizeRow(line: string): string[] {
  const tabSplit = line
    .split("\t")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (tabSplit.length >= 4) {
    return tabSplit;
  }

  return line
    .trim()
    .split(/\s{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function isHeaderRow(columns: string[]): boolean {
  const lowered = columns.map((value) => value.toLowerCase());
  return (
    lowered.some((value) => value.includes("datum")) &&
    lowered.some((value) => value.includes("von")) &&
    lowered.some((value) => value.includes("bis")) &&
    lowered.some((value) => value.includes("raum"))
  );
}

function extractFields(row: TokenizedRow): { dateRaw: string; fromRaw: string; toRaw: string; roomRaw: string } {
  const timeIndexes = row.columns
    .map((value, index) => (value.match(/^\d{2}:\d{2}$/) ? index : -1))
    .filter((index) => index >= 0);

  if (timeIndexes.length < 2) {
    throw new Error(`Ungültige Zeile ${row.lineNumber}: Von/Bis Zeit fehlt.`);
  }

  const fromIndex = timeIndexes[0] as number;
  const toIndex = timeIndexes[1] as number;

  if (toIndex <= fromIndex) {
    throw new Error(`Ungültige Zeile ${row.lineNumber}: Von/Bis Zeitreihenfolge ungültig.`);
  }

  const hasIndexColumn = fromIndex >= 2 && /^\d+$/.test(row.columns[0] ?? "");
  const dateRaw = row.columns.slice(hasIndexColumn ? 1 : 0, fromIndex).join(" ").trim();
  const fromRaw = row.columns[fromIndex] ?? "";
  const toRaw = row.columns[toIndex] ?? "";
  const roomRaw = row.columns[toIndex + 1] ?? "";

  if (!dateRaw) {
    throw new Error(`Ungültige Zeile ${row.lineNumber}: Datum fehlt.`);
  }

  if (!roomRaw) {
    throw new Error(`Ungültige Zeile ${row.lineNumber}: Raum fehlt.`);
  }

  return { dateRaw, fromRaw, toRaw, roomRaw };
}

export function parseAppointments(rawText: string): ParsedAppointment[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((rawLine, index) => ({ rawLine, lineNumber: index + 1 }))
    .filter((line) => line.rawLine.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  const tokenizedRows = lines
    .map((line) => ({
      lineNumber: line.lineNumber,
      columns: tokenizeRow(line.rawLine)
    }))
    .filter((row) => row.columns.length > 0);

  const rows = tokenizedRows.filter((row, index) => !(index === 0 && isHeaderRow(row.columns)));
  const parsed = rows.map((row) => {
    const { dateRaw, fromRaw, toRaw, roomRaw } = extractFields(row);
    const { date, hasAsterisk } = parseGermanDate(dateRaw, row.lineNumber);

    return {
      date,
      time_from: parseTime(fromRaw, row.lineNumber),
      time_to: parseTime(toRaw, row.lineNumber),
      room: stripMarkdownLink(roomRaw),
      hasAsterisk
    };
  });

  const hasAnyAsterisk = parsed.some((appointment) => appointment.hasAsterisk);

  return parsed.map((appointment) => ({
    date: appointment.date,
    time_from: appointment.time_from,
    time_to: appointment.time_to,
    room: appointment.room,
    type: hasAnyAsterisk ? (appointment.hasAsterisk ? "Vorlesung" : "Uebung") : "Vorlesung"
  }));
}

export function summarizeAppointments(rawText: string): {
  count: number;
  date_from: string | null;
  date_to: string | null;
  types: AppointmentType[];
} {
  const appointments = parseAppointments(rawText);
  if (appointments.length === 0) {
    return {
      count: 0,
      date_from: null,
      date_to: null,
      types: []
    };
  }

  const orderedDates = appointments.map((appointment) => appointment.date).sort((left, right) => left.localeCompare(right));
  const types = Array.from(new Set(appointments.map((appointment) => appointment.type)));

  return {
    count: appointments.length,
    date_from: orderedDates[0] ?? null,
    date_to: orderedDates[orderedDates.length - 1] ?? null,
    types
  };
}

function getTime(appointment: TextareaAppointment, field: "from" | "to"): string {
  if (field === "from") {
    return appointment.timeFrom ?? appointment.time_from ?? "";
  }

  return appointment.timeTo ?? appointment.time_to ?? "";
}

export function formatAppointmentsForTextarea(appointments: TextareaAppointment[]): string {
  const daysOfWeek = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const months = ["Jan.", "Feb.", "Mär.", "Apr.", "Mai", "Jun.", "Jul.", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];
  const rows = appointments.map((appointment, index) => {
    const date = new Date(`${appointment.date}T00:00:00.000Z`);
    const dayAbbr = daysOfWeek[date.getUTCDay()] ?? "Mo";
    const monthAbbr = months[date.getUTCMonth()] ?? "Jan.";
    const maybeStar = appointment.type === "Vorlesung" ? "*" : "";

    return `${index + 1}\t${dayAbbr}, ${date.getUTCDate()}. ${monthAbbr} ${date.getUTCFullYear()}${maybeStar}\t${getTime(appointment, "from")}\t${getTime(appointment, "to")}\t${appointment.room}\t`;
  });

  return rows.length > 0 ? `Nr\tDatum\tVon\tBis\tRaum\tLehrende\n${rows.join("\n")}` : "";
}
