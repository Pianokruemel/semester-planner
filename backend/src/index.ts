import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { ZodError } from "zod";
import { startScannerIfCatalogEmpty } from "./lib/bootScanner";
import { errorHandler, HttpError, notFoundHandler } from "./middleware/errorHandler";
import { catalogRouter } from "./routes/catalog";
import { plansRouter } from "./routes/plans";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

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

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
  void startScannerIfCatalogEmpty({ port }).catch((error) => {
    console.error("catalog_empty_scanner_boot_check_failed", error);
  });
});
