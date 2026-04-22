"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportImportRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const icsExporter_1 = require("../services/icsExporter");
const importSchema = zod_1.z.object({
    export_version: zod_1.z.string(),
    settings: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    categories: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
        color: zod_1.z.string()
    })),
    courses: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
        abbreviation: zod_1.z.string(),
        cp: zod_1.z.number().int(),
        category_id: zod_1.z.string().uuid().nullable(),
        is_active: zod_1.z.boolean(),
        appointments: zod_1.z.array(zod_1.z.object({
            date: zod_1.z.string(),
            time_from: zod_1.z.string(),
            time_to: zod_1.z.string(),
            room: zod_1.z.string(),
            type: zod_1.z.enum(["Vorlesung", "Uebung"])
        }))
    }))
});
exports.exportImportRouter = (0, express_1.Router)();
exports.exportImportRouter.get("/json", async (_req, res) => {
    const [settingsRows, categories, courses] = await Promise.all([
        prisma_1.prisma.setting.findMany(),
        prisma_1.prisma.category.findMany(),
        prisma_1.prisma.course.findMany({ include: { appointments: true } })
    ]);
    const settings = {};
    for (const row of settingsRows) {
        try {
            settings[row.key] = JSON.parse(row.value);
        }
        catch {
            settings[row.key] = row.value;
        }
    }
    res.json({
        export_version: "1.0",
        exported_at: new Date().toISOString(),
        settings,
        categories,
        courses: courses.map((course) => ({
            id: course.id,
            name: course.name,
            abbreviation: course.abbreviation,
            cp: course.cp,
            category_id: course.categoryId,
            is_active: course.isActive,
            appointments: course.appointments.map((appointment) => ({
                date: appointment.date.toISOString().slice(0, 10),
                time_from: appointment.timeFrom.toISOString().slice(11, 16),
                time_to: appointment.timeTo.toISOString().slice(11, 16),
                room: appointment.room,
                type: appointment.type
            }))
        }))
    });
});
exports.exportImportRouter.post("/json", async (req, res) => {
    const payload = importSchema.parse(req.body);
    await prisma_1.prisma.$transaction(async (tx) => {
        const currentDarkMode = await tx.setting.findUnique({ where: { key: "dark_mode" } });
        await tx.appointment.deleteMany();
        await tx.course.deleteMany();
        await tx.category.deleteMany();
        await tx.setting.deleteMany();
        await tx.category.createMany({
            data: payload.categories.map((category) => ({
                id: category.id,
                name: category.name,
                color: category.color
            }))
        });
        for (const course of payload.courses) {
            await tx.course.create({
                data: {
                    id: course.id,
                    name: course.name,
                    abbreviation: course.abbreviation,
                    cp: course.cp,
                    categoryId: course.category_id,
                    isActive: course.is_active,
                    appointments: {
                        createMany: {
                            data: course.appointments.map((appointment) => {
                                const [fromHour, fromMinute] = appointment.time_from.split(":").map(Number);
                                const [toHour, toMinute] = appointment.time_to.split(":").map(Number);
                                return {
                                    date: new Date(`${appointment.date}T00:00:00.000Z`),
                                    timeFrom: new Date(Date.UTC(1970, 0, 1, fromHour, fromMinute, 0)),
                                    timeTo: new Date(Date.UTC(1970, 0, 1, toHour, toMinute, 0)),
                                    room: appointment.room,
                                    type: appointment.type
                                };
                            })
                        }
                    }
                }
            });
        }
        const settingRows = Object.entries(payload.settings)
            .filter(([key]) => key !== "dark_mode")
            .map(([key, value]) => ({
            key,
            value: JSON.stringify(value)
        }));
        settingRows.push({
            key: "dark_mode",
            value: currentDarkMode?.value ??
                (typeof payload.settings.dark_mode === "boolean" ? JSON.stringify(payload.settings.dark_mode) : "false")
        });
        const deduplicatedSettings = settingRows.map(({ key, value }) => ({
            key,
            value
        }));
        if (deduplicatedSettings.length > 0) {
            await tx.setting.createMany({
                data: deduplicatedSettings
            });
        }
    });
    res.status(204).send();
});
exports.exportImportRouter.get("/ics", async (req, res) => {
    const cpQuery = typeof req.query.cp === "string" ? req.query.cp : "";
    const typesQuery = typeof req.query.types === "string" ? req.query.types : "";
    const courseIdsQuery = typeof req.query.courses === "string" ? req.query.courses : "";
    const cpValues = cpQuery
        .split(",")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
    const courseIds = courseIdsQuery
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    const types = typesQuery
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value === "Vorlesung" || value === "Uebung");
    const settingsRows = await prisma_1.prisma.setting.findMany({ where: { key: { in: ["show_full_name"] } } });
    const showFullNameRow = settingsRows.find((row) => row.key === "show_full_name");
    const showFullName = showFullNameRow ? JSON.parse(showFullNameRow.value) === true : false;
    const courses = await prisma_1.prisma.course.findMany({
        where: {
            isActive: true,
            ...(cpValues.length > 0 ? { cp: { in: cpValues } } : {}),
            ...(courseIds.length > 0 ? { id: { in: courseIds } } : {})
        },
        include: {
            category: true,
            appointments: true
        }
    });
    const ics = (0, icsExporter_1.buildIcs)(courses.flatMap((course) => course.appointments
        .filter((appointment) => types.length > 0 ? types.includes(appointment.type) : true)
        .map((appointment) => ({
        id: appointment.id,
        courseName: course.name,
        courseAbbreviation: course.abbreviation,
        cp: course.cp,
        categoryName: course.category?.name ?? null,
        date: appointment.date,
        timeFrom: appointment.timeFrom,
        timeTo: appointment.timeTo,
        room: appointment.room
    }))), showFullName);
    res.header("Content-Type", "text/calendar; charset=utf-8");
    res.header("Content-Disposition", 'attachment; filename="stundenplan.ics"');
    res.send(ics);
});
//# sourceMappingURL=exportImport.js.map