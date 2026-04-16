"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIcs = buildIcs;
const ics_1 = require("ics");
function dateArrayFromParts(date, time) {
    return [
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        time.getUTCHours(),
        time.getUTCMinutes()
    ];
}
function buildIcs(appointments, showFullName) {
    const events = appointments.map((appointment) => ({
        uid: `${appointment.id}@stundenplan`,
        title: showFullName ? appointment.courseName : appointment.courseAbbreviation,
        start: dateArrayFromParts(appointment.date, appointment.timeFrom),
        end: dateArrayFromParts(appointment.date, appointment.timeTo),
        location: appointment.room,
        description: `Kategorie: ${appointment.categoryName ?? "Ohne Kategorie"} | CP: ${appointment.cp}`,
        startInputType: "local",
        startOutputType: "local",
        endInputType: "local",
        endOutputType: "local"
    }));
    const result = (0, ics_1.createEvents)(events);
    if (result.error) {
        throw result.error;
    }
    if (!result.value) {
        throw new Error("ICS konnte nicht erstellt werden.");
    }
    return result.value;
}
//# sourceMappingURL=icsExporter.js.map