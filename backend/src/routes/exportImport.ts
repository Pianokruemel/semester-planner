import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { buildIcs } from "../services/icsExporter";

const importSchema = z.object({
  export_version: z.string(),
  settings: z.record(z.string(), z.unknown()),
  categories: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      color: z.string()
    })
  ),
  courses: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      abbreviation: z.string(),
      cp: z.number().int(),
      category_id: z.string().uuid().nullable(),
      is_active: z.boolean(),
      appointments: z.array(
        z.object({
          date: z.string(),
          time_from: z.string(),
          time_to: z.string(),
          room: z.string(),
          type: z.enum(["Vorlesung", "Uebung"])
        })
      )
    })
  )
});

export const exportImportRouter = Router();

exportImportRouter.get("/json", async (_req, res) => {
  const [settingsRows, categories, courses] = await Promise.all([
    prisma.setting.findMany(),
    prisma.category.findMany(),
    prisma.course.findMany({ include: { appointments: true } })
  ]);

  const settings: Record<string, unknown> = {};
  for (const row of settingsRows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }

  res.json({
    export_version: "1.0",
    exported_at: new Date().toISOString(),
    settings,
    categories,
    courses: courses.map((course: (typeof courses)[number]) => ({
      id: course.id,
      name: course.name,
      abbreviation: course.abbreviation,
      cp: course.cp,
      category_id: course.categoryId,
      is_active: course.isActive,
      appointments: course.appointments.map((appointment: (typeof course.appointments)[number]) => ({
        date: appointment.date.toISOString().slice(0, 10),
        time_from: appointment.timeFrom.toISOString().slice(11, 16),
        time_to: appointment.timeTo.toISOString().slice(11, 16),
        room: appointment.room,
        type: appointment.type
      }))
    }))
  });
});

exportImportRouter.post("/json", async (req, res) => {
  const payload = importSchema.parse(req.body);

  await prisma.$transaction(async (tx: any) => {
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
      value:
        currentDarkMode?.value ??
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

exportImportRouter.get("/ics", async (req, res) => {
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
    .filter((value): value is "Vorlesung" | "Uebung" => value === "Vorlesung" || value === "Uebung");

  const settingsRows = await prisma.setting.findMany({ where: { key: { in: ["show_full_name"] } } });
  const showFullNameRow = settingsRows.find((row: (typeof settingsRows)[number]) => row.key === "show_full_name");
  const showFullName = showFullNameRow ? JSON.parse(showFullNameRow.value) === true : false;

  const courses = await prisma.course.findMany({
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

  const ics = buildIcs(
    courses.flatMap((course: (typeof courses)[number]) =>
      course.appointments
        .filter((appointment: (typeof course.appointments)[number]) =>
          types.length > 0 ? types.includes(appointment.type) : true
        )
        .map((appointment: (typeof course.appointments)[number]) => ({
        id: appointment.id,
        courseName: course.name,
        courseAbbreviation: course.abbreviation,
        cp: course.cp,
        categoryName: course.category?.name ?? null,
        date: appointment.date,
        timeFrom: appointment.timeFrom,
        timeTo: appointment.timeTo,
        room: appointment.room
        }))
    ),
    showFullName
  );

  res.header("Content-Type", "text/calendar; charset=utf-8");
  res.header("Content-Disposition", 'attachment; filename="stundenplan.ics"');
  res.send(ics);
});
