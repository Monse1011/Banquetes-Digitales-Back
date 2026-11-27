const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    globals: true,
    setupFiles: ["./database/test-setup.js"],
    globalSetup: ["./database/test-global-setup.js"],
    // schema-persistence.test.js reinicia el contenedor: ninguna otra prueba debe usarlo a la vez.
    fileParallelism: false,
  },
});
