// Contratos 11 y 12 + galería y redes (Función 4.1) contra el PostgreSQL desechable.
// AD-11: sin page/per_page llega la lista completa vigente; los parámetros explícitos
// del DAD se honran cuando el cliente los envía.
const { Pool } = require("pg");
const request = require("supertest");
const { createApp } = require("../app");
const {
  PostgresPromotionRepository,
} = require("../../infrastructure/repositories/promotion/postgres-promotion-repository");
const {
  PostgresGalleryRepository,
} = require("../../infrastructure/repositories/content/postgres-gallery-repository");
const {
  PostgresSocialLinkRepository,
} = require("../../infrastructure/repositories/content/postgres-social-link-repository");
const {
  PostgresServiceRepository,
} = require("../../infrastructure/repositories/service/postgres-service-repository");
const { AdminRequestMessages } = require("../../domain/constants/admin-request-messages");
const { ClientProposalMessages } = require("../../domain/constants/client-proposal-messages");

function notUsed(_req, res) {
  res.sendStatus(501);
}

function buildApp(connection) {
  return createApp({
    authController: {
      session: notUsed,
      logout: notUsed,
      login: notUsed,
      changePassword: notUsed,
      firstAccess: notUsed,
    },
    passwordResetController: { requestReset: notUsed, resetPassword: notUsed },
    tokenService: { verifyToken: () => ({ id_user: 1, role: "ADMIN" }) },
    resourceUseCases: {},
    humanResourceUseCases: {},
    materialResourceUseCases: {},
    logisticResourceUseCases: {},
    serviceRepository: new PostgresServiceRepository(connection),
    promotionRepository: new PostgresPromotionRepository(connection),
    galleryRepository: new PostgresGalleryRepository(connection),
    socialLinkRepository: new PostgresSocialLinkRepository(connection),
  });
}

async function insert(db, sql, values = []) {
  const { rows } = await db.query(sql, values);

  return rows[0];
}

