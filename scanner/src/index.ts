import { setTimeout as sleep } from "node:timers/promises";
import { parseExamWorkbookBuffer } from "@semester-planner/shared/examWorkbook";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig, ScannerConfig } from "./config.js";
import { discoverExamPlanLinks, ExamPlanLink, selectNewestExamPlanLink } from "./examPlans.js";
import {
  discoverStudyProgramPages,
  findCurrentModuleHandbookLink,
  ModuleHandbookLink,
  parseModuleHandbookPages,
  parsePdfPages,
  sha256Hex,
  StudyProgramPage
} from "./moduleHandbooks.js";
import {
  attachSmallGroupDetail,
  discoverSemesterKey,
  extractBreadcrumb,
  extractLinks,
  findCurrentSemesterLink,
  findFacultyLink,
  parseCourseDetail,
  parseSmallGroupDetail,
  ScrapedCatalogCourse,
  smallGroupsFromCourse,
  TucanLink
} from "./tucan.js";

type QueueItem = {
  url: string;
  path: string[];
};

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "semester-planner-public-catalog-scanner/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`TUCaN request failed ${response.status}: ${url}`);
  }

  return response.text();
}

async function fetchBytes(
  url: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; bytes: Uint8Array; etag: string | null; lastModified: string | null }> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "semester-planner-public-catalog-scanner/0.1",
      ...headers
    }
  });

  if (response.status === 304) {
    return { status: 304, bytes: new Uint8Array(), etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") };
  }

  if (!response.ok) {
    throw new Error(`Binary request failed ${response.status}: ${url}`);
  }

  return {
    status: response.status,
    bytes: new Uint8Array(await response.arrayBuffer()),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified")
  };
}

function isWithinFaculty(path: string[], link: TucanLink, facultyPrefix: string): boolean {
  return path.some((entry) => entry.startsWith(facultyPrefix)) || link.text.startsWith(facultyPrefix);
}

function defaultStartUrl(config: ScannerConfig): string {
  return new URL("/scripts/mgrqispi.dll?APPNAME=CampusNet&PRGNAME=ACTION&ARGUMENTS=-N000000000000001,-N000000,-N0,-N0,-N0", config.tucanBaseUrl).toString();
}

function navigationTextIsUseful(text: string, facultyPrefix: string): boolean {
  if (!text) {
    return false;
  }

  if (text.includes("Übersicht") || text.endsWith(">") || text.startsWith(facultyPrefix)) {
    return false;
  }

  return true;
}

async function resolveScanStart(config: ScannerConfig): Promise<{
  url: string;
  html: string;
  semesterKey: string;
  path: string[];
}> {
  const configuredUrl = config.startUrl ?? defaultStartUrl(config);
  const configuredHtml = await fetchText(configuredUrl);
  const currentSemesterLink = findCurrentSemesterLink(configuredHtml, configuredUrl);
  const catalogueUrl = currentSemesterLink?.href ?? configuredUrl;
  const catalogueHtml = currentSemesterLink ? await fetchText(catalogueUrl) : configuredHtml;
  const semesterKey = currentSemesterLink?.text.replace(/^Aktuell\s*-\s*/i, "") ?? discoverSemesterKey(catalogueHtml);
  const facultyLink = findFacultyLink(catalogueHtml, catalogueUrl, config.facultyPrefix);

  if (facultyLink) {
    const facultyHtml = await fetchText(facultyLink.href);
    const breadcrumb = extractBreadcrumb(facultyHtml);
    return {
      url: facultyLink.href,
      html: facultyHtml,
      semesterKey,
      path: breadcrumb.length > 0 ? breadcrumb : [config.facultyPrefix]
    };
  }

  const breadcrumb = extractBreadcrumb(catalogueHtml);
  if (breadcrumb.some((entry) => entry.startsWith(config.facultyPrefix))) {
    return {
      url: catalogueUrl,
      html: catalogueHtml,
      semesterKey,
      path: breadcrumb
    };
  }

  throw new Error(`Could not find faculty "${config.facultyPrefix}" in the current TUCaN catalogue.`);
}

