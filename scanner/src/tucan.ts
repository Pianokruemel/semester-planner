import { parseAppointments } from "@semester-planner/shared/appointmentParser";
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import type { Element } from "domhandler";

export type TucanLinkKind = "navigation" | "course" | "module" | "other";

export type TucanLink = {
  href: string;
  text: string;
  prgName: string | null;
  kind: TucanLinkKind;
};

export type ScrapedSmallGroup = {
  key: string;
  title: string;
  instructors: string[];
  schedule: string;
  url: string | null;
  appointments?: ScrapedCatalogAppointment[];
  appointment_instructors?: Array<{ position: number; instructors: string[] }>;
};

export type ScrapedCatalogAppointment = {
  date: string;
  time_from: string;
  time_to: string;
  room: string;
  type: string;
  position: number;
};

export type ScrapedCatalogCourse = {
  semester_key: string;
  source: "tucan";
  source_key: string;
  source_url: string;
  title: string;
  course_number: string | null;
  abbreviation: string | null;
  cp: number;
  event_type: string | null;
  language: string | null;
  faculty: string | null;
  path: string[];
  instructors: string[];
  details_json: Record<string, unknown>;
  raw_appointment_text: string;
  appointments: ScrapedCatalogAppointment[];
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function multilineText($: cheerio.CheerioAPI, element: Element | cheerio.Cheerio<Element>): string {
  const $el = "cheerio" in (element as object) ? (element as cheerio.Cheerio<Element>) : $(element as Element);
  const $clone = $el.clone();
  $clone.find("br").replaceWith("\n");
  $clone.find("input,script,style").remove();
  return $clone
    .text()
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function absoluteUrl(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function getPrgName(url: string): string | null {
  try {
    return new URL(url).searchParams.get("PRGNAME");
  } catch {
    return null;
  }
}

function classifyPrgName(prgName: string | null): TucanLinkKind {
  if (prgName === "COURSEDETAILS") {
    return "course";
  }

  if (prgName === "MODULEDETAILS") {
    return "module";
  }

  if (prgName === "ACTION" || prgName === "REGISTRATION") {
    return "navigation";
  }

  return "other";
}

export function extractLinks(html: string, pageUrl: string): TucanLink[] {
  const $ = cheerio.load(html);
  const links: TucanLink[] = [];

  $("#pageContent a").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    const url = absoluteUrl(pageUrl, href);
    if (!url) {
      return;
    }

    const prgName = getPrgName(url);
    links.push({
      href: url,
      text: normalizeWhitespace($(element).text()),
      prgName,
      kind: classifyPrgName(prgName)
    });
  });

  return links;
}

function linkFromElement($: cheerio.CheerioAPI, element: Element, pageUrl: string): TucanLink | null {
  const href = $(element).attr("href");
  if (!href) {
    return null;
  }

  const url = absoluteUrl(pageUrl, href);
  if (!url) {
    return null;
  }

  const prgName = getPrgName(url);
  return {
    href: url,
    text: normalizeWhitespace($(element).text()),
    prgName,
    kind: classifyPrgName(prgName)
  };
}

export function findCurrentSemesterLink(html: string, pageUrl: string): TucanLink | null {
  const $ = cheerio.load(html);

  for (const element of $("a").toArray()) {
    const text = normalizeWhitespace($(element).text());
    if (!/^Aktuell\s*-\s*(Sommersemester|Wintersemester)\s+\d{4}/i.test(text)) {
      continue;
    }

    const link = linkFromElement($, element, pageUrl);
    if (link?.kind === "navigation") {
      return link;
    }
  }

  return null;
}

export function findFacultyLink(html: string, pageUrl: string, facultyPrefix: string): TucanLink | null {
  const $ = cheerio.load(html);

  for (const element of $("#pageContent a").toArray()) {
    const text = normalizeWhitespace($(element).text());
    if (!text.startsWith(facultyPrefix)) {
      continue;
    }

    const link = linkFromElement($, element, pageUrl);
    if (link?.kind === "navigation") {
      return link;
    }
  }

  return null;
}

export function extractBreadcrumb(html: string): string[] {
  const $ = cheerio.load(html);
  const heading = normalizeWhitespace($("#pageContent h2").first().text());
  return heading
    .replace(/^Übersicht\s*>?\s*/i, "")
    .split(">")
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

export function discoverSemesterKey(html: string): string {
  const $ = cheerio.load(html);
  const text = normalizeWhitespace($("body").text());
  const match = text.match(/(?:Sommersemester|Wintersemester)\s+\d{4}(?:\/\d{2,4})?/i);
  return match?.[0] ?? new Date().getFullYear().toString();
}

function extractParagraphProperties($: cheerio.CheerioAPI): Record<string, string> {
  const details: Record<string, string> = {};
  $("#pageContent p").each((_index, p) => {
    const $p = $(p);
    const $b = $p.children("b").first();
    if (!$b.length) {
      return;
    }

    const label = normalizeWhitespace($b.text()).replace(/[:.\s]+$/, "");
    if (!label) {
      return;
    }

    const $clone = $p.clone();
    $clone.children("b").first().remove();
    const value = multilineText($, $clone as unknown as cheerio.Cheerio<Element>).replace(/^[:\s]+/, "").trim();
    if (value || !(label in details)) {
      details[label] = value;
    }
  });
  return details;
}

function extractTableKeyValues($: cheerio.CheerioAPI): Record<string, string> {
  const details: Record<string, string> = {};
  $("#pageContent table").first().find("tr").each((_index, row) => {
    const cells = $(row)
      .find("th,td")
      .toArray()
      .map((cell) => normalizeWhitespace($(cell).text()));

    if (cells.length >= 2 && cells[0]) {
      details[cells[0].replace(/:$/, "") as string] = cells.slice(1).join(" ");
    }
  });
  return details;
}

function extractDetails($: cheerio.CheerioAPI): Record<string, string> {
  const paragraphProps = extractParagraphProperties($);
  if (Object.keys(paragraphProps).length > 0) {
    return paragraphProps;
  }
  return extractTableKeyValues($);
}

function findDetail(details: Record<string, string>, labels: string[]): string | null {
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  for (const [key, value] of Object.entries(details)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedLabels.some((label) => normalizedKey.includes(label))) {
      return value || null;
    }
  }

  return null;
}

function splitInstructors(raw: string): string[] {
  return raw
    .split(/;|,\s+(?=Prof\.|Dr\.|Dipl\.|Univ\.|PD\b|M\.Sc\.|B\.Sc\.)/)
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);
}

