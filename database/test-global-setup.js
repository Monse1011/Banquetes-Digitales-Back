const { useTestDatabase, hasTestDatabase, createTestPool } = require("./test-database");

// schema.sql no trae datos y el código no da de alta servicios; las pruebas de integración
// existentes necesitan al menos un servicio y un rol operativo activos.
module.exports = async function setup() {
  useTestDatabase();
  if (!hasTestDatabase()) return;

  const pool = createTestPool();
  try {
    await pool.query(
      `INSERT INTO services (name, description) VALUES ('Servicio de prueba', 'Catálogo de pruebas')
       ON CONFLICT DO NOTHING`
    );
    await pool.query(
      "INSERT INTO operative_roles (name) VALUES ('Rol de prueba') ON CONFLICT DO NOTHING"
    );
  } catch (error) {
    throw new Error(
      `No se pudo preparar la BD de pruebas (${error.message}). ` +
        "¿Levantaste docker compose -f docker-compose.test.yml up -d --wait?"
    );
  } finally {
    await pool.end();
  }
};
