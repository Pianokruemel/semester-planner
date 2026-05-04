import * as cheerio from "cheerio";

export type ExamPlanLink = {
  semester_key: string;
  semester_index: number;
  file_url: string;
  file_label: string;
  stand_date: string | null;
};

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

function fullYear(value: string): number {
  const year = Number(value);
  return value.length === 2 ? 2000 + year : year;
}

function parseStandDate(value: string): string | null {
  const match = value.match(/\bStand\s+(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\b/i);
  if (!match) {
    return null;
  }

  const year = match[3]!.length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const month = Number(match[2]);
  const day = Number(match[1]);
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseExamPlanSemester(label: string): { semester_key: string; semester_index: number } | null {
  const normalized = normalizeWhitespace(label);
  const summer = normalized.match(/\bSommersemester\s+(\d{2,4})\b/i);
  if (summer) {
    const year = fullYear(summer[1]!);
    return {
      semester_key: `Sommersemester ${year}`,
      semester_index: year * 2
    };
  }

  const winter = normalized.match(/\bWintersemester\s+(\d{2,4})\s*\/\s*(\d{2,4})\b/i);
  if (winter) {
    const startYear = fullYear(winter[1]!);
    const endYear = fullYear(winter[2]!);
    return {
      semester_key: `Wintersemester ${startYear}/${String(endYear).slice(-2)}`,
      semester_index: startYear * 2 + 1
    };
  }

  return null;
}

export function discoverExamPlanLinks(html: string, pageUrl: string): ExamPlanLink[] {
  const $ = cheerio.load(html);
  const links: ExamPlanLink[] = [];

  $("a").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href || !/\.xlsx(?:[?#].*)?$/i.test(href)) {
      return;
    }

    const fileUrl = absoluteUrl(pageUrl, href);
    const text = normalizeWhitespace($(element).text()).replace(/\s*\(XLSX-Datei\)\s*$/i, "");
    const semester = parseExamPlanSemester(text);
    if (!fileUrl || !semester) {
      return;
    }

    const parent = $(element).closest("p");
    const standText = parent.nextAll("p").first().text();
    links.push({
      ...semester,
      file_url: fileUrl,
      file_label: text,
      stand_date: parseStandDate(standText)
    });
  });

  return links;
}

export function selectNewestExamPlanLink(links: ExamPlanLink[]): ExamPlanLink | null {
  return (
    links
      .slice()
      .sort(
        (left, right) =>
          right.semester_index - left.semester_index ||
          (right.stand_date ?? "").localeCompare(left.stand_date ?? "") ||
          right.file_url.localeCompare(left.file_url)
      )[0] ?? null
  );
}
