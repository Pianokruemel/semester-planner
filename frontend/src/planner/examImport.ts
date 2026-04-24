import * as XLSX from "xlsx";
import { PlannerCourse, SnapshotExam } from "../api/types";

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

export type ExamImportPreviewStatus = "matched" | "unmatched" | "ambiguous" | "invalid";

export type ExamImportPreviewRow = ParsedExamImportRow & {
  normalizedCourseNumbers: string[];
  matchedCourseId: string | null;
  matchedCourses: Array<{
    id: string;
    name: string;
    courseNumber: string | null;
  }>;
  candidateExam: SnapshotExam | null;
  status: ExamImportPreviewStatus;
  message: string;
  overwritesExistingExam: boolean;
};

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
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? formatDateValue(parsed.y, parsed.m, parsed.d) : null;
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
    const year = dotMatch[3].length === 2 ? Number(`20${dotMatch[3]}`) : Number(dotMatch[3]);
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

export function parseExamWorksheetRows(rows: unknown[][]): ParsedExamImportRow[] {
  if (rows.length === 0) {
    throw new Error("Die Datei enthält keine Daten.");
  }

  const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
  const indexByHeader = new Map<ExamWorkbookHeader, number>();

  for (const header of examWorkbookHeaders) {
    const index = headerRow.findIndex((cell) => normalizeHeader(cell) === header);

    if (index < 0) {
      throw new Error(`Spalte \"${header}\" fehlt.`);
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

export function parseExamWorkbookBuffer(buffer: ArrayBuffer): ParsedExamImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Die Datei enthält kein Arbeitsblatt.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: null
  });

  return parseExamWorksheetRows(rows);
}

export async function parseExamWorkbook(file: File): Promise<ParsedExamImportRow[]> {
  return parseExamWorkbookBuffer(await file.arrayBuffer());
}

function buildCourseNumberIndex(courses: PlannerCourse[]): Map<string, PlannerCourse[]> {
  const index = new Map<string, PlannerCourse[]>();

  for (const course of courses) {
    if (!course.courseNumber) {
      continue;
    }

    const normalizedCourseNumber = normalizeCourseNumber(course.courseNumber);
    const existing = index.get(normalizedCourseNumber) ?? [];
    existing.push(course);
    index.set(normalizedCourseNumber, existing);
  }

  return index;
}

export function buildExamImportPreview(rows: ParsedExamImportRow[], courses: PlannerCourse[]): ExamImportPreviewRow[] {
  const courseNumberIndex = buildCourseNumberIndex(courses);

  const previewRows = rows.map((row) => {
    const normalizedCourseNumbers = Array.from(
      new Set(row.extractedCourseNumbers.map((value) => normalizeCourseNumber(value)).filter((value) => value.length > 0))
    );

    if (row.parseError) {
      return {
        ...row,
        normalizedCourseNumbers,
        matchedCourseId: null,
        matchedCourses: [],
        candidateExam: null,
        status: "invalid",
        message: row.parseError,
        overwritesExistingExam: false
      } satisfies ExamImportPreviewRow;
    }

    if (normalizedCourseNumbers.length === 0) {
      return {
        ...row,
        normalizedCourseNumbers,
        matchedCourseId: null,
        matchedCourses: [],
        candidateExam: null,
        status: "unmatched",
        message: "Keine Kursnummer in Klammern gefunden.",
        overwritesExistingExam: false
      } satisfies ExamImportPreviewRow;
    }

    const matchedCourses = Array.from(
      new Map(
        normalizedCourseNumbers
          .flatMap((courseNumber) => courseNumberIndex.get(courseNumber) ?? [])
          .map((course) => [course.id, { id: course.id, name: course.name, courseNumber: course.courseNumber }])
      ).values()
    );

    if (matchedCourses.length === 0) {
      return {
        ...row,
        normalizedCourseNumbers,
        matchedCourseId: null,
        matchedCourses: [],
        candidateExam: null,
        status: "unmatched",
        message: "Keine passende Kursnummer gefunden.",
        overwritesExistingExam: false
      } satisfies ExamImportPreviewRow;
    }

    if (matchedCourses.length > 1) {
      return {
        ...row,
        normalizedCourseNumbers,
        matchedCourseId: null,
        matchedCourses,
        candidateExam: null,
        status: "ambiguous",
        message: "Mehrere Kurse passen zu dieser Zeile.",
        overwritesExistingExam: false
      } satisfies ExamImportPreviewRow;
    }

    const matchedCourse = courses.find((course) => course.id === matchedCourses[0]?.id) ?? null;

    return {
      ...row,
      normalizedCourseNumbers,
      matchedCourseId: matchedCourses[0]?.id ?? null,
      matchedCourses,
      candidateExam:
        row.date && row.timeFrom && row.timeTo
          ? {
              date: row.date,
              time_from: row.timeFrom,
              time_to: row.timeTo
            }
          : null,
      status: "matched",
      message: matchedCourse?.exam ? "Eindeutiger Treffer, vorhandene Prüfung wird ersetzt." : "Eindeutiger Treffer.",
      overwritesExistingExam: Boolean(matchedCourse?.exam)
    } satisfies ExamImportPreviewRow;
  });

  const rowsByCourseId = new Map<string, ExamImportPreviewRow[]>();

  for (const row of previewRows) {
    if (row.status !== "matched" || !row.matchedCourseId) {
      continue;
    }

    const existingRows = rowsByCourseId.get(row.matchedCourseId) ?? [];
    existingRows.push(row);
    rowsByCourseId.set(row.matchedCourseId, existingRows);
  }

  return previewRows.map((row) => {
    if (row.status !== "matched" || !row.matchedCourseId) {
      return row;
    }

    const duplicates = rowsByCourseId.get(row.matchedCourseId) ?? [];

    if (duplicates.length <= 1) {
      return row;
    }

    return {
      ...row,
      status: "ambiguous",
      message: "Mehrere Zeilen passen zu demselben Kurs. Bitte einzeln bestätigen."
    } satisfies ExamImportPreviewRow;
  });
}