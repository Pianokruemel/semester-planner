import type { UIAppointment, UICourse } from "../app/adapter";

export type ExamSeverityKey = "overlap" | "24h" | "48h";

export const EXAM_SEVERITY: Record<ExamSeverityKey, { color: string; bg: string; label: string; rank: number }> = {
  overlap: { color: "var(--tint-red)", bg: "rgba(255,59,48,0.12)", label: "Zeitgleich", rank: 3 },
  "24h": { color: "var(--tint-orange)", bg: "rgba(255,149,0,0.12)", label: "Innerhalb 24h", rank: 2 },
  "48h": { color: "oklch(0.75 0.15 85)", bg: "oklch(0.75 0.15 85 / 0.12)", label: "Innerhalb 48h", rank: 1 }
};

export const TYPE_LABELS: Record<UIAppointment["type"], string> = { vl: "Vorlesung", ub: "Übung", klausur: "Klausur" };
export const TYPE_SHORT: Record<UIAppointment["type"], string> = { vl: "VL", ub: "ÜB", klausur: "Klausur" };

export function overlaps(a: UIAppointment, b: UIAppointment): boolean {
  const s1 = new Date(a.start).getTime();
  const e1 = new Date(a.end).getTime();
  const s2 = new Date(b.start).getTime();
  const e2 = new Date(b.end).getTime();
  return s1 < e2 && s2 < e1;
}

export function hoursBetween(a: UIAppointment, b: UIAppointment): number {
  const e1 = new Date(a.end).getTime();
  const s2 = new Date(b.start).getTime();
  const e2 = new Date(b.end).getTime();
  const s1 = new Date(a.start).getTime();
  const gap = Math.min(Math.abs(s2 - e1), Math.abs(s1 - e2));
  return gap / (1000 * 60 * 60);
}

export function examSeverity(examA: UIAppointment, examB: UIAppointment): ExamSeverityKey | null {
  if (overlaps(examA, examB)) return "overlap";
  const gap = hoursBetween(examA, examB);
  if (gap < 24) return "24h";
  if (gap < 48) return "48h";
  return null;
}

export type ConflictPair = {
  a: UICourse;
  b: UICourse;
  clashes: { apptA: UIAppointment; apptB: UIAppointment }[];
  examSev: ExamSeverityKey | null;
};

export type PerCourseConflict = {
  clashCount: number;
  totalAppts: number;
  worstExamSev: ExamSeverityKey | null;
};

export function computeConflicts(picked: UICourse[]): {
  pairs: ConflictPair[];
  perCourse: Record<string, PerCourseConflict>;
} {
  const pairs: ConflictPair[] = [];
  const perCourse: Record<string, PerCourseConflict> = {};

  picked.forEach((c) => {
    if (!perCourse[c.id]) {
      perCourse[c.id] = { clashCount: 0, totalAppts: c.appointments.length, worstExamSev: null };
    }
  });

  picked.forEach((a, i) => {
    picked.slice(i + 1).forEach((b) => {
      const clashes: { apptA: UIAppointment; apptB: UIAppointment }[] = [];
      const examA = a.appointments.find((x) => x.type === "klausur");
      const examB = b.appointments.find((x) => x.type === "klausur");

      a.appointments.forEach((aa) => {
        b.appointments.forEach((bb) => {
          if (aa.type === "klausur" && bb.type === "klausur") return;
          if (overlaps(aa, bb)) clashes.push({ apptA: aa, apptB: bb });
        });
      });

      let sev: ExamSeverityKey | null = null;
      if (examA && examB) sev = examSeverity(examA, examB);

      if (clashes.length > 0 || sev) {
        pairs.push({ a, b, clashes, examSev: sev });
        const uniqueA = new Set(clashes.map((c) => c.apptA.start));
        const uniqueB = new Set(clashes.map((c) => c.apptB.start));
        perCourse[a.id].clashCount += uniqueA.size;
        perCourse[b.id].clashCount += uniqueB.size;
        if (sev) {
          const rank = EXAM_SEVERITY[sev].rank;
          [a.id, b.id].forEach((id) => {
            const cur = perCourse[id].worstExamSev;
            if (!cur || rank > EXAM_SEVERITY[cur].rank) perCourse[id].worstExamSev = sev;
          });
        }
      }
    });
  });

  return { pairs, perCourse };
}
