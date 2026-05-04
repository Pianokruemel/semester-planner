import {
  examWorkbookHeaders,
  normalizeCourseNumber,
  normalizeCourseTitle,
  parseExamWorkbook,
  parseExamWorkbookBuffer,
  parseExamWorksheetRows,
  stripBracketContents,
  type ParsedExamImportRow
} from "@semester-planner/shared/examWorkbook";
import { PlannerCourse, SnapshotExam } from "../api/types";

export { examWorkbookHeaders, parseExamWorkbook, parseExamWorkbookBuffer, parseExamWorksheetRows, type ParsedExamImportRow };

export type ExamImportPreviewStatus = "matched" | "unmatched" | "ambiguous" | "invalid";

export type ExamImportMatchReason = "course-number-brackets" | "course-number-title" | "course-title-exact";

export type ExamImportPreviewRow = ParsedExamImportRow & {
  normalizedCourseNumbers: string[];
  matchedCourseId: string | null;
  matchedCourses: Array<{
    id: string;
    name: string;
    courseNumber: string | null;
    matchReasons: ExamImportMatchReason[];
  }>;
  candidateExam: SnapshotExam | null;
  status: ExamImportPreviewStatus;
  message: string;
  matchReasons: ExamImportMatchReason[];
  overwritesExistingExam: boolean;
};

const examImportMatchReasonOrder: ExamImportMatchReason[] = [
  "course-number-brackets",
  "course-number-title",
  "course-title-exact"
];

export function formatExamImportMatchReason(reason: ExamImportMatchReason): string {
  if (reason === "course-number-brackets") {
    return "Kursnummer in Klammern";
  }

  if (reason === "course-number-title") {
    return "Kursnummer im Titel";
  }

  return "Titeltreffer";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function courseNumberAppearsInTitle(normalizedTitle: string, courseNumber: string): boolean {
  const normalizedCourseNumber = normalizeCourseNumber(courseNumber);

  if (!normalizedCourseNumber) {
    return false;
  }

  const boundaryPattern = new RegExp(`(^|[^0-9A-Z])${escapeRegExp(normalizedCourseNumber)}([^0-9A-Z]|$)`);
  return boundaryPattern.test(normalizedTitle);
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

function buildCourseTitleIndex(courses: PlannerCourse[]): Map<string, PlannerCourse[]> {
  const index = new Map<string, PlannerCourse[]>();

  for (const course of courses) {
    const normalizedCourseTitle = normalizeCourseTitle(course.name);

    if (!normalizedCourseTitle) {
      continue;
    }

    const existing = index.get(normalizedCourseTitle) ?? [];
    existing.push(course);
    index.set(normalizedCourseTitle, existing);
  }

  return index;
}

function sortExamImportMatchReasons(reasons: Iterable<ExamImportMatchReason>): ExamImportMatchReason[] {
  const uniqueReasons = new Set(reasons);
  return examImportMatchReasonOrder.filter((reason) => uniqueReasons.has(reason));
}

export function buildExamImportPreview(rows: ParsedExamImportRow[], courses: PlannerCourse[]): ExamImportPreviewRow[] {
  const courseNumberIndex = buildCourseNumberIndex(courses);
  const courseTitleIndex = buildCourseTitleIndex(courses);

  const previewRows = rows.map((row) => {
    const normalizedCourseNumbers = Array.from(
      new Set(row.extractedCourseNumbers.map((value) => normalizeCourseNumber(value)).filter((value) => value.length > 0))
    );
    const normalizedCourseTitle = normalizeCourseTitle(row.courseName);
    const normalizedCourseTitleWithoutBrackets = normalizeCourseTitle(stripBracketContents(row.courseName));

    if (row.parseError) {
      return {
        ...row,
        normalizedCourseNumbers,
        matchedCourseId: null,
        matchedCourses: [],
        candidateExam: null,
        status: "invalid",
        message: row.parseError,
        matchReasons: [],
        overwritesExistingExam: false
      } satisfies ExamImportPreviewRow;
    }

    const matchedCourseMap = new Map<
      string,
      {
        id: string;
        name: string;
        courseNumber: string | null;
        matchReasons: Set<ExamImportMatchReason>;
      }
    >();

    function addMatchedCourses(sourceCourses: PlannerCourse[], reason: ExamImportMatchReason) {
      for (const course of sourceCourses) {
        const existing = matchedCourseMap.get(course.id);

        if (existing) {
          existing.matchReasons.add(reason);
          continue;
        }

        matchedCourseMap.set(course.id, {
          id: course.id,
          name: course.name,
          courseNumber: course.courseNumber,
          matchReasons: new Set([reason])
        });
      }
    }

    addMatchedCourses(
      normalizedCourseNumbers.flatMap((courseNumber) => courseNumberIndex.get(courseNumber) ?? []),
      "course-number-brackets"
    );
    addMatchedCourses(
      courses.filter((course) => course.courseNumber && courseNumberAppearsInTitle(normalizedCourseTitle, course.courseNumber)),
      "course-number-title"
    );
    addMatchedCourses(courseTitleIndex.get(normalizedCourseTitle) ?? [], "course-title-exact");

    if (normalizedCourseTitleWithoutBrackets !== normalizedCourseTitle) {
      addMatchedCourses(courseTitleIndex.get(normalizedCourseTitleWithoutBrackets) ?? [], "course-title-exact");
    }

    const matchedCourses = Array.from(matchedCourseMap.values()).map((course) => ({
      id: course.id,
      name: course.name,
      courseNumber: course.courseNumber,
      matchReasons: sortExamImportMatchReasons(course.matchReasons)
    }));
    const matchReasons = sortExamImportMatchReasons(matchedCourses.flatMap((course) => course.matchReasons));
    const primaryMatchReasons = matchedCourses[0]?.matchReasons.slice(0, 1) ?? [];

    if (matchedCourses.length === 0) {
      return {
        ...row,
        normalizedCourseNumbers,
        matchedCourseId: null,
        matchedCourses: [],
        candidateExam: null,
        status: "unmatched",
        message: "Keine passende Kursnummer oder kein passender Kurstitel gefunden.",
        matchReasons: [],
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
        matchReasons,
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
      matchReasons: primaryMatchReasons,
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
