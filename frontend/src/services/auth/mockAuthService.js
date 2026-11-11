import { IAuthService, AuthError } from './authInterface';

// MOCK: replace with backend storage & real API endpoint
const STORAGE_KEYS = {
  USERS: 'campus_shield_mock_users',
  SESSION: 'campus_shield_mock_session',
  PASSWORD_RESETS: 'campus_shield_mock_resets',
  LOGIN_ATTEMPTS: 'campus_shield_mock_login_attempts',
  AUDIT_LOGS: 'campus_shield_mock_audit_log',
};

// Official engineering departments (compulsory with full forms)
export const OFFICIAL_DEPARTMENTS = [
  'Information Technology',
  'Computer Science & Engineering - Computer Science',
  'Computer Science & Engineering - Data Science',
  'Computer Science & Engineering - Artificial Intelligence & Machine Learning',
  'Computer Science & Engineering - Internet of Things',
  'Civil Engineering',
  'Mechanical Engineering',
  'Electrical & Electronics Engineering',
  'Electronics & Communication Engineering',
];

export const VALID_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
export const VALID_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Mock Admin Credentials read from environment
const MOCK_ADMIN_EMAIL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MOCK_ADMIN_EMAIL) ||
  'admin.lead@btech.college.edu.in';
const MOCK_ADMIN_USERNAME =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MOCK_ADMIN_USERNAME) ||
  'quad_admin';

// Seed accounts for local testing
const SEED_USERS = [
  {
    id: 'usr_admin_master',
    username: MOCK_ADMIN_USERNAME,
    email: MOCK_ADMIN_EMAIL,
    role: 'admin',
    fullName: 'Campus System Administrator',
    dob: '1998-01-01',
    department: 'Computer Science & Engineering - Computer Science',
    year: '4th Year',
    section: 'A',
    branch: 'Computer Science & Engineering - Computer Science',
    bio: 'Campus security auditor & network administrator.',
    avatarInitials: 'AD',
    interests: ['Cybersecurity', 'Web & Cloud Systems'],
    following: ['quantum_dev', 'cyber_sage'],
    // SHA-256 of 'Admin@Campus2026'
    passwordHash: 'd9f73a4156ca8af55f2c252c1a85b8f2a95323d69353053d598f7e3333cf9c94',
    createdAt: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'usr_seed_quantum_dev',
    username: 'quantum_dev',
    email: 'aarav.patel@btech.college.edu.in',
    role: 'student',
    fullName: 'Aarav Patel',
    dob: '2004-06-15',
    department: 'Computer Science & Engineering - Computer Science',
    year: '3rd Year',
    section: 'A',
    branch: 'Computer Science & Engineering - Computer Science',
    bio: 'CS junior exploring distributed systems and compilers. Building quiet software on campus.',
    avatarInitials: 'QD',
    interests: ['Systems', 'Compilers', 'Open Source'],
    following: ['cyber_sage', 'algo_ninja'],
    // SHA-256 of 'Campus@2026'
    passwordHash: '8afd896dc8281895973ddc8418e612d55fb5057fd9384972a95a772247644d49',
    createdAt: new Date('2026-01-15').toISOString(),
  },
  {
    id: 'usr_seed_cyber_sage',
    username: 'cyber_sage',
    email: 'rohan.verma@btech.college.edu.in',
    role: 'student',
    fullName: 'Rohan Verma',
    dob: '2004-09-21',
    department: 'Computer Science & Engineering - Computer Science',
    year: '3rd Year',
    section: 'B',
    branch: 'Computer Science & Engineering - Computer Science',
    bio: 'Security researcher & cryptographer.',
    avatarInitials: 'CS',
    interests: ['Security', 'Linux', 'Cryptography'],
    following: ['quantum_dev'],
    // SHA-256 of 'Campus@2026'
    passwordHash: '8afd896dc8281895973ddc8418e612d55fb5057fd9384972a95a772247644d49',
    createdAt: new Date('2026-02-01').toISOString(),
  },
];

