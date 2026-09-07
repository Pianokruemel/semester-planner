import { describe, expect, it } from "vitest";
import type { UICourse } from "../app/adapter";
import { createCalendarExport } from "./calendarExport";

const GENERATED_AT = new Date("2026-09-07T03:41:28.537Z");

function course(overrides: Partial<UICourse> = {}): UICourse {
  return {
    id: "course-1",
    name: "Graphische Datenverarbeitung I",
    abbreviation: "GDV I",
    ects: 6,
    prof: "Stefan Roth",
    color: "var(--chip-1)",
    colorTag: "chip-1",
    isActive: true,
    appointments: [
      { type: "vl", start: "2026-10-20T10:00", end: "2026-10-20T11:40", room: "S305/074" },
      { type: "vl", start: "2026-10-27T10:00", end: "2026-10-27T11:40", room: "S305/074" },
      { type: "ub", start: "2026-10-22T15:20", end: "2026-10-22T17:00", room: "S202/C205" },
      { type: "klausur", start: "2027-02-16T13:00", end: "2027-02-16T15:00" }
    ],
    ...overrides
  };
}

function unfold(calendar: string): string {
  return calendar.replace(/\r\n[ \t]/g, "");
}

describe("calendar export", () => {
  it("exports actual lecture, tutorial and exam dates only for active courses", () => {
    const calendar = unfold(createCalendarExport([
      course(),
      course({ id: "inactive", name: "Inactive course", isActive: false }),
      course({ id: "unscheduled", name: "Unscheduled course", appointments: [] })
    ], GENERATED_AT));

    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(calendar).not.toContain("Inactive course");
    expect(calendar).not.toContain("Unscheduled course");
    expect(calendar).toContain("SUMMARY:Graphische Datenverarbeitung I (Vorlesung)\r\n");
    expect(calendar).toContain("SUMMARY:Graphische Datenverarbeitung I (Übung)\r\n");
    expect(calendar).toContain("SUMMARY:Graphische Datenverarbeitung I (Klausur)\r\n");
    expect(calendar).toContain("LOCATION:S202/C205\r\n");
    expect(calendar).toContain("DESCRIPTION:Lehrende: Stefan Roth\r\n");
    expect(calendar).toContain("DTSTART;TZID=Europe/Berlin:20261022T152000\r\n");
    expect(calendar).toContain("DTEND;TZID=Europe/Berlin:20270216T150000\r\n");
    expect(calendar).toContain("DTSTAMP:20260907T034128Z\r\n");
  });

  it("keeps Berlin wall times across the autumn DST change and embeds both offset rules", () => {
    const calendar = unfold(createCalendarExport([course()], GENERATED_AT));
    expect(calendar).toContain("DTSTART;TZID=Europe/Berlin:20261020T100000\r\n");
    expect(calendar).toContain("DTSTART;TZID=Europe/Berlin:20261027T100000\r\n");
    expect(calendar).toContain("TZID:Europe/Berlin\r\n");
    expect(calendar).toContain("TZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nTZNAME:CEST\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU");
    expect(calendar).toContain("TZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nTZNAME:CET\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU");
    expect(calendar).not.toContain("DTSTART:20261020T100000Z");
  });

  it("escapes text and folds UTF-8 without splitting characters or introducing calendar properties", () => {
    const name = "Übung 💻, A; B\\C\r\nEND:VEVENT\n" + "Überprüfung💻".repeat(12);
    const exported = course({
      name,
      prof: "Roth; Muster, Test\\Team\rLehrstuhl",
      appointments: [{ type: "ub", start: "2026-10-22T15:20", end: "2026-10-22T17:00", room: "Raum A,B; C\\D\nCampus" }]
    });
    const calendar = createCalendarExport([exported], GENERATED_AT);
    const unfolded = unfold(calendar);

    expect(unfolded.match(/\r\nEND:VEVENT\r\n/g)).toHaveLength(1);
    expect(unfolded).toContain("SUMMARY:Übung 💻\\, A\\; B\\\\C\\nEND:VEVENT\\n" + "Überprüfung💻".repeat(12) + " (Übung)\r\n");
    expect(unfolded).toContain("LOCATION:Raum A\\,B\\; C\\\\D\\nCampus\r\n");
    expect(unfolded).toContain("DESCRIPTION:Lehrende: Roth\\; Muster\\, Test\\\\Team\\nLehrstuhl\r\n");
    expect(calendar).toContain("\r\n ");
    expect(calendar.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    for (const line of calendar.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(calendar))).toBe(calendar);
  });

  it("keeps event identifiers stable after reordering or changing course metadata", () => {
    const original = course();
    const ids = (calendar: string) => unfold(calendar).match(/^UID:.+$/gm)?.sort();
    const changed = course({ name: "Updated title", appointments: [...original.appointments].reverse() });
    expect(ids(createCalendarExport([changed], GENERATED_AT))).toEqual(ids(createCalendarExport([original], GENERATED_AT)));
    expect(new Set(ids(createCalendarExport([original], GENERATED_AT))).size).toBe(4);
  });

  it("combines room rows for the same appointment without colliding event identifiers", () => {
    const appointment = course().appointments[0];
    const multipleRooms = course({ appointments: [
      { ...appointment, room: "Room B" },
      { ...appointment, room: "Room A" },
      { ...appointment, room: "Room A" },
      { ...appointment, type: "ub", room: "Room C" }
    ] });
    const calendar = unfold(createCalendarExport([multipleRooms], GENERATED_AT));
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(new Set(calendar.match(/^UID:.+$/gm)).size).toBe(2);
    expect(calendar).toContain("LOCATION:Room A\\, Room B\r\n");
    expect(calendar).toContain("LOCATION:Room C\r\n");

    const reversed = course({ appointments: [...multipleRooms.appointments].reverse() });
    const eventLines = (value: string) => unfold(value).split("\r\n").filter((line) => /^(UID|LOCATION):/.test(line)).sort();
    expect(eventLines(createCalendarExport([reversed], GENERATED_AT))).toEqual(eventLines(calendar));
  });

  it("produces a complete empty calendar when no active course has dates", () => {
    const calendar = createCalendarExport([course({ isActive: false })], GENERATED_AT);
    expect(calendar.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(calendar.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(calendar).not.toContain("BEGIN:VEVENT");
  });
});
