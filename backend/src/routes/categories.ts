import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
});

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { courses: true }
      }
    },
    orderBy: { name: "asc" }
  });

  res.json(categories);
});

categoriesRouter.post("/", async (req, res) => {
  const payload = categorySchema.parse(req.body);
  const created = await prisma.category.create({ data: payload });
  res.status(201).json(created);
});

categoriesRouter.put("/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const payload = categorySchema.parse(req.body);

  const updated = await prisma.category.update({
    where: { id },
    data: payload
  });

  res.json(updated);
});

categoriesRouter.delete("/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const confirm = req.query.confirm === "true";

  const affectedCourses = await prisma.course.findMany({
    where: { categoryId: id },
    select: { name: true }
  });

  if (affectedCourses.length > 0 && !confirm) {
    res.status(409).json({
      warning: true,
      affected_courses: affectedCourses.map((course: { name: string }) => course.name),
      message: "Diese Kurse werden auf 'Ohne Kategorie' gesetzt."
    });
    return;
  }

  await prisma.category.delete({ where: { id } });
  res.status(204).send();
});
