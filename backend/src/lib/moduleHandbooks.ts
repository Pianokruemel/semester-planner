import { ModuleHandbookCourse } from "@prisma/client";
import { prisma } from "./prisma";

const COURSE_NUMBER_PATTERN = /\b\d{2}\s*-\s*\d{2}\s*-\s*\d{4}(?:\s*-\s*[A-Za-z]{1,8})?\b/;
const BASE_COURSE_NUMBER_PATTERN = /\b\d{2}\s*-\s*\d{2}\s*-\s*\d{4}\b/;

export type CatalogProgrammeMatch = {
  program_key: string;
  program_label: string;
  po_label: string;
  cp: number | null;
  class_path: string[];
  module_number: string;
  module_title: string;
};

export type HandbookCourseWithProgram = ModuleHandbookCourse & {
  program: {
    key: string;
    label: string;
  };
};

export function normalizeCourseNumber(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const compact = value.replace(/\s+/g, "");
  const match = compact.match(COURSE_NUMBER_PATTERN);
  return match?.[0]?.toLowerCase() ?? null;
}

export function normalizeBaseCourseNumber(value: string | null | undefined): string | null {
  const normalized = normalizeCourseNumber(value);
  if (!normalized) {
    return null;
  }

  return normalized.match(BASE_COURSE_NUMBER_PATTERN)?.[0] ?? normalized;
}

export function serializeProgrammeMatch(entry: HandbookCourseWithProgram): CatalogProgrammeMatch {
  return {
    program_key: entry.programKey,
    program_label: entry.program.label,
    po_label: entry.poLabel,
    cp: entry.cp,
    class_path: entry.classPath,
    module_number: entry.moduleNumber,
    module_title: entry.moduleTitle
  };
}

function dedupeMatches(entries: HandbookCourseWithProgram[]): HandbookCourseWithProgram[] {
  const seen = new Set<string>();
  const result: HandbookCourseWithProgram[] = [];
  for (const entry of entries) {
    const key = [entry.programKey, entry.poLabel, entry.moduleNumber, entry.normalizedCourseNumber ?? ""].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(entry);
  }
  return result;
}

export async function findProgrammeMatchesForCourseNumber(courseNumber: string | null | undefined): Promise<HandbookCourseWithProgram[]> {
  const normalized = normalizeBaseCourseNumber(courseNumber);
  if (!normalized) {
    return [];
  }

  const entries = await prisma.moduleHandbookCourse.findMany({
    where: {
      OR: [{ normalizedCourseNumber: normalized }, { moduleNumber: normalized }]
    },
    include: { program: { select: { key: true, label: true } } },
    orderBy: [{ program: { label: "asc" } }, { poLabel: "desc" }, { normalizedCourseNumber: "asc" }]
  });

  const exact = entries.filter((entry) => entry.normalizedCourseNumber === normalized);
  const moduleFallback = entries.filter((entry) => entry.normalizedCourseNumber !== normalized && entry.moduleNumber === normalized);
  return dedupeMatches([...exact, ...moduleFallback]);
}

export async function findProgrammeMatchesForCourseNumbers(courseNumbers: Array<string | null | undefined>) {
  const normalizedNumbers = [...new Set(courseNumbers.map(normalizeBaseCourseNumber).filter((entry): entry is string => Boolean(entry)))];
  if (normalizedNumbers.length === 0) {
    return new Map<string, HandbookCourseWithProgram[]>();
  }

  const entries = await prisma.moduleHandbookCourse.findMany({
    where: {
      OR: [{ normalizedCourseNumber: { in: normalizedNumbers } }, { moduleNumber: { in: normalizedNumbers } }]
    },
    include: { program: { select: { key: true, label: true } } },
    orderBy: [{ program: { label: "asc" } }, { poLabel: "desc" }, { normalizedCourseNumber: "asc" }]
  });

  const grouped = new Map<string, HandbookCourseWithProgram[]>();
  for (const normalized of normalizedNumbers) {
    const exact = entries.filter((entry) => entry.normalizedCourseNumber === normalized);
    const moduleFallback = entries.filter((entry) => entry.normalizedCourseNumber !== normalized && entry.moduleNumber === normalized);
    grouped.set(normalized, dedupeMatches([...exact, ...moduleFallback]));
  }

  return grouped;
}

