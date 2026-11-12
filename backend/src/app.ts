import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import type { DatabaseSync } from 'node:sqlite';
import {
  DB_PATH,
  FRONTEND_ORIGIN,
  INSTITUTION,
  IS_PRODUCTION,
  SECURITY_LIMITS,
  SEED_ADMIN_PASSWORD,
  SEED_ADMIN_PASSWORD_GENERATED,
  ADMIN_USERNAME,
} from './config/constants.ts';
import { publicInstitutionConfig } from './config/institution.ts';
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

  // Baseline security headers for every API response.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Cross-Origin-Resource-Policy', 'same-site');
    reply.header('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    if (IS_PRODUCTION) {
      reply.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    return payload;
  });

  const db = openDatabase(dbPath);
  const seeded = await seedDatabase(db);
  if (seeded && SEED_ADMIN_PASSWORD_GENERATED) {
    app.log.warn(
      `First start: administrator "${ADMIN_USERNAME}" created with a generated password: ${SEED_ADMIN_PASSWORD}  ` +
        '(shown once. Set SEED_ADMIN_PASSWORD before first start to choose your own.)'
    );
  }

  app.addHook('onClose', async () => {
    db.close();
  });

  const auth = createAuthMiddleware(db);

  app.get('/api/v1/health', async () => ({
    status: 'ok',
    version: '2.7.0',
    engine: 'fastify+sqlite-wal',
    timestamp: new Date().toISOString(),
  }));

  // Public white-label configuration used by the sign-up flow.
  app.get('/api/v1/config', async () => publicInstitutionConfig(INSTITUTION));

  registerAuthRoutes(app, db, auth);
  registerFeedRoutes(app, db, auth);
  registerSocialRoutes(app, db, auth);
  registerAdminRoutes(app, db, auth);

  return { app, db };
}
