import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.js';

declare global {
  var _postgresPool: InstanceType<typeof Pool> | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const sqlHost = process.env.SQL_HOST || process.env.PGHOST || '127.0.0.1';
    const sqlPort = parseInt(process.env.SQL_PORT || process.env.PGPORT || '5432', 10);
    const sqlUser = process.env.SQL_USER || process.env.PGUSER || 'postgres';
    const sqlPassword = process.env.SQL_PASSWORD !== undefined ? process.env.SQL_PASSWORD : process.env.PGPASSWORD;
    const sqlDatabase = process.env.SQL_DB_NAME || process.env.PGDATABASE || 'callnet_db';

    global._postgresPool = new Pool({
      host: sqlHost,
      port: sqlPort,
      user: sqlUser,
      password: sqlPassword,
      database: sqlDatabase,
      max: 10,
      connectionTimeoutMillis: 15000,
      ssl: process.env.SQL_HOST ? false : (process.env.PGHOST && !process.env.PGHOST.includes('127.0.0.1') ? { rejectUnauthorized: false } : false)
    });

    global._postgresPool.on('error', (err: any) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
export { pool };
