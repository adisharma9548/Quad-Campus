import crypto from 'node:crypto';
import type { UserRole } from '../types.ts';

const SCRYPT_PARAMS: crypto.ScryptOptions = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;

export interface SessionTokenPayload {
  sid: string;
  uid: string;
  role: UserRole;
  exp: number;
  jti?: string;
}

/**
 * Hash a password using Node native scrypt with a per-user 16-byte random salt.
 */
export function hashPassword(plainText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(String(plainText), salt, KEYLEN, SCRYPT_PARAMS, (err, derived) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derived.toString('hex')}`);
    });
  });
}

// Precomputed dummy scrypt hash to keep timing constant on non-existent accounts
const DUMMY_HASH =
  'scrypt$0123456789abcdef0123456789abcdef$' +
  crypto
    .scryptSync('dummy-timing-guard', '0123456789abcdef0123456789abcdef', KEYLEN, SCRYPT_PARAMS)
    .toString('hex');

/**
 * Timing-safe password verification. Always executes scrypt work even when storedHash is absent.
 */
export function verifyPasswordHash(plainText: string, storedHash?: string | null): Promise<boolean> {
  return new Promise((resolve) => {
    const target = storedHash && storedHash.startsWith('scrypt$') ? storedHash : DUMMY_HASH;
    const parts = target.split('$');
    if (parts.length !== 3) return resolve(false);

    const [, salt, expectedHex] = parts;
    crypto.scrypt(String(plainText), salt, KEYLEN, SCRYPT_PARAMS, (err, derived) => {
      if (err || !storedHash) return resolve(false);
      const expectedBuf = Buffer.from(expectedHex, 'hex');
      if (expectedBuf.length !== derived.length) return resolve(false);
      resolve(crypto.timingSafeEqual(expectedBuf, derived));
    });
  });
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/**
 * Mint an HMAC-SHA256 signed bearer token bound to a server session ID.
 */
export function signSessionToken(
  { sid, uid, role, exp }: { sid: string; uid: string; role: UserRole; exp: number },
  secret: string
): string {
  const payload = Buffer.from(
    JSON.stringify({ sid, uid, role, exp, jti: crypto.randomUUID() })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify HMAC-SHA256 signature and expiration cleanly using constant-time comparison.
 */
export function verifySessionToken(
  token: string | null | undefined,
  secret: string
): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, providedSig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as SessionTokenPayload;
    if (!decoded?.sid || !decoded?.uid || !decoded?.exp || Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
