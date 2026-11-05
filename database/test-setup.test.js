const http = require("http");
const request = require("supertest");

// Regresión de las fallas intermitentes de supertest (ver test-setup.js): la petición debe
// llegar al servidor de la prueba aunque otro proceso ocupe el mismo puerto en 127.0.0.1.
describe("test-setup: conexión de supertest", () => {
  it("llega al servidor de la prueba aunque otro proceso tenga el puerto en 127.0.0.1", async () => {
    const app = http.createServer((_req, res) => res.end("prueba"));
    app.listen(0);
    const { port } = app.address();
    // Simula a VS Code: otro servidor en el mismo puerto, pero en 127.0.0.1.
    const intruder = http.createServer((_req, res) => res.end("intruso"));
    const intruderUp = await new Promise((resolve) => {
      intruder.once("error", () => resolve(false));
      intruder.listen(port, "127.0.0.1", () => resolve(true));
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
});
