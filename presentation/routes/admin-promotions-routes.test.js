const request = require("supertest");
const { createApp } = require("../app");
const { InMemoryPromotionRepository } = require("../../infrastructure/repositories/promotion/in-memory-promotion-repository");
const { Promotion } = require("../../domain/entities/promotion/promotion");
const PromotionStatus = require("../../domain/enums/promotion/promotion-status");
const UserRole = require("../../domain/enums/auth/user-role");

describe("Admin & Client Promotion Routes (Función 2.7 - Contrato API)", () => {
  let app;
  let promotionRepository;
  let currentUserId;
  let currentUserRole;

  function buildApp() {
    return createApp({
      tokenService: {
        verifyToken: () => ({ id_user: currentUserId, role: currentUserRole }),
      },
      promotionRepository,
      serviceRepository: { findAll: () => [] },
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

    promotionRepository = new InMemoryPromotionRepository([
      new Promotion(1, "Descuento de temporada", "Aplica en eventos de temporada.", 10.0, "2026-12-31", PromotionStatus.ACTIVE),
      new Promotion(2, "Promoción de verano", "Aplica en eventos de verano.", 5.0, "2026-08-31", PromotionStatus.INACTIVE),
      new Promotion(3, "Promoción eliminada", "No debe mostrarse.", 15.0, "2026-12-31", PromotionStatus.DELETED),
    ]);

    app = buildApp();
  });

  describe("Authentication & Role Authorization", () => {
    it("rejects unauthenticated requests with 401 Unauthorized", async () => {
      const response = await request(app).get("/api/admin/promotions");
      expect(response.status).toBe(401);
    });

    it("rejects non-admin roles with 403 Forbidden (RF-1.2.7.1)", async () => {
      currentUserRole = UserRole.LOGISTICS;
      const response = await request(app)
        .get("/api/admin/promotions")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(403);
    });
  });

  describe("6 - Listar promociones: GET /api/admin/promotions", () => {
    it("returns paginated promotions ordered by ACTIVE first, then INACTIVE, excluding DELETED (RF-1.2.7.2)", async () => {
      const response = await request(app)
        .get("/api/admin/promotions?page=1&per_page=10")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(200);
      expect(response.body.data.promotions).toHaveLength(2);
      expect(response.body.metadata.pagination).toEqual({
        total_records: 2,
        page: 1,
        per_page: 10,
      });

      expect(response.body.data.promotions[0]).toEqual({
        id: 1,
        name: "Descuento de temporada",
        description: "Aplica en eventos de temporada.",
        discount_percentage: 10.0,
        valid_until: "2026-12-31",
        status: PromotionStatus.ACTIVE,
      });

      expect(response.body.data.promotions[1]).toEqual({
        id: 2,
        name: "Promoción de verano",
        description: "Aplica en eventos de verano.",
        discount_percentage: 5.0,
        valid_until: "2026-08-31",
        status: PromotionStatus.INACTIVE,
      });
    });

    it("returns empty promotions list when no non-deleted promotions exist (RF-1.2.7.2.1)", async () => {
      promotionRepository = new InMemoryPromotionRepository([]);
      app = buildApp();

      const response = await request(app)
        .get("/api/admin/promotions")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(200);
      expect(response.body.data.promotions).toEqual([]);
      expect(response.body.metadata.pagination.total_records).toBe(0);
    });
  });

  describe("7 - Crear promoción: POST /api/admin/promotions", () => {
    it("creates a new promotion with status ACTIVE and returns 201 with Location header (RF-1.2.7.3.4, RF-1.2.7.3.5)", async () => {
      const response = await request(app)
        .post("/api/admin/promotions")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Descuento Fin de Año",
            description: "Aplica en diciembre",
            discount_percentage: 15.0,
            valid_until: "2026-12-31",
          },
        });

      expect(response.status).toBe(201);
      expect(response.headers.location).toMatch(/^\/api\/admin\/promotions\/\d+$/);
      expect(response.text).toBe("");
    });

    it("rejects invalid fields with 400 Bad Request (RF-1.2.7.3.1)", async () => {
      const response = await request(app)
        .post("/api/admin/promotions")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "   ",
            description: "",
            discount_percentage: -1,
            valid_until: "2020-01-01",
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.name).toBeDefined();
      expect(response.body.errors.description).toBeDefined();
      expect(response.body.errors.discount_percentage).toBeDefined();
      expect(response.body.errors.valid_until).toBeDefined();
    });

    it("rejects duplicate active name with 409 Conflict (RF-1.2.7.3.2)", async () => {
      const response = await request(app)
        .post("/api/admin/promotions")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "  descuento de temporada  ",
            description: "Intento duplicado",
            discount_percentage: 12.0,
            valid_until: "2026-12-31",
          },
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Ya existe una promoción vigente con ese nombre.");
    });
  });

  describe("8 - Editar promoción: PUT & PATCH /api/admin/promotions/:id", () => {
    it("updates promotion details with PUT and responds 204 No Content (RF-1.2.7.4.1)", async () => {
      const response = await request(app)
        .put("/api/admin/promotions/1")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Descuento de temporada extendido",
            description: "Nueva descripción",
            discount_percentage: 12.5,
            valid_until: "2027-01-31",
          },
        });

      expect(response.status).toBe(204);
      expect(response.text).toBe("");

      const stored = await promotionRepository.findById(1);
      expect(stored.name).toBe("Descuento de temporada extendido");
      expect(stored.discountPercentage).toBe(12.5);
      expect(stored.validUntil).toBe("2027-01-31");
    });

    it("also supports PATCH /api/admin/promotions/:id as per sequence diagram", async () => {
      const response = await request(app)
        .patch("/api/admin/promotions/1")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Descuento de temporada vía PATCH",
            description: "Descripción vía PATCH",
            discount_percentage: 11.0,
            valid_until: "2027-02-15",
          },
        });

      expect(response.status).toBe(204);

      const stored = await promotionRepository.findById(1);
      expect(stored.name).toBe("Descuento de temporada vía PATCH");
    });

    it("rejects editing an INACTIVE promotion with 409 Conflict (RF-1.2.7.4)", async () => {
      const response = await request(app)
        .put("/api/admin/promotions/2")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Intento editar inactiva",
            description: "Desc",
            discount_percentage: 5.0,
            valid_until: "2026-12-31",
          },
        });

      expect(response.status).toBe(409);
    });

    it("returns 404 for non-existent or deleted promotion", async () => {
      const notFoundResponse = await request(app)
        .put("/api/admin/promotions/999")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Inexistente",
            description: "Desc",
            discount_percentage: 5.0,
            valid_until: "2026-12-31",
          },
        });
      expect(notFoundResponse.status).toBe(404);

      const deletedResponse = await request(app)
        .put("/api/admin/promotions/3")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Eliminada",
            description: "Desc",
            discount_percentage: 5.0,
            valid_until: "2026-12-31",
          },
        });
      expect(deletedResponse.status).toBe(404);
    });

    it("returns 400 for invalid id parameter", async () => {
      const response = await request(app)
        .put("/api/admin/promotions/invalid-id")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            name: "Algo",
            description: "Desc",
            discount_percentage: 5.0,
            valid_until: "2026-12-31",
          },
        });

      expect(response.status).toBe(400);
    });
  });

  describe("9 - Marcar como no vigente: PUT /api/admin/promotions/:id & /status", () => {
    it("marks promotion as INACTIVE via PUT with { status: 'INACTIVE' } and returns 204 (RF-1.2.7.10.2)", async () => {
      const response = await request(app)
        .put("/api/admin/promotions/1")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            status: "INACTIVE",
          },
        });

      expect(response.status).toBe(204);

      const stored = await promotionRepository.findById(1);
      expect(stored.status).toBe(PromotionStatus.INACTIVE);
    });

    it("also supports PUT /api/admin/promotions/:id/status as per sequence diagram", async () => {
      const response = await request(app)
        .put("/api/admin/promotions/1/status")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            status: "INACTIVE",
          },
        });

      expect(response.status).toBe(204);

      const stored = await promotionRepository.findById(1);
      expect(stored.status).toBe(PromotionStatus.INACTIVE);
    });

    it("rejects reactivating (requesting status ACTIVE) with 409 Conflict (RF-1.2.7.6)", async () => {
      const response = await request(app)
        .put("/api/admin/promotions/2")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            status: "ACTIVE",
          },
        });

      expect(response.status).toBe(409);
    });

    it("rejects changing a promotion to its same status with 409 Conflict", async () => {
      const response = await request(app)
        .put("/api/admin/promotions/2")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            status: "INACTIVE",
          },
        });

      expect(response.status).toBe(409);
    });

    it("rejects DELETED status with 422 Unprocessable Entity", async () => {
      const response = await request(app)
        .put("/api/admin/promotions/1")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: {
            status: "DELETED",
          },
        });

      expect(response.status).toBe(422);
    });

    it("returns 404 for non-existent or deleted promotion", async () => {
      const notFoundResponse = await request(app)
        .put("/api/admin/promotions/999/status")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: { status: "INACTIVE" },
        });
      expect(notFoundResponse.status).toBe(404);

      const deletedResponse = await request(app)
        .put("/api/admin/promotions/3/status")
        .set("Cookie", ["auth_token=valid"])
        .send({
          data: { status: "INACTIVE" },
        });
      expect(deletedResponse.status).toBe(404);
    });
  });

  describe("10 - Eliminar promoción: DELETE /api/admin/promotions/:id", () => {
    it("soft deletes a promotion and returns 204 No Content (contrato_api endpoint 10)", async () => {
      const response = await request(app)
        .delete("/api/admin/promotions/1")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(204);
      expect(response.text).toBe("");

      const stored = await promotionRepository.findById(1);
      expect(stored.status).toBe(PromotionStatus.DELETED);
    });

    it("returns 404 when deleting an already deleted promotion", async () => {
      const response = await request(app)
        .delete("/api/admin/promotions/3")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(404);
    });

    it("returns 404 when deleting a non-existent promotion", async () => {
      const response = await request(app)
        .delete("/api/admin/promotions/999")
        .set("Cookie", ["auth_token=valid"]);

      expect(response.status).toBe(404);
    });
  });

  describe("11 - Catálogo público de promociones vigentes: GET /api/client/promotions", () => {
    it("returns only active non-expired promotions without authentication (RF-1.2.7.5, RF-1.2.7.7)", async () => {
      const response = await request(app).get("/api/client/promotions");

      expect(response.status).toBe(200);
      expect(response.body.data.promotions).toHaveLength(1);
      expect(response.body.data.promotions[0]).toEqual({
        id: 1,
        name: "Descuento de temporada",
        description: "Aplica en eventos de temporada.",
        discount_percentage: 10.0,
        valid_until: "2026-12-31",
      });
      expect(response.body.data.promotions[0].status).toBeUndefined();
      expect(response.body.metadata.pagination.total_records).toBe(1);
    });

    it("reflects immediate changes when a promotion is deactivated", async () => {
      await request(app)
        .put("/api/admin/promotions/1")
        .set("Cookie", ["auth_token=valid"])
        .send({ data: { status: "INACTIVE" } });

      const clientResponse = await request(app).get("/api/client/promotions");
      expect(clientResponse.status).toBe(200);
      expect(clientResponse.body.data.promotions).toHaveLength(0);
      expect(clientResponse.body.metadata.pagination.total_records).toBe(0);
    });
  });
});

