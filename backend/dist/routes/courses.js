"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coursesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const appointmentParser_1 = require("../services/appointmentParser");
const courseSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    abbreviation: zod_1.z.string().min(1).max(50),
    cp: zod_1.z.number().int().positive(),
    category_id: zod_1.z.string().uuid().nullable().optional(),
    appointments_raw: zod_1.z.string().optional().default("")
});
const previewSchema = zod_1.z.object({
    appointments_raw: zod_1.z.string().default("")
});
exports.coursesRouter = (0, express_1.Router)();
exports.coursesRouter.get("/", async (_req, res) => {
    const courses = await prisma_1.prisma.course.findMany({
        include: {
            category: true,
            appointments: true
        },
        orderBy: { createdAt: "asc" }
    });
    res.json(courses);
});
exports.coursesRouter.post("/", async (req, res) => {
    const payload = courseSchema.parse(req.body);
    const appointments = (0, appointmentParser_1.parseAppointments)(payload.appointments_raw ?? "");
    const course = await prisma_1.prisma.course.create({
        data: {
            name: payload.name,
            abbreviation: payload.abbreviation,
            cp: payload.cp,
            categoryId: payload.category_id ?? null,
            appointments: {
                createMany: {
                    data: appointments.map((appointment) => ({
                        date: appointment.date,
                        timeFrom: appointment.timeFrom,
                        timeTo: appointment.timeTo,
                        room: appointment.room,
                        type: appointment.type
                    }))
                }
            }
        },
        include: {
            category: true,
            appointments: true
        }
    });
    res.status(201).json(course);
});
exports.coursesRouter.post("/preview", async (req, res) => {
    const payload = previewSchema.parse(req.body);
    const appointments = (0, appointmentParser_1.parseAppointments)(payload.appointments_raw);
    if (appointments.length === 0) {
        res.json({
            count: 0,
            date_from: null,
            date_to: null,
            types: []
        });
        return;
    }
    const orderedDates = appointments
        .map((appointment) => appointment.date)
        .sort((a, b) => a.getTime() - b.getTime());
    const types = Array.from(new Set(appointments.map((appointment) => appointment.type)));
    res.json({
        count: appointments.length,
        date_from: orderedDates[0]?.toISOString().slice(0, 10) ?? null,
        date_to: orderedDates[orderedDates.length - 1]?.toISOString().slice(0, 10) ?? null,
        types
    });
});
exports.coursesRouter.put("/:id", async (req, res) => {
    const id = zod_1.z.string().uuid().parse(req.params.id);
    const payload = courseSchema.parse(req.body);
    const appointments = (0, appointmentParser_1.parseAppointments)(payload.appointments_raw ?? "");
    await prisma_1.prisma.course.findUniqueOrThrow({ where: { id } });
    const course = await prisma_1.prisma.$transaction(async (tx) => {
        await tx.appointment.deleteMany({ where: { courseId: id } });
        return tx.course.update({
            where: { id },
            data: {
                name: payload.name,
                abbreviation: payload.abbreviation,
                cp: payload.cp,
                categoryId: payload.category_id ?? null,
                appointments: {
                    createMany: {
                        data: appointments.map((appointment) => ({
                            date: appointment.date,
                            timeFrom: appointment.timeFrom,
                            timeTo: appointment.timeTo,
                            room: appointment.room,
                            type: appointment.type
                        }))
                    }
                }
            },
            include: {
                category: true,
                appointments: true
            }
        });
    });
    res.json(course);
});
exports.coursesRouter.delete("/:id", async (req, res) => {
    const id = zod_1.z.string().uuid().parse(req.params.id);
    await prisma_1.prisma.course.delete({ where: { id } });
    res.status(204).send();
});
exports.coursesRouter.patch("/:id/toggle", async (req, res) => {
    const id = zod_1.z.string().uuid().parse(req.params.id);
    const course = await prisma_1.prisma.course.findUnique({ where: { id } });
    if (!course) {
        throw new errorHandler_1.HttpError(404, "Kurs nicht gefunden.");
    }
    const updated = await prisma_1.prisma.course.update({
        where: { id },
        data: { isActive: !course.isActive }
    });
    res.json(updated);
});
//# sourceMappingURL=courses.js.map