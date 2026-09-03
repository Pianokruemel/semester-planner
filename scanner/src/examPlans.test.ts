import { describe, expect, it } from "vitest";
import { discoverExamPlanLinks, parseExamPlanSemester, selectNewestExamPlanLink } from "./examPlans.js";

describe("exam plan semester discovery", () => {
  it("sorts semesters semantically instead of by page order", () => {
    expect(parseExamPlanSemester("Wintersemester 25/26")).toEqual({
      semester_key: "Wintersemester 2025/26",
      semester_index: 4051
    });
    expect(parseExamPlanSemester("Sommersemester 2026")).toEqual({
      semester_key: "Sommersemester 2026",
      semester_index: 4052
    });
    expect(parseExamPlanSemester("Wintersemester 26/27")).toEqual({
      semester_key: "Wintersemester 2026/27",
      semester_index: 4053
    });
    expect(parseExamPlanSemester("Wintersemester 2026/2027")).toEqual({
      semester_key: "Wintersemester 2026/27",
      semester_index: 4053
    });
  });

  it("selects Sommersemester 2026 over Wintersemester 25/26 even when winter appears first", () => {
    const links = discoverExamPlanLinks(
      `
      <p><a href="/Pruefungen_WiSe_25_26_Studierende.xlsx">Wintersemester 25/26<span>(XLSX-Datei)</span></a></p>
      <p><em>Stand 26.03.26</em></p>
      <p><a href="/Pruefungen_SoSe_2026_Studierende.xlsx">Sommersemester 2026<span>(XLSX-Datei)</span></a></p>
      <p><em>Stand 26.03.26</em></p>
      `,
      "https://www.intern.tu-darmstadt.de/page/index.de.jsp"
    );

    expect(selectNewestExamPlanLink(links)).toMatchObject({
      semester_key: "Sommersemester 2026",
      file_url: "https://www.intern.tu-darmstadt.de/Pruefungen_SoSe_2026_Studierende.xlsx"
    });
  });
});
