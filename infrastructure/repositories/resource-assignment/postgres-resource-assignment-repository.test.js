const { Pool } = require("pg");
const { randomUUID } = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const {
  PostgresResourceAssignmentRepository,
} = require("./postgres-resource-assignment-repository");
const {
  PostgresResourceConfirmationRepository,
} = require("./postgres-resource-confirmation-repository");
const {
  PostgresTransactionManager,
} = require("../../services/transaction/postgres-transaction-manager");
const {
  ResourceAssignment,
} = require("../../../domain/entities/resource-assignment/resource-assignment");
const {
  ResourceConfirmation,
} = require("../../../domain/entities/resource-assignment/resource-confirmation");
const { AssignmentStatus } = require("../../../domain/enums/resource-assignment/assignment-status");
const {
  ResourceSufficiency,
} = require("../../../domain/enums/resource-assignment/resource-sufficiency");

describe.skipIf(!process.env.TEST_PGDATABASE)("PostgreSQL resource-assignment repositories", () => {
  let admin;
  let pool;
  let schema;
  let assignments;
  let confirmations;
  let transactions;
  const start = new Date("2035-06-01T20:00:00Z");
  const end = new Date("2035-06-01T23:00:00Z");

  beforeEach(async () => {
    schema = `resource_assignment_test_${randomUUID().replaceAll("-", "")}`;
    admin = new Pool({ database: process.env.TEST_PGDATABASE });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({
      database: process.env.TEST_PGDATABASE,
      options: `-c search_path=${schema} -c statement_timeout=5000`,
    });
    // Esquema real (database/schema.sql) instalado en el esquema aislado de esta prueba.
    await pool.query(
      await fs.readFile(path.join(__dirname, "../../../database/schema.sql"), "utf8")
    );
    await pool.query(`
      INSERT INTO users (id_user, id_employee, full_name, email, password_hash, role)
        OVERRIDING SYSTEM VALUE VALUES (7, 'T7', 'Logistica', 'l7@example.invalid', 'x', 'LOGISTICS');
      INSERT INTO clients (full_name, email, phone) VALUES ('Cliente', 'c@example.invalid', '9991234567');
      INSERT INTO resources (id, name, type, total_quantity, unit_cost) OVERRIDING SYSTEM VALUE
        VALUES (10, 'Sillas', 'MATERIAL', 10, 1), (11, 'Mesas', 'MATERIAL', 10, 1);
      INSERT INTO reservations_request
        (id, folio, client_id, event_date, event_time, event_end_time, guest_count, event_address)
        OVERRIDING SYSTEM VALUE
        VALUES (1, 'BD-2035-00001', 1, '2035-06-01', '14:00', '2035-06-01T23:00:00Z', 10, 'Lugar');
    `);
    assignments = new PostgresResourceAssignmentRepository(pool);
    confirmations = new PostgresResourceConfirmationRepository(pool);
    transactions = new PostgresTransactionManager(pool);
  });

  afterEach(async () => {
    if (pool) await pool.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  });

  function assignment(resourceId, quantity = 1) {
    return new ResourceAssignment(
      null,
      1,
      resourceId,
      quantity,
      quantity,
      2,
      ResourceSufficiency.SUFFICIENT,
      AssignmentStatus.PROVISIONAL,
      start,
      end,
      start,
      end,
      "revisar",
      7,
      new Date(),
      null,
      null
    );
  }

  it("persists provisional and confirmed assignments and their release history", async () => {
    const first = assignment(10);
    const second = assignment(11);
    const saved = await assignments.saveProvisional([first, second], []);
    expect(saved.map((item) => item.id)).toEqual([1, 2]);

    const [confirmed] = await assignments.findByRequest(1);
    confirmed.confirm(2, 7, new Date());
    await assignments.confirm([confirmed], [saved[1].id], []);

    expect(await assignments.findByRequest(1)).toMatchObject([
      { id: saved[0].id, status: AssignmentStatus.CONFIRMED, confirmedByUserId: 7 },
    ]);
    const history = await pool.query("SELECT id, status FROM assigned_resources ORDER BY id");
    expect(history.rows).toEqual([
      { id: "1", status: AssignmentStatus.CONFIRMED },
      { id: "2", status: AssignmentStatus.RELEASED },
    ]);
  });

  it("releaseByRequestId libera las asignaciones activas dentro de la transacción (NC-01)", async () => {
    await assignments.saveProvisional([assignment(10), assignment(11)], []);
    const [confirmed] = await assignments.findByRequest(1);
    confirmed.confirm(2, 7, new Date());
    await assignments.confirm([confirmed], [], []);

    const released = await assignments.releaseByRequestId(1);
    expect(released).toHaveLength(2);
    const history = await pool.query("SELECT status FROM assigned_resources ORDER BY id");
    expect(history.rows.map((row) => row.status)).toEqual([
      AssignmentStatus.RELEASED,
      AssignmentStatus.RELEASED,
    ]);
  });

  it("rolls back assignment writes with their surrounding transaction", async () => {
    await expect(
      transactions.run(async (transaction) => {
        await assignments.saveProvisional([assignment(10)], [], transaction);
        throw new Error("rollback test");
      })
    ).rejects.toThrow("rollback test");

    expect(await assignments.findByRequest(1)).toEqual([]);
  });

  it("persists confirmation history and pending observations", async () => {
    const confirmation = new ResourceConfirmation(
      1,
      7,
      new Date(),
      "Asignada",
      "Coordinación Lista",
      2,
      0,
      "confirmado"
    );
    await confirmations.create(confirmation);
    await confirmations.savePendingObservations(1, "pendiente");

    expect(await confirmations.findLatestByRequest(1)).toMatchObject({
      requestId: 1,
      confirmedByUserId: 7,
      sufficientResources: 2,
      observations: "confirmado",
    });
    expect(await confirmations.findPendingObservations(1)).toBe("pendiente");

    await confirmations.deletePendingObservations(1);
    expect(await confirmations.findPendingObservations(1)).toBeNull();
  });
});
