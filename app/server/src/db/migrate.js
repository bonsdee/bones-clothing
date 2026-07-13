/**
 * Runs pending Drizzle migrations against DATABASE_URL. Safe to run on every
 * deploy — drizzle tracks applied migrations in `__drizzle_migrations`.
 *
 * Usage: npm run db:migrate
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';

async function main() {
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  const db = drizzle(connection);

  console.log('Running migrations from ./src/db/migrations ...');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('Migrations complete.');

  await connection.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
