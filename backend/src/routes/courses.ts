import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { parseAppointments } from "../services/appointmentParser";

const courseSchema = z.object({
  name: z.string().min(1),
  abbreviation: z.string().min(1).max(50),
  cp: z.number().int().positive(),
  category_id: z.string().uuid().nullable().optional(),
  appointments_raw: z.string().optional().default("")
});

const previewSchema = z.object({
  appointments_raw: z.string().default("")
});

export const coursesRouter = Router();

coursesRouter.get("/", async (_req, res) => {
  const courses = await prisma.course.findMany({
    include: {
      category: true,
      appointments: true
    },
    orderBy: { createdAt: "asc" }
  });

  res.json(courses);
});

coursesRouter.post("/", async (req, res) => {
  const payload = courseSchema.parse(req.body);
  const appointments = parseAppointments(payload.appointments_raw ?? "");

  const course = await prisma.course.create({
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

coursesRouter.post("/preview", async (req, res) => {
  const payload = previewSchema.parse(req.body);
  const appointments = parseAppointments(payload.appointments_raw);

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

coursesRouter.put("/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const payload = courseSchema.parse(req.body);
  const appointments = parseAppointments(payload.appointments_raw ?? "");

  await prisma.course.findUniqueOrThrow({ where: { id } });

  const course = await prisma.$transaction(async (tx: any) => {
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

coursesRouter.delete("/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  await prisma.course.delete({ where: { id } });
  res.status(204).send();
});

coursesRouter.patch("/:id/toggle", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const course = await prisma.course.findUnique({ where: { id } });

  if (!course) {
    throw new HttpError(404, "Kurs nicht gefunden.");
  }

  const updated = await prisma.course.update({
    where: { id },
    data: { isActive: !course.isActive }
  });

  res.json(updated);
});
