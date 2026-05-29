const { spawnSync } = require("node:child_process");

const { buildDatabaseUrl } = require("./buildDatabaseUrl");

function commandName(command) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

function runSync(command, args, env) {
  const result = spawnSync(commandName(command), args, {
    env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 0) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  process.env.DATABASE_URL = buildDatabaseUrl();

  runSync("npx", ["prisma", "migrate", "deploy"], process.env);

  require("../dist/index.js");
}

main();
