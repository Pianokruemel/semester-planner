import { setTimeout as sleep } from "node:timers/promises";
import { readConfig, ScannerConfig } from "./config.js";
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

async function scanOnce(config: ScannerConfig) {
  if (!config.scannerToken) {
    throw new Error("SCANNER_TOKEN is required.");
  }

  const resolvedStart = await resolveScanStart(config);
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
}

async function main() {
  const config = readConfig();
  const command = process.argv[2] ?? "scan:once";

  if (command === "scan:once") {
    await scanOnce(config);
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

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
