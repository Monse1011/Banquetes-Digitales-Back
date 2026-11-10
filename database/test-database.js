const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

const ROOT = path.join(__dirname, "..");

// Apunta las pruebas de integración al contenedor de docker-compose.test.yml. Solo se leen las
// variables TEST_PG* de .env (el resto del entorno de desarrollo no se carga) y se copian a las
// PG* que usa `pg`. Sin TEST_PGHOST (p. ej. en CI) no se toca nada y esas pruebas se omiten.
function useTestDatabase() {
  const envFile = path.join(ROOT, ".env");
  const fileEnv = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
  const env = { ...fileEnv, ...process.env };

  if (!env.TEST_PGHOST || !env.TEST_PGDATABASE) return;

  Object.assign(process.env, {
    TEST_PGDATABASE: env.TEST_PGDATABASE,
    PGHOST: env.TEST_PGHOST,
    PGPORT: env.TEST_PGPORT ?? "5432",
    PGUSER: env.TEST_PGUSER ?? "",
    PGPASSWORD: env.TEST_PGPASSWORD ?? "",
  });
}

const hasTestDatabase = () => Boolean(process.env.TEST_PGDATABASE);

const createTestPool = (options = {}) =>
  new Pool({ database: process.env.TEST_PGDATABASE, ...options });

module.exports = { ROOT, useTestDatabase, hasTestDatabase, createTestPool };
