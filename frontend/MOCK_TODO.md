# Quad Campus Platform — Backend Handoff & Mock Service Replacement Specification (`MOCK_TODO.md`)

This document serves as the comprehensive engineering guide for dropping a real production backend into the **Quad** campus social platform.

The frontend is built with a strictly decoupled service layer. All UI components communicate exclusively with an abstract interface (`IAuthService`) via the `AuthContext` React hook. No UI screen or component has direct knowledge of whether the authentication system is running against local storage mocks or a live distributed API.

---

## 1. Real Backend Active (`VITE_AUTH_MODE=real`) & Mock Mode Switch

The Fastify + SQLite backend in `../backend/` is wired and enabled by default in `frontend/.env`:

1. `src/services/auth/realAuthService.js` implements `IAuthService` using `src/services/apiClient.js`, and `src/services/admin/adminService.js` + `src/context/AppContext.jsx` automatically talk to `/api/v1/*` when `VITE_AUTH_MODE=real`.
2. `.env` defaults to:
   ```bash
   VITE_AUTH_MODE=real
   VITE_API_BASE_URL=/api/v1
   ```
   Vite (`vite.config.js`) proxies `/api` requests in local dev to `http://127.0.0.1:4000`.
3. To fall back to the local offline mock layer (`src/services/auth/mockAuthService.js`), set `VITE_AUTH_MODE=mock` in `frontend/.env`.

**Zero UI code changes are needed between modes.** The stepper, welcome screen, login forms, feed/personal space flows, route guards, and admin console switch transparently via `VITE_AUTH_MODE`.

---

## 2. Inventory of Mock Annotations in Codebase

Every mock implementation detail is explicitly tagged with `// MOCK: replace with backend`:

| File | Line Reference | Tagged Purpose | Production Replacement |
|---|---|---|---|
| `src/services/auth/mockAuthService.js` | Lines 3–8 | `STORAGE_KEYS` (local storage keys) | Remote PostgreSQL / MongoDB database & Redis session cache. |
| `src/services/auth/mockAuthService.js` | Lines 25–26 | Seed users & static password hash | Dynamic user records in database with Argon2id salts. |
| `src/services/auth/mockAuthService.js` | Line 66 | Client-side WebCrypto SHA-256 hash | Server-side password hashing (Argon2id or bcrypt). Passwords sent over TLS only. |
| `src/services/auth/mockAuthService.js` | Lines 77–80 | `simulateNetworkLatency()` | Real HTTP/HTTPS requests over `fetch` / Axios with TLS 1.3. |
| `src/services/auth/mockAuthService.js` | Line 88 | `_initializeStorage()` | Database migrations (e.g., Prisma, Flyway, Alembic). |
| `src/services/auth/mockAuthService.js` | Line 141 | `signUp(params)` | `POST /api/v1/auth/signup` |
| `src/services/auth/mockAuthService.js` | Line 207 | MOCK password hash & secure token minting | Cryptographically signed RS256/EdDSA JWT or opaque session cookie with `HttpOnly; Secure; SameSite=Strict`. |
| `src/services/auth/mockAuthService.js` | Line 260 | `logIn({ identifier, password })` | `POST /api/v1/auth/login` |
| `src/services/auth/mockAuthService.js` | Line 301 | `logOut()` | `POST /api/v1/auth/logout` (server token revocation & cookie invalidation). |
| `src/services/auth/mockAuthService.js` | Line 310 | `getSession()` | `GET /api/v1/auth/session` |
| `src/services/auth/mockAuthService.js` | Line 329 | `checkUsernameAvailable(username)` | `GET /api/v1/users/check-username?q=...` |
| `src/services/auth/mockAuthService.js` | Line 366 | `updateProfile(updates)` | `PATCH /api/v1/users/me` |
| `src/services/auth/mockAuthService.js` | Line 400 | `requestPasswordReset(identifier)` | `POST /api/v1/auth/forgot-password` |

---

## 3. REST API Specification

### Common Headers
```http
Content-Type: application/json
Accept: application/json
X-Client-Version: 2.4.0
```
Protected routes additionally require:
```http
Authorization: Bearer <jwt_access_token>
```

### Standard Error Response Format
All non-2xx responses MUST return:
```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable explanation of error."
  }
}
```

---

### Endpoint 1: Student Registration (Sign-up)
- **Method & Path**: `POST /api/v1/auth/signup`
- **Auth**: None (Public)
- **Description**: Registers a student account after passing the 6-step onboarding stepper. Validates college email (strictly email, mobile numbers blocked), compulsory engineering department (full form), compulsory academic year (1st-4th), compulsory section (A-H), age gate (>= 13), checks handle availability, hashes password, and creates session. Department, year, and section are permanently bound to the college email and cannot be modified later in settings.