async function ingestBatch(config: ScannerConfig, payload: {
  scan_run_id?: string;
  semester_key: string;
  status: "running" | "completed" | "failed";
  courses_failed?: number;
  error_text?: string | null;
  courses: ScrapedCatalogCourse[];
}) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(`${config.backendApiUrl}/catalog/internal/ingest`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-scanner-token": config.scannerToken
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Backend ingest failed ${response.status}: ${await response.text()}`);
      }

      return (await response.json()) as { scan_run_id: string };
    } catch (error) {
      lastError = error;
      console.error(`backend_ingest_retry attempt=${attempt}`, error);
      await sleep(2_000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Backend ingest failed.");
}

async function fetchHandbookStatus(config: ScannerConfig, link: ModuleHandbookLink): Promise<{
  content_hash: string;
  etag: string | null;
  last_modified: string | null;
} | null> {
  const params = new URLSearchParams({
    program_key: link.program_key,
    po_label: link.po_label,
    pdf_url: link.pdf_url
  });
  const response = await fetch(`${config.backendApiUrl}/catalog/internal/module-handbooks/status?${params.toString()}`, {
    headers: {
      "x-scanner-token": config.scannerToken
    }
  });

  if (!response.ok) {
    throw new Error(`Backend handbook status failed ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as { content_hash: string; etag: string | null; last_modified: string | null } | null;
}

async function fetchExamPlanStatus(config: ScannerConfig, link: ExamPlanLink): Promise<{
  content_hash: string;
  etag: string | null;
  last_modified: string | null;
  fetch_status: string;
  parse_status: string;
} | null> {
  const params = new URLSearchParams({
    semester_key: link.semester_key,
    file_url: link.file_url
  });
  const response = await fetch(`${config.backendApiUrl}/catalog/internal/exam-plans/status?${params.toString()}`, {
    headers: {
      "x-scanner-token": config.scannerToken
    }
  });

  if (!response.ok) {
    throw new Error(`Backend exam plan status failed ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as {
    content_hash: string;
    etag: string | null;
    last_modified: string | null;
    fetch_status: string;
    parse_status: string;
  } | null;
}

async function ingestExamPlan(
  config: ScannerConfig,
  link: ExamPlanLink,
  document: {
    content_hash: string;
    etag: string | null;
    last_modified: string | null;
    fetch_status: string;
    parse_status: string;
    error_text?: string | null;
    rows: ReturnType<typeof parseExamWorkbookBuffer>;
  }
) {
  const response = await fetch(`${config.backendApiUrl}/catalog/internal/exam-plans`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-scanner-token": config.scannerToken
    },
    body: JSON.stringify({
      semester_key: link.semester_key,
      semester_index: link.semester_index,
      file_url: link.file_url,
      file_label: link.file_label,
      content_hash: document.content_hash,
      etag: document.etag,
      last_modified: document.last_modified,
      fetch_status: document.fetch_status,
      parse_status: document.parse_status,
      error_text: document.error_text ?? null,
      rows: document.rows.map((row) => ({
        row_number: row.rowNumber,
        weekday: row.weekday,
        date: row.date,
        time_from: row.timeFrom,
        time_to: row.timeTo,
        appointment_type: row.appointmentType,
        lecturer: row.lecturer,
        course_name: row.courseName,
        extracted_course_numbers: row.extractedCourseNumbers,
        parse_error: row.parseError
      }))
    })
  });

  if (!response.ok) {
    throw new Error(`Backend exam plan ingest failed ${response.status}: ${await response.text()}`);
  }

  const result = await response.json();
  console.log(`exam_plan_ingested ${JSON.stringify(result)}`);
}

async function ingestModuleHandbooks(
  config: ScannerConfig,
  programmes: StudyProgramPage[],
  documents: Array<{
    program_key: string;
    po_label: string;
    pdf_url: string;
    pdf_label: string;
    content_hash: string;
    etag: string | null;
    last_modified: string | null;
    fetch_status: string;
    parse_status: string;
    error_text?: string | null;
    courses: ReturnType<typeof parseModuleHandbookPages>;
  }>
) {
  if (programmes.length === 0 && documents.length === 0) {
    return;
  }

  const response = await fetch(`${config.backendApiUrl}/catalog/internal/module-handbooks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-scanner-token": config.scannerToken
    },
    body: JSON.stringify({ programmes, documents })
  });

  if (!response.ok) {
    throw new Error(`Backend handbook ingest failed ${response.status}: ${await response.text()}`);
  }

  const result = await response.json();
  console.log(`module_handbooks_ingested ${JSON.stringify(result)}`);
}