function extractInstructors($: cheerio.CheerioAPI, details: Record<string, string>): string[] {
  const dozentenText = normalizeWhitespace($("#dozenten").first().text());
  if (dozentenText) {
    return splitInstructors(dozentenText);
  }

  const detailValue = findDetail(details, ["lehrende", "dozent", "instructor"]);
  if (detailValue) {
    return splitInstructors(detailValue);
  }

  return $("td[name='instructorTitle']")
    .toArray()
    .map((td) => normalizeWhitespace($(td).text()))
    .filter(Boolean);
}

function extractTitleAndNumber($: cheerio.CheerioAPI, details: Record<string, string>): { title: string; courseNumber: string | null } {
  const heading = $("#pageContent h1").first();
  const headingLines = heading.length ? multilineText($, heading as unknown as cheerio.Cheerio<Element>).split("\n").filter(Boolean) : [];

  const courseNumberLinePattern = /^[A-Za-z0-9]+-\d{2}-\d{4}(?:-[A-Za-z0-9]+)?$|^\d{2}-\d{2}-\d{4}(?:-[A-Za-z0-9]+)?$/;
  const inlineCourseNumberPattern = /^(\d{2}-\d{2}-\d{4}(?:-[A-Za-z0-9]+)?)\s+(.+)$/;
  let courseNumber: string | null = null;
  let title = "";

  if (headingLines.length >= 2 && courseNumberLinePattern.test(headingLines[0]!)) {
    courseNumber = headingLines[0]!;
    title = headingLines.slice(1).join(" ");
  } else if (headingLines.length === 1) {
    const line = headingLines[0]!;
    const inlineMatch = line.match(inlineCourseNumberPattern);
    if (inlineMatch) {
      courseNumber = inlineMatch[1] as string;
      title = inlineMatch[2] as string;
    } else {
      title = line;
    }
  }

  if (!title) {
    title =
      findDetail(details, ["titel", "veranstaltung"]) ??
      normalizeWhitespace($("#pageContent h2, #pageContent h3").first().text()) ??
      "Unbenannte Veranstaltung";
  }

  if (!courseNumber) {
    const fromDetails = findDetail(details, ["veranstaltungsnummer", "course number", "nummer"]);
    courseNumber = fromDetails?.match(/\b\d{2}-\d{2}-\d{4}(?:-[A-Za-z0-9]+)?\b/)?.[0] ?? null;
  }

  const titlePrefixMatch = title.match(inlineCourseNumberPattern);
  if (titlePrefixMatch) {
    if (!courseNumber) {
      courseNumber = titlePrefixMatch[1] as string;
    }
    title = titlePrefixMatch[2] as string;
  }

  return { title: title || "Unbenannte Veranstaltung", courseNumber };
}

