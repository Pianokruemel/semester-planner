import { PlannerCourse, PlannerExam } from "../api/types";

export type ExamConflictSeverity = "red" | "orange" | "yellow" | "green";

export type ExamConflict = {
  severity: ExamConflictSeverity;
  explanation: string;
  comparedCourseId: string | null;
};

type ExamRange = {
  start: Date;
  end: Date;
};

function parseLocalDateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return { year, month: month - 1, day };
}

function parseLocalTimeParts(time: string) {
  const [hour, minute] = time.split(":").map(Number);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  return { hour, minute };
}

function buildExamRange(exam: PlannerExam): ExamRange | null {
  const date = parseLocalDateParts(exam.date);
  const from = parseLocalTimeParts(exam.timeFrom);
  const to = parseLocalTimeParts(exam.timeTo);

  if (!date || !from || !to) {
    return null;
  }

  const start = new Date(date.year, date.month, date.day, from.hour, from.minute, 0, 0);
  const end = new Date(date.year, date.month, date.day, to.hour, to.minute, 0, 0);

  if (end <= start) {
    return null;
  }

  return { start, end };
}

function severityRank(severity: ExamConflictSeverity): number {
  if (severity === "red") {
    return 3;
  }

  if (severity === "orange") {
    return 2;
  }

  if (severity === "yellow") {
    return 1;
  }

  return 0;
}

function formatGapHours(gapMinutes: number): string {
  if (gapMinutes < 60) {
    return `${gapMinutes} Min.`;
  }

  const hours = Math.round((gapMinutes / 60) * 10) / 10;
  const rendered = Number.isInteger(hours) ? String(hours) : String(hours).replace(".", ",");
  return `${rendered} Std.`;
}

function describeConflict(
  severity: ExamConflictSeverity,
  courseName: string,
  gapMinutes: number
): string {
  if (severity === "red") {
    return `Überschneidet sich direkt mit ${courseName}.`;
  }

  if (severity === "orange") {
    return `${formatGapHours(gapMinutes)} Abstand zu ${courseName}.`;
  }

  if (severity === "yellow") {
    return `${formatGapHours(gapMinutes)} Abstand zu ${courseName}.`;
  }

  return `Mehr als 48 Std. Abstand zu ${courseName}.`;
}

export function buildExamConflictMap(courses: PlannerCourse[]): Map<string, ExamConflict> {
  const activeExams = courses
    .filter((course) => course.isActive && course.exam)
    .map((course) => ({
      course,
      range: buildExamRange(course.exam as PlannerExam)
    }))
    .filter((entry): entry is { course: PlannerCourse; range: ExamRange } => entry.range !== null);

  const conflicts = new Map<string, ExamConflict>();

  for (const entry of activeExams) {
    let bestConflict: ExamConflict = {
      severity: "green",
      explanation: "Kein enger Konflikt mit anderen aktiven Prüfungen.",
      comparedCourseId: null
    };
    let bestGap = Number.POSITIVE_INFINITY;

    for (const otherEntry of activeExams) {
      if (otherEntry.course.id === entry.course.id) {
        continue;
      }

      const overlaps = entry.range.start < otherEntry.range.end && otherEntry.range.start < entry.range.end;
      const gapMinutes = overlaps
        ? 0
        : Math.round(
            Math.min(
              Math.abs(entry.range.start.getTime() - otherEntry.range.end.getTime()),
              Math.abs(otherEntry.range.start.getTime() - entry.range.end.getTime())
            ) / 60_000
          );

      const severity: ExamConflictSeverity = overlaps
        ? "red"
        : gapMinutes <= 24 * 60
          ? "orange"
          : gapMinutes <= 48 * 60
            ? "yellow"
            : "green";

      const nextConflict: ExamConflict = {
        severity,
        explanation: describeConflict(severity, otherEntry.course.name, gapMinutes),
        comparedCourseId: otherEntry.course.id
      };

      const nextRank = severityRank(nextConflict.severity);
      const currentRank = severityRank(bestConflict.severity);

      if (nextRank > currentRank || (nextRank === currentRank && gapMinutes < bestGap)) {
        bestConflict = nextConflict;
        bestGap = gapMinutes;
      }
    }

    conflicts.set(entry.course.id, bestConflict);
  }

  return conflicts;
}