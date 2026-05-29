import { describe, expect, it } from "vitest";
import {
  attachSmallGroupDetail,
  extractBreadcrumb,
  extractLinks,
  findCurrentSemesterLink,
  findFacultyLink,
  parseCourseDetail,
  parseSmallGroupDetail,
  smallGroupsFromCourse
} from "./tucan.js";

describe("TUCaN parsing", () => {
  it("classifies generated links by PRGNAME", () => {
    const links = extractLinks(
      `<div id="pageContent"><ul><li><a href="/scripts/mgrqispi.dll?PRGNAME=COURSEDETAILS&ARGUMENTS=-N123">Course</a></li></ul></div>`,
      "https://www.tucan.tu-darmstadt.de/start"
    );

    expect(links[0]).toMatchObject({
      kind: "course",
      text: "Course",
      prgName: "COURSEDETAILS"
    });
  });

  it("finds the active semester and faculty entry from TUCaN navigation pages", () => {
    const html = `
      <nav>
        <a href="/scripts/mgrqispi.dll?PRGNAME=ACTION&ARGUMENTS=-Acurrent">Aktuell - Sommersemester 2026</a>
        <a href="/scripts/mgrqispi.dll?PRGNAME=ACTION&ARGUMENTS=-Aarchive">Wintersemester 2024/25</a>
      </nav>
      <div id="pageContent">
        <h2>Übersicht</h2>
        <a href="/scripts/mgrqispi.dll?PRGNAME=ACTION&ARGUMENTS=-Afb20">FB20 - Informatik</a>
      </div>
    `;

    expect(findCurrentSemesterLink(html, "https://www.tucan.tu-darmstadt.de/start")).toMatchObject({
      text: "Aktuell - Sommersemester 2026",
      kind: "navigation"
    });
    expect(findFacultyLink(html, "https://www.tucan.tu-darmstadt.de/start", "FB20 - Informatik")).toMatchObject({
      text: "FB20 - Informatik",
      kind: "navigation"
    });
  });

  it("extracts breadcrumb paths without the overview prefix", () => {
    expect(extractBreadcrumb(`<div id="pageContent"><h2>Übersicht > FB20 - Informatik > Wahlbereiche</h2></div>`)).toEqual([
      "FB20 - Informatik",
      "Wahlbereiche"
    ]);
  });

  it("parses TUCaN's actual COURSEDETAILS layout (paragraph properties + named cells)", () => {
    const html = `
      <div id="pageContent">
        <h1>
        20-00-0219-iv
        IT Sicherheit
        </h1>
        <table>
          <caption>Veranstaltungsdetails</caption>
          <tr><td colspan="3">
            <p><b>Lehrende: </b><span id="dozenten">Dr. Donika Mirdita; Prof. Dr. Haya Schulmann; Prof. Dr. rer. nat. Michael Waidner</span></p>
            <p><b>Veranstaltungsart:</b> Integrierte Veranstaltung</p>
            <p><b>Orga-Einheit:</b> <span name="courseOrgUnit">FB20 Informatik</span></p>
            <p><b>Anzeige im Stundenplan: </b> IT Sicherheit
              <input type="hidden" name="shortdescription" value="IT Sicherheit" />
            </p>
            <p><b>Semesterwochenstunden: </b> 4 <input type="hidden" name="sws" value="4" /></p>
            <input type="hidden" name="credits" value="  6,0" />
            <p><b>Unterrichtssprache: </b> <span name="courseLanguageOfInstruction">Deutsch</span></p>
            <p><b>Lehrinhalte</b>:<br/> Diese Vorlesung bietet einen Einblick in IT-Sicherheit.</p>
            <p><b>Voraussetzungen</b>:<br/> Gute Kenntnisse der Kryptographie.</p>
            <p><b>Online-Angebote</b>:<br/> moodle</p>
          </td></tr>
        </table>
        <table>
          <caption>Termine</caption>
          <tr class="rw-hide">
            <td class="tbsubhead"></td>
            <td class="tbsubhead">Datum</td>
            <td class="tbsubhead">Von</td>
            <td class="tbsubhead">Bis</td>
            <td class="tbsubhead">Raum</td>
            <td class="tbsubhead">Lehrende</td>
          </tr>
          <tr>
            <td>1</td>
            <td name="appointmentDate">Mo, 27. Apr. 2026</td>
            <td name="appointmentTimeFrom">08:55</td>
            <td name="appointmentDateTo">10:35 </td>
            <td><a name="appointmentRooms" href="#">S311/08</a></td>
            <td name="appointmentInstructors">Dr. Donika Mirdita; Prof. Dr. Haya Schulmann</td>
          </tr>
        </table>
        <ul class="dl-ul-listview">
          <li class="listelement">
            <div class="dl-inner">
              <p class="dl-ul-li-headline"><strong>IT Sicherheit - Ü 01</strong></p>
              <p>Dr. Donika Mirdita; Prof. Dr. Haya Schulmann</p>
              <p>Mi, 29. Apr. 2026 [09:50]-Mi, 8. Jul. 2026 [11:30]</p>
            </div>
            <div class="dl-link">
              <a href="/scripts/mgrqispi.dll?PRGNAME=COURSEDETAILS&ARGUMENTS=-N9999">Kleingruppe anzeigen</a>
            </div>
          </li>
        </ul>
      </div>
    `;

    const course = parseCourseDetail(html, "https://www.tucan.tu-darmstadt.de/scripts/mgrqispi.dll?PRGNAME=COURSEDETAILS&ARGUMENTS=-N123", {
      semesterKey: "Sommersemester 2026",
      path: ["FB20 - Informatik"]
    });

    expect(course.title).toBe("IT Sicherheit");
    expect(course.course_number).toBe("20-00-0219");
    expect(course.abbreviation).toBe("IT Sicherheit");
    expect(course.event_type).toBe("Integrierte Veranstaltung");
    expect(course.language).toBe("Deutsch");
    expect(course.faculty).toBe("FB20 Informatik");
    expect(course.cp).toBe(6);
    expect(course.instructors).toEqual([
      "Dr. Donika Mirdita",
      "Prof. Dr. Haya Schulmann",
      "Prof. Dr. rer. nat. Michael Waidner"
    ]);
    expect(course.appointments).toHaveLength(1);
    expect(course.appointments[0]).toMatchObject({
      date: "2026-04-27",
      time_from: "08:55",
      time_to: "10:35",
      room: "S311/08"
    });

    const detailsJson = course.details_json as Record<string, unknown>;
    expect(detailsJson.description).toBe("Diese Vorlesung bietet einen Einblick in IT-Sicherheit.");
    expect(detailsJson.prerequisites).toBe("Gute Kenntnisse der Kryptographie.");
    expect(detailsJson.online_offerings).toBe("moodle");
    expect(detailsJson.sws).toBe(4);
    expect(detailsJson.org_unit).toBe("FB20 Informatik");

    const smallGroups = detailsJson.small_groups as Array<{ title: string; instructors: string[] }>;
    expect(smallGroups).toHaveLength(1);
    expect(smallGroups[0]?.title).toBe("IT Sicherheit - Ü 01");
    expect(smallGroups[0]?.instructors).toEqual(["Dr. Donika Mirdita", "Prof. Dr. Haya Schulmann"]);

    const appointmentInstructors = detailsJson.appointment_instructors as Array<{ position: number; instructors: string[] }>;
    expect(appointmentInstructors[0]?.instructors).toEqual(["Dr. Donika Mirdita", "Prof. Dr. Haya Schulmann"]);
  });

  it("falls back to key/value table layout when paragraphs are absent", () => {
    const course = parseCourseDetail(
      `
      <div id="pageContent">
        <h1>IT-Sicherheit</h1>
        <table>
          <tr><th>Veranstaltungsnummer</th><td>20-00-1234</td></tr>
          <tr><th>Lehrende</th><td>Ada Lovelace; Grace Hopper</td></tr>
        </table>
        <table>
          <caption>Termine</caption>
          <tr><th>Nr</th><th>Datum</th><th>Von</th><th>Bis</th><th>Raum</th><th>Lehrende</th></tr>
          <tr><td>1</td><td>Mo, 27. Apr. 2026*</td><td>08:55</td><td>10:35</td><td>S311/08</td><td>Ada</td></tr>
        </table>
      </div>
      `,
      "https://www.tucan.tu-darmstadt.de/scripts/mgrqispi.dll?PRGNAME=COURSEDETAILS&ARGUMENTS=-N123",
      { semesterKey: "Sommersemester 2026", path: ["FB20 - Informatik"] }
    );

    expect(course.course_number).toBe("20-00-1234");
    expect(course.cp).toBe(0);
    expect(course.instructors).toEqual(["Ada Lovelace", "Grace Hopper"]);
    expect(course.appointments[0]).toMatchObject({
      date: "2026-04-27",
      time_from: "08:55",
      type: "Vorlesung"
    });
  });

  it("keeps small-group appointments as selectable tutorial metadata", () => {
    const parent = parseCourseDetail(
      `
      <div id="pageContent">
        <h1>20-00-0219-iv
        IT Sicherheit</h1>
        <table>
          <tr><th>Lehrende</th><td>Ada Lovelace</td></tr>
        </table>
        <table>
          <caption>Termine</caption>
          <tr><th>Nr</th><th>Datum</th><th>Von</th><th>Bis</th><th>Raum</th><th>Lehrende</th></tr>
          <tr><td>1</td><td>Mo, 27. Apr. 2026*</td><td>08:55</td><td>10:35</td><td>S311/08</td><td>Ada</td></tr>
        </table>
        <ul class="dl-ul-listview">
          <li class="listelement">
            <div class="dl-inner">
              <p class="dl-ul-li-headline"><strong>IT Sicherheit - Ü 01</strong></p>
              <p>Ada Lovelace</p>
              <p>Mi, 29. Apr. 2026 [09:50]-Mi, 8. Jul. 2026 [11:30]</p>
            </div>
            <div class="dl-link">
              <a href="/scripts/mgrqispi.dll?PRGNAME=COURSEDETAILS&ARGUMENTS=-N9999">Kleingruppe anzeigen</a>
            </div>
          </li>
        </ul>
      </div>
      `,
      "https://www.tucan.tu-darmstadt.de/scripts/mgrqispi.dll?PRGNAME=COURSEDETAILS&ARGUMENTS=-N123",
      { semesterKey: "Sommersemester 2026", path: ["FB20 - Informatik"] }
    );
    const groupHtml = `
      <div id="pageContent">
        <h1>IT Sicherheit - Ü 01</h1>
        <table>
          <caption>Termine</caption>
          <tr><th>Nr</th><th>Datum</th><th>Von</th><th>Bis</th><th>Raum</th><th>Lehrende</th></tr>
          <tr><td>1</td><td>Mo, 27. Apr. 2026</td><td>08:55</td><td>10:35</td><td>S311/08</td><td>Ada</td></tr>
          <tr><td>2</td><td>Mi, 29. Apr. 2026</td><td>09:50</td><td>11:30</td><td>S202/C205</td><td>Ada</td></tr>
          <tr><td>3</td><td>Mi, 29. Apr. 2026</td><td>09:50</td><td>11:30</td><td>S202/C205</td><td>Ada</td></tr>
        </table>
      </div>
    `;

    const groups = smallGroupsFromCourse(parent);
    expect(groups).toHaveLength(1);
    const withGroupDetail = attachSmallGroupDetail(parent, groups[0]!.key, parseSmallGroupDetail(groupHtml));
    const updatedGroup = smallGroupsFromCourse(withGroupDetail)[0]!;

    expect(withGroupDetail.appointments).toHaveLength(1);
    expect(updatedGroup.appointments).toHaveLength(1);
    expect(updatedGroup.appointments?.[0]).toMatchObject({
      date: "2026-04-29",
      time_from: "09:50",
      type: "Uebung"
    });
    expect(updatedGroup.appointment_instructors?.[0]?.instructors).toEqual(["Ada"]);
  });
});
