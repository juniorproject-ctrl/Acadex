import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { config } from './config';

dotenv.config({ path: '.env.local' });

export const pool = mysql.createPool({
  uri: config.databaseUrl(),
  connectionLimit: 10,
  waitForConnections: true,
  timezone: 'Z',
});

// DATETIME values and server-generated timestamps use the same UTC convention.
pool.pool.on('connection', (connection) => { connection.query("SET time_zone = '+00:00'"); });

export async function query<T>(sql: string, values: unknown[] = []): Promise<T> {
  const [rows] = await pool.execute(sql, values as mysql.ExecuteValues);
  return rows as T;
}
