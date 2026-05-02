export type ScannerConfig = {
  backendApiUrl: string;
  scannerToken: string;
  tucanBaseUrl: string;
  rateLimitMs: number;
  scanIntervalHours: number;
  facultyPrefix: string;
  startUrl: string | null;
  batchSize: number;
};

export function readConfig(env = process.env): ScannerConfig {
  return {
    backendApiUrl: env.BACKEND_API_URL ?? "http://backend:4000/api",
    scannerToken: env.SCANNER_TOKEN ?? "",
    tucanBaseUrl: env.TUCAN_BASE_URL ?? "https://www.tucan.tu-darmstadt.de",
    rateLimitMs: Number(env.TUCAN_RATE_LIMIT_MS ?? 750),
    scanIntervalHours: Number(env.SCAN_INTERVAL_HOURS ?? 24),
    facultyPrefix: env.TUCAN_FACULTY_PREFIX ?? "FB20 - Informatik",
    startUrl: env.TUCAN_START_URL ?? null,
    batchSize: Number(env.SCAN_BATCH_SIZE ?? 25)
  };
}
