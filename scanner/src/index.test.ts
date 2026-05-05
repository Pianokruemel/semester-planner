import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScannerConfig } from "./config.js";
import { enrichModuleHandbooks, scanOnce } from "./index.js";

const baseConfig: ScannerConfig = {
  backendApiUrl: "https://backend.test/api",
  scannerToken: "scanner-token",
  tucanBaseUrl: "https://tucan.test",
  rateLimitMs: 0,
  scanIntervalHours: 24,
  facultyPrefix: "FB20 - Informatik",
  startUrl: "https://tucan.test/start",
  batchSize: 10,
  moduleHandbookOverviewUrl: "https://informatik.test/ordnungen/",
  examPlanOverviewUrl: "https://exam.test/"
};

function textResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    ...init,
    headers: {
      "content-type": "text/plain",
      ...init.headers
    }
  });
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scanner orchestration", () => {
  it("ingests discovered study programmes before fetching handbook PDFs", async () => {
    const ingests: unknown[] = [];
    const failedPdfError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url === baseConfig.moduleHandbookOverviewUrl) {
          return textResponse(`<a href="/msc">M. Sc. Informatik</a>`);
        }

        if (url === "https://informatik.test/msc") {
          return textResponse(`
            <main>
              <h2>PO 2023</h2>
              <a href="handbook.pdf">Modulhandbuch</a>
            </main>
          `);
        }

        if (url.startsWith(`${baseConfig.backendApiUrl}/catalog/internal/module-handbooks/status`)) {
          return jsonResponse(null);
        }

        if (url === "https://informatik.test/handbook.pdf") {
          return textResponse("pdf unavailable", { status: 500 });
        }

        if (url === `${baseConfig.backendApiUrl}/catalog/internal/module-handbooks` && init?.method === "POST") {
          ingests.push(JSON.parse(String(init.body)));
          return jsonResponse({ programmes_seen: 1, documents_seen: 0, courses_replaced: 0 });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    await enrichModuleHandbooks(baseConfig);

    expect(ingests).toHaveLength(1);
    expect(ingests[0]).toMatchObject({
      programmes: [
        {
          program_key: "msc-informatik",
          program_label: "M. Sc. Informatik",
          page_url: "https://informatik.test/msc"
        }
      ],
      documents: []
    });
    expect(failedPdfError).toHaveBeenCalledWith(
      expect.stringContaining("module_handbook_failed"),
      expect.any(Error)
    );
  });

  it("runs module handbook sync before resolving the TUCaN crawl start", async () => {
    const calls: string[] = [];
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url === `${baseConfig.backendApiUrl}/catalog/internal/ingest` && init?.method === "POST") {
          calls.push("ingest");
          return jsonResponse({ scan_run_id: "scan-run-1" });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    await scanOnce(baseConfig, {
      enrichModuleHandbooks: async () => {
        calls.push("handbooks");
      },
      resolveScanStart: async () => {
        calls.push("resolve-start");
        return {
          url: "https://tucan.test/fb20",
          html: "<html></html>",
          semesterKey: "Sommersemester 2026",
          path: ["FB20 - Informatik"]
        };
      },
      enrichExamPlans: async () => {
        calls.push("exam-plans");
      }
    });

    expect(calls).toEqual(["handbooks", "resolve-start", "ingest", "ingest", "exam-plans"]);
  });

  it("marks the scan run as failed when a navigation fetch aborts the crawl", async () => {
    const ingests: unknown[] = [];
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url === `${baseConfig.backendApiUrl}/catalog/internal/ingest` && init?.method === "POST") {
          ingests.push(JSON.parse(String(init.body)));
          return jsonResponse({ scan_run_id: "scan-run-1" });
        }

        if (url === "https://tucan.test/scripts/mgrqispi.dll?PRGNAME=ACTION") {
          throw new TypeError("fetch failed");
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    await expect(
      scanOnce(baseConfig, {
        enrichModuleHandbooks: async () => undefined,
        resolveScanStart: async () => ({
          url: "https://tucan.test/fb20",
          html: `
            <div id="pageContent">
              <a href="/scripts/mgrqispi.dll?PRGNAME=ACTION">Advanced Courses</a>
            </div>
          `,
          semesterKey: "Sommersemester 2026",
          path: ["FB20 - Informatik"]
        }),
        enrichExamPlans: async () => undefined
      })
    ).rejects.toThrow("fetch failed");

    expect(ingests).toHaveLength(2);
    expect(ingests[0]).toMatchObject({
      semester_key: "Sommersemester 2026",
      status: "running",
      courses: []
    });
    expect(ingests[1]).toMatchObject({
      scan_run_id: "scan-run-1",
      semester_key: "Sommersemester 2026",
      status: "failed",
      courses_failed: 0,
      error_text: expect.stringContaining("fetch failed"),
      courses: []
    });
  });
});
