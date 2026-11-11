import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { DB_PATH, FRONTEND_ORIGIN, SECURITY_LIMITS } from './config/constants.js';
import { openDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerFeedRoutes } from './routes/feed.js';
import { registerSocialRoutes } from './routes/social.js';
import { registerAdminRoutes } from './routes/admin.js';

export async function buildApp({ dbPath = DB_PATH, logger = false } = {}) {
  const app = Fastify({
    logger,
    bodyLimit: SECURITY_LIMITS.MAX_UPLOAD_BYTES + 1024 * 1024,
  });

  await app.register(cors, {
    origin: [FRONTEND_ORIGIN, 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'],
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
    version: '2.5.0',
    engine: 'fastify+sqlite-wal',
    timestamp: new Date().toISOString(),
  }));

  registerAuthRoutes(app, db, auth);
  registerFeedRoutes(app, db, auth);
  registerSocialRoutes(app, db, auth);
  registerAdminRoutes(app, db, auth);

  return { app, db };
}