#### Request Payload
```json
{
  "email": "aarav.patel@btech.college.edu.in",
  "password": "Campus@Password2026",
  "fullName": "Aarav Patel",
  "dob": "2004-06-15",
  "department": "Computer Science & Engineering",
  "year": "3rd Year",
  "section": "A",
  "username": "quantum_dev",
  "bio": "CS junior building quiet campus software.",
  "avatarInitials": "QD",
  "interests": ["Algorithms & CP", "AI & Machine Learning"],
  "following": ["cyber_sage", "algo_ninja"]
}
```

#### Response (`201 Created`)
```json
{
  "user": {
    "id": "usr_94b8e210a4",
    "username": "quantum_dev",
    "email": "aarav.patel@btech.college.edu.in",
    "fullName": "Aarav Patel",
    "dob": "2004-06-15",
    "department": "Computer Science & Engineering",
    "year": "3rd Year",
    "section": "A",
    "branch": "Computer Science & Engineering",
    "bio": "CS junior building quiet campus software.",
    "avatarInitials": "QD",
    "interests": ["Algorithms & CP", "AI & Machine Learning"],
    "following": ["cyber_sage", "algo_ninja"],
    "profilePublic": false,
    "createdAt": "2026-11-11T12:00:00.000Z"
  },
  "session": {
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": 1795000000000
  }
}
```

#### Error Codes:
- `400 INVALID_COLLEGE_EMAIL`: Missing or invalid college email format, or attempt to use mobile number.
- `400 MISSING_DEPARTMENT`: Department was not selected.
- `400 INVALID_DEPARTMENT`: Department is not one of the 9 official departments.
- `400 MISSING_YEAR`: Academic Year was not selected (1st, 2nd, 3rd, or 4th Year).
- `400 MISSING_SECTION`: Section was not selected (A through H).
- `400 INVALID_USERNAME_FORMAT`: Handle violates allowed characters (`^[a-z0-9_]{3,20}$`).
- `400 WEAK_PASSWORD`: Password length < 8 or insufficient entropy.
- `403 AGE_GATE_BLOCKED`: Date of birth indicates under 13 years of age.
- `409 USERNAME_TAKEN`: Handle is already registered.
- `409 EMAIL_EXISTS`: College email address is already bound to an account.

---

### Endpoint 2: User Authentication (Login)
- **Method & Path**: `POST /api/v1/auth/login`
- **Auth**: None (Public)
- **Description**: Authenticates a user by username handle or verified college email (mobile numbers are rejected). Enforces timing-safe credential verification to prevent account enumeration.

#### Request Payload
```json
{
  "identifier": "quantum_dev",
  "password": "Campus@Password2026"
}
```

#### Response (`200 OK`)
```json
{
  "user": {
    "id": "usr_94b8e210a4",
    "username": "quantum_dev",
    "email": "aarav.patel@btech.college.edu.in",
    "fullName": "Aarav Patel",
    "department": "Computer Science & Engineering",
    "year": "3rd Year",
    "section": "A",
    "avatarInitials": "QD",
    "branch": "Computer Science & Engineering",
    "profilePublic": false
  },
  "session": {
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": 1795000000000
  }
}
```

#### Error Codes:
- `400 MISSING_CREDENTIALS`: Either identifier or password omitted.
- `401 INVALID_CREDENTIALS`: Non-enumerating error message returned whether user doesn't exist or password mismatch (*"Invalid credentials. Please verify your login details and try again."*).
- `429 TOO_MANY_REQUESTS`: Rate limit exceeded (e.g. max 5 failed attempts per IP/account per 15 minutes).

---

