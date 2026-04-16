"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    color: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/)
});
exports.categoriesRouter = (0, express_1.Router)();
exports.categoriesRouter.get("/", async (_req, res) => {
    const categories = await prisma_1.prisma.category.findMany({
        include: {
            _count: {
                select: { courses: true }
            }
        },
        orderBy: { name: "asc" }
    });
    res.json(categories);
});
exports.categoriesRouter.post("/", async (req, res) => {
    const payload = categorySchema.parse(req.body);
    const created = await prisma_1.prisma.category.create({ data: payload });
    res.status(201).json(created);
});
exports.categoriesRouter.put("/:id", async (req, res) => {
    const id = zod_1.z.string().uuid().parse(req.params.id);
    const payload = categorySchema.parse(req.body);
    const updated = await prisma_1.prisma.category.update({
        where: { id },
        data: payload
    });
    res.json(updated);
});
exports.categoriesRouter.delete("/:id", async (req, res) => {
    const id = zod_1.z.string().uuid().parse(req.params.id);
    const confirm = req.query.confirm === "true";
    const affectedCourses = await prisma_1.prisma.course.findMany({
        where: { categoryId: id },
        select: { name: true }
    });
    if (affectedCourses.length > 0 && !confirm) {
        res.status(409).json({
            warning: true,
            affected_courses: affectedCourses.map((course) => course.name),
            message: "Diese Kurse werden auf 'Ohne Kategorie' gesetzt."
        });
        return;
    }
    await prisma_1.prisma.category.delete({ where: { id } });
    res.status(204).send();
});
//# sourceMappingURL=categories.js.map