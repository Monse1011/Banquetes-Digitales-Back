const { Pool } = require("pg");
const { PostgresCalendarEventRepository } = require("./postgres-calendar-event-repository");
const {
  FinalizeElapsedEventsUseCase,
} = require("../../../application/use-cases/calendar/finalize-elapsed-events-use-case");

// Isolated SQL fixtures shadow public tables only on this connection. No production rows,
// clocks, sequences, or in-memory repositories are changed. These exercise real repository SQL;
// installed-schema compatibility is covered separately by postgres-request-integration.test.js.
describe.skipIf(!process.env.TEST_PGDATABASE)("Calendar closing scenarios on PostgreSQL", () => {
  let pool;
  let connection;
  let repository;
  const end = new Date("2035-06-02T07:00:00Z");
  beforeEach(async () => {
    pool = new Pool({ database: process.env.TEST_PGDATABASE });
    connection = await pool.connect();
    await connection.query("BEGIN");
    await connection.query(`
      CREATE TEMP TABLE reservations_request (
        id bigint, folio text, status text, logistic_user_id bigint,
        event_date_time timestamptz, event_end_time timestamptz
      ) ON COMMIT DROP;
      CREATE TEMP TABLE calendar_events (id bigint, id_request bigint, start_at timestamptz, end_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE proposals (id bigint, request_id bigint) ON COMMIT DROP;
      CREATE TEMP TABLE proposal_resources (proposal_id bigint, resource_id bigint, quantity integer) ON COMMIT DROP;
      CREATE TEMP TABLE resources (id bigint, name text, total_quantity integer, is_active boolean) ON COMMIT DROP;
      CREATE TEMP TABLE users (id_user bigint, role text, status text) ON COMMIT DROP;
      INSERT INTO users VALUES (1,'LOGISTICS','ACTIVE');
      INSERT INTO resources VALUES (1,'Persona',1,true);
      INSERT INTO reservations_request VALUES
        (1,'ORIGINAL','CONFIRMED',1,'2035-06-02T00:00:00Z','2035-06-02T07:00:00Z'),
        (2,'CANDIDATE','PROPOSAL_GENERATED',1,'2035-06-02T10:00:00Z','2035-06-02T12:00:00Z');
      INSERT INTO calendar_events VALUES (1,1,'2035-06-02T00:00:00Z','2035-06-02T07:00:00Z');
      INSERT INTO proposals VALUES (1,1),(2,2);
      INSERT INTO proposal_resources VALUES (1,1,1),(2,1,1);
    `);
    repository = new PostgresCalendarEventRepository(connection);
  });
  afterEach(async () => {
    if (connection) {
      await connection.query("ROLLBACK");
      connection.release();
    }
    if (pool) await pool.end();
  });
  function conflicts(startAt) {
    return repository.findResourceConflicts(connection, {
      requestId: 2,
      startAt,
      endAt: new Date(startAt.getTime() + 3600000),
    });
  }
  it("finalizes exactly at the end, is repeatable, and retains the three-hour resource block", async () => {
    expect(
      await new FinalizeElapsedEventsUseCase(
        repository,
        () => new Date(end.getTime() - 1)
      ).execute()
    ).toBe(0);
    expect(await new FinalizeElapsedEventsUseCase(repository, () => end).execute()).toBe(1);
    expect(await new FinalizeElapsedEventsUseCase(repository, () => end).execute()).toBe(0);
    expect(
      (await connection.query("SELECT status FROM reservations_request WHERE id=1")).rows[0].status
    ).toBe("FINALIZED");
    expect(await conflicts(new Date(end.getTime() + 10800000 - 1))).toHaveLength(1);
    expect(await conflicts(new Date(end.getTime() + 10800000))).toEqual([]);
  });
  it("detects responsible overlap and permits touching schedules", async () => {
    const params = { requestId: 2, logisticUserId: 1, endAt: new Date(end.getTime() + 3600000) };
    expect(
      await repository.findResponsibleConflicts(connection, {
        ...params,
        startAt: new Date(end.getTime() - 1),
      })
    ).toHaveLength(1);
    expect(
      await repository.findResponsibleConflicts(connection, { ...params, startAt: end })
    ).toEqual([]);
  });
  it.each([
    ["separate bookings", "2035-06-02T05:00:00Z", 0],
    ["touching blocks", "2035-06-02T04:00:00Z", 0],
    ["overlapping blocks", "2035-06-02T03:00:00Z", 1],
  ])("uses peak demand for %s", async (_, secondStart, expectedConflicts) => {
    await connection.query(`
      UPDATE resources SET total_quantity=10;
      UPDATE proposal_resources SET quantity=6 WHERE proposal_id=1;
      UPDATE proposal_resources SET quantity=4 WHERE proposal_id=2;
      UPDATE calendar_events SET end_at='2035-06-02T01:00:00Z' WHERE id=1;
      INSERT INTO reservations_request VALUES
        (3,'LATER','CONFIRMED',1,'2035-06-02T05:00:00Z','2035-06-02T06:00:00Z');
      INSERT INTO calendar_events VALUES (3,3,'2035-06-02T05:00:00Z','2035-06-02T06:00:00Z');
      INSERT INTO proposals VALUES (3,3);
      INSERT INTO proposal_resources VALUES (3,1,6);
    `);
    await connection.query("UPDATE calendar_events SET start_at=$1 WHERE id=3", [secondStart]);
    // First booking blocks 00:00–04:00. Candidate needs 4 until 09:00 including its margin.
    // Two bookings of 6 only exceed stock 10 with the candidate if their blocks overlap.
    expect(
      await repository.findResourceConflicts(connection, {
        requestId: 2,
        startAt: new Date("2035-06-02T00:00:00Z"),
        endAt: new Date("2035-06-02T06:00:00Z"),
      })
    ).toHaveLength(expectedConflicts);
  });
  it("excludes cancelled events immediately, including the extra three-hour margin", async () => {
    expect(await conflicts(end)).toHaveLength(1);
    await connection.query("UPDATE reservations_request SET status='CANCELED' WHERE id=1");
    expect(await conflicts(end)).toEqual([]);
    expect(await new FinalizeElapsedEventsUseCase(repository, () => end).execute()).toBe(0);
  });
});
