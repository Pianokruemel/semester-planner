import type { UIAppointment, UICourse } from "../app/adapter";
import { TYPE_LABELS } from "./conflicts";

// TUCaN appointments are local Darmstadt times. Include the modern Berlin
// daylight-saving rules so calendar imports do not depend on the browser's zone.
const BERLIN_TIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "DTSTART:19960331T020000",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "DTSTART:19961027T030000",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE"
];

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/[,;]/g, "\\$&");
}

// RFC 5545 limits physical lines to 75 octets, including continuation spaces.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  let result = "";
  let octets = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (octets + size > 75) {
      result += "\r\n ";
      octets = 1;
    }
    result += character;
    octets += size;
  }
  return result;
}

export function createCalendarExport(courses: readonly UICourse[], generatedAt = new Date()): string {
  const timestamp = generatedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Semesti//Stundenplan//DE",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Semesti Stundenplan",
    "X-WR-TIMEZONE:Europe/Berlin",
    ...BERLIN_TIMEZONE
  ];

  const events = new Map<string, { course: UICourse; appointment: UIAppointment; rooms: Set<string> }>();
  for (const course of courses.filter((course) => course.isActive)) {
    for (const appointment of course.appointments) {
      const key = `${course.id}-${appointment.type}-${appointment.start}-${appointment.end}`;
      const event = events.get(key) ?? { course, appointment, rooms: new Set<string>() };
      // A single appointment may have one catalogue row per room.
      if (appointment.room) event.rooms.add(appointment.room);
      events.set(key, event);
    }
  }

  for (const { course, appointment, rooms } of [...events.values()].sort((a, b) => a.appointment.start.localeCompare(b.appointment.start))) {
    const start = appointment.start.replace(/[-:]/g, "") + "00";
    const end = appointment.end.replace(/[-:]/g, "") + "00";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(course.id)}-${appointment.type}-${start}-${end}@semesti.plani.dev`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;TZID=Europe/Berlin:${start}`,
      `DTEND;TZID=Europe/Berlin:${end}`,
      `SUMMARY:${escapeText(`${course.name} (${TYPE_LABELS[appointment.type]})`)}`
    );
    if (rooms.size) lines.push(`LOCATION:${escapeText([...rooms].sort().join(", "))}`);
    if (course.prof) lines.push(`DESCRIPTION:${escapeText(`Lehrende: ${course.prof}`)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function downloadCalendar(courses: readonly UICourse[]): void {
  const blob = new Blob([createCalendarExport(courses)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "semesti-stundenplan.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
