import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import type { DatabaseSync } from 'node:sqlite';
import { DB_PATH, FRONTEND_ORIGIN, SECURITY_LIMITS } from './config/constants.ts';
import { openDatabase } from './db/database.ts';
import { seedDatabase } from './db/seed.ts';
import { createAuthMiddleware } from './middleware/auth.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerFeedRoutes } from './routes/feed.ts';
import { registerSocialRoutes } from './routes/social.ts';
import { registerAdminRoutes } from './routes/admin.ts';

export interface BuildAppOptions {
  dbPath?: string;
  logger?: boolean;
}

export interface BuiltQuadApp {
  app: FastifyInstance;
  db: DatabaseSync;
}

export async function buildApp({
  dbPath = DB_PATH,
  logger = false,
}: BuildAppOptions = {}): Promise<BuiltQuadApp> {
  const app = Fastify({
    logger,
    bodyLimit: SECURITY_LIMITS.MAX_UPLOAD_BYTES + 1024 * 1024,
  });

  await app.register(cors, {
    origin: [
      FRONTEND_ORIGIN,
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
      'capacitor://localhost',
      'http://localhost',
      'https://localhost',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(multipart, {
    limits: {
      fileSize: SECURITY_LIMITS.MAX_UPLOAD_BYTES,
      files: 1,
    },
  });

  const db = openDatabase(dbPath);
  await seedDatabase(db);

  app.addHook('onClose', async () => {
    db.close();
  });

  const auth = createAuthMiddleware(db);

  app.get('/api/v1/health', async () => ({
    status: 'ok',
    version: '2.6.0',
    engine: 'fastify+sqlite-wal',
    timestamp: new Date().toISOString(),
  }));

  registerAuthRoutes(app, db, auth);
  registerFeedRoutes(app, db, auth);
  registerSocialRoutes(app, db, auth);
  registerAdminRoutes(app, db, auth);

  return { app, db };
}
