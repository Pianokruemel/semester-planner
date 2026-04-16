"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const categories_1 = require("./routes/categories");
const courses_1 = require("./routes/courses");
const exportImport_1 = require("./routes/exportImport");
const settings_1 = require("./routes/settings");
const errorHandler_1 = require("./middleware/errorHandler");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = Number(process.env.PORT ?? 4000);
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "2mb" }));
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.use("/api/courses", courses_1.coursesRouter);
app.use("/api/categories", categories_1.categoriesRouter);
app.use("/api/settings", settings_1.settingsRouter);
app.use("/api/export", exportImport_1.exportImportRouter);
app.use("/api/import", exportImport_1.exportImportRouter);
app.use(errorHandler_1.notFoundHandler);
app.use((error, req, res, next) => {
    if (error instanceof zod_1.ZodError) {
        next(new errorHandler_1.HttpError(400, error.issues.map((issue) => issue.message).join("; ")));
        return;
    }
    next(error);
});
app.use(errorHandler_1.errorHandler);
app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
});
//# sourceMappingURL=index.js.map