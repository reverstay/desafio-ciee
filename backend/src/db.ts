import sql from 'mssql';
import type { DbConfig } from './config.js';

export async function connect(config: DbConfig): Promise<sql.ConnectionPool> {
  const pool = new sql.ConnectionPool({
    ...config,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  });
  return pool.connect();
}

export { sql };
