import { Pool, PoolConfig } from 'pg';

export function createPostgresPool(overrides: PoolConfig = {}): Pool {
  const config: PoolConfig = {};

  if (process.env.DATABASE_URL) {
    config.connectionString = process.env.DATABASE_URL;
  } else {
    if (process.env.PGHOST) config.host = process.env.PGHOST;
    if (process.env.PGPORT) config.port = Number(process.env.PGPORT);
    if (process.env.PGUSER) config.user = process.env.PGUSER;
    if (process.env.PGPASSWORD) config.password = process.env.PGPASSWORD;
    if (process.env.PGDATABASE) config.database = process.env.PGDATABASE;
  }

  return new Pool({ ...config, ...overrides });
}