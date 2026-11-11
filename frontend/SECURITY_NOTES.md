# Quad Campus Security Architecture & Backend Enforcement Notes (`SECURITY_NOTES.md`)

> **CRITICAL SECURITY NOTICE**:  
> **Frontend route gating is strictly cosmetic.** Any client-side check (e.g. `role === 'admin'`, `AdminRouteGuard`, or hidden menu items) can be manipulated in browser developer tools or bypassed with direct curl/HTTP requests. The production backend server MUST authoritatively enforce role-based access control (RBAC), cryptographically signed session tokens, rate limiting, and multi-factor authentication (2FA) on every privileged API endpoint.

---

## 1. Core Threat Model & Guardrails

### 1.1 Stealth Endpoint Design
- **No Public Hints**: The public user interface has no admin link, button, menu item, or separate login page.
- **Identical 404 Behavior**: If an unauthenticated user or regular student visits `/admin`, the application renders the standard 404 "Page Not Found" screen. It does **not** redirect to a login prompt, return a 401/403 forbidden header, or reveal that `/admin` exists.
- **Code-Splitting**: The administrative UI chunk (`AdminPanel.jsx`) is lazy-loaded with `React.lazy` and dynamic `import()`. It is never bundled into the main JavaScript bundle delivered to students and is only requested over the network after client-side admin verification passes.

### 1.2 Session Lifetimes & Auto-Logout
- **Student Sessions**: Valid for up to 7 days with persistent refresh capability.
- **Admin Sessions**: High-privilege tokens have a maximum lifetime of **30 minutes**.
- **Inactivity Timer**: Client and server monitor interaction events (`mousemove`, `keydown`, `touchstart`). If 15 minutes of inactivity elapse, the session is invalidated immediately.

### 1.3 Re-Authentication Before Destructive Actions
- Privileged operations (banning a user, suspending a student, removing reported content, deleting posts) require administrator password re-verification via a dedicated prompt (`ReauthModal`).
- The backend must require this secondary authentication confirmation or a temporary high-privilege escalation token (valid for 5 minutes).

### 1.4 Rate Limiting & Lockout
- **Threshold**: 5 consecutive failed login attempts within a 15-minute window for an identifier.
- **Enforcement**: The account enters a locked state for 15 minutes (`HTTP 429 Too Many Requests`).
- **Enumeration Protection**: Error responses are uniform across non-existent and wrong-password scenarios:  
  `"Invalid credentials. Please verify your login details and try again."`

---

## 2. Production Backend Security Requirements

1. **Server-Side Token Verification**: Every request to an admin endpoint (`/api/v1/admin/*`) must validate an asymmetric JWT signature (RS256 or Ed25519) or server-side Redis session containing an immutable `role: "admin"` claim.
2. **Mandatory 2FA (Two-Factor Authentication)**: In production, administrative logins must require a TOTP (RFC 6238) authenticator token or WebAuthn/FIDO2 hardware security key.
3. **Immutable Audit Logging**: Every administrative action must be appended to an append-only, tamper-evident audit log stored in a secure relational database (PostgreSQL with write-once audit table or AWS CloudWatch / Google Cloud Logging).
4. **Permanent Academic Identity Lock**: Student department, academic year, and section must be immutably linked to the verified college email on the backend database. Any update payload targeting these fields in `PATCH /api/v1/users/me` must be rejected with `HTTP 400 Bad Request`.

---

## 3. Endpoints Expected by the Admin UI

All endpoints below require:
```http
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

### 3.1 Overview Metrics
- **`GET /api/v1/admin/metrics`**
  - **Required Role**: `admin`
  - **Returns**:
    ```json
    {
      "totalUsers": 1284,
      "activeUsers": 1279,
      "suspendedUsers": 3,
      "bannedUsers": 2,
      "pendingReports": 3,
      "activePosts": 8420
    }
    ```

### 3.2 Student User Moderation
- **`GET /api/v1/admin/users?q=<search>&status=<all|active|suspended|banned>&page=1&limit=50`**
  - **Required Role**: `admin`
  - **Returns**: Paginated list of student accounts with private vault data (full name, department, year, section, ban status).

- **`POST /api/v1/admin/users/:userId/suspend`**
  - **Required Role**: `admin`
  - **Requires**: Admin re-auth password or escalation token.
  - **Body**:
    ```json
    {
      "days": 7,
      "reason": "Temporary harassment policy violation"
    }
    ```

- **`POST /api/v1/admin/users/:userId/ban`**
  - **Required Role**: `admin`
  - **Requires**: Admin re-auth password or escalation token.
  - **Body**:
    ```json
    {
      "reason": "Severe academic integrity breach"
    }
    ```

- **`POST /api/v1/admin/users/:userId/reactivate`**
  - **Required Role**: `admin`
  - **Body**: `{}`

### 3.3 Reported Content Queue
- **`GET /api/v1/admin/reports?status=pending`**
  - **Required Role**: `admin`
  - **Returns**: List of pending reports with reporter handle, target type (`post` | `user` | `comment`), target ID, violation reason, details, and snippet.

- **`POST /api/v1/admin/reports/:reportId/dismiss`**
  - **Required Role**: `admin`
  - **Body**: `{}`

- **`POST /api/v1/admin/reports/:reportId/remove`**
  - **Required Role**: `admin`
  - **Requires**: Admin re-auth password.
  - **Body**:
    ```json
    {
      "reason": "Violates campus community code"
    }
    ```

### 3.4 Community Posts Moderation
- **`GET /api/v1/admin/posts?status=all&page=1`**
  - **Required Role**: `admin`
  - **Returns**: List of community posts across all departments.

- **`DELETE /api/v1/admin/posts/:postId`**
  - **Required Role**: `admin`
  - **Requires**: Admin re-auth password.
  - **Body**:
    ```json
    {
      "reason": "Hate speech / harassment removal"
    }
    ```

### 3.5 Cryptographic Audit Logs
- **`GET /api/v1/admin/audit-logs?page=1&limit=100`**
  - **Required Role**: `admin`
  - **Returns**:
    ```json
    [
      {
        "id": "log_1794408900_a81f",
        "timestamp": "2026-11-11T15:00:00.000Z",
        "adminUser": "quad_admin",
        "action": "BAN_USER",
        "targetType": "user",
        "targetId": "spammer_99",
        "details": "Permanent ban executed. Reason: Commercial spam"
      }
    ]
    ```

### 3.6 Re-Authentication Verification
- **`POST /api/v1/auth/verify-password`**
  - **Requires**: Active session bearer token.
  - **Body**:
    ```json
    {
      "password": "Admin@Campus2026"
    }
    ```
  - **Returns**: `200 OK` `{ "verified": true }` or `401 Unauthorized`.