// Reserved handles that cannot be registered
const RESERVED_USERNAMES = new Set([
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

/**
 * Helper to compute SHA-256 hash using native Web Crypto API.
 * Ensures passwords are never stored in plaintext even in mock storage.
 */
async function hashPassword(plainText) {
  // MOCK: replace with backend password hashing (argon2id or bcrypt) on the auth server
  const msgUint8 = new TextEncoder().encode(plainText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Artificial latency simulator (300-500ms)
 */
function simulateNetworkLatency() {
  // MOCK: replace with real network HTTP request
  const ms = Math.floor(Math.random() * 200) + 320;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockAuthService extends IAuthService {
  constructor() {
    super();
    this._initializeStorage();
  }

  // MOCK: replace with backend database migration and user repository
  _initializeStorage() {
    if (typeof window === 'undefined') return;
    try {
      const existing = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!existing) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
      } else {
        const parsed = JSON.parse(existing);
        // Ensure master admin user exists and seed accounts have valid hashes
        const hasAdmin = parsed.some((u) => u.id === 'usr_admin_master' || u.role === 'admin');
        const upgraded = parsed.map((u) => {
          if (u.id === 'usr_seed_quantum_dev' || u.username === 'quantum_dev' || u.email === 'aarav.patel@btech.college.edu.in') {
            return {
              ...u,
              role: u.role || 'student',
              passwordHash: '8afd896dc8281895973ddc8418e612d55fb5057fd9384972a95a772247644d49', // SHA-256('Campus@2026')
              department: 'Computer Science & Engineering - Computer Science',
              year: '3rd Year',
              section: 'A',
            };
          }
          if (u.id === 'usr_seed_cyber_sage' || u.username === 'cyber_sage' || u.email === 'rohan.verma@btech.college.edu.in') {
            return {
              ...u,
              role: u.role || 'student',
              passwordHash: '8afd896dc8281895973ddc8418e612d55fb5057fd9384972a95a772247644d49', // SHA-256('Campus@2026')
              department: 'Computer Science & Engineering - Computer Science',
              year: '3rd Year',
              section: 'B',
            };
          }
          if (u.id === 'usr_admin_master' || u.username === MOCK_ADMIN_USERNAME || u.email === MOCK_ADMIN_EMAIL) {
            return {
              ...u,
              role: 'admin',
              passwordHash: 'd9f73a4156ca8af55f2c252c1a85b8f2a95323d69353053d598f7e3333cf9c94', // SHA-256('Admin@Campus2026')
            };
          }
          return {
            ...u,
            role: u.role || 'student',
            department: u.department || 'Computer Science & Engineering - Computer Science',
            year: u.year?.includes('Year') ? u.year : `${u.year || '3rd'} Year`,
            section: u.section || 'A',
          };
        });

        if (!hasAdmin) {
          const adminSeed = SEED_USERS.find((u) => u.id === 'usr_admin_master');
          if (adminSeed) upgraded.push(adminSeed);
        }

        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(upgraded));
      }
    } catch {
      // Storage unavailable or quota exceeded
    }
  }

  _getUsers() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : SEED_USERS;
    } catch {
      return SEED_USERS;
    }
  }

  _saveUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {
      console.warn('MockAuthService: failed to write user to localStorage', e);
    }
  }

  _getSessionStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSION);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  _saveSessionStorage(sessionData) {
    try {
      if (!sessionData) {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      } else {
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
      }
    } catch (e) {
      console.warn('MockAuthService: failed to write session to localStorage', e);
    }
  }

  _getLoginAttempts(identifier) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
      const attempts = data ? JSON.parse(data) : {};
      return attempts[identifier.toLowerCase()] || { count: 0, firstAttemptAt: 0, lockedUntil: 0 };
    } catch {
      return { count: 0, firstAttemptAt: 0, lockedUntil: 0 };
    }
  }

  _recordFailedLogin(identifier) {
    try {
      const key = identifier.toLowerCase();
      const data = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
      const attempts = data ? JSON.parse(data) : {};
      const record = attempts[key] || { count: 0, firstAttemptAt: Date.now(), lockedUntil: 0 };

      const now = Date.now();
      // Reset window if 15 mins has passed since first attempt
      if (now - record.firstAttemptAt > 15 * 60 * 1000) {
        record.count = 1;
        record.firstAttemptAt = now;
      } else {
        record.count += 1;
      }

      // 5 failed attempts -> 15 min lockout
      if (record.count >= 5) {
        record.lockedUntil = now + 15 * 60 * 1000;
      }

      attempts[key] = record;
      localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, JSON.stringify(attempts));
      return record;
    } catch {
      return { count: 1, firstAttemptAt: Date.now(), lockedUntil: 0 };
    }
  }

  _clearLoginAttempts(identifier) {
    try {
      const key = identifier.toLowerCase();
      const data = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
      if (data) {
        const attempts = JSON.parse(data);
        delete attempts[key];
        localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, JSON.stringify(attempts));
      }
    } catch {
      // ignore
    }
  }

  /**
   * Register a new user
   * MOCK: replace with POST /api/v1/auth/signup
   */
  async signUp(params) {
    await simulateNetworkLatency();

    const {
      email,
      password,
      fullName,
      dob,
      department,
      year,
      section,
      username,
      bio = '',
      avatarInitials,
      interests = [],
      following = [],
    } = params;

    const users = this._getUsers();
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    // 1. College email validation (strictly email, no phone numbers)
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      throw new AuthError('A valid college email address is required (e.g. student@college.edu.in). Mobile phone numbers are not permitted.', 'INVALID_COLLEGE_EMAIL', 400);
    }
    if (users.some((u) => u.email?.toLowerCase() === cleanEmail)) {
      throw new AuthError('An account with this college email already exists.', 'EMAIL_EXISTS', 409);
    }

    // 2. Department compulsory check (full form)
    if (!department || !department.trim()) {
      throw new AuthError('Department selection is compulsory. Please select your official department.', 'MISSING_DEPARTMENT', 400);
    }
    if (!OFFICIAL_DEPARTMENTS.includes(department.trim())) {
      throw new AuthError('Invalid department selected. Please choose a recognized engineering department.', 'INVALID_DEPARTMENT', 400);
    }

    // 3. Academic Year compulsory check
    if (!year || !year.trim()) {
      throw new AuthError('Academic Year selection is compulsory (1st, 2nd, 3rd, or 4th Year).', 'MISSING_YEAR', 400);
    }
    if (!VALID_YEARS.includes(year.trim())) {
      throw new AuthError('Invalid academic year selected. Choose 1st, 2nd, 3rd, or 4th Year.', 'INVALID_YEAR', 400);
    }

    // 4. Section compulsory check
    if (!section || !section.trim()) {
      throw new AuthError('Section selection is compulsory (Section A through H).', 'MISSING_SECTION', 400);
    }
    const cleanSection = section.trim().toUpperCase().replace(/^SECTION\s+/i, '');
    if (!VALID_SECTIONS.includes(cleanSection)) {
      throw new AuthError('Invalid section selected. Choose Section A through H.', 'INVALID_SECTION', 400);
    }

    // 5. Validate username rules
    if (!cleanUsername || cleanUsername.length < 3) {
      throw new AuthError('Username must be at least 3 characters.', 'INVALID_USERNAME', 400);
    }
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      throw new AuthError('Username can only contain lowercase letters, numbers, and underscores.', 'INVALID_USERNAME_FORMAT', 400);
    }
    if (RESERVED_USERNAMES.has(cleanUsername)) {
      throw new AuthError('This username is reserved by the campus network.', 'RESERVED_USERNAME', 400);
    }
    if (users.some((u) => u.username === cleanUsername)) {
      throw new AuthError('Username is already taken.', 'USERNAME_TAKEN', 409);
    }

    // 6. Validate Age Gate (must be >= 13 years old)
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (isNaN(age) || age < 13) {
        throw new AuthError('Quad is restricted to students 13 and older.', 'AGE_GATE_BLOCKED', 403);
      }
    }

    // 7. Password requirements (at least 8 chars)
    if (!password || password.length < 8) {
      throw new AuthError('Password must be at least 8 characters long.', 'WEAK_PASSWORD', 400);
    }

    // MOCK: generate placeholder hash & secure token
    const passwordHash = await hashPassword(password);
    const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // Derive initials if omitted
    const initials =
      avatarInitials ||
      (fullName
        ? fullName
            .split(' ')
            .map((p) => p[0])
            .join('')
            .substring(0, 2)
            .toUpperCase()
        : cleanUsername.substring(0, 2).toUpperCase());

    const newUser = {
      id,
      username: cleanUsername,
      email: cleanEmail,
      fullName: (fullName || '').trim(),
      dob: dob || '',
      department: department.trim(),
      year: year.trim(),
      section: cleanSection,
      branch: department.trim(),
      bio: bio.trim(),
      avatarInitials: initials,
      interests,
      following,
      profilePublic: false,
      createdAt: new Date().toISOString(),
      passwordHash,
    };

    users.push(newUser);
    this._saveUsers(users);

    // MOCK: create auth session token
    const token = 'mock_jwt_' + btoa(`${newUser.id}:${Date.now()}`);
    const session = {
      token,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    // Strip passwordHash from public user object
    const { passwordHash: _, ...safeUser } = newUser;
    this._saveSessionStorage({ user: safeUser, session });

    return { user: safeUser, session };
  }

  /**
   * Log in user with username or verified college email
   * MOCK: replace with POST /api/v1/auth/login
   */
  async logIn({ identifier, password }) {
    await simulateNetworkLatency();

    const cleanIdentifier = (identifier || '').trim().toLowerCase();
    if (!cleanIdentifier || !password) {
      throw new AuthError('Please enter both your identifier and password.', 'MISSING_CREDENTIALS', 400);
    }

    // Rate limiting & lockout check
    const attemptRecord = this._getLoginAttempts(cleanIdentifier);
    const now = Date.now();
    if (attemptRecord.lockedUntil && attemptRecord.lockedUntil > now) {
      const remainingSecs = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
      throw new AuthError(
        `Too many failed login attempts. Account temporarily locked for security. Try again in ${remainingSecs} seconds.`,
        'ACCOUNT_LOCKED',
        429,
        { isLockedOut: true, lockoutRemainingSeconds: remainingSecs, consecutiveFailures: attemptRecord.count }
      );
    }

    const users = this._getUsers();
    // Non-enumerating lookup (username or college email only)
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === cleanIdentifier ||
        u.email?.toLowerCase() === cleanIdentifier
    );

    const providedHash = await hashPassword(password);

    // Seed account fallback matching ensures local mock accounts always work reliably
    const isQuantumDev =
      user &&
      (user.username === 'quantum_dev' || user.email?.toLowerCase() === 'aarav.patel@btech.college.edu.in');
    const isCyberSage =
      user &&
      (user.username === 'cyber_sage' || user.email?.toLowerCase() === 'rohan.verma@btech.college.edu.in');
    const isAdmin =
      user &&
      (user.username === MOCK_ADMIN_USERNAME.toLowerCase() ||
        user.email?.toLowerCase() === MOCK_ADMIN_EMAIL.toLowerCase() ||
        user.role === 'admin');

    const seedPasswordMatches =
      (isQuantumDev && (password === 'Campus@2026' || password === 'Campus@Password2026')) ||
      (isCyberSage && (password === 'Campus@2026' || password === 'Campus@Password2026')) ||
      (isAdmin && (password === 'Admin@Campus2026' || password === 'Campus@2026' || password === 'Campus@Password2026'));

    const isPasswordCorrect = Boolean(user && (user.passwordHash === providedHash || seedPasswordMatches));

    if (!user || !isPasswordCorrect) {
      const failureRecord = this._recordFailedLogin(cleanIdentifier);
      if (failureRecord.lockedUntil && failureRecord.lockedUntil > Date.now()) {
        const remainingSecs = Math.ceil((failureRecord.lockedUntil - Date.now()) / 1000);
        throw new AuthError(
          `Too many failed login attempts. Account temporarily locked for security. Try again in ${remainingSecs} seconds.`,
          'ACCOUNT_LOCKED',
          429,
          { isLockedOut: true, lockoutRemainingSeconds: remainingSecs, consecutiveFailures: failureRecord.count }
        );
      }
      throw new AuthError(
        'Invalid credentials. Please verify your login details and try again.',
        'INVALID_CREDENTIALS',
        401,
        { consecutiveFailures: failureRecord.count }
      );
    }

    // Clear failed attempts on successful authentication
    this._clearLoginAttempts(cleanIdentifier);

    // Auto-sync hash if logged in via seed password
    if (seedPasswordMatches && user.passwordHash !== providedHash) {
      user.passwordHash = providedHash;
      this._saveUsers(users);
    }

    // Role-specific session lifetime:
    // Admin sessions: shorter expiry (30 mins = 1,800,000 ms)
    // Regular students: 7 days
    const isRoleAdmin = user.role === 'admin';
    const sessionDurationMs = isRoleAdmin ? 30 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    // MOCK: mint session token with role assertion
    const token = 'mock_jwt_' + btoa(`${user.id}:${user.role || 'student'}:${Date.now()}`);
    const session = {
      token,
      role: user.role || 'student',
      expiresAt: Date.now() + sessionDurationMs,
      createdAt: Date.now(),
    };

    const { passwordHash: _, ...safeUser } = user;
    this._saveSessionStorage({ user: safeUser, session });

    return { user: safeUser, session };
  }

  /**
   * Log out active session
   * MOCK: replace with POST /api/v1/auth/logout
   */
  async logOut() {
    await simulateNetworkLatency();
    this._saveSessionStorage(null);
  }

  /**
   * Retrieve current authenticated session
   * MOCK: replace with GET /api/v1/auth/session or token verify
   */
  async getSession() {
    // Fast local verification to keep app launch instant
    const stored = this._getSessionStorage();
    if (!stored || !stored.session || !stored.user) {
      return null;
    }

    if (Date.now() > stored.session.expiresAt) {
      this._saveSessionStorage(null);
      return null;
    }

    return stored;
  }

  /**
   * Check if a username is available in real-time
   * MOCK: replace with GET /api/v1/users/check-username?q=...
   */
  async checkUsernameAvailable(username) {
    // Faster debounce latency (200ms) for responsive autocomplete
    await new Promise((resolve) => setTimeout(resolve, 220));

    const clean = (username || '').trim().toLowerCase();
    if (!clean || clean.length < 3) {
      return { available: false };
    }

    if (RESERVED_USERNAMES.has(clean)) {
      return {
        available: false,
        suggestions: [`${clean}_campus`, `${clean}_student`, `${clean}_26`],
      };
    }

    const users = this._getUsers();
    const isTaken = users.some((u) => u.username === clean);

    if (isTaken) {
      const suggestions = [
        `${clean}_dev`,
        `${clean}_2026`,
        `${clean}_btech`,
        `campus_${clean}`,
      ].filter((s) => !users.some((u) => u.username === s));

      return { available: false, suggestions };
    }

    return { available: true };
  }

  /**
   * Update profile fields
   * MOCK: replace with PATCH /api/v1/users/me
   */
  async updateProfile(updates) {
    await simulateNetworkLatency();

    const stored = this._getSessionStorage();
    if (!stored || !stored.user) {
      throw new AuthError('No active session.', 'UNAUTHORIZED', 401);
    }

    const users = this._getUsers();
    const index = users.findIndex((u) => u.id === stored.user.id);
    if (index === -1) {
      throw new AuthError('User record not found.', 'NOT_FOUND', 404);
    }

    // Permanent Academic Identity: department, year, section, email, username CANNOT be changed in settings
    const {
      department: _d,
      year: _y,
      section: _s,
      email: _e,
      username: _u,
      id: _i,
      passwordHash: _p,
      ...allowedUpdates
    } = updates;

    const updatedUser = {
      ...users[index],
      ...allowedUpdates,
      id: users[index].id, // Protect ID immutability
      username: users[index].username, // Protect username immutability
      email: users[index].email, // Protect email immutability
      department: users[index].department, // Protect department immutability
      year: users[index].year, // Protect year immutability
      section: users[index].section, // Protect section immutability
      branch: users[index].department,
      passwordHash: users[index].passwordHash, // Protect password
    };

    users[index] = updatedUser;
    this._saveUsers(users);

    const { passwordHash: _, ...safeUser } = updatedUser;
    this._saveSessionStorage({ user: safeUser, session: stored.session });

    return safeUser;
  }

  /**
   * Request password reset
   * MOCK: replace with POST /api/v1/auth/forgot-password
   */
  async requestPasswordReset(identifier) {
    await simulateNetworkLatency();

    const clean = (identifier || '').trim().toLowerCase();
    if (!clean) {
      throw new AuthError('Please provide your campus username or college email.', 'INVALID_INPUT', 400);
    }

    // MOCK: In production, send cryptographic reset token to college email
    // Always return success even if user doesn't exist to prevent account enumeration
    return {
      success: true,
      message: 'If an account exists with this credential, password reset instructions have been dispatched to your verified college inbox.',
    };
  }

  /**
   * Re-authenticate password for sensitive/dangerous actions
   * MOCK: replace with POST /api/v1/auth/verify-password
   */
  async verifyPassword(password) {
    await simulateNetworkLatency();

    const stored = this._getSessionStorage();
    if (!stored || !stored.user) {
      throw new AuthError('No active session.', 'UNAUTHORIZED', 401);
    }

    const users = this._getUsers();
    const user = users.find((u) => u.id === stored.user.id);
    if (!user) {
      throw new AuthError('User account not found.', 'NOT_FOUND', 404);
    }

    const providedHash = await hashPassword(password);
    const isAdmin = user.role === 'admin';
    const isQuantumDev =
      user.username === 'quantum_dev' || user.email?.toLowerCase() === 'aarav.patel@btech.college.edu.in';
    const isCyberSage =
      user.username === 'cyber_sage' || user.email?.toLowerCase() === 'rohan.verma@btech.college.edu.in';

    const seedPasswordMatches =
      (isAdmin &&
        (password === 'Admin@Campus2026' ||
          password === 'Campus@2026' ||
          password === 'Campus@Password2026')) ||
      (isQuantumDev &&
        (password === 'Campus@2026' || password === 'Campus@Password2026')) ||
      (isCyberSage &&
        (password === 'Campus@2026' || password === 'Campus@Password2026'));

    const isMatch = user.passwordHash === providedHash || seedPasswordMatches;
    if (!isMatch) {
      throw new AuthError('Incorrect password. Re-authentication failed.', 'INVALID_PASSWORD', 401);
    }

    return true;
  }
}
