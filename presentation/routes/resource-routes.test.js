const request = require("supertest");
const { createApp } = require("../app");
const {
  InMemoryResourceRepository,
} = require("../../infrastructure/repositories/resource/in-memory-resource-repository");
const {
  InMemoryOperativeRoleRepository,
} = require("../../infrastructure/repositories/operative-role/in-memory-operative-role-repository");
const {
  createResourceUseCases,
} = require("../../application/use-cases/resource/create-resource-use-cases");
const { Resource } = require("../../domain/entities/resource/resource");
const { OperativeRole } = require("../../domain/entities/operative-role/operative-role");
const { ResourceType } = require("../../domain/enums/resource/resource-type");
const UserRole = require("../../domain/enums/auth/user-role");

const AUTH_COOKIE = "auth_token=valid-token";

const notUsed = (_req, res) => res.status(501).end();

function resource(id, name, type, isActive = true) {
  const now = new Date();
  const isHuman = type === ResourceType.HUMAN;

  return new Resource(
    id,
    name,
    type,
    isHuman ? 1 : null,
    isHuman ? 1 : 10,
    isHuman ? null : 100,
    isActive,
    now,
    now,
    null
  );
}

function buildApp(role) {
  const resourceRepository = new InMemoryResourceRepository([
    resource(1, "David Torres", ResourceType.HUMAN),
    resource(2, "Pedro Gómez", ResourceType.HUMAN, false),
    resource(3, "Cable HDMI", ResourceType.MATERIAL),
    resource(4, "Camioneta", ResourceType.LOGISTIC),
  ]);
  const operativeRoleRepository = new InMemoryOperativeRoleRepository([
    new OperativeRole(1, "Mesero", true),
  ]);

  return createApp({
    authController: { login: notUsed, changePassword: notUsed, firstAccess: notUsed },
    passwordResetController: { requestReset: notUsed, resetPassword: notUsed },
    tokenService: { verifyToken: () => ({ id_user: 1, role }) },
    ...createResourceUseCases(resourceRepository, operativeRoleRepository),
  });
}

describe("Resource routes (Funciones 2.8 a 2.10)", () => {
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
        { id: 1, name: "David Torres", type: "HUMAN", operative_role_id: 1, is_active: true },
      ]);
      expect(response.body.metadata.pagination).toEqual({
        total_records: 1,
        page: 1,
        per_page: 10,
      });
    });

    it("creates a human resource and returns its location", async () => {
      const response = await request(app)
        .post("/api/admin/resources/human")
        .set("Cookie", AUTH_COOKIE)
        .send({ data: { name: "Ana López", operative_role_id: 1 } });

      expect(response.status).toBe(201);
      expect(response.headers.location).toBe("/api/admin/resources/human/5");
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

    it("returns the detail, edits and deactivates a human resource", async () => {
      const detail = await request(app)
        .get("/api/admin/resources/human/1")
        .set("Cookie", AUTH_COOKIE);
      const update = await request(app)
        .patch("/api/admin/resources/human/1")
        .set("Cookie", AUTH_COOKIE)
        .send({ data: { name: "David Tec", operative_role_id: 1 } });
      const deactivate = await request(app)
        .put("/api/admin/resources/human/1")
        .set("Cookie", AUTH_COOKIE)
        .send({ data: { is_active: false } });

      expect(detail.status).toBe(200);
      expect(detail.body.data.resource).toMatchObject({ id: 1, name: "David Torres" });
      expect(update.status).toBe(204);
      expect(deactivate.status).toBe(204);
    });

    it.each([
      ["material", 3],
      ["logistic", 4],
    ])("manages %s resources", async (path, existingId) => {
      const create = await request(app)
        .post(`/api/admin/resources/${path}/`)
        .set("Cookie", AUTH_COOKIE)
        .send({ data: { name: "Mesas", quantity: 4, unit_cost: 1000 } });
      const list = await request(app)
        .get(`/api/admin/resources/${path}?sort_by=name&order=asc`)
        .set("Cookie", AUTH_COOKIE);
      const update = await request(app)
        .patch(`/api/admin/resources/${path}/${existingId}`)
        .set("Cookie", AUTH_COOKIE)
        .send({ data: { name: "Nuevo nombre", quantity: 3, unit_cost: 1200 } });
      const detail = await request(app)
        .get(`/api/admin/resources/${path}/${existingId}`)
        .set("Cookie", AUTH_COOKIE);
      const deactivate = await request(app)
        .put(`/api/admin/resources/${path}/${existingId}`)
        .set("Cookie", AUTH_COOKIE)
        .send({ data: { is_active: false } });

      expect(create.status).toBe(201);
      expect(create.headers.location).toBe(`/api/admin/resources/${path}/5`);
      expect(list.body.data.resources).toHaveLength(2);
      expect(update.status).toBe(204);
      expect(detail.body.data.resource).toMatchObject({
        name: "Nuevo nombre",
        quantity: 3,
        unit_cost: 1200,
      });
      expect(deactivate.status).toBe(204);
    });

    it("soft deletes logistic resources with DELETE", async () => {
      const response = await request(app)
        .delete("/api/admin/resources/logistic/4")
        .set("Cookie", AUTH_COOKIE);
      const detail = await request(app)
        .get("/api/admin/resources/logistic/4")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(204);
      expect(detail.body.data.resource.is_active).toBe(false);
    });

    it("does not expose DELETE for material resources", async () => {
      const response = await request(app)
        .delete("/api/admin/resources/material/3")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(404);
    });

    it("lists resources of every type or of the requested type", async () => {
      const all = await request(app).get("/api/admin/resources").set("Cookie", AUTH_COOKIE);
      const materials = await request(app)
        .get("/api/admin/resources?type=MATERIAL&name=cable")
        .set("Cookie", AUTH_COOKIE);

      const humans = await request(app)
        .get("/api/admin/resources?type=HUMAN")
        .set("Cookie", AUTH_COOKIE);

      expect(all.body.data.resources.map((item) => item.id)).toEqual([3, 4, 1]);
      expect(materials.body.data.resources.map((item) => item.id)).toEqual([3]);
      // NC-06: el filtro usa los valores del contrato (HUMAN, MATERIAL, LOGISTIC).
      expect(humans.body.data.resources).toEqual([
        { id: 1, name: "David Torres", type: "HUMAN", operative_role_id: 1, is_active: true },
      ]);
    });

    it("returns 404 for invalid ids or resources of another type", async () => {
      const invalid = await request(app)
        .get("/api/admin/resources/human/abc")
        .set("Cookie", AUTH_COOKIE);
      const otherType = await request(app)
        .get("/api/admin/resources/material/4")
        .set("Cookie", AUTH_COOKIE);

      expect(invalid.status).toBe(404);
      expect(otherType.status).toBe(404);
      expect(otherType.body.message).toBe("El recurso material no existe.");
    });

    it("cannot use the logistics listings", async () => {
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

    it("cannot manage the resource catalogs", async () => {
      const response = await request(app)
        .get("/api/admin/resources/material")
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(403);
    });

    it.each([
      ["human", [1]],
      ["material", [3]],
      ["logistic", [4]],
    ])("only sees active %s resources", async (path, expectedIds) => {
      const response = await request(app)
        .get(`/api/logistics/resources/${path}?status=inactive`)
        .set("Cookie", AUTH_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data.resources.map((item) => item.id)).toEqual(expectedIds);
    });
  });

  it("requires authentication", async () => {
    const response = await request(buildApp(UserRole.ADMIN)).get("/api/admin/resources/human");

    expect(response.status).toBe(401);
  });
});