function baseCourseNumber(courseNumber: string | null): string | null {
  return courseNumber?.match(/\b\d{2}-\d{2}-\d{4}\b/)?.[0] ?? null;
}

function extractCp($: cheerio.CheerioAPI, details: Record<string, string>): number {
  const visibleRaw = findDetail(details, ["credit", "leistungspunkte", "cp"]);
  const visibleMatch = visibleRaw?.match(/(\d+(?:[,.]\d+)?)/);
  if (visibleMatch) {
    return Math.round(Number(visibleMatch[1]?.replace(",", ".")) || 0);
  }

  const hiddenRaw = $("input[name='credits']").first().attr("value") ?? "";
  const hiddenMatch = hiddenRaw.trim().match(/(\d+(?:[,.]\d+)?)/);
  if (hiddenMatch) {
    return Math.round(Number(hiddenMatch[1]?.replace(",", ".")) || 0);
  }

  return 0;
}

function extractLanguage($: cheerio.CheerioAPI, details: Record<string, string>): string | null {
  const detailValue = findDetail(details, ["sprache", "language"]);
  if (detailValue) {
    return detailValue;
  }
  const spanValue = normalizeWhitespace($("span[name='courseLanguageOfInstruction']").first().text());
  return spanValue || null;
}

function extractFaculty($: cheerio.CheerioAPI, details: Record<string, string>, path: string[]): string | null {
  const orgUnit = normalizeWhitespace($("span[name='courseOrgUnit']").first().text());
  if (orgUnit) {
    return orgUnit;
  }
  const detailValue = findDetail(details, ["orga-einheit", "fachbereich", "faculty"]);
  if (detailValue) {
    return detailValue;
  }
  return path.find((entry) => /^FB\d+/.test(entry)) ?? null;
}

function extractAbbreviation($: cheerio.CheerioAPI, details: Record<string, string>, courseNumber: string | null): string | null {
  const fromDetails = findDetail(details, ["anzeige im stundenplan", "kürzel", "kuerzel", "abbreviation"]);
  if (fromDetails) {
    return fromDetails;
  }
  const hidden = $("input[name='shortdescription']").first().attr("value");
  if (hidden && hidden.trim().length > 0) {
    return hidden.trim();
  }
  return baseCourseNumber(courseNumber);
}

