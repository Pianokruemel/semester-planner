import * as cheerio from "cheerio";
import { createHash } from "node:crypto";

export type StudyProgramTarget = {
  key: string;
  label: string;
  matchers: string[];
};

export type StudyProgramPage = {
  program_key: string;
  program_label: string;
  page_url: string;
};

export type ModuleHandbookLink = StudyProgramPage & {
  po_label: string;
  pdf_url: string;
  pdf_label: string;
};

export type ParsedModuleHandbookCourse = {
  module_number: string;
  course_number: string | null;
  module_title: string;
  cp: number | null;
  class_path: string[];
  page_number: number | null;
};

export type ParsedPdfPage = {
  pageNumber: number;
  text: string;
};

export const ORDNUNGEN_OVERVIEW_URL =
  "https://www.informatik.tu-darmstadt.de/studium_fb20/im_studium/formulare_und_dokumente/ordnungen/index.de.jsp";

const COURSE_NUMBER_PATTERN = /\b\d{2}-[A-Za-z0-9]{2}-\d{4}(?:-[A-Za-z0-9]{1,8})?\b/;
const COURSE_NUMBER_GLOBAL_PATTERN = /\b\d{2}-[A-Za-z0-9]{2}-\d{4}(?:-[A-Za-z0-9]{1,8})?\b/g;
const BASE_COURSE_NUMBER_PATTERN = /\b\d{2}-[A-Za-z0-9]{2}-\d{4}\b/;

export const STUDY_PROGRAM_TARGETS: StudyProgramTarget[] = [
  { key: "bsc-informatik", label: "B. Sc. Informatik", matchers: ["b. sc. informatik", "b.sc. informatik", "bachelor informatik"] },
  { key: "msc-informatik", label: "M. Sc. Informatik", matchers: ["m. sc. informatik", "m.sc. informatik", "master informatik"] },
  { key: "msc-computer-science", label: "M.Sc. Computer Science", matchers: ["m.sc. computer science", "computer science"] },
  {
    key: "msc-autonome-systeme-robotik",
    label: "M.Sc. Autonome Systeme und Robotik",
    matchers: ["autonome systeme und robotik", "autonomous systems and robotics"]
  },
  {
    key: "msc-artificial-intelligence-machine-learning",
    label: "M.Sc. Artificial Intelligence and Machine Learning",
    matchers: ["artificial intelligence and machine learning", "aiml"]
  },
  { key: "msc-it-security", label: "M.Sc. IT Security", matchers: ["m.sc. it security", "it security"] }
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function absoluteUrl(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizedLabel(value: string): string {
  return normalizeWhitespace(value).toLowerCase().replace(/\s+/g, " ");
}

export function discoverStudyProgramPages(html: string, overviewUrl: string, targets = STUDY_PROGRAM_TARGETS): StudyProgramPage[] {
  const $ = cheerio.load(html);
  const pages = new Map<string, StudyProgramPage>();

  $("a").each((_index, element) => {
    const text = normalizedLabel($(element).text());
    const href = $(element).attr("href");
    if (!text || !href) {
      return;
    }

    const target = targets.find((entry) => entry.matchers.some((matcher) => text.includes(matcher)));
    const url = target ? absoluteUrl(overviewUrl, href) : null;
    if (!target || !url || pages.has(target.key)) {
      return;
    }

    pages.set(target.key, {
      program_key: target.key,
      program_label: target.label,
      page_url: url
    });
  });

  return targets.flatMap((target) => {
    const page = pages.get(target.key);
    return page ? [page] : [];
  });
}

function headingLevel(tagName: string): number {
  const match = tagName.match(/^h([1-6])$/i);
  return match ? Number(match[1]) : 6;
}

function isArchiveText(text: string): boolean {
  return /\b(archiv|archive|ältere|aeltere|ausgelaufen|geschlossen|closed)\b/i.test(text);
}

function isModuleHandbookText(text: string): boolean {
  return /\b(Modulhandbuch|Module Handbook)\b/i.test(text);
}

export function findCurrentModuleHandbookLink(programHtml: string, page: StudyProgramPage): ModuleHandbookLink | null {
  const $ = cheerio.load(programHtml);
  const content = $("#content, #pageContent, main, body").first();
  const sectionStack: Array<{ level: number; text: string; archived: boolean }> = [];

  for (const element of content.find("h1,h2,h3,h4,h5,h6,a").toArray()) {
    const tagName = element.tagName.toLowerCase();
    const text = normalizeWhitespace($(element).text());
    if (!text) {
      continue;
    }

    if (/^h[1-6]$/.test(tagName)) {
      const level = headingLevel(tagName);
      while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1]!.level >= level) {
        sectionStack.pop();
      }
      sectionStack.push({ level, text, archived: isArchiveText(text) });
      continue;
    }

    if (!isModuleHandbookText(text) || isArchiveText(text)) {
      continue;
    }

    const href = $(element).attr("href");
    const pdfUrl = href ? absoluteUrl(page.page_url, href) : null;
    if (!pdfUrl || !/\.pdf(?:[?#].*)?$/i.test(pdfUrl)) {
      continue;
    }

    if (sectionStack.some((section) => section.archived)) {
      continue;
    }

    const poSection = sectionStack
      .slice()
      .reverse()
      .find((section) => /\b(PO|Prüfungsordnung|Pruefungsordnung|examination regulations|202\d)\b/i.test(section.text));

    return {
      ...page,
      po_label: poSection?.text ?? "current",
      pdf_url: pdfUrl,
      pdf_label: text
    };
  }

  return null;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function parsePdfPages(bytes: Uint8Array): Promise<ParsedPdfPage[]> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as {
    getDocument: (input: { data: Uint8Array; useWorkerFetch?: boolean; isEvalSupported?: boolean }) => {
      promise: Promise<{ numPages: number; getPage: (pageNumber: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }> }>;
    };
  };
  const pdf = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false }).promise;
  const pages: ParsedPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => {
        if (typeof item === "object" && item !== null && "str" in item && typeof item.str === "string") {
          return item.str;
        }
        return "";
      })
      .join("\n");
    pages.push({ pageNumber, text });
  }

  return pages;
}

