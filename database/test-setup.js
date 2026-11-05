// eslint-disable-next-line import/no-extraneous-dependencies -- archivo solo de pruebas
const Test = require("supertest/lib/test");

require("./test-database").useTestDatabase();

// supertest escucha en el puerto 0 sin host ("::") pero se conecta a 127.0.0.1. En macOS otro
// proceso (p. ej. VS Code) puede tener ese mismo puerto en 127.0.0.1 y recibir la petición, lo
// que daba fallas intermitentes con códigos aleatorios. Si el servidor quedó en "::", se
// conecta por [::1], que llega al servidor de la prueba. Sin IPv6 no cambia nada.
// shortcut: depende del método interno serverAddress de supertest; revisar al actualizarlo.
const originalServerAddress = Test.prototype.serverAddress;
Test.prototype.serverAddress = function serverAddress(app, path) {
  const url = originalServerAddress.call(this, app, path);

  return app.address()?.address === "::" ? url.replace("://127.0.0.1:", "://[::1]:") : url;
};
