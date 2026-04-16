import { createEvents, DateArray } from "ics";

type ExportAppointment = {
  id: string;
  courseName: string;
  courseAbbreviation: string;
  cp: number;
  categoryName: string | null;
  date: Date;
  timeFrom: Date;
  timeTo: Date;
  room: string;
};

function dateArrayFromParts(date: Date, time: Date): DateArray {
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    time.getUTCHours(),
    time.getUTCMinutes()
  ];
}

export function buildIcs(
  appointments: ExportAppointment[],
  showFullName: boolean
): string {
  const events = appointments.map((appointment) => ({
    uid: `${appointment.id}@stundenplan`,
    title: showFullName ? appointment.courseName : appointment.courseAbbreviation,
    start: dateArrayFromParts(appointment.date, appointment.timeFrom),
    end: dateArrayFromParts(appointment.date, appointment.timeTo),
    location: appointment.room,
    description: `Kategorie: ${appointment.categoryName ?? "Ohne Kategorie"} | CP: ${appointment.cp}`,
    startInputType: "local" as const,
    startOutputType: "local" as const,
    endInputType: "local" as const,
    endOutputType: "local" as const
  }));

  const result = createEvents(events);
  if (result.error) {
    throw result.error;
  }

  if (!result.value) {
    throw new Error("ICS konnte nicht erstellt werden.");
  }

  return result.value;
}