function normalizePdfText(text: string): string {
  return text
    .replace(/([A-Za-zÄÖÜäöüß])-\s*\n\s*([A-Za-zÄÖÜäöüß])/g, "$1$2")
    .replace(/\bLeistungspun\s*\n\s*kte\b/gi, "Leistungspunkte")
    .replace(/(\d{2})\s*-\s*([A-Za-z0-9]{2})\s*-\s*(\d{4})\s*-\s*([A-Za-z0-9]{1,8})/g, "$1-$2-$3-$4")
    .replace(/(\d{2})\s*-\s*([A-Za-z0-9]{2})\s*-\s*(\d{4})/g, "$1-$2-$3");
}

function normalizeCourseNumber(value: string): string | null {
  const compact = value.replace(/\s+/g, "");
  return compact.match(COURSE_NUMBER_PATTERN)?.[0]?.toLowerCase() ?? null;
}

function baseCourseNumber(value: string | null): string | null {
  return value?.match(BASE_COURSE_NUMBER_PATTERN)?.[0]?.toLowerCase() ?? null;
}

function isCourseSectionStart(line: string): boolean {
  return /^(?:\d+(?:\.\d+)*\.?\s+)?(?:Kurse des Moduls|Courses?(?: of the)? Module|Veranstaltungen)$/i.test(
    normalizeWhitespace(line)
  );
}

function isCourseSectionEnd(line: string): boolean {
  return /^(?:\d+(?:\.\d+)*\.?\s+)?(?:Lerninhalt|Lehrinhalt|Course Contents?|Contents?)\b/i.test(
    normalizeWhitespace(line)
  );
}

function courseNumberLines(block: string[]): string[] {
  const startIndex = block.findIndex(isCourseSectionStart);
  if (startIndex < 0) {
    return block;
  }

  const relativeEndIndex = block.slice(startIndex + 1).findIndex(isCourseSectionEnd);
  const endIndex = relativeEndIndex < 0 ? block.length : startIndex + relativeEndIndex + 1;
  return block.slice(startIndex, endIndex);
}

