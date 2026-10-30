const request = require("supertest");
const { createApp } = require("../app");
const {
  FinalizeEventUseCase,
} = require("../../application/use-cases/event-closure/finalize-event-use-case");
const {
  InMemoryEventClosureRepository,
} = require("../../infrastructure/repositories/event-closure/in-memory-event-closure-repository");
const {
  InMemoryTransactionManager,
} = require("../../infrastructure/services/transaction/in-memory-transaction-manager");
const {
  ReservationRequestStatus,
} = require("../../domain/enums/reservation-request/request-status");
const { parseMeridaDateTime } = require("../../application/services/event-closure/merida-time");
const UserRole = require("../../domain/enums/auth/user-role");

const AUTH_COOKIE = "auth_token=valid-token";
const NOW = parseMeridaDateTime("2026-11-15T23:45:00-06:00");
const notUsed = (_req, res) => res.status(501).end();

function validBody(overrides = {}) {
  return {
    data: {
      actual_start_at: "2026-11-15T18:10:00-06:00",
      actual_end_at: "2026-11-15T23:20:00-06:00",
      event_observation: "El evento inició 10 minutos después de lo programado.",
      status: "FINALIZED",
      ...overrides,
    },
  };
}

function buildApp({ role = UserRole.LOGISTICS, userId = 10, status } = {}) {
  const repository = new InMemoryEventClosureRepository(
    [
      {
        requestId: 21312,
        status: status ?? ReservationRequestStatus.CONFIRMED,
        logisticUserId: 10,
        scheduledStartAt: parseMeridaDateTime("2026-11-15T18:00:00-06:00"),
        scheduledEndAt: parseMeridaDateTime("2026-11-15T23:00:00-06:00"),
      },
    ],
    () => NOW
  );

  return createApp({
    authController: {
      session: notUsed,
      logout: notUsed,
      login: notUsed,
      changePassword: notUsed,
      firstAccess: notUsed,
    },
    passwordResetController: { requestReset: notUsed, resetPassword: notUsed },
    tokenService: { verifyToken: () => ({ id_user: userId, role }) },
    finalizeEventUseCase: new FinalizeEventUseCase(
      repository,
      new InMemoryTransactionManager(),
      () => NOW
    ),
  });
}

function patchEnding(app, id, body) {
  return request(app)
    .patch(`/api/logistics/requests/${id}/ending`)
    .set("Cookie", AUTH_COOKIE)
    .send(body);
}

describe("PATCH /api/logistics/requests/:id/ending (Función 3.6)", () => {
  it("responde 200 con el contrato del DAD", async () => {
    const response = await patchEnding(buildApp(), 21312, validBody());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        request_id: 21312,
        actual_start_at: "2026-11-15T18:10:00-06:00",
        actual_end_at: "2026-11-15T23:20:00-06:00",
        event_observation: "El evento inició 10 minutos después de lo programado.",
        status: "FINALIZED",
        status_changed_at: "2026-11-15T23:45:00-06:00",
      },
    });
  });

  it("responde 401 sin sesión", async () => {
    const response = await request(buildApp())
      .patch("/api/logistics/requests/21312/ending")
      .send(validBody());

    expect(response.status).toBe(401);
  });

  it("responde 403 si el rol no es Personal de Logística", async () => {
    const response = await patchEnding(buildApp({ role: UserRole.ADMIN }), 21312, validBody());

    expect(response.status).toBe(403);
  });

  it("responde 403 con el mensaje del DAD si no es el responsable asignado", async () => {
    const response = await patchEnding(buildApp({ userId: 77 }), 21312, validBody());

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "No tiene permisos para realizar esta acción." });
  });

  it("responde 404 si la solicitud no existe", async () => {
    const response = await patchEnding(buildApp(), 999, validBody());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "No se encontró la solicitud." });
  });

  it.each(["abc", "0", "-3", "1.5"])("responde 400 si el identificador es %s", async (id) => {
    const response = await patchEnding(buildApp(), id, validBody());

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "El identificador de la solicitud no es válido.",
    });
  });

  it("responde 400 si falta el objeto data", async () => {
    const response = await patchEnding(buildApp(), 21312, {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "Debe indicar la hora real de inicio y de finalización.",
    });
  });

  it("responde 400 con el mensaje de formato si la fecha usa Z", async () => {
    const response = await patchEnding(
      buildApp(),
      21312,
      validBody({ actual_start_at: "2026-11-15T18:10:00Z" })
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "El formato de fecha y hora no es válido." });
  });

  it("responde 400 si el estado no es FINALIZED", async () => {
    const response = await patchEnding(buildApp(), 21312, validBody({ status: "CONFIRMED" }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "El estado indicado no es válido." });
  });

  it("responde 409 si la solicitud no está confirmada", async () => {
    const response = await patchEnding(
      buildApp({ status: ReservationRequestStatus.PROPOSAL_GENERATED }),
      21312,
      validBody()
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Solo se puede registrar el seguimiento o finalizar eventos en estado Confirmado.",
    });
  });

  it("responde 409 si el evento ya fue finalizado", async () => {
    const app = buildApp();

    await patchEnding(app, 21312, validBody());
    const response = await patchEnding(app, 21312, validBody());

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "El evento ya fue finalizado y no puede modificarse.",
    });
  });
});
