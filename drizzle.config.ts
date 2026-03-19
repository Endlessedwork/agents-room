import { defineConfig } from 'drizzle-kit';
import path from 'path';

export default defineConfig({
  out: './src/db/migrations',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(process.cwd(), 'data', 'agents-room.db'),
  },
});
