const request = require("supertest");
const { createApp } = require("../app");
const {
  InMemoryResourceRepository,
} = require("../../infrastructure/repositories/resource/in-memory-resource-repository");
const {
  InMemoryOperativeRoleRepository,
} = require("../../infrastructure/repositories/operative-role/in-memory-operative-role-repository");
const {
  CreateHumanResourceUseCase,
} = require("../../application/use-cases/resource/create-human-resource-use-case");
const {
  UpdateHumanResourceUseCase,
} = require("../../application/use-cases/resource/update-human-resource-use-case");
const {
  ChangeHumanResourceStatusUseCase,
} = require("../../application/use-cases/resource/change-human-resource-status-use-case");
const {
  GetHumanResourcesUseCase,
} = require("../../application/use-cases/resource/get-human-resources-use-case");
const {
  GetHumanResourceUseCase,
} = require("../../application/use-cases/resource/get-human-resource-use-case");
const { Resource } = require("../../domain/entities/resource/resource");
const { OperativeRole } = require("../../domain/entities/operative-role/operative-role");
const { ResourceType } = require("../../domain/enums/resource/resource-type");
const UserRole = require("../../domain/enums/auth/user-role");

const AUTH_COOKIE = "auth_token=valid-token";

const notUsed = (_req, res) => res.status(501).end();

function humanResource(id, name, isActive = true) {
  const now = new Date();

  return new Resource(id, name, ResourceType.HUMAN, 1, 1, null, isActive, now, now, null);
}

function buildApp(role) {
  const resourceRepository = new InMemoryResourceRepository([
    humanResource(1, "David Torres"),
    humanResource(2, "Pedro Gómez", false),
  ]);
  const operativeRoleRepository = new InMemoryOperativeRoleRepository([
    new OperativeRole(1, "Mesero", true),
  ]);

  return createApp({
    authController: { login: notUsed, changePassword: notUsed, firstAccess: notUsed },
    passwordResetController: { requestReset: notUsed, resetPassword: notUsed },
    tokenService: { verifyToken: () => ({ id_user: 1, role }) },
    createHumanResourceUseCase: new CreateHumanResourceUseCase(
      resourceRepository,
      operativeRoleRepository
    ),
    updateHumanResourceUseCase: new UpdateHumanResourceUseCase(
      resourceRepository,
      operativeRoleRepository
    ),
    changeHumanResourceStatusUseCase: new ChangeHumanResourceStatusUseCase(
      resourceRepository,
      operativeRoleRepository
    ),
    getHumanResourcesUseCase: new GetHumanResourcesUseCase(resourceRepository),
    getHumanResourceUseCase: new GetHumanResourceUseCase(resourceRepository),
  });
}

describe("Human resource routes (Función 2.8)", () => {
  describe("as Administrador General", () => {
    let app;

    beforeEach(() => {
      app = buildApp(UserRole.ADMIN);
    });

    it("lists active human resources with pagination metadata", async () => {
      const response = await request(app)
        .get("/api/admin/resources/human?status=active&sort_by=name&order=asc&page=1&per_page=10")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data.resources).toEqual([
        { id: 1, name: "David Torres", type: "humano", operative_role_id: 1, is_active: true },
      ]);
      expect(response.body.metadata.pagination).toEqual({
        total_records: 1,
        page: 1,
        per_page: 10,
      });
    });

    it("creates a resource and returns its location", async () => {
      const response = await request(app)
        .post("/api/admin/resources/human")
        .set("Cookie", AUTH_COOKIE)
        .send({ data: { name: "Ana López", operative_role_id: 1 } });

      expect(response.status).toBe(201);
      expect(response.headers.location).toBe("/api/admin/resources/human/3");
    });

    it("asks for confirmation before registering a possible duplicate", async () => {
      const response = await request(app)
        .post("/api/admin/resources/human")
        .set("Cookie", AUTH_COOKIE)
        .send({ data: { name: "David Torres", operative_role_id: 1 } });

      expect(response.status).toBe(409);
      expect(response.body.requires_confirmation).toBe(true);
    });

    it("returns 422 with the field errors when the body is invalid", async () => {
      const response = await request(app)
        .post("/api/admin/resources/human")
        .set("Cookie", AUTH_COOKIE)
        .send({ name: "Ana López" });

      expect(response.status).toBe(422);
      expect(Object.keys(response.body.errors)).toEqual(["name", "operative_role_id"]);
    });

    it("returns the detail of a resource", async () => {
      const response = await request(app)
        .get("/api/admin/resources/human/1")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data.resource).toMatchObject({ id: 1, name: "David Torres" });
    });

    it("edits the name and answers with 204", async () => {
      const response = await request(app)
        .patch("/api/admin/resources/human/1")
        .set("Cookie", AUTH_COOKIE)
        .send({ data: { name: "David Tec", operative_role_id: 1 } });

      expect(response.status).toBe(204);
    });

    it("deactivates a resource and answers with 204", async () => {
      const response = await request(app)
        .put("/api/admin/resources/human/1")
        .set("Cookie", AUTH_COOKIE)
        .send({ data: { is_active: false } });

      expect(response.status).toBe(204);
    });

    it("returns 404 for invalid or unknown ids", async () => {
      const invalid = await request(app)
        .get("/api/admin/resources/human/abc")
        .set("Cookie", AUTH_COOKIE);
      const unknown = await request(app)
        .get("/api/admin/resources/human/99")
        .set("Cookie", AUTH_COOKIE);

      expect(invalid.status).toBe(404);
      expect(unknown.status).toBe(404);
    });

    it("cannot use the logistics listing", async () => {
      const response = await request(app)
        .get("/api/logistics/resources/human")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(403);
    });
  });

  describe("as Personal de Logística", () => {
    let app;

    beforeEach(() => {
      app = buildApp(UserRole.LOGISTICA);
    });

    it("cannot manage the human resources catalog", async () => {
      const response = await request(app)
        .get("/api/admin/resources/human")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(403);
    });

    it("only sees active human resources", async () => {
      const response = await request(app)
        .get("/api/logistics/resources/human?status=inactive")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data.resources.map((resource) => resource.id)).toEqual([1]);
    });
  });

  it("requires authentication", async () => {
    const response = await request(buildApp(UserRole.ADMIN)).get("/api/admin/resources/human");

    expect(response.status).toBe(401);
  });
});
