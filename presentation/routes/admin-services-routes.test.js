const request = require("supertest");
const { createApp } = require("../app");
const {
  InMemoryServiceRepository,
} = require("../../infrastructure/repositories/service/in-memory-service-repository");
const { Service } = require("../../domain/entities/service/service");
const ServiceStatus = require("../../domain/enums/service/service-status");
const UserRole = require("../../domain/enums/auth/user-role");

describe("Admin Service Routes (Función 2.6 - Contrato API)", () => {
  let app;
  let serviceRepository;
  let currentUserId;
  let currentUserRole;

  function buildApp() {
    return createApp({
      tokenService: {
        verifyToken: () => ({ id_user: currentUserId, role: currentUserRole }),
      },
      serviceRepository,
      authController: {
        session: (_req, res) => res.sendStatus(501),
        logout: (_req, res) => res.sendStatus(501),
        login: (_req, res) => res.status(200).json({}),
        changePassword: (_req, res) => res.status(200).json({}),
        firstAccess: (_req, res) => res.status(200).json({ firstAccess: true }),
      },
      passwordResetController: {
        requestReset: (_req, res) => res.status(200).json({}),
        resetPassword: (_req, res) => res.status(200).json({}),
      },
    });
  }

  beforeEach(() => {
    currentUserId = 1;
    currentUserRole = UserRole.ADMIN;

    serviceRepository = new InMemoryServiceRepository([
      new Service(
        1,
        "Banquetes y bebidas",
        "Texto breve del servicio.",
        1500.0,
        ServiceStatus.ACTIVE
      ),
      new Service(2, "Música", "Sonido profesional.", 800.0, ServiceStatus.ACTIVE),
      new Service(
        7,
        "Servicio de personal",
        "Texto breve del servicio.",
        800.0,
        ServiceStatus.INACTIVE
      ),
      new Service(9, "Servicio eliminado", "No debe mostrarse.", 500.0, ServiceStatus.DELETED),
    ]);

    app = buildApp();
  });

  describe("Authentication & Role Authorization", () => {
    it("rejects unauthenticated requests with 401 Unauthorized", async () => {
      const response = await request(app).get("/api/admin/services");
      expect(response.status).toBe(401);
    });

    it("rejects non-admin roles with 403 Forbidden (RF-1.2.6.1)", async () => {
      currentUserRole = UserRole.LOGISTICS;
      const response = await request(app)
        .get("/api/admin/services")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(403);
    });
  });

  describe("1 - Listar servicios: GET /api/admin/services", () => {
    it("returns paginated services ordered by ACTIVE first, then INACTIVE, excluding DELETED (RF-1.2.6.2)", async () => {
      const response = await request(app)
        .get("/api/admin/services?page=1&per_page=10")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(200);
      expect(response.body.data.services).toHaveLength(3);
      expect(response.body.metadata.pagination).toEqual({
        total_records: 3,
        page: 1,
        per_page: 10,
      });

      expect(response.body.data.services[0]).toEqual({
        id: 1,
        name: "Banquetes y bebidas",
        description: "Texto breve del servicio.",
        price: 1500.0,
        status: ServiceStatus.ACTIVE,
      });

      expect(response.body.data.services[1]).toEqual({
        id: 2,
        name: "Música",
        description: "Sonido profesional.",
        price: 800.0,
        status: ServiceStatus.ACTIVE,
      });

      expect(response.body.data.services[2]).toEqual({
        id: 7,
        name: "Servicio de personal",
        description: "Texto breve del servicio.",
        price: 800.0,
        status: ServiceStatus.INACTIVE,
      });
    });

    it("returns empty services list when no non-deleted services exist (RF-1.2.6.2.1)", async () => {
      serviceRepository = new InMemoryServiceRepository([]);
      app = buildApp();

      const response = await request(app)
        .get("/api/admin/services")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(200);
      expect(response.body.data.services).toEqual([]);
      expect(response.body.metadata.pagination.total_records).toBe(0);
    });
  });

  describe("2 - Crear servicio: POST /api/admin/services", () => {
    it("creates a new service with status ACTIVE and returns 201 with Location header (RF-1.2.6.3.4, RF-1.2.6.3.5)", async () => {
      const response = await request(app)
        .post("/api/admin/services")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Decoración floral",
            description: "Centros de mesa y ambientación",
            price: 2500.5,
          },
        });

      expect(response.status).toBe(201);
      expect(response.headers.location).toMatch(/^\/api\/admin\/services\/\d+$/);
      expect(response.text).toBe("");
    });

    it("rejects missing or invalid fields with 400 Bad Request (RF-1.2.6.3.1)", async () => {
      const response = await request(app)
        .post("/api/admin/services")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "   ",
            description: "",
            price: -5,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.name).toBeDefined();
      expect(response.body.errors.description).toBeDefined();
      expect(response.body.errors.price).toBeDefined();
    });

    it("rejects duplicate active name with 409 Conflict (RF-1.2.6.3.2)", async () => {
      const response = await request(app)
        .post("/api/admin/services")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "  banquetes y bebidas  ",
            description: "Intento duplicado",
            price: 1200,
          },
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Ya existe un servicio vigente con ese nombre.");
    });
  });

  describe("3 - Editar servicio: PATCH /api/admin/services/:id", () => {
    it("updates service details and responds 204 No Content (RF-1.2.6.4.1)", async () => {
      const response = await request(app)
        .patch("/api/admin/services/1")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Banquetes Gourmet Premium",
            description: "Menú de 4 tiempos",
            price: 3200.5,
          },
        });

      expect(response.status).toBe(204);
      expect(response.text).toBe("");

      const stored = await serviceRepository.findById(1);
      expect(stored.name).toBe("Banquetes Gourmet Premium");
      expect(stored.description).toBe("Menú de 4 tiempos");
      expect(stored.price).toBe(3200.5);
    });

    it("rejects duplicate active name from another service with 409 Conflict (RF-1.2.6.3.2)", async () => {
      const response = await request(app)
        .patch("/api/admin/services/1")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Música",
            description: "Intentando usar nombre del servicio 2",
            price: 1000,
          },
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Ya existe un servicio vigente con ese nombre.");
    });

    it("allows editing without changing the name", async () => {
      const response = await request(app)
        .patch("/api/admin/services/1")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Banquetes y bebidas",
            description: "Solo descripción actualizada",
            price: 1600,
          },
        });

      expect(response.status).toBe(204);
    });

    it("returns 404 for non-existent or deleted service", async () => {
      const notFoundResponse = await request(app)
        .patch("/api/admin/services/999")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Inexistente",
            description: "Desc",
            price: 500,
          },
        });
      expect(notFoundResponse.status).toBe(404);

      const deletedResponse = await request(app)
        .patch("/api/admin/services/9")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Eliminado",
            description: "Desc",
            price: 500,
          },
        });
      expect(deletedResponse.status).toBe(404);
    });

    it("returns 400 for invalid id parameter", async () => {
      const response = await request(app)
        .patch("/api/admin/services/invalid-id")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Algo",
            description: "Desc",
            price: 500,
          },
        });

      expect(response.status).toBe(400);
    });
  });

  describe("4 - Cambiar vigencia de servicio: PUT /api/admin/services/:id", () => {
    it("marks service as INACTIVE and returns 204 (RF-1.2.6.7.1)", async () => {
      const response = await request(app)
        .put("/api/admin/services/1")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            status: "INACTIVE",
          },
        });

      expect(response.status).toBe(204);

      const stored = await serviceRepository.findById(1);
      expect(stored.status).toBe(ServiceStatus.INACTIVE);
    });

    it("also supports PUT /api/admin/services/:id/status as per sequence diagram", async () => {
      const response = await request(app)
        .put("/api/admin/services/2/status")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            status: "INACTIVE",
          },
        });

      expect(response.status).toBe(204);

      const stored = await serviceRepository.findById(2);
      expect(stored.status).toBe(ServiceStatus.INACTIVE);
    });

    it("reactivates service to ACTIVE and returns 204 (RF-1.2.6.11.2)", async () => {
      const response = await request(app)
        .put("/api/admin/services/7")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            status: "ACTIVE",
          },
        });

      expect(response.status).toBe(204);

      const stored = await serviceRepository.findById(7);
      expect(stored.status).toBe(ServiceStatus.ACTIVE);
    });

    it("rejects reactivating when another active service already has that name (RF-1.2.6.11.1)", async () => {
      // Create active service with name "Servicio de personal"
      await request(app)
        .post("/api/admin/services")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Servicio de personal",
            description: "Nuevo personal",
            price: 1000,
          },
        });

      // Try to reactivate service 7
      const response = await request(app)
        .put("/api/admin/services/7")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            status: "ACTIVE",
          },
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Ya existe un servicio vigente con ese nombre.");
    });

    it("rejects changing a service to its same status with 409 Conflict", async () => {
      const response = await request(app)
        .put("/api/admin/services/1")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            status: "ACTIVE",
          },
        });

      expect(response.status).toBe(409);
    });

    it("rejects DELETED status with 422 Unprocessable Entity", async () => {
      const response = await request(app)
        .put("/api/admin/services/1")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            status: "DELETED",
          },
        });

      expect(response.status).toBe(422);
    });

    it("returns 404 for non-existent or deleted service", async () => {
      const notFoundResponse = await request(app)
        .put("/api/admin/services/999")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: { status: "ACTIVE" },
        });
      expect(notFoundResponse.status).toBe(404);

      const deletedResponse = await request(app)
        .put("/api/admin/services/9")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: { status: "ACTIVE" },
        });
      expect(deletedResponse.status).toBe(404);
    });
  });

  describe("5 - Eliminar servicio: DELETE /api/admin/services/:id", () => {
    it("soft deletes a service and returns 204 No Content (RF-1.2.6.8)", async () => {
      const response = await request(app)
        .delete("/api/admin/services/1")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(204);
      expect(response.text).toBe("");

      const stored = await serviceRepository.findById(1);
      expect(stored.status).toBe(ServiceStatus.DELETED);
    });

    it("returns 404 when deleting an already deleted service", async () => {
      const response = await request(app)
        .delete("/api/admin/services/9")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(404);
    });

    it("returns 404 when deleting a non-existent service", async () => {
      const response = await request(app)
        .delete("/api/admin/services/999")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(404);
    });
  });

  describe("Client catalog isolation (RF-1.2.6.9)", () => {
    it("client route /api/client/services only reflects active services", async () => {
      // Initial client list: service 1 and 2 are active
      const initialResponse = await request(app).get("/api/client/services");
      expect(initialResponse.status).toBe(200);
      expect(initialResponse.body.data.services.map((s) => s.id)).toEqual([1, 2]);

      // Deactivate service 1
      await request(app)
        .put("/api/admin/services/1")
        .set("Cookie", ["auth_token=valid"])
        .send({ data: { status: "INACTIVE" } });

      // Client list should now only contain service 2
      const afterDeactivation = await request(app).get("/api/client/services");
      expect(afterDeactivation.body.data.services.map((s) => s.id)).toEqual([2]);

      // Reactivate service 7
      await request(app)
        .put("/api/admin/services/7")
        .set("Cookie", ["auth_token=valid"])
        .send({ data: { status: "ACTIVE" } });

      // Client list should now contain service 2 and 7
      const afterReactivation = await request(app).get("/api/client/services");
      expect(afterReactivation.body.data.services.map((s) => s.id)).toEqual([2, 7]);
    });
  });
});
