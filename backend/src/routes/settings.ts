import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const appointmentTypeSchema = z.enum(["Vorlesung", "Uebung"]);

const defaultActiveFilters = {
  cp: [] as number[],
  hideTypes: [] as Array<z.infer<typeof appointmentTypeSchema>>,
  showRoom: true,
  showType: true,
  showTime: true,
  showTotalCp: true
};

type ActiveFilters = typeof defaultActiveFilters;

function normalizeActiveFilters(input: unknown): ActiveFilters {
  const parsed = z.record(z.string(), z.unknown()).safeParse(input);
  if (!parsed.success) {
    return { ...defaultActiveFilters };
  }

  const source = parsed.data;

  const cp = Array.isArray(source.cp)
    ? source.cp
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : defaultActiveFilters.cp;

  const hideTypesSource =
    Array.isArray(source.hideTypes) && source.hideTypes.length >= 0
      ? source.hideTypes
      : Array.isArray(source.types)
        ? source.types
        : [];

  const hideTypes = hideTypesSource.filter(
    (value): value is z.infer<typeof appointmentTypeSchema> => value === "Vorlesung" || value === "Uebung"
  );

  return {
    cp,
    hideTypes,
    showRoom: typeof source.showRoom === "boolean" ? source.showRoom : defaultActiveFilters.showRoom,
    showType: typeof source.showType === "boolean" ? source.showType : defaultActiveFilters.showType,
    showTime: typeof source.showTime === "boolean" ? source.showTime : defaultActiveFilters.showTime,
    showTotalCp: typeof source.showTotalCp === "boolean" ? source.showTotalCp : defaultActiveFilters.showTotalCp
  };
}

const settingsSchema = z.object({
  dark_mode: z.boolean(),
  show_full_name: z.boolean(),
  active_filters: z.unknown().optional().default(defaultActiveFilters)
});

const partialSettingsSchema = z
  .object({
    dark_mode: z.boolean().optional(),
    show_full_name: z.boolean().optional(),
    active_filters: z.unknown().optional()
  })
  .refine(
    (value) =>
      value.dark_mode !== undefined || value.show_full_name !== undefined || value.active_filters !== undefined,
    "At least one setting key must be provided."
  );

async function readSettingsFromDb() {
  const settings = await prisma.setting.findMany();
  const result: Record<string, unknown> = {};

  for (const setting of settings) {
    try {
      const parsedValue = JSON.parse(setting.value);
      result[setting.key] = setting.key === "active_filters" ? normalizeActiveFilters(parsedValue) : parsedValue;
    } catch {
      result[setting.key] = setting.key === "active_filters" ? normalizeActiveFilters(undefined) : setting.value;
    }
  }

  return {
    dark_mode: typeof result.dark_mode === "boolean" ? result.dark_mode : false,
    show_full_name: typeof result.show_full_name === "boolean" ? result.show_full_name : false,
    active_filters: normalizeActiveFilters(result.active_filters)
  };
}

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  const settings = await readSettingsFromDb();
  res.json(settings);
});

settingsRouter.put("/", async (req, res) => {
  const payload = settingsSchema.parse(req.body);
  const activeFilters = normalizeActiveFilters(payload.active_filters);

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: "dark_mode" },
      update: { value: JSON.stringify(payload.dark_mode) },
      create: { key: "dark_mode", value: JSON.stringify(payload.dark_mode) }
    }),
    prisma.setting.upsert({
      where: { key: "show_full_name" },
      update: { value: JSON.stringify(payload.show_full_name) },
      create: { key: "show_full_name", value: JSON.stringify(payload.show_full_name) }
    }),
    prisma.setting.upsert({
      where: { key: "active_filters" },
      update: { value: JSON.stringify(activeFilters) },
      create: { key: "active_filters", value: JSON.stringify(activeFilters) }
    })
  ]);

  res.status(204).send();
});

settingsRouter.patch("/", async (req, res) => {
  const payload = partialSettingsSchema.parse(req.body);
  const operations: Array<ReturnType<typeof prisma.setting.upsert>> = [];

  if (payload.dark_mode !== undefined) {
    operations.push(
      prisma.setting.upsert({
        where: { key: "dark_mode" },
        update: { value: JSON.stringify(payload.dark_mode) },
        create: { key: "dark_mode", value: JSON.stringify(payload.dark_mode) }
      })
    );
  }

  if (payload.show_full_name !== undefined) {
    operations.push(
      prisma.setting.upsert({
        where: { key: "show_full_name" },
        update: { value: JSON.stringify(payload.show_full_name) },
        create: { key: "show_full_name", value: JSON.stringify(payload.show_full_name) }
      })
    );
  }

  if (payload.active_filters !== undefined) {
    const currentSettings = await readSettingsFromDb();
    const parsedActiveFilters = z.record(z.string(), z.unknown()).safeParse(payload.active_filters);
    const nextActiveFilters = parsedActiveFilters.success
      ? normalizeActiveFilters({ ...currentSettings.active_filters, ...parsedActiveFilters.data })
      : currentSettings.active_filters;

    operations.push(
      prisma.setting.upsert({
        where: { key: "active_filters" },
        update: { value: JSON.stringify(nextActiveFilters) },
        create: { key: "active_filters", value: JSON.stringify(nextActiveFilters) }
      })
    );
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  res.status(204).send();
});
