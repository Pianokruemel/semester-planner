import { describe, expect, it } from "vitest";
import {
  discoverStudyProgramPages,
  findCurrentModuleHandbookLink,
  parseModuleHandbookPages
} from "./moduleHandbooks.js";

describe("module handbook discovery", () => {
  it("selects the current PO handbook link and skips archived handbook sections", () => {
    const overviewUrl = "https://www.informatik.tu-darmstadt.de/ordnungen/";
    const pages = discoverStudyProgramPages(
      `
      <a href="/bsc">B. Sc. Informatik</a>
      <a href="/msc">M. Sc. Informatik</a>
      `,
      overviewUrl
    );

    expect(pages[0]).toMatchObject({
      program_key: "bsc-informatik",
      page_url: "https://www.informatik.tu-darmstadt.de/bsc"
    });

    const link = findCurrentModuleHandbookLink(
      `
      <main>
        <h2>PO 2023</h2>
        <a href="current.pdf">Modulhandbuch</a>
        <h2>Archiv</h2>
        <a href="old.pdf">Modulhandbuch</a>
      </main>
      `,
      pages[0]!
    );

    expect(link).toMatchObject({
      po_label: "PO 2023",
      pdf_url: "https://www.informatik.tu-darmstadt.de/current.pdf",
      pdf_label: "Modulhandbuch"
    });
  });
});

describe("module handbook text parsing", () => {
  it("parses sector-specific class paths and CP values without leaking between sectors", () => {
    const entries = parseModuleHandbookPages([
      {
        pageNumber: 12,
        text: `
          Pflichtbereich
          Modulnummer 20-00-1111 Algorithmen
          Leistungspunkte 5
          Veranstaltungen
          20-00-1111-iv Algorithmen

          Wahlpflichtbereich
          Modulnummer 20-00-2222 Advanced Systems
          CP 6
          Veranstaltungen
          20-00-2222-vl Advanced Systems Lecture

          Anwendungsfach
          Modulnummer 20-00-3333 Data Lab
          3 CP
        `
      }
    ]);

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module_number: "20-00-1111",
          course_number: "20-00-1111-iv",
          cp: 5,
          class_path: ["Pflichtbereich"]
        }),
        expect.objectContaining({
          module_number: "20-00-2222",
          course_number: "20-00-2222-vl",
          cp: 6,
          class_path: ["Wahlpflichtbereich"]
        }),
        expect.objectContaining({
          module_number: "20-00-3333",
          course_number: null,
          cp: 3,
          class_path: ["Anwendungsfach"]
        })
      ])
    );
  });

  it("keeps section context and parses split CP labels and course numbers", () => {
    const entries = parseModuleHandbookPages([
      {
        pageNumber: 7,
        text: `
          Pflichtbereich
          Modulnummer 20-00-0219 IT Sicherheit
          Leistungspun
          kte 5
          Veranstaltungen
          20-00-0219-
          iv IT Sicherheit
          20-00-0219-
          ue IT Sicherheit Übung
        `
      },
      {
        pageNumber: 8,
        text: `
          Wahlpflichtbereich
          Modulnummer 20-00-0999 Advanced Topic
          Credit Points 6
        `
      }
    ]);

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module_number: "20-00-0219",
          course_number: "20-00-0219-iv",
          cp: 5,
          class_path: ["Pflichtbereich"],
          page_number: 7
        }),
        expect.objectContaining({
          module_number: "20-00-0219",
          course_number: "20-00-0219-ue",
          cp: 5,
          class_path: ["Pflichtbereich"]
        }),
        expect.objectContaining({
          module_number: "20-00-0999",
          course_number: null,
          cp: 6,
          class_path: ["Wahlpflichtbereich"]
        })
      ])
    );
  });
});
