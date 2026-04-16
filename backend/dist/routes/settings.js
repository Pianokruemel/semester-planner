"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const appointmentTypeSchema = zod_1.z.enum(["Vorlesung", "Uebung"]);
const defaultActiveFilters = {
    cp: [],
    hideTypes: [],
    showRoom: true,
    showType: true,
    showTime: true
};
function normalizeActiveFilters(input) {
    const parsed = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).safeParse(input);
    if (!parsed.success) {
        return { ...defaultActiveFilters };
    }
    const source = parsed.data;
    const cp = Array.isArray(source.cp)
        ? source.cp
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
        : defaultActiveFilters.cp;
    const hideTypesSource = Array.isArray(source.hideTypes) && source.hideTypes.length >= 0
        ? source.hideTypes
        : Array.isArray(source.types)
            ? source.types
            : [];
    const hideTypes = hideTypesSource.filter((value) => value === "Vorlesung" || value === "Uebung");
    return {
        cp,
        hideTypes,
        showRoom: typeof source.showRoom === "boolean" ? source.showRoom : defaultActiveFilters.showRoom,
        showType: typeof source.showType === "boolean" ? source.showType : defaultActiveFilters.showType,
        showTime: typeof source.showTime === "boolean" ? source.showTime : defaultActiveFilters.showTime
    };
}
const settingsSchema = zod_1.z.object({
    dark_mode: zod_1.z.boolean(),
    show_full_name: zod_1.z.boolean(),
    active_filters: zod_1.z.unknown().optional().default(defaultActiveFilters)
});
exports.settingsRouter = (0, express_1.Router)();
exports.settingsRouter.get("/", async (_req, res) => {
    const settings = await prisma_1.prisma.setting.findMany();
    const result = {};
    for (const setting of settings) {
        try {
            const parsedValue = JSON.parse(setting.value);
            result[setting.key] = setting.key === "active_filters" ? normalizeActiveFilters(parsedValue) : parsedValue;
        }
        catch {
            result[setting.key] = setting.key === "active_filters" ? normalizeActiveFilters(undefined) : setting.value;
        }
    }
    if (result.active_filters === undefined) {
        result.active_filters = normalizeActiveFilters(undefined);
    }
    res.json(result);
});
exports.settingsRouter.put("/", async (req, res) => {
    const payload = settingsSchema.parse(req.body);
    const activeFilters = normalizeActiveFilters(payload.active_filters);
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.setting.upsert({
            where: { key: "dark_mode" },
            update: { value: JSON.stringify(payload.dark_mode) },
            create: { key: "dark_mode", value: JSON.stringify(payload.dark_mode) }
        }),
        prisma_1.prisma.setting.upsert({
            where: { key: "show_full_name" },
            update: { value: JSON.stringify(payload.show_full_name) },
            create: { key: "show_full_name", value: JSON.stringify(payload.show_full_name) }
        }),
        prisma_1.prisma.setting.upsert({
            where: { key: "active_filters" },
            update: { value: JSON.stringify(activeFilters) },
            create: { key: "active_filters", value: JSON.stringify(activeFilters) }
        })
    ]);
    res.status(204).send();
});
//# sourceMappingURL=settings.js.map