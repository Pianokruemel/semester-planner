"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAppointments = parseAppointments;
const errorHandler_1 = require("../middleware/errorHandler");
const monthMap = {
    "Jan.": 1,
    "Feb.": 2,
    "Mar.": 3,
    "Mär.": 3,
    "Apr.": 4,
    Mai: 5,
    "Jun.": 6,
    "Jul.": 7,
    "Aug.": 8,
    "Sep.": 9,
    "Okt.": 10,
    "Nov.": 11,
    "Dez.": 12
};
function parseGermanDate(raw, lineNumber) {
    const hasAsterisk = raw.trim().endsWith("*");
    const cleaned = raw.replace(/\*$/, "").trim();
    const match = cleaned.match(/^[^,]+,\s*(\d{1,2})\.\s*([A-Za-zäÄöÖüÜß\.]+)\s+(\d{4})$/);
    if (!match) {
        throw new errorHandler_1.HttpError(400, `Ungültiges Datumsformat in Zeile ${lineNumber}.`);
    }
    const day = Number(match[1]);
    const monthToken = match[2];
    const year = Number(match[3]);
    const month = monthMap[monthToken];
    if (!month) {
        throw new errorHandler_1.HttpError(400, `Unbekannter Monat '${monthToken}' in Zeile ${lineNumber}.`);
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    return { date, hasAsterisk };
}
function parseTime(raw, lineNumber) {
    const match = raw.trim().match(/^(\d{2}):(\d{2})$/);
    if (!match) {
        throw new errorHandler_1.HttpError(400, `Ungültige Uhrzeit in Zeile ${lineNumber}.`);
    }
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) {
        throw new errorHandler_1.HttpError(400, `Ungültige Uhrzeit in Zeile ${lineNumber}.`);
    }
    return new Date(Date.UTC(1970, 0, 1, hour, minute, 0));
}
function stripMarkdownLink(value) {
    const match = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!match) {
        return value.trim();
    }
    return match[1].trim();
}
function tokenizeRow(line) {
    const tabSplit = line
        .split("\t")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    if (tabSplit.length >= 4) {
        return tabSplit;
    }
    return line
        .trim()
        .split(/\s{2,}/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}
function isHeaderRow(columns) {
    const lowered = columns.map((value) => value.toLowerCase());
    return (lowered.some((value) => value.includes("datum")) &&
        lowered.some((value) => value.includes("von")) &&
        lowered.some((value) => value.includes("bis")) &&
        lowered.some((value) => value.includes("raum")));
}
function extractFields(row) {
    const timeIndexes = row.columns
        .map((value, index) => (value.match(/^\d{2}:\d{2}$/) ? index : -1))
        .filter((index) => index >= 0);
    if (timeIndexes.length < 2) {
        throw new errorHandler_1.HttpError(400, `Ungueltige Zeile ${row.lineNumber}: Von/Bis Zeit fehlt.`);
    }
    const fromIndex = timeIndexes[0];
    const toIndex = timeIndexes[1];
    if (toIndex <= fromIndex) {
        throw new errorHandler_1.HttpError(400, `Ungueltige Zeile ${row.lineNumber}: Von/Bis Zeitreihenfolge ungueltig.`);
    }
    const hasIndexColumn = fromIndex >= 2 && /^\d+$/.test(row.columns[0] ?? "");
    const dateStart = hasIndexColumn ? 1 : 0;
    const dateRaw = row.columns.slice(dateStart, fromIndex).join(" ").trim();
    const fromRaw = row.columns[fromIndex] ?? "";
    const toRaw = row.columns[toIndex] ?? "";
    const roomRaw = row.columns[toIndex + 1] ?? "";
    if (!dateRaw) {
        throw new errorHandler_1.HttpError(400, `Ungueltige Zeile ${row.lineNumber}: Datum fehlt.`);
    }
    if (!roomRaw) {
        throw new errorHandler_1.HttpError(400, `Ungueltige Zeile ${row.lineNumber}: Raum fehlt.`);
    }
    return { dateRaw, fromRaw, toRaw, roomRaw };
}
function parseAppointments(rawText) {
    const lines = rawText
        .split(/\r?\n/)
        .map((line, index) => ({ rawLine: line, lineNumber: index + 1 }))
        .filter((line) => line.rawLine.trim().length > 0);
    if (lines.length === 0) {
        return [];
    }
    const tokenizedRows = lines
        .map((line) => ({
        rawLine: line.rawLine,
        lineNumber: line.lineNumber,
        columns: tokenizeRow(line.rawLine)
    }))
        .filter((row) => row.columns.length > 0);
    const rows = tokenizedRows.filter((row, index) => !(index === 0 && isHeaderRow(row.columns)));
    if (rows.length === 0) {
        return [];
    }
    const parsed = [];
    for (const row of rows) {
        const { dateRaw, fromRaw, toRaw, roomRaw } = extractFields(row);
        const { date, hasAsterisk } = parseGermanDate(dateRaw, row.lineNumber);
        const timeFrom = parseTime(fromRaw, row.lineNumber);
        const timeTo = parseTime(toRaw, row.lineNumber);
        const room = stripMarkdownLink(roomRaw);
        parsed.push({
            date,
            timeFrom,
            timeTo,
            room,
            hasAsterisk
        });
    }
    const hasAnyAsterisk = parsed.some((item) => item.hasAsterisk);
    return parsed.map((item) => ({
        date: item.date,
        timeFrom: item.timeFrom,
        timeTo: item.timeTo,
        room: item.room,
        type: hasAnyAsterisk
            ? item.hasAsterisk
                ? "Vorlesung"
                : "Uebung"
            : "Vorlesung"
    }));
}
//# sourceMappingURL=appointmentParser.js.map