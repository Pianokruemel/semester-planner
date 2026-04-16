const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.category.upsert({
    where: { name: "Seminar" },
    update: {},
    create: {
      name: "Seminar",
      color: "#6366F1"
    }
  });

  await prisma.category.upsert({
    where: { name: "Praktikum" },
    update: {},
    create: {
      name: "Praktikum",
      color: "#10B981"
    }
  });

  await prisma.setting.upsert({
    where: { key: "dark_mode" },
    update: {},
    create: { key: "dark_mode", value: "false" }
  });

  await prisma.setting.upsert({
    where: { key: "show_full_name" },
    update: {},
    create: { key: "show_full_name", value: "false" }
  });

  await prisma.setting.upsert({
    where: { key: "active_filters" },
    update: {},
    create: {
      key: "active_filters",
      value: JSON.stringify({
        cp: [],
        hideTypes: [],
        showRoom: true,
        showType: true,
        showTime: true
      })
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