export async function enrichModuleHandbooks(config: ScannerConfig) {
  console.log(`module_handbooks_overview url=${config.moduleHandbookOverviewUrl}`);
  const overviewHtml = await fetchText(config.moduleHandbookOverviewUrl);
  const programmePages = discoverStudyProgramPages(overviewHtml, config.moduleHandbookOverviewUrl);
  const links: ModuleHandbookLink[] = [];

  await ingestModuleHandbooks(config, programmePages, []);

  for (const page of programmePages) {
    await sleep(config.rateLimitMs);
    const programHtml = await fetchText(page.page_url);
    const link = findCurrentModuleHandbookLink(programHtml, page);
    if (link) {
      links.push(link);
      console.log(`module_handbook_found program="${link.program_label}" po="${link.po_label}" pdf=${link.pdf_url}`);
    } else {
      console.warn(`module_handbook_missing program="${page.program_label}" page=${page.page_url}`);
    }
  }

  const documents: Parameters<typeof ingestModuleHandbooks>[2] = [];
  for (const link of links) {
    try {
      const previous = await fetchHandbookStatus(config, link);
      const headers: Record<string, string> = {};
      if (previous?.etag) {
        headers["if-none-match"] = previous.etag;
      }
      if (previous?.last_modified) {
        headers["if-modified-since"] = previous.last_modified;
      }

      await sleep(config.rateLimitMs);
      const fetched = await fetchBytes(link.pdf_url, headers);
      if (fetched.status === 304) {
        console.log(`module_handbook_unchanged program="${link.program_label}" reason=not_modified`);
        continue;
      }

      const contentHash = sha256Hex(fetched.bytes);
      if (previous?.content_hash === contentHash) {
        console.log(`module_handbook_unchanged program="${link.program_label}" reason=same_hash`);
        continue;
      }

      const pages = await parsePdfPages(fetched.bytes);
      const courses = parseModuleHandbookPages(pages);
      documents.push({
        program_key: link.program_key,
        po_label: link.po_label,
        pdf_url: link.pdf_url,
        pdf_label: link.pdf_label,
        content_hash: contentHash,
        etag: fetched.etag,
        last_modified: fetched.lastModified,
        fetch_status: "fetched",
        parse_status: "parsed",
        courses
      });
      console.log(`module_handbook_parsed program="${link.program_label}" courses=${courses.length}`);
    } catch (error) {
      console.error(`module_handbook_failed program="${link.program_label}" pdf=${link.pdf_url}`, error);
    }
  }

  await ingestModuleHandbooks(config, [], documents);
}

export async function enrichExamPlans(config: ScannerConfig) {
  console.log(`exam_plan_overview url=${config.examPlanOverviewUrl}`);
  const overviewHtml = await fetchText(config.examPlanOverviewUrl);
  const links = discoverExamPlanLinks(overviewHtml, config.examPlanOverviewUrl);
  const newest = selectNewestExamPlanLink(links);

  if (!newest) {
    console.warn("exam_plan_missing reason=no_xlsx_semester_link");
    return;
  }

  console.log(
    `exam_plan_selected semester="${newest.semester_key}" index=${newest.semester_index} label="${newest.file_label}" url=${newest.file_url}`
  );
  const previous = await fetchExamPlanStatus(config, newest);
  await sleep(config.rateLimitMs);
  const fetched = await fetchBytes(newest.file_url);
  const contentHash = sha256Hex(fetched.bytes);

  if (previous?.content_hash === contentHash && previous.parse_status === "parsed") {
    console.log(`exam_plan_unchanged semester="${newest.semester_key}" reason=same_hash`);
    return;
  }

  try {
    const rows = parseExamWorkbookBuffer(fetched.bytes);
    await ingestExamPlan(config, newest, {
      content_hash: contentHash,
      etag: fetched.etag,
      last_modified: fetched.lastModified,
      fetch_status: "fetched",
      parse_status: "parsed",
      rows
    });
    console.log(`exam_plan_parsed semester="${newest.semester_key}" rows=${rows.length}`);
  } catch (error) {
    await ingestExamPlan(config, newest, {
      content_hash: contentHash,
      etag: fetched.etag,
      last_modified: fetched.lastModified,
      fetch_status: "fetched",
      parse_status: "failed",
      error_text: error instanceof Error ? error.message : String(error),
      rows: []
    });
    throw error;
  }
}

type ScanOnceDeps = {
  enrichModuleHandbooks?: typeof enrichModuleHandbooks;
  enrichExamPlans?: typeof enrichExamPlans;
  resolveScanStart?: typeof resolveScanStart;
};

