"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
class HttpError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.HttpError = HttpError;
function notFoundHandler(_req, res) {
    res.status(404).json({ message: "Nicht gefunden" });
}
function errorHandler(error, _req, res, _next) {
    if (error instanceof HttpError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }
    console.error(error);
    res.status(500).json({ message: "Interner Serverfehler" });
}
//# sourceMappingURL=errorHandler.js.map