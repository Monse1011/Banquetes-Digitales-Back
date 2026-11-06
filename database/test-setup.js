/* global beforeAll */
const net = require("net");
// eslint-disable-next-line import/no-extraneous-dependencies -- archivo solo de pruebas
const Test = require("supertest/lib/test");

require("./test-database").useTestDatabase();

// supertest escucha en el puerto 0 sin host ("::") pero se conecta a 127.0.0.1. En macOS otro
// proceso (p. ej. VS Code) puede tener ese mismo puerto en 127.0.0.1 y recibir la petición, lo
// que daba fallas intermitentes con códigos aleatorios. Si el servidor quedó en "::" y ::1 es
// utilizable, se conecta por [::1], que llega al servidor de la prueba. Sin ::1 (IPv6
// desactivado o contenedor sin loopback IPv6) se queda en 127.0.0.1.
// shortcut: depende del método interno serverAddress de supertest; revisar al actualizarlo.
let ipv6LoopbackAvailable = false;

beforeAll(async () => {
  ipv6LoopbackAvailable = await new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(0, "::1", () => probe.close(() => resolve(true)));
  });
});

const originalServerAddress = Test.prototype.serverAddress;
Test.prototype.serverAddress = function serverAddress(app, path) {
  const url = originalServerAddress.call(this, app, path);

  return ipv6LoopbackAvailable && app.address()?.address === "::"
    ? url.replace("://127.0.0.1:", "://[::1]:")
    : url;
};