### Endpoint 3: Terminate Session (Logout)
- **Method & Path**: `POST /api/v1/auth/logout`
- **Auth**: Required (`Bearer <token>`)
- **Description**: Invalidates the active JWT / server session and clears any auth cookies.

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Session successfully terminated."
}
```

---

### Endpoint 4: Active Session Verification
- **Method & Path**: `GET /api/v1/auth/session`
- **Auth**: Required (`Bearer <token>`)
- **Description**: Called on app boot to restore authentication state.

#### Response (`200 OK`)
```json
{
  "user": {
    "id": "usr_94b8e210a4",
    "username": "quantum_dev",
    "email": "aarav.patel@btech.college.edu.in",
    "department": "Computer Science & Engineering",
    "year": "3rd Year",
    "section": "A",
    "avatarInitials": "QD",
    "branch": "Computer Science & Engineering",
    "profilePublic": false
  },
  "session": {
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": 1795000000000
  }
}
```

#### Error Codes:
- `401 UNAUTHORIZED`: Token expired, malformed, or revoked.

---

### Endpoint 5: Live Username Availability Check
- **Method & Path**: `GET /api/v1/users/check-username?q=<username>`
- **Auth**: None (Public)
- **Description**: Debounced real-time endpoint called during Step 3 of sign-up. If unavailable, returns 3-4 recommended available variants.

#### Response when available (`200 OK`)
```json
{
  "available": true
}
```

#### Response when taken or reserved (`200 OK`)
```json
{
  "available": false,
  "suggestions": [
    "quantum_dev_26",
    "quantum_dev_btech",
    "campus_quantum_dev"
  ]
}
```

---

### Endpoint 6: Password Reset Request
- **Method & Path**: `POST /api/v1/auth/forgot-password`
- **Auth**: None (Public, Rate-limited)
- **Description**: Dispatches a cryptographic one-time token to the student's verified college email (mobile numbers are not supported). Must always return a 200 generic success response regardless of whether the account exists, to completely prevent user enumeration.

#### Request Payload
```json
{
  "identifier": "aarav.patel@btech.college.edu.in"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "If an account exists with this credential, password reset instructions have been dispatched to your verified college inbox."
}
```

---

### Endpoint 7: Update Profile Attributes
- **Method & Path**: `PATCH /api/v1/users/me`
- **Auth**: Required (`Bearer <token>`)
- **Description**: Updates profile fields such as bio, avatar monogram, interests, and privacy settings. **Important**: `department`, `year`, `section`, `email`, `username`, and `id` are permanently locked to the college email registry and MUST be rejected with HTTP 400 if passed in the mutation payload.

#### Request Payload
```json
{
  "bio": "Exploring distributed systems and compilers.",
  "avatarInitials": "AP",
  "interests": ["Algorithms & CP", "Robotics & Embedded"]
}
```

#### Response (`200 OK`)
Returns the updated `user` object.

---

## 4. Crucial Security Mandates for Backend Authors

1. **Password Hashing**:
   - MUST use **Argon2id** (`m=65536, t=3, p=4`) or **bcrypt** with cost factor >= 12.
   - Plaintext passwords must NEVER be logged to stdout, syslog, APM, or disk.
2. **Timing-Safe Credential Verification**:
   - In `POST /api/v1/auth/login`, do not return distinct error codes for "account not found" vs "wrong password". Both conditions MUST return `401 INVALID_CREDENTIALS`.
   - Run a dummy password hash check if the user is not found, to guarantee constant-time execution against timing attacks.
3. **Age Verification**:
   - Server MUST enforce `dob <= (today - 13 years)` during registration.
4. **EXIF / GPS Scrubbing**:
   - The media processing microservice or worker MUST strip all EXIF metadata (specifically GPS coordinates, device serials, and capture timestamps) from uploaded images before persisting to S3/Cloud Storage.
5. **Rate Limiting & Lockout**:
   - `POST /api/v1/auth/login`: 5 attempts per 15 minutes per IP + account. After 5 failures, return `429 ACCOUNT_LOCKED` with 15-minute lock.
   - `GET /api/v1/users/check-username`: 30 queries per minute per IP.
   - `POST /api/v1/auth/forgot-password`: 3 requests per hour per identifier.

---

## 5. Seed Accounts & Stealth Admin Setup (For Local Testing)

### 5.1 Pre-seeded Accounts
The local mock authentication service auto-provisions the following accounts in `localStorage`:

| Account Type | Username Handle | Verified College Email | Password | Role |
|---|---|---|---|---|
| **Student** | `quantum_dev` | `aarav.patel@btech.college.edu.in` | `Campus@2026` *(also accepts `Campus@Password2026`)* | `student` |
| **Student** | `cyber_sage` | `rohan.verma@btech.college.edu.in` | `Campus@2026` | `student` |
| **Admin** | `quad_admin` | `admin.lead@btech.college.edu.in` | *(offline mock mode only; the real backend generates its own admin password)* | `admin` |

### 5.2 Environment Variables for Admin Seeding
Admin account identity is configurable in `.env`:
```bash
VITE_MOCK_ADMIN_EMAIL=admin.lead@btech.college.edu.in
VITE_MOCK_ADMIN_USERNAME=quad_admin
```
*Note: Real admin passwords are never committed to git or exposed in client bundles.*

### 5.3 Stealth Admin Route Behavior
1. **No Admin Links**: The public UI contains zero links or menus for `/admin`.
2. **Stealth 404**: Unauthenticated users or students navigating to `/admin` receive the standard 404 Not Found screen.
3. **Lazy-Loading**: The Admin bundle is code-split and loaded only after admin credentials and role are verified.
4. **Session Expiry**: Admin sessions expire after 30 minutes (students: 7 days) and auto-logout after 15 minutes of inactivity.
5. **Re-authentication**: Destructive actions (user ban, user suspension, post deletion, content removal) require password re-entry.
6. **Detailed Architecture**: See `SECURITY_NOTES.md` for full backend specification.

