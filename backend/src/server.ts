import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Lightweight .env loader (avoids extra dotenv dependency)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    }
  }
}

const { HOST, PORT } = await import('./config/constants.ts');
const { buildApp } = await import('./app.ts');

const { app } = await buildApp({ logger: true });

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Quad backend listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
