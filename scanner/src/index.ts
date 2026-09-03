import { setTimeout as sleep } from "node:timers/promises";
import { setDefaultResultOrder } from "node:dns";
import { parseExamWorkbookBuffer } from "@semester-planner/shared/examWorkbook";
import path from "node:path";
import { fileURLToPath } from "node:url";

setDefaultResultOrder("ipv4first");
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

const FETCH_TIMEOUT_MS = 30_000;
const FETCH_RETRY_ATTEMPTS = 3;
const FETCH_RETRY_DELAY_MS = 5_000;
// Guard against decompression bombs / accidental huge files when downloading
// remote PDFs and Excel exam plans into memory.
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
// Cap on redirect hops we follow while re-validating each one (see guardedFetch).
const MAX_REDIRECTS = 5;

function isTransientFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return true;
  return error.message.includes("fetch failed");
}

// Thrown when a URL fails the SSRF allowlist. Kept distinct from transient fetch
// failures so the crawl can skip a single bad link instead of aborting (see scanOnce).
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

// The exact set of public university hosts the scanner is configured to crawl.
// Every scraped/redirected URL is checked against this — without it an attacker who
// can influence a TU page or a redirect could point the scanner at internal hosts
// (e.g. the backend, cloud metadata) — a classic SSRF. We match the full hostname,
// not the registrable domain, so the rest of the tu-darmstadt.de zone is NOT trusted.
function allowedHosts(config: ScannerConfig): Set<string> {
  const hosts = new Set<string>();
  for (const source of [config.tucanBaseUrl, config.moduleHandbookOverviewUrl, config.examPlanOverviewUrl]) {
    try {
      hosts.add(new URL(source).hostname.toLowerCase());
    } catch {
      // Ignore unparseable configuration URLs.
    }
  }
  return hosts;
}

export function assertAllowedScrapeUrl(url: string, config: ScannerConfig): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BlockedUrlError(`Blocked malformed scrape URL: ${url}`);
  }

  if (parsed.protocol !== "https:") {
    throw new BlockedUrlError(`Blocked non-https scrape URL: ${url}`);
  }

  if (!allowedHosts(config).has(parsed.hostname.toLowerCase())) {
    throw new BlockedUrlError(`Blocked scrape URL outside the allowed university hosts: ${url}`);
  }
}

// Follow redirects manually so the SSRF allowlist is enforced on EVERY hop. With
// fetch's default redirect:"follow", an allowed page could 30x-bounce the scanner
// to an internal host without re-checking — defeating assertAllowedScrapeUrl.
export async function guardedFetch(url: string, config: ScannerConfig, init: RequestInit): Promise<Response> {
  let target = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    assertAllowedScrapeUrl(target, config);
    const response = await fetch(target, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      // Discard the redirect body so the socket can be reused, then re-validate the next hop.
      await response.body?.cancel().catch(() => undefined);
      target = new URL(location, target).toString();
      continue;
    }
    return response;
  }
  throw new BlockedUrlError(`Blocked scrape URL after too many redirects (>${MAX_REDIRECTS}): ${url}`);
}

