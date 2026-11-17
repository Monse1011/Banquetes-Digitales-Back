/* global vi */
const createClientRoutes = require("./client-routes");

describe("POST /api/client/request (contrato 16)", () => {
  let controller;
  let router;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("CLIENT_RATE_LIMIT_MAX", "2");
    controller = {
      create: vi.fn(async (_req, res) => res.status(201).json({ data: { folio: "BD-1" } })),
    };
    router = createClientRoutes(controller, {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  // Ejecuta el router Express completo sin abrir puertos ni acceder a PostgreSQL.
  function post(ip = "127.0.0.1") {
    return new Promise((resolve, reject) => {
      const response = {
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          resolve({ status: this.statusCode, body });
        },
      };
      router.handle({ method: "POST", url: "/request", ip, socket: {} }, response, reject);
    });
  }

  it("responde 429 al exceder el límite e impide crear otra solicitud", async () => {
    expect((await post()).status).toBe(201);
    expect((await post()).status).toBe(201);
    expect(await post()).toEqual({
      status: 429,
      body: { message: "Demasiadas solicitudes. Intente nuevamente en unos minutos." },
    });
    expect(controller.create).toHaveBeenCalledTimes(2);
  });

  it("limita cada IP por separado y vuelve a permitir solicitudes tras un minuto", async () => {
    await post();
    await post();
    expect((await post()).status).toBe(429);
    expect((await post("127.0.0.2")).status).toBe(201);

    vi.advanceTimersByTime(60 * 1000);

    expect((await post()).status).toBe(201);
    expect(controller.create).toHaveBeenCalledTimes(4);
  });
});
