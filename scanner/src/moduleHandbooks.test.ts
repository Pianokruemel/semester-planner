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

  it("keeps IT Security elective context after table-of-contents and prose fragments", () => {
    const entries = parseModuleHandbookPages([
      {
        pageNumber: 3,
        text: `
          Wahlbereiche
          Wahlbereich Cryptography and Foundations                                            4
          Wahlbereich Systems and Communication Security                                     24
          Masterarbeit                                                                       248
        `
      },
      {
        pageNumber: 4,
        text: `
          Modulhandbuch
          M. Sc. IT Security

          Wahlbereich Cryptography and Foundations

          Modulbeschreibung
          Modulname
          Deep Learning: Architectures & Methods
          Modul Nr.
          20-00-1034
          6 CP
          Kurse des Moduls
          20-00-1034-iv Deep Learning: Architectures & Methods
          Qualifikationsziele / Lernergebnisse
          Forschungsprojekte im Bereich der Reinforcement Learning durchzuführen, z.B. im Rahmen einer Bachelor- oder
          Masterarbeit. Dies betrifft sowohl ein grundlegendes Verständnis der algorithmischen Ansätze.

          Modulbeschreibung
          Modulname
          Kryptographische Protokolle
          Modul Nr.
          20-00-1032
          6 CP
          Kurse des Moduls
          20-00-1032-iv Kryptographische Protokolle
        `
      }
    ]);

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module_number: "20-00-1034",
          course_number: "20-00-1034-iv",
          class_path: ["Wahlbereich Cryptography and Foundations"]
        }),
        expect.objectContaining({
          module_number: "20-00-1032",
          course_number: "20-00-1032-iv",
          class_path: ["Wahlbereich Cryptography and Foundations"]
        })
      ])
    );
    expect(entries.map((entry) => entry.class_path.join(" > "))).not.toContain("Masterarbeit");
    expect(entries.map((entry) => entry.class_path.join(" > "))).not.toContain(
      "Bereich der Reinforcement Learning durchzuführen, z.B. im Rahmen einer Bachelor- oder"
    );
  });

  it("resets table-of-contents context at lettered section covers and ignores exam references as courses", () => {
    const entries = parseModuleHandbookPages([
      {
        pageNumber: 3,
        text: `
          Inhaltsverzeichnis
          Wahlbereich Studienbegleitende Leistungen
          Praktikum in der Lehre
          Masterarbeit 608
        `
      },
      {
        pageNumber: 4,
        text: `
          Modulhandbuch
          B. Sc. Informatik
          A Pflichtbereich
        `
      },
      {
        pageNumber: 5,
        text: `
          Modulbeschreibung
          Modulname
          1.1.1.
          Erfolgreich ins Informatik-Studium starten (eiiss)
          Modul Nr.
          20-00-1141
          1 CP
          1
          Kurse des Moduls
          Kurs Nr.
          20-00-1141-
          tt
          Erfolgreich ins Informatik-Studium starten
          2
          Lerninhalt
          5
          Prüfungsform
          [20-00-0000-tt] (Studienleistung, Sonderform, Bestanden/Nicht bestanden)
        `
      },
      {
        pageNumber: 48,
        text: `
          Modulhandbuch
          B. Sc. Informatik
          B Wahlpflichtbereich
        `
      },
      {
        pageNumber: 49,
        text: `
          Modulbeschreibung
          Modulname
          Betriebssysteme
          Modul Nr.
          20-00-0903
          5 CP
          Kurse des Moduls
          20-00-0903-iv Betriebssysteme
        `
      }
    ]);

    expect(entries.filter((entry) => entry.module_number === "20-00-1141")).toEqual([
      expect.objectContaining({
        course_number: "20-00-1141-tt",
        module_title: "Erfolgreich ins Informatik-Studium starten (eiiss)",
        class_path: ["Pflichtbereich"]
      })
    ]);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module_number: "20-00-0903",
          class_path: ["Wahlpflichtbereich"]
        })
      ])
    );
  });

  it("recognizes named compulsory-elective covers without treating continuation prose as a heading", () => {
    const entries = parseModuleHandbookPages([
      {
        pageNumber: 3,
        text: `
          Inhaltsverzeichnis
          Wahlpflichtbereich Sense 4
          Masterarbeit 217
        `
      },
      {
        pageNumber: 4,
        text: `
          Modulhandbuch
          M. Sc. Autonome Systeme und Robotik
          Wahlpflichtbereich Sense
        `
      },
      {
        pageNumber: 5,
        text: `
          Modulbeschreibung
          Modulname
          Bildverarbeitung für Ingenieure - Grundlagen der bildgestützten Mess- und
          Automatisierungstechnik
          Modul Nr.
          20-00-0155
          3 CP
          Kurse des Moduls
          20-00-0155-iv Bildverarbeitung
        `
      },
      {
        pageNumber: 6,
        text: `
          Anwendungen aus dem Wahlbereich Plan werden in diesem Modul verglichen.
          Wahlbereich Act ist ebenfalls für das Anwendungsbeispiel relevant.
        `
      },
      {
        pageNumber: 7,
        text: `
          Modulbeschreibung
          Modulname
          Computer Vision
          Modul Nr.
          20-00-0157
          6 CP
          Kurse des Moduls
          20-00-0157-iv Computer Vision
        `
      }
    ]);

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module_number: "20-00-0155",
          module_title: "Bildverarbeitung für Ingenieure - Grundlagen der bildgestützten Mess- und Automatisierungstechnik",
          class_path: ["Wahlpflichtbereich Sense"]
        }),
        expect.objectContaining({
          module_number: "20-00-0157",
          class_path: ["Wahlpflichtbereich Sense"]
        })
      ])
    );
  });

  it("keeps Computer Science specialisations as parents of wrapped elective headings", () => {
    const entries = parseModuleHandbookPages([
      {
        pageNumber: 175,
        text: `
          Modulhandbuch
          M. Sc. Computer Science
          Vertiefung Distributed Computing
          Wahlbereich Computer Networks and
          Distributed Systems
        `
      },
      {
        pageNumber: 176,
        text: `
          Modulbeschreibung
          Modulname
          Sichere Mobile Netze
          Modul Nr.
          20-00-0342
          6 CP
          Kurse des Moduls
          20-00-0342-iv Sichere Mobile Netze
        `
      },
      {
        pageNumber: 311,
        text: `
          Modulhandbuch
          M. Sc. Computer Science
          Vertiefung Visual Computing
          Wahlbereich Integrated Methods of Graphics
          and Vision
        `
      },
      {
        pageNumber: 312,
        text: `
          Modulbeschreibung
          Modulname
          Visual Inference
          Modul Nr.
          20-00-1038
          6 CP
          Kurse des Moduls
          20-00-1038-iv Visual Inference
        `
      }
    ]);

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module_number: "20-00-0342",
          class_path: ["Vertiefung Distributed Computing", "Wahlbereich Computer Networks and Distributed Systems"]
        }),
        expect.objectContaining({
          module_number: "20-00-1038",
          class_path: ["Vertiefung Visual Computing", "Wahlbereich Integrated Methods of Graphics and Vision"]
        })
      ])
    );
  });

  it("parses module and course numbers with alphanumeric department segments", () => {
    const entries = parseModuleHandbookPages([
      {
        pageNumber: 12,
        text: `
          Modulbeschreibung
          Modulname
          Adaptive Systeme
          Modul Nr.
          18 - AD - 2090
          6 CP
          Kurse des Moduls
          18 - AD - 2090 - vl Adaptive Systeme
        `
      }
    ]);

    expect(entries).toEqual([
      expect.objectContaining({
        module_number: "18-ad-2090",
        course_number: "18-ad-2090-vl",
        module_title: "Adaptive Systeme"
      })
    ]);
  });
});
