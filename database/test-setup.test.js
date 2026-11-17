const http = require("http");
const net = require("net");
const request = require("supertest");

function ipv6LoopbackAvailable() {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(0, "::1", () => probe.close(() => resolve(true)));
  });
}

function listen(handler) {
  const app = http.createServer(handler);
  app.listen(0);
  return app;
}

// Regresión de las fallas intermitentes de supertest (ver test-setup.js).
describe("test-setup: conexión de supertest", () => {
  it("con ::1, llega al servidor de la prueba aunque otro proceso tenga el puerto en 127.0.0.1", async (context) => {
    if (!(await ipv6LoopbackAvailable())) context.skip();

    const app = listen((_req, res) => res.end("prueba"));
    // Simula a VS Code: otro servidor en el mismo puerto, pero en 127.0.0.1.
    const intruder = http.createServer((_req, res) => res.end("intruso"));
    const intruderUp = await new Promise((resolve) => {
      intruder.once("error", () => resolve(false));
      intruder.listen(app.address().port, "127.0.0.1", () => resolve(true));
    });

    try {
      const response = await request(app).get("/");

      // En macOS el intruso sí se levanta; en otros sistemas el puerto ya está ocupado.
      expect(intruderUp || process.platform !== "darwin").toBe(true);
      expect(response.text).toBe("prueba");
    } finally {
      app.close();
      if (intruder.listening) intruder.close();
    }
  });

  it("sin ::1 (IPv6 desactivado), vuelve a 127.0.0.1 y sigue funcionando", async (context) => {
    if (await ipv6LoopbackAvailable()) context.skip();

    const app = listen((_req, res) => res.end("prueba"));

    try {
      const test = request(app).get("/");

      expect(test.url).toContain("://127.0.0.1:");
      expect((await test).text).toBe("prueba");
    } finally {
      app.close();
    }
  });
});
