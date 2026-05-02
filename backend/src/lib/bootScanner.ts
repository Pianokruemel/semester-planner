import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "./prisma";

type BootScannerOptions = {
  port: number;
};

function commandName(command: string) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

function shouldAutoStartScanner() {
  const raw = process.env.AUTO_START_SCANNER_ON_EMPTY_DB;
  return raw === undefined || !["0", "false", "no", "off"].includes(raw.trim().toLowerCase());
}

function scannerWorkdir() {
  return process.env.SCANNER_WORKDIR ?? path.resolve(process.cwd(), "../scanner");
}

function scannerBackendApiUrl(port: number) {
  return process.env.SCANNER_BOOT_BACKEND_API_URL ?? `http://127.0.0.1:${port}/api`;
}

export async function startScannerIfCatalogEmpty({ port }: BootScannerOptions) {
  if (!shouldAutoStartScanner()) {
    return;
  }

  if (!process.env.SCANNER_TOKEN) {
    console.warn("catalog_empty_scanner_skipped reason=missing_scanner_token");
    return;
  }

  const [catalogCourseCount, runningScanCount] = await Promise.all([
    prisma.catalogCourse.count(),
    prisma.catalogScanRun.count({ where: { status: "running" } })
  ]);

  if (catalogCourseCount > 0) {
    return;
  }

  if (runningScanCount > 0) {
    console.log("catalog_empty_scanner_skipped reason=scan_already_running");
    return;
  }

  const cwd = scannerWorkdir();
  if (!existsSync(path.join(cwd, "package.json"))) {
    console.warn(`catalog_empty_scanner_skipped reason=scanner_workdir_missing path=${cwd}`);
    return;
  }

  console.log("catalog_empty_starting_scanner");
  const child = spawn(commandName("npm"), ["run", "scan:once"], {
    cwd,
    env: {
      ...process.env,
      BACKEND_API_URL: scannerBackendApiUrl(port)
    },
    stdio: "inherit"
  });

  child.on("error", (error) => {
    console.error("catalog_empty_scanner_start_failed", error);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`catalog_empty_scanner_exited signal=${signal}`);
      return;
    }

    console.log(`catalog_empty_scanner_exited code=${code ?? 0}`);
  });
}
