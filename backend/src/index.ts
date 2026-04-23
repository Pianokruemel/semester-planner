import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { ZodError } from "zod";
import { errorHandler, HttpError, notFoundHandler } from "./middleware/errorHandler";
import { sharesRouter } from "./routes/shares";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/shares", sharesRouter);

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
});
