import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScannerConfig } from "./config.js";
import {
  assertAllowedScrapeUrl,
  BlockedUrlError,
  defaultStartUrl,
  enrichModuleHandbooks,
  guardedFetch,
  readBodyCapped,
  scanOnce
} from "./index.js";

const baseConfig: ScannerConfig = {
  backendApiUrl: "https://backend.test/api",
  scannerToken: "scanner-token",
  tucanBaseUrl: "https://tucan.test",
  rateLimitMs: 0,
  scanIntervalHours: 24,
  facultyPrefix: "FB20 - Informatik",
  startUrl: "https://tucan.test/start",
  batchSize: 10,
  fetchRetryDelayMs: 0,
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

describe("scanner defaults", () => {
  it("starts from the stable public welcome page", () => {
    const url = new URL(defaultStartUrl({ ...baseConfig, startUrl: null }));

    expect(url.origin).toBe("https://tucan.test");
    expect(url.searchParams.get("PRGNAME")).toBe("EXTERNALPAGES");
    expect(url.searchParams.get("ARGUMENTS")).toBe("-N000000000000001,-N000344,-Awelcome");
  });
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

  it("skips a blocked off-host navigation link instead of aborting the crawl", async () => {
    const ingests: Array<Record<string, unknown>> = [];
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url === `${baseConfig.backendApiUrl}/catalog/internal/ingest` && init?.method === "POST") {
          ingests.push(JSON.parse(String(init.body)));
          return jsonResponse({ scan_run_id: "scan-run-1" });
        }

        // An off-host link is rejected before fetch is ever called, so reaching
        // here for evil.test would be a bug.
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    await scanOnce(baseConfig, {
      enrichModuleHandbooks: async () => undefined,
      resolveScanStart: async () => ({
        url: "https://tucan.test/fb20",
        html: `
          <div id="pageContent">
            <a href="https://evil.test/scripts/mgrqispi.dll?PRGNAME=ACTION">Advanced Courses</a>
          </div>
        `,
        semesterKey: "Sommersemester 2026",
        path: ["FB20 - Informatik"]
      }),
      enrichExamPlans: async () => undefined
    });

    expect(ingests).toHaveLength(2);
    expect(ingests[1]).toMatchObject({
      scan_run_id: "scan-run-1",
      status: "completed",
      courses_failed: 0
    });
  });

  it("deduplicates regenerated navigation URLs by breadcrumb and uses that path for courses", async () => {
    const ingests: Array<Record<string, unknown>> = [];
    const navigationFetches: string[] = [];
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

        if (url === "https://tucan.test/scripts/mgrqispi.dll?PRGNAME=ACTION&ARGUMENTS=-A1") {
          navigationFetches.push(url);
          return textResponse(`
            <div id="pageContent">
              <h2>Übersicht &gt; FB20 - Informatik &gt; Canonical Area</h2>
              <a href="/scripts/mgrqispi.dll?PRGNAME=COURSEDETAILS&ARGUMENTS=-C1">Course One</a>
              <a href="/scripts/mgrqispi.dll?PRGNAME=ACTION&ARGUMENTS=-A2">Regenerated Area</a>
            </div>
          `);
        }

        if (url === "https://tucan.test/scripts/mgrqispi.dll?PRGNAME=ACTION&ARGUMENTS=-A2") {
          navigationFetches.push(url);
          return textResponse(`
            <div id="pageContent">
              <h2> Übersicht &gt;  FB20 - Informatik  &gt; Canonical Area </h2>
              <a href="/scripts/mgrqispi.dll?PRGNAME=ACTION&ARGUMENTS=-A3">Another regenerated URL</a>
            </div>
          `);
        }

        if (url === "https://tucan.test/scripts/mgrqispi.dll?PRGNAME=COURSEDETAILS&ARGUMENTS=-C1") {
          return textResponse(`<div id="pageContent"><h1>20-00-0001-vl\nCourse One</h1></div>`);
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    await scanOnce(baseConfig, {
      enrichModuleHandbooks: async () => undefined,
      resolveScanStart: async () => ({
        url: "https://tucan.test/fb20",
        html: `
          <div id="pageContent">
            <h2>Übersicht &gt; FB20 - Informatik</h2>
            <a href="/scripts/mgrqispi.dll?PRGNAME=ACTION&ARGUMENTS=-A1">Queued label differs</a>
          </div>
        `,
        semesterKey: "Sommersemester 2026",
        path: ["FB20 - Informatik"]
      }),
      enrichExamPlans: async () => undefined
    });

    expect(navigationFetches).toEqual([
      "https://tucan.test/scripts/mgrqispi.dll?PRGNAME=ACTION&ARGUMENTS=-A1",
      "https://tucan.test/scripts/mgrqispi.dll?PRGNAME=ACTION&ARGUMENTS=-A2"
    ]);
    expect(ingests.at(-1)).toMatchObject({
      status: "completed",
      courses: [
        expect.objectContaining({
          title: "Course One",
          path: ["FB20 - Informatik", "Canonical Area"]
        })
      ]
    });
  });
});

describe("scrape URL allowlist", () => {
  it("allows the exact configured hosts over https", () => {
    expect(() => assertAllowedScrapeUrl("https://tucan.test/x", baseConfig)).not.toThrow();
    expect(() => assertAllowedScrapeUrl("https://informatik.test/a.pdf", baseConfig)).not.toThrow();
    expect(() => assertAllowedScrapeUrl("https://exam.test/p.xlsx", baseConfig)).not.toThrow();
  });

  it("blocks non-https, off-host, sibling-subdomain, and internal hosts", () => {
    expect(() => assertAllowedScrapeUrl("http://tucan.test/x", baseConfig)).toThrow(BlockedUrlError);
    expect(() => assertAllowedScrapeUrl("https://evil.test/x", baseConfig)).toThrow(BlockedUrlError);
    // The wider registrable zone is NOT trusted — only the exact configured hosts.
    expect(() => assertAllowedScrapeUrl("https://sub.tucan.test/x", baseConfig)).toThrow(BlockedUrlError);
    expect(() => assertAllowedScrapeUrl("https://backend/secret", baseConfig)).toThrow(BlockedUrlError);
  });
});

describe("guardedFetch redirect handling", () => {
  it("re-validates redirect targets and blocks a redirect to an internal host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "https://exam.test/plan.xlsx") {
          return new Response(null, { status: 302, headers: { location: "http://backend/secret" } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    await expect(guardedFetch("https://exam.test/plan.xlsx", baseConfig, {})).rejects.toThrow(BlockedUrlError);
  });

  it("follows a redirect that stays on an allowed host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "https://tucan.test/a") {
          return new Response(null, { status: 302, headers: { location: "https://tucan.test/b" } });
        }
        if (url === "https://tucan.test/b") {
          return textResponse("final");
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const response = await guardedFetch("https://tucan.test/a", baseConfig, {});
    expect(await response.text()).toBe("final");
  });
});

describe("readBodyCapped", () => {
  it("returns the body when under the cap", async () => {
    const bytes = await readBodyCapped(new Response("hello"), 1024, "https://exam.test/x");
    expect(new TextDecoder().decode(bytes)).toBe("hello");
  });

  it("aborts once the streamed body exceeds the cap", async () => {
    await expect(readBodyCapped(new Response("x".repeat(100)), 10, "https://exam.test/x")).rejects.toThrow(
      /exceeds 10 bytes/
    );
  });
});
