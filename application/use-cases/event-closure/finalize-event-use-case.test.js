const { FinalizeEventUseCase } = require("./finalize-event-use-case");
const { FinalizeEventRequestDto } = require("../../dto/event-closure/finalize-event-request-dto");
const {
  InMemoryEventClosureRepository,
} = require("../../../infrastructure/repositories/event-closure/in-memory-event-closure-repository");
const {
  InMemoryTransactionManager,
} = require("../../../infrastructure/services/transaction/in-memory-transaction-manager");
const {
  ReservationRequestStatus,
} = require("../../../domain/enums/reservation-request/request-status");
const { EventClosureMessages } = require("../../../domain/constants/event-closure-messages");
const { parseMeridaDateTime } = require("../../services/event-closure/merida-time");
const EventClosureValidationException = require("../../../domain/exceptions/event-closure/event-closure-validation-exception");
const EventClosureConflictException = require("../../../domain/exceptions/event-closure/event-closure-conflict-exception");
const EventClosureNotFoundException = require("../../../domain/exceptions/event-closure/event-closure-not-found-exception");
const EventClosureAccessDeniedException = require("../../../domain/exceptions/event-closure/event-closure-access-denied-exception");

const LOGISTICS_USER_ID = 10;
const REQUEST_ID = 21312;
// Evento del 15/11/2026 de 18:00 a 23:00 (hora de pared de Mérida).
const NOW = parseMeridaDateTime("2026-11-15T23:45:00-06:00");

function validBody(overrides = {}) {
  return {
    actual_start_at: "2026-11-15T18:10:00-06:00",
    actual_end_at: "2026-11-15T23:20:00-06:00",
    event_observation: "El evento inició 10 minutos después de lo programado.",
    status: "FINALIZED",
    ...overrides,
  };
}

function buildUseCase({ event = {}, now = NOW } = {}) {
  const repository = new InMemoryEventClosureRepository(
    [
      {
        requestId: REQUEST_ID,
        status: ReservationRequestStatus.CONFIRMED,
        logisticUserId: LOGISTICS_USER_ID,
        scheduledStartAt: parseMeridaDateTime("2026-11-15T18:00:00-06:00"),
        scheduledEndAt: parseMeridaDateTime("2026-11-15T23:00:00-06:00"),
        ...event,
      },
    ],
    () => now
  );
  const useCase = new FinalizeEventUseCase(repository, new InMemoryTransactionManager(), () => now);

  return {
    repository,
    run: (body = validBody(), userId = LOGISTICS_USER_ID, requestId = REQUEST_ID) =>
      useCase.execute(requestId, userId, new FinalizeEventRequestDto(body)),
  };
}

async function expectRejection(promise, ExceptionClass, message) {
  const error = await promise.then(
    () => null,
    (caught) => caught
  );

  expect(error).toBeInstanceOf(ExceptionClass);
  expect(error.message).toBe(message);
}