function extractCp(lines: string[], startIndex: number, endIndex: number): number | null {
  const windowText = lines.slice(startIndex, Math.min(endIndex, startIndex + 24)).join(" ");
  const labelMatch = windowText.match(/(?:Leistungspunkte|Credit Points?|Credits?)\D{0,40}(\d+(?:[,.]\d+)?)/i);
  if (labelMatch) {
    return Math.round(Number(labelMatch[1]!.replace(",", ".")));
  }

  const cpPrefixMatch = windowText.match(/\bCP\s*[:=]?\s*(\d+(?:[,.]\d+)?)\b/i);
  if (cpPrefixMatch) {
    return Math.round(Number(cpPrefixMatch[1]!.replace(",", ".")));
  }

  const shortMatch = windowText.match(/\b(\d+(?:[,.]\d+)?)\s*(?:CP|Credit Points?|Leistungspunkte)\b/i);
  return shortMatch ? Math.round(Number(shortMatch[1]!.replace(",", "."))) : null;
}

function isModuleFieldLine(line: string): boolean {
  const normalized = normalizeWhitespace(line);
  return /^(Modulbeschreibung|Modul|Module|Veranstaltung|Course|Leistungspunkte|Credit|Arbeitsaufwand|Selbststudium|Moduldauer|Angebotsturnus|Sprache|SWS|Kurs|Kursname|Nr\.?)\b/i.test(
    normalized
  );
}

function isHandbookChromeLine(line: string): boolean {
  return /^Modulhandbuch\b|^M\.\s*Sc\.|^B\.\s*Sc\.|^Technische Universität|^Fachbereich Informatik$/i.test(line);
}

function isSectionCoverPage(lines: string[]): boolean {
  return lines.some((line) => /^Modulhandbuch$/i.test(line)) && !lines.some((line) => /^Modulbeschreibung$/i.test(line));
}

function isStudyRelatedSubheading(line: string): boolean {
  return /^(Praktika(?:,?\s*Projektpraktika)?|Seminare|Praktikum in der Lehre)\b/i.test(line);
}

function isStandaloneSectionHeading(line: string): boolean {
  return /^(Pflichtbereich|Wahlpflichtbereich(?:\s+.+)?|Vertiefung|Anwendungsfach|Mandatory|Elective|Area|Katalog|Catalog|Masterarbeit|Master Thesis|General Education|Studium Generale)$/i.test(
    line
  );
}

function isSpecialisationHeading(line: string): boolean {
  return /^(?:Vertiefung\s+.+|Data Science and Engineering|Distributed Computing|Visual Computing)$/i.test(line);
}

function specialisationPath(currentPath: string[]): string[] {
  return currentPath[0] && isSpecialisationHeading(currentPath[0]) ? [currentPath[0]] : [];
}

function studyRelatedPath(currentPath: string[]): string[] {
  const sectionIndex = currentPath.findIndex((entry) => /^Wahlbereich Studienbegleitende Leistungen$/i.test(entry));
  return sectionIndex >= 0
    ? currentPath.slice(0, sectionIndex + 1)
    : [...specialisationPath(currentPath), "Wahlbereich Studienbegleitende Leistungen"];
}

function cleanHeadingLine(line: string): string {
  const normalized = normalizeWhitespace(line)
    .replace(/,$/, "")
    .replace(/\s+Veranstaltungen$/i, " Veranstaltungen")
    .replace(/^[A-Z]\s+(?=(?:Pflichtbereich|Wahlpflichtbereich|Wahlbereich)\b)/, "");

  if (
    /^(Wahlbereich|Pflichtbereich|Wahlpflichtbereich|Vertiefung|Anwendungsfach|Mandatory|Elective|Area|Katalog|Catalog|Masterarbeit|Master Thesis|General Education|Studium Generale)\b/i.test(
      normalized
    )
  ) {
    return normalized.replace(/\s+\d{1,4}$/, "");
  }

  return normalized;
}

