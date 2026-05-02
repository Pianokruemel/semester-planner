import { describe, expect, it } from "vitest";
import { formatAppointmentsForTextarea, parseAppointments, summarizeAppointments } from "./appointmentParser.js";

describe("appointment parser", () => {
  it("parses tab-separated TUCaN rows with optional header", () => {
    expect(
      parseAppointments("Nr\tDatum\tVon\tBis\tRaum\tLehrende\n1\tMo, 27. Apr. 2026\t08:55\t10:35\tS311/08\tAda")
    ).toEqual([
      {
        date: "2026-04-27",
        time_from: "08:55",
        time_to: "10:35",
        room: "S311/08",
        type: "Vorlesung"
      }
    ]);
  });

  it("maps starred rows to lectures and unstarred rows to tutorials when any star exists", () => {
    expect(
      parseAppointments(
        [
          "1\tMo, 27. Apr. 2026*\t08:55\t10:35\tS311/08\tAda",
          "2\tDi, 28. Apr. 2026\t09:50\t11:30\tS202/C205\tAda"
        ].join("\n")
      )
    ).toMatchObject([{ type: "Vorlesung" }, { type: "Uebung" }]);
  });

  it("supports whitespace-separated rows and markdown room links", () => {
    expect(parseAppointments("Mo, 27. Mär. 2026  08:55  10:35  [S311/08](https://example.test)  Ada")).toEqual([
      {
        date: "2026-03-27",
        time_from: "08:55",
        time_to: "10:35",
        room: "S311/08",
        type: "Vorlesung"
      }
    ]);
  });

  it("summarizes parsed appointments", () => {
    expect(summarizeAppointments("1\tMo, 27. Apr. 2026\t08:55\t10:35\tS311/08\tAda")).toEqual({
      count: 1,
      date_from: "2026-04-27",
      date_to: "2026-04-27",
      types: ["Vorlesung"]
    });
  });

  it("formats appointments back to textarea rows", () => {
    expect(
      formatAppointmentsForTextarea([
        {
          date: "2026-04-27",
          timeFrom: "08:55",
          timeTo: "10:35",
          room: "S311/08",
          type: "Vorlesung"
        }
      ])
    ).toContain("1\tMo, 27. Apr. 2026*\t08:55\t10:35\tS311/08");
  });
});