function parseInteger(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function extractRichTextSections(details: Record<string, string>): Record<string, string> {
  const richLabels: Record<string, string[]> = {
    description: ["lehrinhalte", "inhalt"],
    literature: ["literatur"],
    prerequisites: ["voraussetzungen"],
    additional_information: ["zusätzliche informationen", "zusatzliche informationen"],
    online_offerings: ["online-angebote", "online angebote"],
    expected_participants: ["erwartete teilnehmerzahl"],
    learning_outcomes: ["lernziele", "qualifikationsziele"]
  };

  const result: Record<string, string> = {};
  for (const [outKey, labels] of Object.entries(richLabels)) {
    const value = findDetail(details, labels);
    if (value) {
      result[outKey] = value;
    }
  }
  return result;
}

function stableSmallGroupKey(url: string | null, title: string): string {
  if (url) {
    try {
      const parsed = new URL(url);
      const prgName = parsed.searchParams.get("PRGNAME");
      const args = parsed.searchParams.get("ARGUMENTS");
      if (prgName === "COURSEDETAILS" && args) {
        return `COURSEDETAILS:${args}`;
      }

      parsed.searchParams.delete("SESSIONID");
      parsed.searchParams.delete("TOKEN");
      return createHash("sha256").update(parsed.toString()).digest("hex");
    } catch {
      // Fall back to the title below.
    }
  }

  return createHash("sha256").update(title).digest("hex");
}

function extractSmallGroups($: cheerio.CheerioAPI, pageUrl: string): ScrapedSmallGroup[] {
  const groups: ScrapedSmallGroup[] = [];
  $("ul.dl-ul-listview > li.listelement").each((_index, li) => {
    const $li = $(li);
    const title = normalizeWhitespace($li.find(".dl-ul-li-headline").first().text());
    const paragraphs = $li
      .find(".dl-inner > p")
      .toArray()
      .map((p) => normalizeWhitespace($(p).text()))
      .filter(Boolean);
    const instructors = paragraphs[1] ? splitInstructors(paragraphs[1]) : [];
    const schedule = paragraphs[2] ?? "";
    const href = $li.find(".dl-link a").first().attr("href");
    const url = href ? absoluteUrl(pageUrl, href) : null;

    if (title) {
      groups.push({ key: stableSmallGroupKey(url, title), title, instructors, schedule, url });
    }
  });
  return groups;
}

function extractRegistrationPeriods($: cheerio.CheerioAPI): Array<Record<string, string>> {
  const table = $("#pageContent table")
    .toArray()
    .find((t) => normalizeWhitespace($(t).find("caption").text()).includes("Anmeldefristen"));
  if (!table) return [];

  const $table = $(table);
  const headers = $table
    .find("tr")
    .first()
    .find("td.tbsubhead, th")
    .toArray()
    .map((cell) => normalizeWhitespace($(cell).text()));

  const periods: Array<Record<string, string>> = [];
  $table.find("tr").slice(1).each((_index, row) => {
    const cells = $(row)
      .find("td.tbdata, td")
      .toArray()
      .map((cell) => normalizeWhitespace($(cell).text()));
    if (cells.every((cell) => !cell)) return;
    const entry: Record<string, string> = {};
    cells.forEach((cell, idx) => {
      const key = headers[idx] || `field_${idx + 1}`;
      entry[key] = cell;
    });
    periods.push(entry);
  });
  return periods;
}

function extractAppointmentRowsAndDetails($: cheerio.CheerioAPI): {
  text: string;
  rich: Array<{ date: string; time_from: string; time_to: string; room: string; instructors: string[] }>;
} {
  const targetTable = $("#pageContent table")
    .toArray()
    .find((table) => {
      const caption = normalizeWhitespace($(table).find("caption").text());
      const tableText = normalizeWhitespace($(table).text());
      return caption.includes("Termine") || tableText.includes("Termine");
    });

  if (!targetTable) {
    return { text: "", rich: [] };
  }

  const lines: string[] = ["Nr\tDatum\tVon\tBis\tRaum\tLehrende"];
  const rich: Array<{ date: string; time_from: string; time_to: string; room: string; instructors: string[] }> = [];

  $(targetTable).find("tr").each((_index, row) => {
    const $row = $(row);
    const dateCell = $row.find("[name='appointmentDate']").first();
    const fromCell = $row.find("[name='appointmentTimeFrom']").first();
    const toCell = $row.find("[name='appointmentDateTo']").first();
    const roomCell = $row.find("[name='appointmentRooms']").first();
    const instructorsCell = $row.find("[name='appointmentInstructors']").first();

    if (!dateCell.length || !fromCell.length || !toCell.length) {
      return;
    }

    const number = normalizeWhitespace($row.find("td").first().text()) || String(rich.length + 1);
    const date = normalizeWhitespace(dateCell.text());
    const from = normalizeWhitespace(fromCell.text());
    const to = normalizeWhitespace(toCell.text());
    const room = normalizeWhitespace(roomCell.text());
    const instructorRaw = normalizeWhitespace(instructorsCell.text());

    lines.push([number, date, from, to, room, instructorRaw].join("\t"));
    rich.push({ date, time_from: from, time_to: to, room, instructors: splitInstructors(instructorRaw) });
  });

  if (rich.length === 0) {
    $(targetTable)
      .find("tr")
      .each((_index, row) => {
        const cells = $(row)
          .find("td,th")
          .toArray()
          .map((cell) => normalizeWhitespace($(cell).text()))
          .filter(Boolean);

        const timeIndexes = cells
          .map((cell, index) => (/^\d{2}:\d{2}$/.test(cell) ? index : -1))
          .filter((index) => index >= 0);
        if (timeIndexes.length < 2) {
          return;
        }

        const fromIndex = timeIndexes[0] as number;
        const toIndex = timeIndexes[1] as number;
        const number = /^\d+$/.test(cells[0] ?? "") ? cells[0] : String(rich.length + 1);
        const date = cells.slice(number === cells[0] ? 1 : 0, fromIndex).join(" ");
        const room = cells[toIndex + 1] ?? "";
        const instructorRaw = cells.slice(toIndex + 2).join(", ");

        lines.push([number, date, cells[fromIndex], cells[toIndex], room, instructorRaw].join("\t"));
        rich.push({
          date,
          time_from: cells[fromIndex] ?? "",
          time_to: cells[toIndex] ?? "",
          room,
          instructors: splitInstructors(instructorRaw)
        });
      });
  }

  return { text: rich.length > 1 || rich.length === 1 ? lines.join("\n") : "", rich };
}

export function parseSmallGroupAppointments(html: string): ScrapedCatalogAppointment[] {
  return parseSmallGroupDetail(html).appointments ?? [];
}

export function parseSmallGroupDetail(html: string): Pick<ScrapedSmallGroup, "appointments" | "appointment_instructors"> {
  const $ = cheerio.load(html);
  const { text: rawAppointmentText, rich: appointmentRows } = extractAppointmentRowsAndDetails($);
  const seen = new Set<string>();
  const appointments: ScrapedCatalogAppointment[] = [];

  for (const appointment of parseAppointments(rawAppointmentText)) {
    const parsed = {
      date: appointment.date,
      time_from: appointment.time_from,
      time_to: appointment.time_to,
      room: appointment.room,
      type: "Uebung",
      position: appointments.length
    };
    const key = appointmentKey(parsed);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    appointments.push(parsed);
  }

  return {
    appointments,
    appointment_instructors: appointmentRows.map((row, index) => ({ position: index, instructors: row.instructors }))
  };
}

function appointmentKey(appointment: Omit<ScrapedCatalogAppointment, "position">): string {
  return [
    appointment.date,
    appointment.time_from,
    appointment.time_to,
    appointment.room,
    appointment.type
  ].join("|");
}

function appointmentTimePlaceKey(appointment: Pick<ScrapedCatalogAppointment, "date" | "time_from" | "time_to" | "room">): string {
  return [
    appointment.date,
    appointment.time_from,
    appointment.time_to,
    appointment.room
  ].join("|");
}

export function mergeSmallGroupAppointments(
  course: ScrapedCatalogCourse,
  appointments: ScrapedCatalogAppointment[]
): ScrapedCatalogCourse {
  if (appointments.length === 0) {
    return course;
  }

  const seen = new Set(course.appointments.map(appointmentTimePlaceKey));
  const merged = [...course.appointments];
  for (const appointment of appointments) {
    const key = appointmentTimePlaceKey(appointment);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push({ ...appointment, position: merged.length });
  }

  return {
    ...course,
    appointments: merged.map((appointment, index) => ({ ...appointment, position: index })),
    details_json: {
      ...course.details_json,
      merged_small_group_appointments: merged.length - course.appointments.length
    }
  };
}

export function attachSmallGroupDetail(
  course: ScrapedCatalogCourse,
  groupKey: string,
  detail: Pick<ScrapedSmallGroup, "appointments" | "appointment_instructors">
): ScrapedCatalogCourse {
  const baseAppointmentKeys = new Set(course.appointments.map(appointmentTimePlaceKey));
  const positionMap = new Map<number, number>();
  const filteredAppointments = (detail.appointments ?? []).flatMap((appointment) => {
    if (baseAppointmentKeys.has(appointmentTimePlaceKey(appointment))) {
      return [];
    }

    const position = positionMap.size;
    positionMap.set(appointment.position, position);
    return [{ ...appointment, position }];
  });
  const appointmentInstructors = (detail.appointment_instructors ?? []).flatMap((entry) => {
    const position = positionMap.get(entry.position);
    return position === undefined ? [] : [{ ...entry, position }];
  });
  const rawGroups = smallGroupsFromCourse(course);
  const groups = rawGroups.map((group) =>
    group.key === groupKey
      ? {
          ...group,
          appointments: filteredAppointments,
          appointment_instructors: appointmentInstructors
        }
      : group
  );

  return {
    ...course,
    details_json: {
      ...course.details_json,
      small_groups: groups
    }
  };
}

export function smallGroupsFromCourse(course: ScrapedCatalogCourse): ScrapedSmallGroup[] {
  const rawGroups = course.details_json.small_groups;
  if (!Array.isArray(rawGroups)) {
    return [];
  }

  return rawGroups.filter((group): group is ScrapedSmallGroup => {
    if (typeof group !== "object" || group === null) {
      return false;
    }

    const candidate = group as Partial<ScrapedSmallGroup>;
    return (
      typeof candidate.title === "string" &&
      typeof candidate.key === "string" &&
      Array.isArray(candidate.instructors) &&
      candidate.instructors.every((instructor) => typeof instructor === "string") &&
      typeof candidate.schedule === "string" &&
      (typeof candidate.url === "string" || candidate.url === null)
    );
  });
}

function stableSourceKey(url: string, semesterKey: string, title: string, courseNumber: string | null): string {
  const parsed = new URL(url);
  const prgName = parsed.searchParams.get("PRGNAME");
  const args = parsed.searchParams.get("ARGUMENTS");
  if (prgName === "COURSEDETAILS" && args) {
    return `COURSEDETAILS:${args}`;
  }

  parsed.searchParams.delete("SESSIONID");
  parsed.searchParams.delete("TOKEN");
  return createHash("sha256")
    .update([semesterKey, title, courseNumber ?? "", parsed.toString()].join("|"))
    .digest("hex");
}

export function parseCourseDetail(html: string, pageUrl: string, context: { semesterKey: string; path: string[] }): ScrapedCatalogCourse {
  const $ = cheerio.load(html);
  const details = extractDetails($);
  const { title, courseNumber } = extractTitleAndNumber($, details);
  const { text: rawAppointmentText, rich: appointmentRows } = extractAppointmentRowsAndDetails($);
  const appointments = parseAppointments(rawAppointmentText).map((appointment, index) => ({
    date: appointment.date,
    time_from: appointment.time_from,
    time_to: appointment.time_to,
    room: appointment.room,
    type: appointment.type,
    position: index
  }));

  const sws = parseInteger(findDetail(details, ["semesterwochenstunden", "sws"])) ??
    parseInteger($("input[name='sws']").first().attr("value") ?? "");
  const minParticipants = parseInteger(findDetail(details, ["min."])) ?? null;
  const maxParticipants = parseInteger(findDetail(details, ["max."])) ?? null;

  const detailsJson: Record<string, unknown> = {
    properties: details,
    ...extractRichTextSections(details),
    appointment_instructors: appointmentRows.map((row, index) => ({ position: index, instructors: row.instructors })),
    small_groups: extractSmallGroups($, pageUrl),
    registration_periods: extractRegistrationPeriods($),
    sws: sws ?? null,
    min_participants: minParticipants,
    max_participants: maxParticipants,
    short_description: $("input[name='shortdescription']").first().attr("value") ?? null,
    org_unit: normalizeWhitespace($("span[name='courseOrgUnit']").first().text()) || null
  };

  return {
    semester_key: context.semesterKey,
    source: "tucan",
    source_key: stableSourceKey(pageUrl, context.semesterKey, title, courseNumber),
    source_url: pageUrl,
    title,
    course_number: baseCourseNumber(courseNumber) ?? courseNumber,
    abbreviation: extractAbbreviation($, details, courseNumber),
    cp: extractCp($, details),
    event_type: findDetail(details, ["veranstaltungsart", "event type"]),
    language: extractLanguage($, details),
    faculty: extractFaculty($, details, context.path),
    path: context.path,
    instructors: extractInstructors($, details),
    details_json: detailsJson,
    raw_appointment_text: rawAppointmentText,
    appointments
  };
}