// Read a response body, aborting as soon as the running size exceeds the cap.
// response.arrayBuffer() would buffer the ENTIRE body first, so a server that
// omits/forges content-length (or gzip-bombs) could exhaust memory before any
// size check — here we stop reading the moment the limit is crossed.
export async function readBodyCapped(response: Response, maxBytes: number, url: string): Promise<Uint8Array> {
  const body = response.body;
  if (!body) {
    return new Uint8Array();
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    total += result.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Remote file exceeds ${maxBytes} bytes: ${url}`);
    }
    chunks.push(result.value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function fetchText(url: string, config: ScannerConfig): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await guardedFetch(url, config, {
      headers: {
        "user-agent": "semester-planner-public-catalog-scanner/0.1"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`TUCaN request failed ${response.status}: ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBytes(
  url: string,
  config: ScannerConfig,
  headers: Record<string, string> = {}
): Promise<{ status: number; bytes: Uint8Array; etag: string | null; lastModified: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await guardedFetch(url, config, {
      headers: {
        "user-agent": "semester-planner-public-catalog-scanner/0.1",
        ...headers
      },
      signal: controller.signal
    });

    if (response.status === 304) {
      return { status: 304, bytes: new Uint8Array(), etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") };
    }

    if (!response.ok) {
      throw new Error(`Binary request failed ${response.status}: ${url}`);
    }

    // Reject obviously-oversized downloads up front, but rely on the streaming
    // cap below for the real guard — content-length can be absent or forged.
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_DOWNLOAD_BYTES) {
      throw new Error(`Remote file exceeds ${MAX_DOWNLOAD_BYTES} bytes (declared ${declaredLength}): ${url}`);
    }

    const bytes = await readBodyCapped(response, MAX_DOWNLOAD_BYTES, url);

    return {
      status: response.status,
      bytes,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified")
    };
  } finally {
    clearTimeout(timer);
  }
}

async function withTransientRetry<T>(
  context: string,
  task: () => Promise<T>,
  attempts = FETCH_RETRY_ATTEMPTS,
  retryDelayMs = FETCH_RETRY_DELAY_MS
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientFetchError(error)) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`fetch_retry context=${context} attempt=${attempt}/${attempts} reason="${reason}"`);
      await sleep(retryDelayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Fetch failed: ${context}`);
}

function isWithinFaculty(path: string[], link: TucanLink, facultyPrefix: string): boolean {
  return path.some((entry) => entry.startsWith(facultyPrefix)) || link.text.startsWith(facultyPrefix);
}

export function defaultStartUrl(config: ScannerConfig): string {
  return new URL(
    "/scripts/mgrqispi.dll?APPNAME=CampusNet&PRGNAME=EXTERNALPAGES&ARGUMENTS=-N000000000000001,-N000344,-Awelcome",
    config.tucanBaseUrl
  ).toString();
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

function navigationPathKey(path: string[]): string {
  return path
    .map((entry) => entry.replace(/\s+/g, " ").trim().toLowerCase())
    .filter(Boolean)
    .join("\u001f");
}

async function resolveScanStart(config: ScannerConfig): Promise<{
  url: string;
  html: string;
  semesterKey: string;
  path: string[];
}> {
  const configuredUrl = config.startUrl ?? defaultStartUrl(config);
  const configuredHtml = await fetchText(configuredUrl, config);
  const currentSemesterLink = findCurrentSemesterLink(configuredHtml, configuredUrl);
  const catalogueUrl = currentSemesterLink?.href ?? configuredUrl;
  const catalogueHtml = currentSemesterLink ? await fetchText(catalogueUrl, config) : configuredHtml;
  const semesterKey = currentSemesterLink?.text.replace(/^Aktuell\s*-\s*/i, "") ?? discoverSemesterKey(catalogueHtml);
  const facultyLink = findFacultyLink(catalogueHtml, catalogueUrl, config.facultyPrefix);

  if (facultyLink) {
    const facultyHtml = await fetchText(facultyLink.href, config);
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
  const maxAttempts = 10;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${config.backendApiUrl}/catalog/internal/ingest`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-scanner-token": config.scannerToken
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return (await response.json()) as { scan_run_id: string };
      }

      const body = await response.text();
      // 4xx means the request itself is wrong (bad token, invalid payload).
      // Retrying can't fix that, so fail fast instead of hammering the backend.
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Backend ingest rejected ${response.status}: ${body}`);
      }
      // 5xx is treated as transient and retried below.
      lastError = new Error(`Backend ingest failed ${response.status}: ${body}`);
    } catch (error) {
      // Network/abort failures are transient; the 4xx rejection above is not.
      if (!isTransientFetchError(error)) {
        throw error;
      }
      lastError = error;
    }

    if (attempt < maxAttempts) {
      console.error(`backend_ingest_retry attempt=${attempt}/${maxAttempts}`, lastError);
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

  const response = await withTransientRetry(`module_handbooks_ingest ${config.backendApiUrl}`, async () => {
    const res = await fetch(`${config.backendApiUrl}/catalog/internal/module-handbooks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-scanner-token": config.scannerToken
      },
      body: JSON.stringify({ programmes, documents })
    });

    if (!res.ok) {
      throw new Error(`Backend handbook ingest failed ${res.status}: ${await res.text()}`);
    }

    return res;
  });

  const result = await response.json();
  console.log(`module_handbooks_ingested ${JSON.stringify(result)}`);
}

