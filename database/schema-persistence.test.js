const { execFileSync } = require("child_process");
const { ROOT, hasTestDatabase, createTestPool } = require("./test-database");

const compose = (...args) =>
  execFileSync("docker", ["compose", "-f", "docker-compose.test.yml", ...args], {
    cwd: ROOT,
    stdio: "pipe",
    timeout: 120000,
  });

const hasDocker = () => {
  try {
    return compose("ps", "--status", "running", "-q", "db").toString().trim() !== "";
  } catch {
    return false;
  }
};

// Recrea el contenedor (down sin -v + up) y comprueba que el volumen conserva los datos.
// vitest.config.js desactiva el paralelismo entre archivos para que nadie use la BD mientras tanto.
describe.skipIf(!hasTestDatabase() || !hasDocker())("schema.sql - persistencia", () => {
  it("los datos confirmados sobreviven a recrear el contenedor", async () => {
    const email = `persist-${Date.now()}@example.invalid`;
    const before = createTestPool();
    const { id } = (
      await before.query(
        "INSERT INTO clients (full_name, email, phone) VALUES ('Persistente', $1, '9991234567') RETURNING id",
        [email]
      )
    ).rows[0];
    await before.end();

    compose("down");
    compose("up", "-d", "--wait");

    const after = createTestPool();
    try {
      const { rows } = await after.query("SELECT email FROM clients WHERE id = $1", [id]);
      expect(rows).toEqual([{ email }]);
    } finally {
      await after.query("DELETE FROM clients WHERE id = $1", [id]);
      await after.end();
    }
  }, 180000);
});