export async function scanOnce(config: ScannerConfig, deps: ScanOnceDeps = {}) {
  if (!config.scannerToken) {
    throw new Error("SCANNER_TOKEN is required.");
  }

  const runModuleHandbooks = deps.enrichModuleHandbooks ?? enrichModuleHandbooks;
  const runExamPlans = deps.enrichExamPlans ?? enrichExamPlans;
  const resolveStart = deps.resolveScanStart ?? resolveScanStart;

  try {
    await runModuleHandbooks(config);
  } catch (error) {
    console.error("module_handbooks_failed", error);
  }

  const resolvedStart = await resolveStart(config);
  const startUrl = resolvedStart.url;
  const startHtml = resolvedStart.html;
  const semesterKey = resolvedStart.semesterKey;
  console.log(`semester=${semesterKey}`);
  console.log(`scan_start url=${startUrl} path="${resolvedStart.path.join(" > ")}"`);

  let scanRunId: string | undefined;
  const firstIngest = await ingestBatch(config, {
    semester_key: semesterKey,
    status: "running",
    courses: []
  });
  scanRunId = firstIngest.scan_run_id;

  const queue: QueueItem[] = [{ url: startUrl, path: resolvedStart.path }];
  const visited = new Set<string>();
  const processedCourseUrls = new Set<string>();
  const batch: ScrapedCatalogCourse[] = [];
  let coursesFailed = 0;

  try {
    while (queue.length > 0) {
      const item = queue.shift() as QueueItem;
      if (visited.has(item.url)) {
        continue;
      }

      visited.add(item.url);
      await sleep(config.rateLimitMs);
      const html = item.url === startUrl ? startHtml : await fetchText(item.url);
      const links = extractLinks(html, item.url);
      console.log(`navigation url=${item.url} links=${links.length}`);

      for (const link of links) {
        if (link.kind === "course" && isWithinFaculty(item.path, link, config.facultyPrefix)) {
          if (processedCourseUrls.has(link.href)) {
            continue;
          }

          processedCourseUrls.add(link.href);

          try {
            await sleep(config.rateLimitMs);
            const courseHtml = await fetchText(link.href);
            let course = parseCourseDetail(courseHtml, link.href, { semesterKey, path: item.path });
            for (const group of smallGroupsFromCourse(course)) {
              if (!group.url || processedCourseUrls.has(group.url)) {
                continue;
              }

              processedCourseUrls.add(group.url);
              try {
                await sleep(config.rateLimitMs);
                const groupHtml = await fetchText(group.url);
                const groupDetail = parseSmallGroupDetail(groupHtml);
                course = attachSmallGroupDetail(course, group.key, groupDetail);
                console.log(`small_group title="${group.title}" appointments=${groupDetail.appointments?.length ?? 0}`);
              } catch (error) {
                console.error(`small_group_failed url=${group.url}`, error);
              }
            }
            batch.push(course);
            console.log(`course title="${course.title}" appointments=${course.appointments.length} cp=${course.cp}`);

            if (batch.length >= config.batchSize) {
              await ingestBatch(config, {
                scan_run_id: scanRunId,
                semester_key: semesterKey,
                status: "running",
                courses: batch.splice(0)
              });
            }
          } catch (error) {
            coursesFailed += 1;
            console.error(`course_failed url=${link.href}`, error);
          }

          continue;
        }

        if (link.kind === "navigation") {
          if (!navigationTextIsUseful(link.text, config.facultyPrefix)) {
            continue;
          }

          const nextPath = link.text ? [...item.path, link.text] : item.path;
          if (isWithinFaculty(nextPath, link, config.facultyPrefix) && nextPath.length <= 8 && !visited.has(link.href)) {
            queue.push({ url: link.href, path: nextPath });
          }
        }
      }
    }

    console.log(`course_pages=${processedCourseUrls.size}`);

    await ingestBatch(config, {
      scan_run_id: scanRunId,
      semester_key: semesterKey,
      status: "completed",
      courses_failed: coursesFailed,
      courses: batch
    });
  } catch (error) {
    try {
      await ingestBatch(config, {
        scan_run_id: scanRunId,
        semester_key: semesterKey,
        status: "failed",
        courses_failed: coursesFailed,
        error_text: error instanceof Error ? (error.stack ?? error.message) : String(error),
        courses: batch.splice(0)
      });
    } catch (statusError) {
      console.error("scan_failed_status_update_failed", statusError);
    }
    throw error;
  }

  try {
    await runExamPlans(config);
  } catch (error) {
    console.error("exam_plans_failed", error);
  }
}

async function main() {
  const config = readConfig();
  const command = process.argv[2] ?? "scan:once";

  if (command === "scan:once") {
    await scanOnce(config);
    return;
  }

  if (command === "module-handbooks:once") {
    await enrichModuleHandbooks(config);
    return;
  }

  if (command === "scan:watch") {
    for (;;) {
      try {
        await scanOnce(config);
      } catch (error) {
        console.error("scan_failed", error);
      }

      await sleep(config.scanIntervalHours * 60 * 60 * 1000);
    }
  }

  throw new Error(`Unknown command: ${command}`);
}

function isCliEntryPoint() {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]!) === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
