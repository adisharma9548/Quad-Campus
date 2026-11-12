import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DB_PATH, UPLOAD_DIR } from '../src/config/constants.ts';
import { openDatabase } from '../src/db/database.ts';
import { assertMediaToolsAvailable, probeVideo, resolveUploadPath } from '../src/utils/videoProcessor.ts';

function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.round(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

async function main() {
  assertMediaToolsAvailable();
  const db = openDatabase(DB_PATH);
  const rows = db
    .prepare(
      `SELECT id, status, duration, duration_sec, width, height, video_path, media_id
       FROM reels
       WHERE status != 'deleted'
       ORDER BY created_at_ms DESC`
    )
    .all() as Array<{
      id: string;
      status: string;
      duration: string;
      duration_sec: number | null;
      width: number | null;
      height: number | null;
      video_path: string | null;
      media_id: string | null;
    }>;

  let checked = 0;
  let repaired = 0;
  let missingFiles = 0;

  for (const row of rows) {
    checked += 1;
    let probeTarget: string | null = null;
    let cleanupPath: string | null = null;

    if (row.video_path) {
      const abs = resolveUploadPath(UPLOAD_DIR, row.video_path);
      if (abs && fs.existsSync(abs)) {
        probeTarget = abs;
      } else {
        console.warn(`[FLAGGED MISSING] Reel ${row.id}: disk file missing (${row.video_path})`);
        missingFiles += 1;
        continue;
      }
    } else if (row.media_id) {
      const asset = db
        .prepare('SELECT extension, data FROM media_assets WHERE id = ?')
        .get(row.media_id) as { extension: string; data: Uint8Array } | undefined;
      if (!asset || !asset.data || asset.data.length === 0) {
        console.warn(`[FLAGGED MISSING] Reel ${row.id}: legacy BLOB media ${row.media_id} missing`);
        missingFiles += 1;
        continue;
      }
      cleanupPath = path.join(os.tmpdir(), `quad-probe-${row.id}.${asset.extension || 'mp4'}`);
      await fsp.writeFile(cleanupPath, Buffer.from(asset.data));
      probeTarget = cleanupPath;
    } else {
      console.warn(`[FLAGGED MISSING] Reel ${row.id}: no video_path or media_id attached`);
      missingFiles += 1;
      continue;
    }

    try {
      const info = await probeVideo(probeTarget);
      const formatted = formatClock(info.durationSec);
      const needsUpdate =
        row.duration_sec === null ||
        Math.abs((row.duration_sec || 0) - info.durationSec) > 0.25 ||
        row.duration !== formatted ||
        row.width !== info.width ||
        row.height !== info.height;

      if (needsUpdate) {
        db.prepare(
          'UPDATE reels SET duration_sec = ?, duration = ?, width = ?, height = ? WHERE id = ?'
        ).run(info.durationSec, formatted, info.width || null, info.height || null, row.id);
        repaired += 1;
        console.log(
          `[REPAIRED] Reel ${row.id}: ${row.duration || 'unset'} (${row.duration_sec ?? 'null'}s) -> ${formatted} (${info.durationSec}s, ${info.width}x${info.height})`
        );
      } else {
        console.log(`[OK] Reel ${row.id}: ${formatted} (${info.durationSec}s, ${info.width}x${info.height})`);
      }
    } catch (err) {
      console.warn(`[FLAGGED UNREADABLE] Reel ${row.id}: ${(err as Error).message}`);
      missingFiles += 1;
    } finally {
      if (cleanupPath) {
        await fsp.unlink(cleanupPath).catch(() => {});
      }
    }
  }

  db.close();
  console.log(`Done. Checked=${checked}, Repaired=${repaired}, Flagged=${missingFiles}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