export async function enrichModuleHandbooks(config: ScannerConfig) {
  console.log(`module_handbooks_overview url=${config.moduleHandbookOverviewUrl}`);
  const overviewHtml = await withTransientRetry(
    `module_handbooks_overview ${config.moduleHandbookOverviewUrl}`,
    () => fetchText(config.moduleHandbookOverviewUrl, config)
  );
  const programmePages = discoverStudyProgramPages(overviewHtml, config.moduleHandbookOverviewUrl);
  const links: ModuleHandbookLink[] = [];

  await ingestModuleHandbooks(config, programmePages, []);

  for (const page of programmePages) {
    await sleep(config.rateLimitMs);
    try {
      const programHtml = await withTransientRetry(
        `module_handbook_program ${page.page_url}`,
        () => fetchText(page.page_url, config)
      );
      const link = findCurrentModuleHandbookLink(programHtml, page);
      if (link) {
        links.push(link);
        console.log(`module_handbook_found program="${link.program_label}" po="${link.po_label}" pdf=${link.pdf_url}`);
      } else {
        console.warn(`module_handbook_missing program="${page.program_label}" page=${page.page_url}`);
      }
    } catch (error) {
      console.error(`module_handbook_program_failed program="${page.program_label}" page=${page.page_url}`, error);
    }
  }

  const documents: Parameters<typeof ingestModuleHandbooks>[2] = [];
  for (const link of links) {
    try {
      await fetchHandbookStatus(config, link);

      await sleep(config.rateLimitMs);
      const fetched = await withTransientRetry(
        `module_handbook_pdf ${link.pdf_url}`,
        () => fetchBytes(link.pdf_url, config)
      );

      const contentHash = sha256Hex(fetched.bytes);
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
  const overviewHtml = await fetchText(config.examPlanOverviewUrl, config);
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
  const fetched = await fetchBytes(newest.file_url, config);
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
  const visitedNavigationPaths = new Set<string>();
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
      // Retry transient failures on navigation pages: unlike per-course fetches
      // (which are isolated below), a thrown navigation fetch aborts the whole crawl.
      let html: string;
      if (item.url === startUrl) {
        html = startHtml;
      } else {
        try {
          html = await withTransientRetry(
            `navigation ${item.url}`,
            () => fetchText(item.url, config),
            FETCH_RETRY_ATTEMPTS,
            config.fetchRetryDelayMs
          );
        } catch (error) {
          // A blocked (off-allowlist / non-https) link must not abort the whole
          // crawl — skip just this page. Transient and other errors still propagate.
          if (error instanceof BlockedUrlError) {
            console.warn(`navigation_skipped url=${item.url} reason="${error.message}"`);
            continue;
          }
          throw error;
        }
      }
      const breadcrumb = extractBreadcrumb(html);
      const pagePath = breadcrumb.length > 0 ? breadcrumb : item.path;
      const pagePathKey = navigationPathKey(pagePath);
      if (visitedNavigationPaths.has(pagePathKey)) {
        continue;
      }
      visitedNavigationPaths.add(pagePathKey);

      const links = extractLinks(html, item.url);
      console.log(`navigation url=${item.url} links=${links.length}`);

      for (const link of links) {
        if (link.kind === "course" && isWithinFaculty(pagePath, link, config.facultyPrefix)) {
          if (processedCourseUrls.has(link.href)) {
            continue;
          }

          processedCourseUrls.add(link.href);

          try {
            await sleep(config.rateLimitMs);
            const courseHtml = await fetchText(link.href, config);
            let course = parseCourseDetail(courseHtml, link.href, { semesterKey, path: pagePath });
            for (const group of smallGroupsFromCourse(course)) {
              if (!group.url || processedCourseUrls.has(group.url)) {
                continue;
              }

              processedCourseUrls.add(group.url);
              try {
                await sleep(config.rateLimitMs);
                const groupHtml = await fetchText(group.url, config);
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

          const nextPath = link.text ? [...pagePath, link.text] : pagePath;
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