describe("FinalizeEventUseCase (Función 3.6)", () => {
  describe("finalización correcta", () => {
    it("guarda horas reales y observación, y cambia el estado a Finalizado (RF-2.3.6.1/3)", async () => {
      const { run, repository } = buildUseCase();

      const result = await run();

      expect(result.data).toEqual({
        request_id: REQUEST_ID,
        actual_start_at: "2026-11-15T18:10:00-06:00",
        actual_end_at: "2026-11-15T23:20:00-06:00",
        event_observation: "El evento inició 10 minutos después de lo programado.",
        status: "FINALIZED",
        status_changed_at: "2026-11-15T23:45:00-06:00",
      });

      const stored = await repository.findForUpdate(REQUEST_ID);
      expect(stored.status).toBe(ReservationRequestStatus.FINALIZED);
      expect(stored.actualStartAt).toEqual(parseMeridaDateTime("2026-11-15T18:10:00-06:00"));
      expect(stored.actualEndAt).toEqual(parseMeridaDateTime("2026-11-15T23:20:00-06:00"));
    });

    it("inserta una fila en el historial de estados con el usuario que finalizó", async () => {
      const { run, repository } = buildUseCase();

      await run();

      expect(repository.history).toEqual([
        {
          requestId: REQUEST_ID,
          previousStatus: ReservationRequestStatus.CONFIRMED,
          newStatus: ReservationRequestStatus.FINALIZED,
          changedAt: NOW,
          changedByUserId: LOGISTICS_USER_ID,
        },
      ]);
    });

    it.each([undefined, null, "", "   "])(
      "guarda como null las observaciones vacías (%j) (RF-2.3.6.2)",
      async (observation) => {
        const { run } = buildUseCase();

        const result = await run(validBody({ event_observation: observation }));

        expect(result.data.event_observation).toBeNull();
      }
    );

    it("acepta observaciones de exactamente 1000 caracteres", async () => {
      const { run } = buildUseCase();
      const observation = "a".repeat(1000);

      const result = await run(validBody({ event_observation: observation }));

      expect(result.data.event_observation).toBe(observation);
    });
  });

  describe("día programado (RF-2.3.6.1)", () => {
    it("permite finalizar en el último segundo del día programado, hora de Mérida", async () => {
      const now = parseMeridaDateTime("2026-11-15T23:59:59-06:00");
      const { run } = buildUseCase({ now });

      await expect(run()).resolves.toBeDefined();
    });

    it("rechaza el día siguiente aunque en UTC aún sea el día programado", async () => {
      // 2026-11-16 00:00:00 en Mérida; en UTC ya es 06:00 del 16, pero la regla usa Mérida.
      const now = parseMeridaDateTime("2026-11-16T00:00:00-06:00");
      const { run, repository } = buildUseCase({ now });

      await expectRejection(
        run(validBody()),
        EventClosureConflictException,
        EventClosureMessages.OUTSIDE_SCHEDULED_DAY
      );
      expect(repository.history).toHaveLength(0);
    });

    it("rechaza un día anterior al programado", async () => {
      const now = parseMeridaDateTime("2026-11-14T20:00:00-06:00");
      const { run } = buildUseCase({ now });

      await expectRejection(
        run(
          validBody({
            actual_start_at: "2026-11-14T18:10:00-06:00",
            actual_end_at: "2026-11-14T19:20:00-06:00",
          })
        ),
        EventClosureConflictException,
        EventClosureMessages.OUTSIDE_SCHEDULED_DAY
      );
    });

    it("en eventos que cruzan la medianoche permite hasta las 23:59:59 del día de fin", async () => {
      const event = {
        scheduledStartAt: parseMeridaDateTime("2026-11-15T20:00:00-06:00"),
        scheduledEndAt: parseMeridaDateTime("2026-11-16T02:00:00-06:00"),
      };
      const body = validBody({
        actual_start_at: "2026-11-15T20:05:00-06:00",
        actual_end_at: "2026-11-16T02:10:00-06:00",
      });

      const lastSecond = buildUseCase({
        event,
        now: parseMeridaDateTime("2026-11-16T23:59:59-06:00"),
      });
      await expect(lastSecond.run(body)).resolves.toBeDefined();

      const nextDay = buildUseCase({
        event,
        now: parseMeridaDateTime("2026-11-17T00:00:00-06:00"),
      });
      await expectRejection(
        nextDay.run(body),
        EventClosureConflictException,
        EventClosureMessages.OUTSIDE_SCHEDULED_DAY
      );
    });
  });

  describe("estado de la solicitud", () => {
    it("rechaza una solicitud ya finalizada (RF-2.3.6.5)", async () => {
      const { run } = buildUseCase({ event: { status: ReservationRequestStatus.FINALIZED } });

      await expectRejection(
        run(),
        EventClosureConflictException,
        EventClosureMessages.ALREADY_FINALIZED
      );
    });

    it.each([
      ReservationRequestStatus.ASSIGNED,
      ReservationRequestStatus.PROPOSAL_GENERATED,
      ReservationRequestStatus.CANCELED,
    ])("rechaza el estado %s", async (status) => {
      const { run } = buildUseCase({ event: { status } });

      await expectRejection(
        run(),
        EventClosureConflictException,
        EventClosureMessages.NOT_CONFIRMED
      );
    });

    it("finalizar dos veces: la segunda recibe 409 y no duplica el historial", async () => {
      const { run, repository } = buildUseCase();

      await run();
      await expectRejection(
        run(),
        EventClosureConflictException,
        EventClosureMessages.ALREADY_FINALIZED
      );
      expect(repository.history).toHaveLength(1);
    });
  });

  describe("acceso", () => {
    it("responde 404 si la solicitud no existe", async () => {
      const { run } = buildUseCase();

      await expectRejection(
        run(validBody(), LOGISTICS_USER_ID, 999),
        EventClosureNotFoundException,
        EventClosureMessages.REQUEST_NOT_FOUND
      );
    });

    it("responde 403 si el usuario no es el responsable asignado (RF-2.3.6.1)", async () => {
      const { run, repository } = buildUseCase();

      await expectRejection(
        run(validBody(), 77),
        EventClosureAccessDeniedException,
        EventClosureMessages.FORBIDDEN
      );
      expect(repository.history).toHaveLength(0);
    });
  });

  describe("validaciones del cuerpo", () => {
    it.each([
      ["sin hora de inicio", { actual_start_at: undefined }],
      ["hora de inicio nula", { actual_start_at: null }],
      ["sin hora de fin", { actual_end_at: undefined }],
      ["hora de fin vacía", { actual_end_at: "" }],
    ])("%s", async (_label, overrides) => {
      const { run } = buildUseCase();

      await expectRejection(
        run(validBody(overrides)),
        EventClosureValidationException,
        EventClosureMessages.ACTUAL_TIMES_REQUIRED
      );
    });

    it.each([
      ["Z", "2026-11-15T18:10:00Z"],
      ["+00:00", "2026-11-15T18:10:00+00:00"],
      ["sin offset", "2026-11-15T18:10:00"],
      ["milisegundos", "2026-11-15T18:10:00.000-06:00"],
      ["fecha inexistente", "2026-02-30T18:10:00-06:00"],
    ])("rechaza el formato de fecha con %s sin normalizarlo", async (_label, value) => {
      const { run } = buildUseCase();

      await expectRejection(
        run(validBody({ actual_start_at: value })),
        EventClosureValidationException,
        EventClosureMessages.INVALID_DATE_TIME_FORMAT
      );
    });

    it("rechaza una hora de fin igual o anterior a la de inicio (RF-2.3.6.3)", async () => {
      const { run } = buildUseCase();

      await expectRejection(
        run(validBody({ actual_end_at: "2026-11-15T18:10:00-06:00" })),
        EventClosureValidationException,
        EventClosureMessages.END_BEFORE_START
      );
      await expectRejection(
        run(validBody({ actual_end_at: "2026-11-15T18:00:00-06:00" })),
        EventClosureValidationException,
        EventClosureMessages.END_BEFORE_START
      );
    });

    it("rechaza horas reales posteriores a la hora actual", async () => {
      const { run } = buildUseCase();

      await expectRejection(
        run(validBody({ actual_end_at: "2026-11-15T23:46:00-06:00" })),
        EventClosureValidationException,
        EventClosureMessages.ACTUAL_TIME_IN_FUTURE
      );
    });

    it("acepta una hora real igual a la hora actual", async () => {
      const { run } = buildUseCase();

      await expect(
        run(validBody({ actual_end_at: "2026-11-15T23:45:00-06:00" }))
      ).resolves.toBeDefined();
    });

    it("rechaza observaciones de más de 1000 caracteres (RF-2.3.6.2)", async () => {
      const { run } = buildUseCase();

      await expectRejection(
        run(validBody({ event_observation: "a".repeat(1001) })),
        EventClosureValidationException,
        EventClosureMessages.OBSERVATION_TOO_LONG
      );
    });

    it("rechaza observaciones que no son texto", async () => {
      const { run } = buildUseCase();

      await expectRejection(
        run(validBody({ event_observation: 123 })),
        EventClosureValidationException,
        EventClosureMessages.OBSERVATION_TOO_LONG
      );
    });

    it.each([undefined, null, "CONFIRMED", "Finalizado", "finalized"])(
      "rechaza el estado %j: solo se acepta FINALIZED",
      async (status) => {
        const { run } = buildUseCase();

        await expectRejection(
          run(validBody({ status })),
          EventClosureValidationException,
          EventClosureMessages.INVALID_STATUS
        );
      }
    );

    it("si alguna validación falla no se guarda ningún cambio", async () => {
      const { run, repository } = buildUseCase();

      await run(validBody({ status: "OTRO" })).catch(() => undefined);

      const stored = await repository.findForUpdate(REQUEST_ID);
      expect(stored.status).toBe(ReservationRequestStatus.CONFIRMED);
      expect(stored.actualStartAt).toBeUndefined();
      expect(repository.history).toHaveLength(0);
    });
  });
});
