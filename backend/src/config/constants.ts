import crypto from 'node:crypto';
import type { PostType } from '../types.ts';
import { loadInstitutionConfig } from './institution.ts';

export const PORT: number = Number(process.env.PORT || 4000);
export const HOST: string = process.env.HOST || '127.0.0.1';
export const DB_PATH: string = process.env.DB_PATH || './data/quad.db';
export const NODE_ENV: string = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION: boolean = NODE_ENV === 'production';

const INSECURE_SECRETS: ReadonlySet<string> = new Set([
  '',
  'replace-with-32-byte-random-hex-secret',
  'quad-campus-dev-fallback-secret-replace-before-deploy',
]);

function resolveAuthSecret(): string {
  const raw = (process.env.AUTH_SECRET || '').trim();
  if (IS_PRODUCTION) {
    if (INSECURE_SECRETS.has(raw) || raw.length < 32) {
      throw new Error(
        'AUTH_SECRET must be set to a random value of at least 32 characters when NODE_ENV=production. ' +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    return raw;
  }
  return INSECURE_SECRETS.has(raw) ? 'quad-campus-dev-fallback-secret-replace-before-deploy' : raw;
}

export const AUTH_SECRET: string = resolveAuthSecret();
export const FRONTEND_ORIGIN: string = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
export const ADMIN_EMAIL: string =
  (process.env.MOCK_ADMIN_EMAIL || 'admin.lead@btech.college.edu.in').trim().toLowerCase();
export const ADMIN_USERNAME: string =
  (process.env.MOCK_ADMIN_USERNAME || 'quad_admin').trim().toLowerCase();

// Demo data (25 fake students, posts, reels) is for development and sales demos only.
// It is OFF by default in production. Set SEED_DEMO_DATA=true to force it on.
export const SEED_DEMO_DATA: boolean = process.env.SEED_DEMO_DATA
  ? process.env.SEED_DEMO_DATA.trim().toLowerCase() === 'true'
  : !IS_PRODUCTION;

// The admin password is never a known default. If SEED_ADMIN_PASSWORD is not set, a random one
// is generated and printed once at first start (see app.ts).
export const SEED_ADMIN_PASSWORD_GENERATED: boolean = !(process.env.SEED_ADMIN_PASSWORD || '').trim();
export const SEED_ADMIN_PASSWORD: string =
  (process.env.SEED_ADMIN_PASSWORD || '').trim() || crypto.randomBytes(18).toString('base64url');
// Demo students only exist when SEED_DEMO_DATA is on. This default is for demos, not production.
export const SEED_STUDENT_PASSWORD: string = process.env.SEED_STUDENT_PASSWORD || 'Campus@2026';

export const INSTITUTION = loadInstitutionConfig();
export const DEPARTMENT_MAP: Readonly<Record<string, string>> = Object.fromEntries(
  INSTITUTION.programs.map((p) => [p.name, p.code])
);
export const OFFICIAL_DEPARTMENTS: readonly string[] = INSTITUTION.programs.map((p) => p.name);
export const VALID_YEARS: readonly string[] = INSTITUTION.years;
export const VALID_SECTIONS: readonly string[] = INSTITUTION.sections;
export const POST_TYPES: readonly PostType[] = [
  'Discussion',
  'Tip',
  'Question',
  'Update',
  'Resource',
  'Event',
];
export const DEFAULT_GROUPS: readonly string[] = [
  'Close Friends',
  'My Branch',
  'My Year',
  'Classmates',
];

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'quad',
  'quad_official',
  'campus_shield',
  'moderator',
  'support',
  'help',
  'security',
  'system',
]);

export const REPORT_REASONS: readonly string[] = [
  'Harassment or Bullying',
  'Threats or Violence',
  'Hate Speech',
  'Impersonation',
  'Private Photos Shared Without Consent',
  'Fake Account or Spam',
  'Academic Dishonesty',
];

export const SECURITY_LIMITS = {
  LOGIN_MAX_FAILURES: 5,
  LOGIN_WINDOW_MS: 15 * 60 * 1000,
  LOGIN_LOCKOUT_MS: 15 * 60 * 1000,
  USERNAME_CHECK_PER_MIN: 30,
  PASSWORD_RESET_PER_HOUR: 3,
  STUDENT_SESSION_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  ADMIN_SESSION_TTL_MS: 30 * 60 * 1000,
  ADMIN_INACTIVITY_MS: 15 * 60 * 1000,
  REAUTH_TOKEN_TTL_MS: 5 * 60 * 1000,
  MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
} as const;

export const SHORT_YEAR = (year: string | null = ''): string =>
  String(year || '').replace(/\s*Year$/i, '').trim() || '3rd';
