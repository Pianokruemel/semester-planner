import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { startScannerIfCatalogEmpty } from "./lib/bootScanner";
import { prisma } from "./lib/prisma";
import { secretsMatch } from "./lib/tokens";
import { errorHandler, HttpError, notFoundHandler } from "./middleware/errorHandler";
import { catalogRouter } from "./routes/catalog";
import { plansRouter } from "./routes/plans";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

// Behind nginx + Cloudflare, so trust the first proxy hop for client IPs.
app.set("trust proxy", 1);
// Don't advertise the framework, and harden the JSON API responses.
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : true }));
app.use(express.json({ limit: "2mb" }));

const scannerToken = () => process.env.SCANNER_TOKEN;
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120),
  standardHeaders: true,
  legacyHeaders: false,
  // Server-side scanner ingest is token-authenticated and runs in bulk.
  skip: (req) => {
    const expected = scannerToken();
    const received = req.header("x-scanner-token");
    return Boolean(expected) && typeof received === "string" && secretsMatch(received, expected as string);
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiLimiter);
app.use("/api/plans", plansRouter);
app.use("/api/catalog", catalogRouter);

app.use(notFoundHandler);

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof ZodError) {
    next(new HttpError(400, error.issues.map((issue) => issue.message).join("; ")));
    return;
  }

  next(error);
});

app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
  void startScannerIfCatalogEmpty({ port }).catch((error) => {
    console.error("catalog_empty_scanner_boot_check_failed", error);
  });
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down.`);
  // Stop accepting new connections, drain in-flight requests, then release the DB pool.
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  // Don't let a hung connection block the orchestrator's stop timeout indefinitely.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
