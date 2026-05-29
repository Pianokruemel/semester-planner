import type { CourseColorTag, SnapshotCourse } from "../api/types";

export type UIAppointmentType = "vl" | "ub" | "klausur";

export type UIAppointment = {
  type: UIAppointmentType;
  start: string; // ISO local datetime "YYYY-MM-DDTHH:MM"
  end: string;
  room?: string;
};

export type UICourse = {
  id: string;
  name: string;
  abbreviation: string;
  ects: number;
  prof: string;
  color: string;
  colorTag: CourseColorTag;
  isActive: boolean;
  appointments: UIAppointment[];
};

const CHIP_FALLBACK: CourseColorTag = "chip-1";

export function toUICourse(c: SnapshotCourse): UICourse {
  const flat: UIAppointment[] = c.appointments.map((a) => ({
    type: a.type === "Vorlesung" ? "vl" : "ub",
    start: `${a.date}T${a.time_from}`,
    end: `${a.date}T${a.time_to}`,
    room: a.room
  }));
  if (c.exam) {
    flat.push({
      type: "klausur",
      start: `${c.exam.date}T${c.exam.time_from}`,
      end: `${c.exam.date}T${c.exam.time_to}`
    });
  }
  const colorTag: CourseColorTag = c.color_tag ?? CHIP_FALLBACK;
  return {
    id: c.id,
    name: c.name,
    abbreviation: c.abbreviation,
    ects: c.cp,
    prof: c.instructor ?? "",
    color: `var(--${colorTag})`,
    colorTag,
    isActive: c.is_active,
    appointments: flat
  };
}

export function toUICourses(courses: SnapshotCourse[]): UICourse[] {
  return courses.map(toUICourse);
}
