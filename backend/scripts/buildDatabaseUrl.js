const { URL } = require("node:url");

const databasePartKeys = [
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
];

function buildDatabaseUrl(env = process.env) {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  const missingKeys = databasePartKeys.filter((key) => !env[key]);
  if (missingKeys.length > 0) {
    throw new Error(
      `DATABASE_URL is not set and missing database env vars: ${missingKeys.join(", ")}`,
    );
  }

  const databaseUrl = new URL("postgresql://localhost");
  databaseUrl.username = env.POSTGRES_USER;
  databaseUrl.password = env.POSTGRES_PASSWORD;
  databaseUrl.hostname = env.POSTGRES_HOST;
  databaseUrl.port = env.POSTGRES_PORT;
  databaseUrl.pathname = `/${env.POSTGRES_DB}`;

  return databaseUrl.toString();
}

module.exports = {
  buildDatabaseUrl,
};