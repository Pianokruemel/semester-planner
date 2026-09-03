import { describe, expect, it } from "vitest";
import { examWorkbookHeaders, extractCourseNumbers, parseExamWorksheetRows } from "./examWorkbook.js";

function makeRows(...rows: unknown[][]) {
  return [examWorkbookHeaders.slice(), ...rows];
}

describe("exam workbook parsing", () => {
  it("parses TU exam rows and extracts course numbers from brackets and titles", () => {
    const rows = parseExamWorksheetRows(
      makeRows(["Do", 46191, "14:00", "16:00", "Examen", "Prof. Ada", "Sichere Kritische Infrastrukturen (20-00-0720)"])
    );

    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      date: "2026-06-18",
      timeFrom: "14:00",
      timeTo: "16:00",
      courseName: "Sichere Kritische Infrastrukturen (20-00-0720)",
      extractedCourseNumbers: ["20-00-0720"],
      parseError: null
    });
  });

  it("finds multiple course numbers embedded in a title", () => {
    expect(
      extractCourseNumbers(
        "Modetheorien/Ästhetik undInszenierungspraktiken 03-01-2003-vl/03-01-4019 und Wdh. 03-01-2011-vl"
      )
    ).toEqual(["03-01-2003-VL", "03-01-4019", "03-01-2011-VL"]);
  });

  it("extracts course numbers with alphanumeric department segments", () => {
    expect(extractCourseNumbers("Robotik (18-ad-2090-vl), Sicherheit 18-su-2010 und Mathematik 20-am-4000-P1")).toEqual([
      "18-AD-2090-VL",
      "18-SU-2010",
      "20-AM-4000-P1"
    ]);
  });
});
