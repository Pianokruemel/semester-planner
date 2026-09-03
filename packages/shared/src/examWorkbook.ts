import { read, utils } from "xlsx";

export const examWorkbookHeaders = [
  "Wochentag",
  "Datum",
  "Beginn",
  "Ende",
  "Terminart (Veranstaltungsart)",
  "DozentIn",
  "Veranstaltungsname"
] as const;

type ExamWorkbookHeader = (typeof examWorkbookHeaders)[number];

export type ParsedExamImportRow = {
  rowNumber: number;
  weekday: string | null;
  date: string | null;
  timeFrom: string | null;
  timeTo: string | null;
  appointmentType: string | null;
  lecturer: string | null;
  courseName: string;
  extractedCourseNumbers: string[];
  parseError: string | null;
};

const courseNumberPattern = /\b\d{2}\s*-\s*[A-Za-z0-9]{2}\s*-\s*\d{4}(?:\s*-\s*[A-Za-z0-9]{1,8})?\b/g;

function padNumber(value: number): string {
  return String(value).padStart(2, "0");
}

function normalizeCellText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).trim();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return "";
}

function isWorksheetRowEmpty(row: unknown[]): boolean {
  return row.every((value) => normalizeCellText(value).length === 0);
}

function normalizeHeader(value: unknown): string {
  return normalizeCellText(value);
}

function formatDateValue(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${year}-${padNumber(month)}-${padNumber(day)}`;
}

function parseDateCell(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateValue(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 24 * 60 * 60 * 1000);
    return formatDateValue(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return formatDateValue(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const dotMatch = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (dotMatch) {
    const year = dotMatch[3]!.length === 2 ? Number(`20${dotMatch[3]}`) : Number(dotMatch[3]);
    return formatDateValue(year, Number(dotMatch[2]), Number(dotMatch[1]));
  }

  return null;
}

function parseTimeCell(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${padNumber(value.getHours())}:${padNumber(value.getMinutes())}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const totalMinutes = Math.round((((value % 1) + 1) % 1) * 24 * 60);
    const minutesInDay = totalMinutes % (24 * 60);
    const hour = Math.floor(minutesInDay / 60);
    const minute = minutesInDay % 60;
    return `${padNumber(hour)}:${padNumber(minute)}`;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${padNumber(hour)}:${padNumber(minute)}`;
}

function readRequiredCell(row: unknown[], indexByHeader: Map<ExamWorkbookHeader, number>, header: ExamWorkbookHeader): unknown {
  const index = indexByHeader.get(header);
  return index === undefined ? null : row[index] ?? null;
}

function buildParseError(courseName: string, date: string | null, timeFrom: string | null, timeTo: string | null): string | null {
  if (!courseName.trim()) {
    return "Veranstaltungsname fehlt.";
  }

  if (!date) {
    return "Datum fehlt oder ist ungültig.";
  }

  if (!timeFrom) {
    return "Beginn fehlt oder ist ungültig.";
  }

  if (!timeTo) {
    return "Ende fehlt oder ist ungültig.";
  }

  if (timeTo <= timeFrom) {
    return "Ende muss nach dem Beginn liegen.";
  }

  return null;
}

export function normalizeCourseNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeCourseTitle(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function stripBracketContents(value: string): string {
  return value.replace(/\(([^()]*)\)|\[([^\[\]]*)\]/g, " ").replace(/\s+/g, " ").trim();
}

export function extractBracketContents(value: string): string[] {
  const matches: string[] = [];
  const bracketPattern = /\(([^()]+)\)|\[([^\[\]]+)\]/g;
  let match: RegExpExecArray | null = null;

  while ((match = bracketPattern.exec(value)) !== null) {
    const token = (match[1] ?? match[2] ?? "").trim();

    if (token) {
      matches.push(token);
    }
  }

  return matches;
}

export function extractCourseNumbers(value: string): string[] {
  const matches = new Set<string>();
  for (const bracket of extractBracketContents(value)) {
    for (const match of bracket.matchAll(courseNumberPattern)) {
      matches.add(normalizeCourseNumber(match[0]));
    }
  }

  for (const match of value.matchAll(courseNumberPattern)) {
    matches.add(normalizeCourseNumber(match[0]));
  }

  return [...matches];
}

export function parseExamWorksheetRows(rows: unknown[][]): ParsedExamImportRow[] {
  if (rows.length === 0) {
    throw new Error("Die Datei enthält keine Daten.");
  }

  const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
  const indexByHeader = new Map<ExamWorkbookHeader, number>();

  for (const header of examWorkbookHeaders) {
    const index = headerRow.findIndex((cell) => normalizeHeader(cell) === header);

    if (index < 0) {
      throw new Error(`Spalte "${header}" fehlt.`);
    }

    indexByHeader.set(header, index);
  }

  return rows.slice(1).flatMap((row, index) => {
    const normalizedRow = Array.isArray(row) ? row : [];

    if (isWorksheetRowEmpty(normalizedRow)) {
      return [];
    }

    const courseName = normalizeCellText(readRequiredCell(normalizedRow, indexByHeader, "Veranstaltungsname"));
    const date = parseDateCell(readRequiredCell(normalizedRow, indexByHeader, "Datum"));
    const timeFrom = parseTimeCell(readRequiredCell(normalizedRow, indexByHeader, "Beginn"));
    const timeTo = parseTimeCell(readRequiredCell(normalizedRow, indexByHeader, "Ende"));

    return [
      {
        rowNumber: index + 2,
        weekday: normalizeCellText(readRequiredCell(normalizedRow, indexByHeader, "Wochentag")) || null,
        date,
        timeFrom,
        timeTo,
        appointmentType:
          normalizeCellText(readRequiredCell(normalizedRow, indexByHeader, "Terminart (Veranstaltungsart)")) || null,
        lecturer: normalizeCellText(readRequiredCell(normalizedRow, indexByHeader, "DozentIn")) || null,
        courseName,
        extractedCourseNumbers: extractBracketContents(courseName),
        parseError: buildParseError(courseName, date, timeFrom, timeTo)
      }
    ] satisfies ParsedExamImportRow[];
  });
}

export function parseExamWorkbookBuffer(buffer: ArrayBuffer | Uint8Array): ParsedExamImportRow[] {
  const workbook = read(buffer, { type: "array", cellDates: false });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Die Datei enthält kein Arbeitsblatt.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error("Die Datei enthält kein lesbares Arbeitsblatt.");
  }

  const rows = utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: null
  });

  return parseExamWorksheetRows(rows);
}

export async function parseExamWorkbook(file: File): Promise<ParsedExamImportRow[]> {
  return parseExamWorkbookBuffer(await file.arrayBuffer());
}
