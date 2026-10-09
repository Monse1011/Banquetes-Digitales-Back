const request = require("supertest");
const { createApp } = require("../app");
const {
  InMemoryResourceRepository,
} = require("../../infrastructure/repositories/resource/in-memory-resource-repository");
const {
  InMemoryOperativeRoleRepository,
} = require("../../infrastructure/repositories/operative-role/in-memory-operative-role-repository");
const {
  InMemoryReservationRequestRepository,
} = require("../../infrastructure/repositories/reservation-request/in-memory-reservation-request-repository");
const {
  InMemoryUserRepository,
} = require("../../infrastructure/repositories/auth/in-memory-user-repository");
const {
  InMemoryResourceAssignmentRepository,
} = require("../../infrastructure/repositories/resource-assignment/in-memory-resource-assignment-repository");
const {
  InMemoryResourceConfirmationRepository,
} = require("../../infrastructure/repositories/resource-assignment/in-memory-resource-confirmation-repository");
const {
  createResourceUseCases,
} = require("../../application/use-cases/resource/create-resource-use-cases");
const {
  createResourceAssignmentUseCases,
} = require("../../application/use-cases/resource-assignment/create-resource-assignment-use-cases");
const { Resource } = require("../../domain/entities/resource/resource");
const { OperativeRole } = require("../../domain/entities/operative-role/operative-role");
const {
  ReservationRequest,
} = require("../../domain/entities/reservation-request/reservation-request");
const User = require("../../domain/entities/auth/user");
const { ResourceType } = require("../../domain/enums/resource/resource-type");
const {
  ReservationRequestStatus,
} = require("../../domain/enums/reservation-request/request-status");
const UserRole = require("../../domain/enums/auth/user-role");
const UserStatus = require("../../domain/enums/auth/user-status");

const AUTH_COOKIE = "auth_token=valid-token";
const ADMIN_ID = 1;
const GABRIEL_ID = 10;
const LAURA_ID = 11;

const notUsed = (_req, res) => res.status(501).end();

function resource(id, name, type, quantity, operativeRoleId = null) {
  const now = new Date();

  return new Resource(id, name, type, operativeRoleId, quantity, null, true, now, now, null);
}

function user(id, fullName, role) {
  return new User(id, `EMP-${id}`, fullName, `${id}@mail.com`, "hash", role, UserStatus.ACTIVE);
}

// Horario en diciembre de 2026 (hora local).
function reservation(id, logisticUserId, status, startHour, endHour, day = 24) {
  return new ReservationRequest(
    id,
    `EVT-2026-000${id}`,
    1,
    null,
    new Date(2026, 11, day, startHour),
    new Date(2026, 11, day, endHour),
    50,
    "Salón Jardín",
    status,
    new Date(2026, 9, 1),
    [],
    logisticUserId
  );
}

function buildApp() {
  const session = { id_user: GABRIEL_ID, role: UserRole.LOGISTICA };
  const resourceRepository = new InMemoryResourceRepository([
    resource(1, "Ana Mesera", ResourceType.HUMAN, 1, 1),
    resource(2, "Vajilla completa", ResourceType.MATERIAL, 100),
    resource(3, "Camión de transporte", ResourceType.LOGISTIC, 2),
  ]);
  const operativeRoleRepository = new InMemoryOperativeRoleRepository([
    new OperativeRole(1, "Mesero", true),
  ]);
  const reservationRequestRepository = new InMemoryReservationRequestRepository();
  // 1: 18:00-23:00. 2: inicia 2 h después del fin de 1 (conflicto). 3: inicia exactamente
  // 3 h después del fin de 1 (sin conflicto). 4: "Aprobada", no permite confirmar recursos.
  reservationRequestRepository.requests = [
    reservation(1, GABRIEL_ID, ReservationRequestStatus.ASSIGNED, 18, 23),
    reservation(2, LAURA_ID, ReservationRequestStatus.ASSIGNED, 1, 4, 25),
    reservation(3, GABRIEL_ID, ReservationRequestStatus.ASSIGNED, 2, 5, 25),
    reservation(4, GABRIEL_ID, ReservationRequestStatus.APPROVED, 10, 12),
  ];
  const userRepository = new InMemoryUserRepository([
    user(ADMIN_ID, "Administrador General", UserRole.ADMIN),
    user(GABRIEL_ID, "Gabriel Sánchez", UserRole.LOGISTICA),
    user(LAURA_ID, "Laura Ruiz", UserRole.LOGISTICA),
  ]);

  const app = createApp({
    authController: { login: notUsed, changePassword: notUsed, firstAccess: notUsed },
    passwordResetController: { requestReset: notUsed, resetPassword: notUsed },
    tokenService: { verifyToken: () => ({ ...session }) },
    ...createResourceUseCases(resourceRepository, operativeRoleRepository),
    ...createResourceAssignmentUseCases(
      resourceRepository,
      reservationRequestRepository,
      new InMemoryResourceAssignmentRepository(),
      new InMemoryResourceConfirmationRepository(),
      operativeRoleRepository,
      userRepository
    ),
  });

  return {
    app,
    session,
    reservationRequestRepository,
    resourceRepository,
    signInAs(id, role) {
      session.id_user = id;
      session.role = role;
    },
  };
}

