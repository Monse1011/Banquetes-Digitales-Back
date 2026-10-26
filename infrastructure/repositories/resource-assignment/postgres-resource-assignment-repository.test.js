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
    await pool.query(`
      CREATE TABLE users (id_user BIGINT PRIMARY KEY);
      CREATE TABLE resources (id BIGINT PRIMARY KEY);
      CREATE TABLE reservations_request (
        id_reservation_request BIGINT PRIMARY KEY,
        event_date_time TIMESTAMP NOT NULL,
        event_end_time TIMESTAMP NOT NULL
      );
      INSERT INTO users VALUES (7);
      INSERT INTO resources VALUES (10), (11);
      INSERT INTO reservations_request VALUES (1, '2035-06-01 20:00:00', '2035-06-01 23:00:00');
    `);
    // Esquema heredado de increment-2 y luego la alineación al DAD v3.0, que renombra sus columnas.
    for (const migration of [
      "increment-2/assigned-resources.sql",
      "increment-3/00-align-schema-dad-v3.sql",
    ]) {
      await pool.query(
        await fs.readFile(path.join(__dirname, "../../../database", migration), "utf8")
      );
    }
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
