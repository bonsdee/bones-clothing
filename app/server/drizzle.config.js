import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema.js',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'mysql://root:password@127.0.0.1:3306/drop_restock_manager'
  },
  strict: true,
  verbose: true
});
