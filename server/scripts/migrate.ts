import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../db';

async function migrate() {
  const directory = path.resolve(process.cwd(), 'server/migrations');
  const connection = await pool.getConnection();
  try {
    const [locks] = await connection.query<any[]>("SELECT GET_LOCK('acadex_migrations', 30) AS acquired");
    if (Number(locks[0].acquired) !== 1) throw new Error('Another migration is running. Try again shortly.');
    await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(200) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    const [applied] = await connection.query<any[]>('SELECT name FROM schema_migrations');
    for (const name of (await fs.readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
      if (applied.some((row) => row.name === name)) continue;
      const sql = await fs.readFile(path.join(directory, name), 'utf8');
      for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean)) {
        await connection.query(statement);
      }
      await connection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
      console.log('Applied', name);
    }
    console.log('Database migration completed.');
  } finally {
    await connection.query("SELECT RELEASE_LOCK('acadex_migrations')");
    connection.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
