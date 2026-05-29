const { spawn, spawnSync } = require("node:child_process");

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

  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }

  if ((result.status ?? 0) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runDev(env) {
  const child = spawn(commandName("npm"), ["run", "dev"], {
    env,
    stdio: "inherit",
  });

  ["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, () => {
      if (!child.killed) {
        child.kill(signal);
      }
    });
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

function main() {
  const env = {
    ...process.env,
    DATABASE_URL: buildDatabaseUrl(),
  };

  runSync("npx", ["prisma", "db", "push"], env);
  runSync("npm", ["run", "seed"], env);
  runDev(env);
}

main();
