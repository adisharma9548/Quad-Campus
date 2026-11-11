export const PORT = Number(process.env.PORT || 4000);
export const HOST = process.env.HOST || '127.0.0.1';
export const DB_PATH = process.env.DB_PATH || './data/quad.db';
export const AUTH_SECRET =
  process.env.AUTH_SECRET || 'quad-campus-dev-fallback-secret-replace-before-deploy';
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

export const ADMIN_EMAIL =
  (process.env.MOCK_ADMIN_EMAIL || 'admin.lead@btech.college.edu.in').trim().toLowerCase();
export const ADMIN_USERNAME =
  (process.env.MOCK_ADMIN_USERNAME || 'quad_admin').trim().toLowerCase();
export const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@Campus2026';
export const SEED_STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD || 'Campus@2026';

export const DEPARTMENT_MAP = {
  'Information Technology': 'IT',
  'Computer Science & Engineering - Computer Science': 'CSE',
  'Computer Science & Engineering - Data Science': 'DS',
  'Computer Science & Engineering - Artificial Intelligence & Machine Learning': 'AI/ML',
  'Computer Science & Engineering - Internet of Things': 'IoT',
  'Civil Engineering': 'CE',
  'Mechanical Engineering': 'ME',
  'Electrical & Electronics Engineering': 'EEE',
  'Electronics & Communication Engineering': 'ECE',
};

export const OFFICIAL_DEPARTMENTS = Object.keys(DEPARTMENT_MAP);
export const VALID_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
export const VALID_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const POST_TYPES = ['Discussion', 'Tip', 'Question', 'Update', 'Resource', 'Event'];
export const DEFAULT_GROUPS = ['Close Friends', 'My Branch', 'My Year', 'Classmates'];

export const RESERVED_USERNAMES = new Set([
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

export const REPORT_REASONS = [
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
};

export const SHORT_YEAR = (year = '') => String(year).replace(/\s*Year$/i, '').trim() || '3rd';