describe("Resource confirmation routes (Función 3.2)", () => {
  let context;

  function get(path) {
    return request(context.app).get(path).set("Cookie", AUTH_COOKIE);
  }

  function post(path, body = {}) {
    return request(context.app).post(path).set("Cookie", AUTH_COOKIE).send(body);
  }

  function assign(requestId, data, observations) {
    return post(`/api/logistics/requests/${requestId}/resources`, { data, observations });
  }

  async function availableOf(requestId, type, resourceId) {
    const response = await get(`/api/logistics/resources/${type}?request_id=${requestId}`);

    return response.body.data.resources.find((item) => item.id === resourceId).available_quantity;
  }

  beforeEach(() => {
    context = buildApp();
  });

  describe("GET /api/logistics/resources/<tipo>?request_id=", () => {
    it("adds the available quantity, the operative role and the read-only schedule", async () => {
      const response = await get("/api/logistics/resources/human?request_id=1");

      expect(response.status).toBe(200);
      expect(response.body.data.resources).toEqual([
        {
          id: 1,
          name: "Ana Mesera",
          type: "HUMAN",
          operative_role_id: 1,
          is_active: true,
          operative_role: "Mesero",
          available_quantity: 1,
          assignment: null,
        },
      ]);
      expect(response.body.metadata.request).toEqual({
        request_id: 1,
        folio: "EVT-2026-0001",
        status: "Asignada",
        event_date: "2026-12-24",
        start_time: "18:00",
        end_time: "23:00",
        observations: null,
        pending_observations: null,
      });
    });

    it("keeps the previous listing when request_id is not sent", async () => {
      const response = await get("/api/logistics/resources/material");

      expect(response.status).toBe(200);
      expect(response.body.data.resources[0]).not.toHaveProperty("available_quantity");
    });

    it("rejects a request that does not allow confirming resources (RF-2.3.2.1)", async () => {
      const response = await get("/api/logistics/resources/material?request_id=4");

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        "La solicitud no se encuentra en un estado que permita confirmar recursos."
      );
    });

    it("denies access to requests of another responsible (RF-2.3.2.21)", async () => {
      const response = await get("/api/logistics/resources/material?request_id=2");

      expect(response.status).toBe(403);
    });

    it("returns 404 for unknown requests", async () => {
      const response = await get("/api/logistics/resources/material?request_id=99");

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/logistics/requests/:id/resources", () => {
    it("assigns provisionally and blocks the event plus 3 hours (RF-2.3.2.13)", async () => {
      const response = await assign(1, [
        { resource_id: 3, quantity: 2, usage_start: "2026-12-24 18:00:00" },
      ]);

      expect(response.status).toBe(204);

      const listing = await get("/api/logistics/resources/logistic?request_id=1");
      expect(listing.body.data.resources[0].assignment).toEqual({
        requested_quantity: 2,
        assigned_quantity: 2,
        available_quantity: 2,
        sufficiency: "Suficiente",
        status: "Provisional",
        observation: null,
      });

      // Laura (solicitud 2) inicia 2 h después del fin; la solicitud 3 inicia justo 3 h después.
      context.signInAs(LAURA_ID, UserRole.LOGISTICA);
      expect(await availableOf(2, "logistic", 3)).toBe(0);
      context.signInAs(GABRIEL_ID, UserRole.LOGISTICA);
      expect(await availableOf(3, "logistic", 3)).toBe(2);
    });

    it("records an insufficient resource without assigning it (RF-2.3.2.7, RF-2.3.2.11)", async () => {
      await assign(1, [{ resource_id: 3, quantity: 3, observation: "Rentar un camión" }]);

      const listing = await get("/api/logistics/resources/logistic?request_id=1");
      expect(listing.body.data.resources[0].assignment).toMatchObject({
        requested_quantity: 3,
        assigned_quantity: 0,
        sufficiency: "Insuficiente",
        observation: "Rentar un camión",
      });
      expect(listing.body.data.resources[0].available_quantity).toBe(2);
    });

    it("replaces the provisional assignment of the same resource", async () => {
      await assign(1, [{ resource_id: 2, quantity: 30 }]);
      await assign(1, [{ resource_id: 2, quantity: 60 }]);

      expect(await availableOf(3, "material", 2)).toBe(100);
      context.signInAs(LAURA_ID, UserRole.LOGISTICA);
      expect(await availableOf(2, "material", 2)).toBe(40);
    });

    it("validates the body", async () => {
      const response = await assign(
        1,
        [
          { resource_id: 1, quantity: 2 },
          { resource_id: 2, quantity: 0, usage_end: "no es fecha" },
          { resource_id: 2, quantity: 1, observation: "x".repeat(201) },
          { resource_id: 3, quantity: 1, usage_start: "2026-12-24 17:00:00" },
        ],
        "Observación general"
      );

      expect(response.status).toBe(422);
      expect(response.body.errors).toEqual({
        "data[1].quantity": "La cantidad debe ser un número entero mayor a cero.",
        "data[1].usage_end": "La fecha y hora de uso no es válida.",
        "data[2].resource_id": "El recurso se indicó más de una vez.",
        "data[2].observation": "La observación debe ser texto de máximo 200 caracteres.",
      });

      const rules = await assign(1, [
        { resource_id: 1, quantity: 2 },
        { resource_id: 3, quantity: 1, usage_start: "2026-12-24 17:00:00" },
        { resource_id: 99, quantity: 1 },
      ]);

      expect(rules.status).toBe(422);
      expect(rules.body.errors).toEqual({
        "data[0].quantity": "La cantidad de un recurso humano debe ser 1.",
        "data[1].usage_start":
          "El periodo de uso debe estar dentro del horario vigente del evento.",
        "data[2].resource_id": "El recurso no existe o no está activo.",
      });
    });

    it("lets the Administrador General confirm resources of any request", async () => {
      context.signInAs(ADMIN_ID, UserRole.ADMIN);

      const response = await assign(2, [{ resource_id: 2, quantity: 10 }]);

      expect(response.status).toBe(204);
    });
  });

  describe("POST /api/logistics/requests/:id/resources/confirm", () => {
    it("moves to Coordinación Lista when every resource is sufficient (RF-2.3.2.17)", async () => {
      await assign(1, [
        { resource_id: 1, quantity: 1 },
        { resource_id: 2, quantity: 50 },
      ]);

      const response = await post("/api/logistics/requests/1/resources/confirm");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        request_id: 1,
        folio: "EVT-2026-0001",
        previous_status: "Asignada",
        current_status: "Coordinación Lista",
        is_fully_sufficient: true,
        confirmed_by: "Gabriel Sánchez",
        summary: { sufficient_resources: 2, insufficient_resources: 0 },
      });
      expect(response.body.data.confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

      const listing = await get("/api/logistics/resources/human?request_id=1");
      expect(listing.status).toBe(409);
    });

    it("moves to Coordinación Incompleta and keeps the observations (RF-2.3.2.18)", async () => {
      await assign(
        1,
        [
          { resource_id: 2, quantity: 50 },
          { resource_id: 3, quantity: 5, observation: "Solo hay 2 camiones" },
        ],
        "Observación de la sesión"
      );

      const response = await post("/api/logistics/requests/1/resources/confirm");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        current_status: "Coordinación Incompleta",
        is_fully_sufficient: false,
        summary: { sufficient_resources: 1, insufficient_resources: 1 },
      });

      // RF-2.3.2.19: al volver se muestran las asignaciones confirmadas y las observaciones.
      const listing = await get("/api/logistics/resources/logistic?request_id=1");
      expect(listing.body.metadata.request.observations).toBe("Observación de la sesión");
      expect(listing.body.data.resources[0].assignment).toMatchObject({
        status: "Confirmada",
        sufficiency: "Insuficiente",
        observation: "Solo hay 2 camiones",
      });
    });

    it("recalculates the status when coming back from Coordinación Incompleta", async () => {
      await assign(1, [{ resource_id: 3, quantity: 5 }]);
      await post("/api/logistics/requests/1/resources/confirm");

      await assign(1, [{ resource_id: 3, quantity: 2 }]);
      const response = await post("/api/logistics/requests/1/resources/confirm", {
        observations: "Se ajustó con el cliente",
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        previous_status: "Coordinación Incompleta",
        current_status: "Coordinación Lista",
        summary: { sufficient_resources: 1, insufficient_resources: 0 },
      });
    });

    it("rejects finishing with a sufficient resource left unassigned (RF-2.3.2.20)", async () => {
      context.signInAs(LAURA_ID, UserRole.LOGISTICA);
      await assign(2, [{ resource_id: 3, quantity: 2 }]);
      context.signInAs(GABRIEL_ID, UserRole.LOGISTICA);
      await assign(1, [{ resource_id: 3, quantity: 1 }]);

      context.signInAs(LAURA_ID, UserRole.LOGISTICA);
      await post("/api/logistics/requests/2/resources/cancel");
      context.signInAs(GABRIEL_ID, UserRole.LOGISTICA);

      const response = await post("/api/logistics/requests/1/resources/confirm");

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Debe asignar todos los recursos con estado Suficiente antes de finalizar la confirmación."
      );
    });

    it("rejects when the availability changed during the process (RF-2.3.2.22)", async () => {
      await assign(1, [{ resource_id: 2, quantity: 80 }]);
      const vajilla = await context.resourceRepository.findById(2);
      vajilla.totalQuantity = 50;
      await context.resourceRepository.updateDetails(vajilla);

      const response = await post("/api/logistics/requests/1/resources/confirm");

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        "La disponibilidad del recurso cambió. Actualice la información."
      );
    });

    it("requires at least one resource", async () => {
      const response = await post("/api/logistics/requests/1/resources/confirm");

      expect(response.status).toBe(422);
    });

    it("rejects requests in a status that does not allow confirming resources", async () => {
      const response = await post("/api/logistics/requests/4/resources/confirm");

      expect(response.status).toBe(409);
    });
  });

  describe("POST /api/logistics/requests/:id/resources/cancel", () => {
    it("releases the provisional assignments without changing the status (RF-2.3.2.16)", async () => {
      await assign(
        1,
        [
          { resource_id: 2, quantity: 50 },
          { resource_id: 3, quantity: 2 },
        ],
        "Se descarta"
      );

      const response = await post("/api/logistics/requests/1/resources/cancel");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        request_id: 1,
        folio: "EVT-2026-0001",
        status: "Asignada",
        provisional_resources_released: 2,
        message: "Cambios descartados y recursos provisionales liberados exitosamente.",
      });

      const listing = await get("/api/logistics/resources/logistic?request_id=1");
      expect(listing.body.data.resources[0].assignment).toBeNull();
      expect(listing.body.metadata.request.pending_observations).toBeNull();
      context.signInAs(LAURA_ID, UserRole.LOGISTICA);
      expect(await availableOf(2, "logistic", 3)).toBe(2);
    });

    it("keeps the assignments already confirmed", async () => {
      await assign(1, [{ resource_id: 3, quantity: 5 }]);
      await post("/api/logistics/requests/1/resources/confirm");
      await assign(1, [{ resource_id: 3, quantity: 2 }]);

      const response = await post("/api/logistics/requests/1/resources/cancel");

      expect(response.body.data).toMatchObject({
        status: "Coordinación Incompleta",
        provisional_resources_released: 1,
      });

      const listing = await get("/api/logistics/resources/logistic?request_id=1");
      expect(listing.body.data.resources[0].assignment).toMatchObject({
        status: "Confirmada",
        requested_quantity: 5,
      });
    });

    it("denies access to requests of another responsible", async () => {
      const response = await post("/api/logistics/requests/2/resources/cancel");

      expect(response.status).toBe(403);
      expect(context.reservationRequestRepository.requests[1].status).toBe("Asignada");
    });
  });
});
