const { Pool } = require("pg");
const {
  FinalizeEventUseCase,
} = require("../../../application/use-cases/event-closure/finalize-event-use-case");
const {
  FinalizeEventRequestDto,
} = require("../../../application/dto/event-closure/finalize-event-request-dto");
const { PostgresEventClosureRepository } = require("./postgres-event-closure-repository");
const {
  PostgresTransactionManager,
} = require("../../services/transaction/postgres-transaction-manager");
const { parseMeridaDateTime } = require("../../../application/services/event-closure/merida-time");
const {
  PostgresAdminRequestQueryRepository,
} = require("../reservation-request/postgres-admin-request-query-repository");
const EventClosureConflictException = require("../../../domain/exceptions/event-closure/event-closure-conflict-exception");

const NOW = parseMeridaDateTime("2035-06-01T23:45:00-06:00");

function body(overrides = {}) {
  return new FinalizeEventRequestDto({
    actual_start_at: "2035-06-01T18:10:00-06:00",
    actual_end_at: "2035-06-01T23:20:00-06:00",
    event_observation: "Inició 10 minutos tarde.",
    status: "FINALIZED",
    ...overrides,
  });
}

// Opt-in: TEST_PGDATABASE debe nombrar una base con estructura.sql y las migraciones de
// database/increment-3 (request-status-history.sql y event-closure.sql). Todo se revierte.
// Las fronteras de transacción se suprimen solo en este adaptador para que los repositorios
// compartan la transacción externa de la prueba.
describe.skipIf(!process.env.TEST_PGDATABASE)("Función 3.6 contra PostgreSQL", () => {
  let pool;
  let connection;
  let useCase;
  let ids;

  beforeEach(async () => {
    pool = new Pool({ database: process.env.TEST_PGDATABASE });
    connection = await pool.connect();
    await connection.query("BEGIN");
    const adapter = {
      query: (sql, values) =>
        ["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)
          ? Promise.resolve({ rows: [] })
          : connection.query(sql, values),
      release() {},
    };
    adapter.connect = async () => adapter;
    useCase = new FinalizeEventUseCase(
      new PostgresEventClosureRepository(),
      new PostgresTransactionManager(adapter),
      () => NOW
    );

    const tag = Date.now();
    const q = async (sql, values) => (await connection.query(sql, values)).rows[0];
    const admin = await q(
      "INSERT INTO users (id_employee,full_name,email,password_hash,role,status) VALUES ($1,'Admin T',$2,'x','ADMIN','ACTIVE') RETURNING id_user",
      [`TA${tag}`, `a-${tag}@example.invalid`]
    );
    const logistic = await q(
      "INSERT INTO users (id_employee,full_name,email,password_hash,role,status) VALUES ($1,'Logistica T',$2,'x','LOGISTICS','ACTIVE') RETURNING id_user",
      [`TL${tag}`, `l-${tag}@example.invalid`]
    );
    const client = await q(
      "INSERT INTO clients (full_name,email,phone) VALUES ('Cliente T',$1,'9991234567') RETURNING id",
      [`c-${tag}@example.invalid`]
    );
    const request = await q(
      `INSERT INTO reservations_request
         (folio, client_id, logistic_user_id, assigned_by_user_id, assigned_at, event_date,
          event_time, event_end_time, guest_count, event_address, status)
       VALUES ('BD-2035-99999', $1, $2, $3, now(), '2035-06-01', '18:00',
          '2035-06-01T23:00:00-06:00', 100, 'Salón T', 'CONFIRMED') RETURNING id`,
      [client.id, logistic.id_user, admin.id_user]
    );
    ids = {
      admin: Number(admin.id_user),
      logistic: Number(logistic.id_user),
      request: Number(request.id),
    };
  });

  afterEach(async () => {
    await connection.query("ROLLBACK");
    connection.release();
    await pool.end();
  });

  it("finaliza el evento, guarda horas reales y deja el historial con el usuario", async () => {
    const result = await useCase.execute(ids.request, ids.logistic, body());

    expect(result.data).toMatchObject({
      request_id: ids.request,
      actual_start_at: "2035-06-01T18:10:00-06:00",
      actual_end_at: "2035-06-01T23:20:00-06:00",
      event_observation: "Inició 10 minutos tarde.",
      status: "FINALIZED",
    });

    const row = (
      await connection.query(
        "SELECT status, actual_start_at, actual_end_at, event_observation FROM reservations_request WHERE id = $1",
        [ids.request]
      )
    ).rows[0];
    expect(row.status).toBe("FINALIZED");
    expect(row.actual_start_at.toISOString()).toBe("2035-06-02T00:10:00.000Z");
    expect(row.actual_end_at.toISOString()).toBe("2035-06-02T05:20:00.000Z");

    const history = (
      await connection.query(
        "SELECT previous_status, new_status, changed_by_user_id FROM request_status_history WHERE request_id = $1 AND new_status = 'FINALIZED'",
        [ids.request]
      )
    ).rows;
    expect(history).toHaveLength(1);
    expect(history[0].previous_status).toBe("CONFIRMED");
    expect(Number(history[0].changed_by_user_id)).toBe(ids.logistic);
  });

  it("las consultas del administrador (2.5 y 2.11) leen las horas reales y observaciones", async () => {
    const queries = new PostgresAdminRequestQueryRepository(connection);

    const before = await queries.findById(ids.request);
    expect(before.request).toMatchObject({
      actual_start_at: null,
      actual_end_at: null,
      event_observation: null,
    });

    await useCase.execute(ids.request, ids.logistic, body());

    const after = await queries.findById(ids.request);
    expect(after.request).toMatchObject({
      status: "FINALIZED",
      actual_start_at: "2035-06-01T18:10:00-06:00",
      actual_end_at: "2035-06-01T23:20:00-06:00",
      event_observation: "Inició 10 minutos tarde.",
    });
    const listed = await queries.findAll({ statuses: ["FINALIZED"] }, 1, 100);
    expect(listed.requests.find((r) => r.request_id === ids.request)).toMatchObject({
      actual_start_at: "2035-06-01T18:10:00-06:00",
      actual_end_at: "2035-06-01T23:20:00-06:00",
    });
  });

  it("usa el horario de la derived_information más reciente", async () => {
    // El acuerdo más reciente mueve el evento al 2 de junio: el día 1 ya no es el programado.
    await connection.query(
      `INSERT INTO derived_information (request_id, location, start_datetime, end_datetime, created_by_user_id)
       VALUES ($1, 'Salón T', '2035-06-02T18:00:00-06:00', '2035-06-02T23:00:00-06:00', $2)`,
      [ids.request, ids.logistic]
    );

    await expect(useCase.execute(ids.request, ids.logistic, body())).rejects.toBeInstanceOf(
      EventClosureConflictException
    );
  });

  // NC-01 (RTF): al reprogramar desde el calendario (Función 3.3) solo se actualizan
  // calendar_events y la solicitud; derived_information conserva el horario original.
  describe("evento reprogramado desde el calendario (NC-01)", () => {
    async function rescheduleFromCalendar(oldDay, newDay) {
      await connection.query(
        `INSERT INTO derived_information (request_id, location, start_datetime, end_datetime, created_by_user_id)
         VALUES ($1, 'Salón T', $2, $3, $4)`,
        [ids.request, `${oldDay}T18:00:00-06:00`, `${oldDay}T23:00:00-06:00`, ids.logistic]
      );
      await connection.query(
        `INSERT INTO calendar_events (id_request, title, start_at, end_at, location, sync_status)
         VALUES ($1, 'Evento T', $2, $3, 'Salón T', 'SYNCED')`,
        [ids.request, `${newDay}T18:00:00-06:00`, `${newDay}T23:00:00-06:00`]
      );
      // Lo mismo que hace reschedule() de la Función 3.3 sobre la solicitud.
      await connection.query(
        "UPDATE reservations_request SET event_date = $2, event_time = '18:00', event_end_time = $3 WHERE id = $1",
        [ids.request, newDay, `${newDay}T23:00:00-06:00`]
      );
    }

    it("permite finalizar el día nuevo y no el original", async () => {
      await rescheduleFromCalendar("2035-05-31", "2035-06-01");

      await expect(useCase.execute(ids.request, ids.logistic, body())).resolves.toBeDefined();
    });

    it("rechaza el día original, que ya no es el programado", async () => {
      await rescheduleFromCalendar("2035-06-01", "2035-06-02");

      await expect(useCase.execute(ids.request, ids.logistic, body())).rejects.toBeInstanceOf(
        EventClosureConflictException
      );
    });
  });

  it("acepta una solicitud sin hora de fin (event_end_time NULL)", async () => {
    await connection.query("UPDATE reservations_request SET event_end_time = NULL WHERE id = $1", [
      ids.request,
    ]);

    await expect(useCase.execute(ids.request, ids.logistic, body())).resolves.toBeDefined();
  });

  it("no permite finalizar dos veces", async () => {
    await useCase.execute(ids.request, ids.logistic, body());

    await expect(useCase.execute(ids.request, ids.logistic, body())).rejects.toThrow(
      "El evento ya fue finalizado y no puede modificarse."
    );
  });

  it("rechaza horas reales con fin anterior al inicio por la restricción de la base", async () => {
    await expect(
      connection.query(
        "UPDATE reservations_request SET actual_start_at = now(), actual_end_at = now() - interval '1 hour' WHERE id = $1",
        [ids.request]
      )
    ).rejects.toThrow("chk_reservations_request_actual_window");
  });
});
