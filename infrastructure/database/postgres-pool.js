const { Pool } = require("pg");

function createPostgresPool(databaseConfig = {}, overrides = {}) {
  const config = {};

  if (databaseConfig.url) {
    config.connectionString = databaseConfig.url;
  } else {
    if (databaseConfig.host) config.host = databaseConfig.host;
    if (databaseConfig.port) config.port = Number(databaseConfig.port);
    if (databaseConfig.user) config.user = databaseConfig.user;
    if (databaseConfig.password) config.password = databaseConfig.password;
    if (databaseConfig.database) config.database = databaseConfig.database;
  }

  return new Pool({ ...config, ...overrides });
}

module.exports = { createPostgresPool };
