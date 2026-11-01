import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { openDb } from './db/connection.ts';

const port = Number(process.env.PORT ?? 8787);
const db = openDb(process.env.DB_PATH ?? 'data/mi360.db');
const app = createApp(db, { uploadDir: process.env.UPLOAD_DIR ?? 'data/uploads' });

serve({ fetch: app.fetch, port }, () => {
  console.log(`API em http://localhost:${port}/api`);
});
