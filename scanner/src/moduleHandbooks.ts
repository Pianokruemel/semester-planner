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
    .replace(/([A-Za-zÄÖÜäöüß])\s*\n\s*([a-zäöüß]{1,8})(?=\b)/g, "$1$2")
    .replace(/(\d{2})\s*-\s*(\d{2})\s*-\s*(\d{4})\s*-\s*([A-Za-z]{1,8})/g, "$1-$2-$3-$4")
    .replace(/(\d{2})\s*-\s*(\d{2})\s*-\s*(\d{4})/g, "$1-$2-$3");
}

function normalizeCourseNumber(value: string): string | null {
  const compact = value.replace(/\s+/g, "");
  return compact.match(/\b\d{2}-\d{2}-\d{4}(?:-[A-Za-z]{1,8})?\b/)?.[0]?.toLowerCase() ?? null;
}

function baseCourseNumber(value: string | null): string | null {
  return value?.match(/\b\d{2}-\d{2}-\d{4}\b/)?.[0] ?? null;
}

function extractCp(lines: string[], startIndex: number, endIndex: number): number | null {
  const windowText = lines.slice(startIndex, Math.min(endIndex, startIndex + 24)).join(" ");
  const labelMatch = windowText.match(/(?:Leistungspunkte|Credit Points?|Credits?|CP)\D{0,40}(\d+(?:[,.]\d+)?)/i);
  if (labelMatch) {
    return Math.round(Number(labelMatch[1]!.replace(",", ".")));
  }

  const shortMatch = windowText.match(/\b(\d+(?:[,.]\d+)?)\s*(?:CP|Credit Points?|Leistungspunkte)\b/i);
  return shortMatch ? Math.round(Number(shortMatch[1]!.replace(",", "."))) : null;
}

function headingPathFromLine(line: string, currentPath: string[]): string[] {
  const normalized = normalizeWhitespace(line);
  if (!normalized || normalized.length > 120) {
    return currentPath;
  }

  if (/^(Modul|Module|Veranstaltung|Course|Leistungspunkte|Credit)/i.test(normalized)) {
    return currentPath;
  }

  if (/(Pflicht|Wahlpflicht|Vertiefung|Anwendungsfach|Mandatory|Elective|Area|Bereich|Katalog|Catalog)/i.test(normalized)) {
    return [normalized];
  }

  const numbered = normalized.match(/^\d+(?:\.\d+)*\s+(.{4,})$/);
  return numbered && !/\b\d{2}-\d{2}-\d{4}\b/.test(normalized) ? [normalized] : currentPath;
}

function titleFromLines(lines: string[], index: number, moduleNumber: string): string {
  const sameLine = lines[index]?.replace(moduleNumber, "").replace(/^[-:\s]+/, "").trim();
  if (sameLine && !/^(Modul|Module)?nummer\b/i.test(sameLine)) {
    return sameLine;
  }

  for (const line of lines.slice(index + 1, index + 5)) {
    const normalized = normalizeWhitespace(line);
    if (
      normalized &&
      !/\b\d{2}-\d{2}-\d{4}\b/.test(normalized) &&
      !/^(Modul|Module)?nummer|Leistungspunkte|Credit|CP\b/i.test(normalized)
    ) {
      return normalized;
    }
  }

  return moduleNumber;
}

export function parseModuleHandbookPages(pages: ParsedPdfPage[]): ParsedModuleHandbookCourse[] {
  const entries: ParsedModuleHandbookCourse[] = [];
  let classPath: string[] = [];

  for (const page of pages) {
    const lines = normalizePdfText(page.text)
      .split(/\n+/)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      classPath = headingPathFromLine(line, classPath);

      const candidateBlock = lines.slice(index, index + 3).join(" ");
      const looksLikeModuleStart =
        /\b(Modul|Module)?nummer\b/i.test(line) || /^\d{2}-\d{2}-\d{4}\b/.test(line);
      if (!looksLikeModuleStart) {
        continue;
      }

      const moduleNumber = baseCourseNumber(candidateBlock.match(/\b\d{2}-\d{2}-\d{4}\b/)?.[0] ?? null);
      if (!moduleNumber) {
        continue;
      }

      const previousLine = lines[index - 1] ?? "";
      if (/\b(Veranstaltung|Course)\b/i.test(previousLine) && !/\b(Modul|Module)\b/i.test(previousLine)) {
        continue;
      }

      const nextModuleIndex = lines.findIndex((candidate, candidateIndex) => {
        return candidateIndex > index && /\b(Modul|Module)?nummer\b/i.test(candidate) && /\b\d{2}-\d{2}-\d{4}\b/.test(candidate);
      });
      const endIndex = nextModuleIndex > index ? nextModuleIndex : lines.length;
      const block = lines.slice(index, endIndex);
      const blockText = block.join(" ");
      const courseNumbers = [
        ...new Set(
          Array.from(blockText.matchAll(/\b\d{2}-\d{2}-\d{4}(?:-[A-Za-z]{1,8})?\b/g))
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
