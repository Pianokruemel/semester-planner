export type ExportAppointment = {
  id: string;
  courseName: string;
  courseAbbreviation: string;
  cp: number;
  categoryName: string | null;
  date: string;
  timeFrom: string;
  timeTo: string;
  room: string;
};

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }

  const segments: string[] = [];
  for (let index = 0; index < line.length; index += 75) {
    const segment = line.slice(index, index + 75);
    segments.push(index === 0 ? segment : ` ${segment}`);
  }

  return segments.join("\r\n");
}

function formatUtcTimestamp(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function formatLocalDateTime(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(/:/g, "")}00`;
}

export function buildIcs(appointments: ExportAppointment[], showFullName: boolean): string {
  const timestamp = formatUtcTimestamp();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Semester Planner//Encrypted Snapshots//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];

  for (const appointment of appointments) {
    const title = showFullName ? appointment.courseName : appointment.courseAbbreviation;
    const description = `Kategorie: ${appointment.categoryName ?? "Ohne Kategorie"} | CP: ${appointment.cp}`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(`${appointment.id}@stundenplan`)}`,
      `DTSTAMP:${timestamp}`,
      `DTSTART:${formatLocalDateTime(appointment.date, appointment.timeFrom)}`,
      `DTEND:${formatLocalDateTime(appointment.date, appointment.timeTo)}`,
      `SUMMARY:${escapeIcsText(title)}`,
      `LOCATION:${escapeIcsText(appointment.room)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}