async function insertService(db, name, description, price, status = "ACTIVE") {
  return insert(
    db,
    `INSERT INTO services (name, description, price, status)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, description, price, status]
  );
}

// valid_until se pasa como expresión SQL controlada por la prueba (now() ± interval).
async function insertPromotion(db, name, validUntilExpr, status = "ACTIVE", discount = 10) {
  return insert(
    db,
    `INSERT INTO promotions (name, description, discount_percentage, valid_until, status)
     VALUES ($1, 'Descuento de prueba', $2, ${validUntilExpr}, $3) RETURNING id`,
    [name, discount, status]
  );
}

describe.skipIf(!process.env.TEST_PGDATABASE)(
  "Contenido público contra PostgreSQL (función 4.1)",
  () => {
    let pool;
    let connection;
    let app;

    beforeAll(() => {
      if (process.env.TEST_PGDATABASE === process.env.PGDATABASE) {
        throw new Error("TEST_PGDATABASE must not be the development database");
      }
      pool = new Pool({ database: process.env.TEST_PGDATABASE });
    });

    afterAll(() => pool.end());

    beforeEach(async () => {
      connection = await pool.connect();
      await connection.query("BEGIN");
      // Aísla los catálogos del seed global de pruebas; el ROLLBACK los devuelve intacto.
      await connection.query("DELETE FROM request_services");
      await connection.query("DELETE FROM services");
      await connection.query("DELETE FROM promotions");
      app = buildApp(connection);
    });

    afterEach(async () => {
      await connection.query("ROLLBACK");
      connection.release();
    });

    const get = (url, query = {}) => request(app).get(url).query(query);

    describe("GET /api/client/services (contrato 12)", () => {
      it("lista completa vigente con id, name, description y price, orden name,id", async () => {
        await insertService(connection, "Decoración", "Flores", 50);
        await insertService(connection, "Banquetes", "Menú", 100);
        await insertService(connection, "Fotografía", "Fotos", 75, "INACTIVE");

        const response = await get("/api/client/services");

        expect(response.status).toBe(200);
        expect(response.body.data.services).toEqual([
          { id: expect.any(Number), name: "Banquetes", description: "Menú", price: 100 },
          { id: expect.any(Number), name: "Decoración", description: "Flores", price: 50 },
        ]);
        expect(response.body.metadata.pagination.total_records).toBe(2);
      });

      it("page/per_page explícitos rebanan (contrato 12) y llegan los nombres repetidos por id", async () => {
        const first = await insertService(connection, "Mismo Nombre", "A", 10);
        await insertService(connection, "Otro", "B", 20);

        const response = await get("/api/client/services", { page: "1", per_page: "1" });

        expect(response.body.data.services).toEqual([
          { id: first.id, name: "Mismo Nombre", description: "A", price: 10 },
        ]);
        expect(response.body.metadata.pagination).toEqual({
          total_records: 2,
          page: 1,
          per_page: 1,
        });
      });

      it("per_page fuera de 1 a 100 responde 400", async () => {
        const response = await get("/api/client/services", { per_page: "101" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(AdminRequestMessages.PAGINATION_INVALID);
      });

      it("sin servicios vigentes responde 200 con arreglo vacío (RF-3.4.1.2.5)", async () => {
        await insertService(connection, "Solo Inactivo", "x", 10, "INACTIVE");

        const response = await get("/api/client/services");

        expect(response.status).toBe(200);
        expect(response.body.data.services).toEqual([]);
      });
    });

    describe("GET /api/client/promotions (contrato 11)", () => {
      it("expira antes de listar: una ACTIVE vencida ayer desaparece y queda INACTIVE en la BD", async () => {
        const expired = await insertPromotion(connection, "Vencida", "now() - interval '1 day'");
        await insertPromotion(
          connection,
          "Hoy es el último día",
          "(now() AT TIME ZONE 'America/Merida')::date"
        );
        await insertPromotion(connection, "Futura", "now() + interval '30 days'");
        await insertPromotion(connection, "Inactiva", "now() + interval '30 days'", "INACTIVE");

        const response = await get("/api/client/promotions");

        expect(response.status).toBe(200);
        expect(response.body.data.promotions.map((p) => p.name)).toEqual([
          "Futura",
          "Hoy es el último día",
        ]);
        expect(response.body.data.promotions[0]).toEqual({
          id: expect.any(Number),
          name: "Futura",
          description: "Descuento de prueba",
          discount_percentage: 10,
          valid_until: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        });

        const { rows } = await connection.query("SELECT status FROM promotions WHERE id = $1", [
          expired.id,
        ]);
        expect(rows[0].status).toBe("INACTIVE");
      });

      it("sin promociones vigentes responde 200 con arreglo vacío", async () => {
        const response = await get("/api/client/promotions");

        expect(response.body.data.promotions).toEqual([]);
      });
    });

    describe("GET /api/client/gallery y /api/client/social-links (diagrama Función 3.4)", () => {
      it("galería ordenada por position,id con el seed del esquema", async () => {
        const response = await get("/api/client/gallery");

        expect(response.status).toBe(200);
        expect(response.body.data.gallery).toHaveLength(4);
        expect(response.body.data.gallery[0]).toEqual({
          id: expect.any(Number),
          url: "/images/boda.jpeg",
          title: "Bodas en hacienda",
          alt: "Boda en hacienda",
        });
      });

      it("galería vacía responde 200 con arreglo vacío", async () => {
        await connection.query("DELETE FROM gallery_photos");

        const response = await get("/api/client/gallery");

        expect(response.body.data.gallery).toEqual([]);
      });

      it("redes: solo las registradas, sin paginación (RF-3.4.1.3)", async () => {
        const response = await get("/api/client/social-links");

        expect(response.status).toBe(200);
        expect(response.body.data.social_links).toEqual([
          { network: "FACEBOOK", url: "https://facebook.com/banqueteselegancia" },
          { network: "INSTAGRAM", url: "https://instagram.com/banqueteselegancia" },
        ]);
        expect(response.body.metadata).toBeUndefined();
      });
    });

    it("429 con el mensaje del DAD al exceder la limitación de solicitudes", async () => {
      process.env.CLIENT_RATE_LIMIT_MAX = "2";
      const limited = buildApp(connection);

      expect((await request(limited).get("/api/client/gallery")).status).toBe(200);
      expect((await request(limited).get("/api/client/gallery")).status).toBe(200);
      const response = await request(limited).get("/api/client/gallery");

      expect(response.status).toBe(429);
      expect(response.body.message).toBe(ClientProposalMessages.TOO_MANY_REQUESTS);

      delete process.env.CLIENT_RATE_LIMIT_MAX;
    });
  }
);
