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

  it("parses IT Security split section headings and ignores prose inside module descriptions", () => {
    const entries = parseModuleHandbookPages([
      {
        pageNumber: 24,
        text: `
          Modulhandbuch
          M. Sc. IT Security

          Wahlbereich
          Systems and Communication Security

          Modulbeschreibung
          Modulname
          Embedded System Security
          Modul Nr.
          20-00-0581
          6 CP
          Kurse des Moduls
          20-00-0581-iv Embedded System Security
          7
          In dieser Veranstaltung findet eine Anrechnung von vorlesungsbegleitenden Leistungen
          statt, die lt. §25(2) der 6. Novelle der Allgemeinen Prüfungsbestimmungen der TU
          Darmstadt und den vom Fachbereich Informatik am 14.07.2022 beschlossenen
          Anrechnungsregeln zu einer Notenverbesserung um bis zu 1.0 führen kann.

          Modulbeschreibung
          Modulname
          Netzsicherheit
          Modul Nr.
          20-00-0512
          6 CP
          Kurse des Moduls
          20-00-0512-iv Netzsicherheit
        `
      },
      {
        pageNumber: 110,
        text: `
          Modulhandbuch
          M. Sc. IT Security

          Wahlbereich Studienbegleitende Leistungen
          Praktika, Projektpraktika und ähnliche
          Veranstaltungen

          Modulbeschreibung
          Modulname
          Hacker Contest
          Modul Nr.
          20-00-0114
          6 CP
          Kurse des Moduls
          20-00-0114-pr Hacker Contest
        `
      },
      {
        pageNumber: 170,
        text: `
          Wahlbereich Studienbegleitende Leistungen
          Seminare

          Modulbeschreibung
          Modulname
          Aktuelle Forschungstrends der Kryptographie
          Modul Nr.
          20-00-1146
          3 CP
          Kurse des Moduls
          20-00-1146-se Aktuelle Forschungstrends der Kryptographie
        `
      }
    ]);

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module_number: "20-00-0581",
          course_number: "20-00-0581-iv",
          cp: 6,
          class_path: ["Wahlbereich Systems and Communication Security"]
        }),
        expect.objectContaining({
          module_number: "20-00-0512",
          course_number: "20-00-0512-iv",
          class_path: ["Wahlbereich Systems and Communication Security"]
        }),
        expect.objectContaining({
          module_number: "20-00-0114",
          course_number: "20-00-0114-pr",
          class_path: ["Wahlbereich Studienbegleitende Leistungen", "Praktika, Projektpraktika und ähnliche Veranstaltungen"]
        }),
        expect.objectContaining({
          module_number: "20-00-1146",
          course_number: "20-00-1146-se",
          class_path: ["Wahlbereich Studienbegleitende Leistungen", "Seminare"]
        })
      ])
    );
  });
});