function isHeadingContinuation(line: string): boolean {
  return Boolean(line) &&
    line.length <= 120 &&
    !/^\d+$/.test(line) &&
    !/^\(/.test(line) &&
    !isModuleFieldLine(line) &&
    !isHandbookChromeLine(line) &&
    !isStudyRelatedSubheading(line) &&
    !isStandaloneSectionHeading(line) &&
    !isSpecialisationHeading(line) &&
    !/^Wahl(?:pflicht)?bereiche?\b/i.test(line);
}

function headingPathFromLines(lines: string[], index: number, currentPath: string[]): { path: string[]; index: number } {
  const normalized = cleanHeadingLine(lines[index] ?? "");
  if (!normalized || normalized.length > 120 || isModuleFieldLine(normalized) || isHandbookChromeLine(normalized)) {
    return { path: currentPath, index };
  }

  const next = cleanHeadingLine(lines[index + 1] ?? "");
  const nextAfter = cleanHeadingLine(lines[index + 2] ?? "");

  if (/^Wahlbereiche$/i.test(normalized)) {
    return { path: currentPath, index };
  }

  if (isSpecialisationHeading(normalized)) {
    return { path: [normalized], index };
  }

  if (/^Wahlbereich Studienbegleitende Leistungen$/i.test(normalized)) {
    if (next && isStudyRelatedSubheading(next)) {
      const subheading = /^(Praktika|Praktika,?\s*Projektpraktika)/i.test(next) && nextAfter === "Veranstaltungen"
        ? `${next} Veranstaltungen`
        : next;
      return {
        path: [...specialisationPath(currentPath), normalized, subheading],
        index: subheading === next ? index + 1 : index + 2
      };
    }

    return { path: [...specialisationPath(currentPath), normalized], index };
  }

  if (/^Wahlbereich(?:\s+.+)?$/i.test(normalized)) {
    const continuation = isHeadingContinuation(next) ? ` ${next}` : "";
    return {
      path: [...specialisationPath(currentPath), `${normalized}${continuation}`],
      index: continuation ? index + 1 : index
    };
  }

  if (/^Praktika,?\s*Projektpraktika und ähnliche$/i.test(normalized) && next === "Veranstaltungen") {
    return { path: [...studyRelatedPath(currentPath), `${normalized} Veranstaltungen`], index: index + 1 };
  }

  if (isStudyRelatedSubheading(normalized)) {
    return { path: [...studyRelatedPath(currentPath), normalized], index };
  }

  if (isStandaloneSectionHeading(normalized)) {
    return { path: [normalized], index };
  }

  return { path: currentPath, index };
}

function cleanModuleTitleLine(line: string): string {
  const normalized = normalizeWhitespace(line);
  if (/^\d+(?:\.\d+)*\.?$/.test(normalized)) {
    return "";
  }

  return normalized.replace(/^\d+(?:\.\d+)*\.\s+/, "");
}

function titleFromLines(lines: string[], index: number, moduleNumber: string): string {
  for (let titleIndex = Math.max(0, index - 8); titleIndex < index; titleIndex += 1) {
    if (/^Modulname$/i.test(lines[titleIndex] ?? "")) {
      const titleParts: string[] = [];
      for (let candidateIndex = titleIndex + 1; candidateIndex < index; candidateIndex += 1) {
        const title = cleanModuleTitleLine(lines[candidateIndex] ?? "");
        if (title && !BASE_COURSE_NUMBER_PATTERN.test(title) && !isModuleFieldLine(title)) {
          titleParts.push(title);
        }
      }
      if (titleParts.length > 0) {
        return titleParts.join(" ");
      }
    }
  }

  const sameLine = lines[index]?.replace(moduleNumber, "").replace(/^[-:\s]+/, "").trim();
  if (sameLine && !/^(Modul|Module)?nummer\b/i.test(sameLine)) {
    return sameLine;
  }

  for (const line of lines.slice(index + 1, index + 5)) {
    const normalized = cleanModuleTitleLine(line);
    if (
      normalized &&
      !BASE_COURSE_NUMBER_PATTERN.test(normalized) &&
      !/^(Modul|Module)?nummer|Leistungspunkte|Credit|CP\b/i.test(normalized)
    ) {
      return normalized;
    }
  }

  return moduleNumber;
}

function looksLikeModuleStartAt(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  if (/\b(Modul|Module)?nummer\b/i.test(line) || /\bModul\s+Nr\.?\b/i.test(line)) {
    return true;
  }

  if (!/^\d{2}-[A-Za-z0-9]{2}-\d{4}\b(?!-)/.test(line)) {
    return false;
  }

  const context = lines.slice(Math.max(0, index - 4), index).join(" ");
  return !/\b(Modul\s+Nr\.?|Modulnummer|Kurse des Moduls|Kurs|Course|Veranstaltung|Veranstaltungen)\b/i.test(context);
}

export function parseModuleHandbookPages(pages: ParsedPdfPage[]): ParsedModuleHandbookCourse[] {
  const entries: ParsedModuleHandbookCourse[] = [];
  let classPath: string[] = [];

  for (const page of pages) {
    const lines = normalizePdfText(page.text)
      .split(/\n+/)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean);
    const firstModuleContentIndex = lines.findIndex((line, index) => {
      return /^Modulbeschreibung$/i.test(line) || looksLikeModuleStartAt(lines, index);
    });
    const hasModuleDescription = lines.some((line) => /^Modulbeschreibung$/i.test(line));
    const headingsOnlyPage = firstModuleContentIndex < 0 && isSectionCoverPage(lines);

    for (let index = 0; index < lines.length; index += 1) {
      const moduleStartsNearby = !hasModuleDescription && lines
        .slice(index + 1, index + 4)
        .some((_line, offset) => looksLikeModuleStartAt(lines, index + offset + 1));
      if (headingsOnlyPage || (firstModuleContentIndex >= 0 && index < firstModuleContentIndex) || moduleStartsNearby) {
        const heading = headingPathFromLines(lines, index, classPath);
        classPath = heading.path;
        index = heading.index;
      }

      const candidateBlock = lines.slice(index, index + 3).join(" ");
      if (!looksLikeModuleStartAt(lines, index)) {
        continue;
      }

      const moduleNumber = baseCourseNumber(candidateBlock.match(BASE_COURSE_NUMBER_PATTERN)?.[0] ?? null);
      if (!moduleNumber) {
        continue;
      }

      const previousLine = lines[index - 1] ?? "";
      if (/\b(Veranstaltung|Course)\b/i.test(previousLine) && !/\b(Modul|Module)\b/i.test(previousLine)) {
        continue;
      }

      const nextModuleIndex = lines.findIndex((candidate, candidateIndex) => {
        return candidateIndex > index && looksLikeModuleStartAt(lines, candidateIndex);
      });
      const endIndex = nextModuleIndex > index ? nextModuleIndex : lines.length;
      const block = lines.slice(index, endIndex);
      const blockText = courseNumberLines(block).join(" ");
      const courseNumbers = [
        ...new Set(
          Array.from(blockText.matchAll(COURSE_NUMBER_GLOBAL_PATTERN))
            .map((match) => normalizeCourseNumber(match[0]))
            .filter((entry): entry is string => Boolean(entry))
        )
      ].filter((courseNumber) => courseNumber !== moduleNumber);
      const cp = extractCp(lines, index, endIndex);
      const moduleTitle = titleFromLines(lines, index, moduleNumber);
      const numbers = courseNumbers.length > 0 ? courseNumbers : [null];

      for (const courseNumber of numbers) {
        const duplicate = entries.some((entry) => {
          return (
            entry.module_number === moduleNumber &&
            entry.course_number === courseNumber &&
            entry.class_path.join("|") === classPath.join("|")
          );
        });
        if (duplicate) {
          continue;
        }

        entries.push({
          module_number: moduleNumber,
          course_number: courseNumber,
          module_title: moduleTitle,
          cp,
          class_path: classPath,
          page_number: page.pageNumber
        });
      }
    }
  }

  return entries;
}
