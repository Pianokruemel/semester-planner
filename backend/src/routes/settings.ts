import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const appointmentTypeSchema = z.enum(["Vorlesung", "Uebung"]);

const defaultActiveFilters = {
  cp: [] as number[],
  hideTypes: [] as Array<z.infer<typeof appointmentTypeSchema>>,
  showRoom: true,
  showType: true,
  showTime: true
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
    showTime: typeof source.showTime === "boolean" ? source.showTime : defaultActiveFilters.showTime
  };
}

const settingsSchema = z.object({
  dark_mode: z.boolean(),
  show_full_name: z.boolean(),
  active_filters: z.unknown().optional().default(defaultActiveFilters)
});

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
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

  if (result.active_filters === undefined) {
    result.active_filters = normalizeActiveFilters(undefined);
  }

  res.json(result);
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
