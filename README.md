# Quad — Campus, on your terms (`v2.5.0`)

A privacy-first, non-addictive B.Tech campus social network split cleanly into `frontend/` (React + Vite + Tailwind) and `backend/` (Fastify v5 + Node.js `node:sqlite`).

> **v2.5.0 Update**: Fixed unauthenticated and mid-registration Terms & Conditions / Privacy Policy navigation so viewing legal documents renders in an isolated guest layout / in-flow modal without redirecting to the main Feed or losing sign-up progress; added strict Proprietary License (`LICENSE`).

## Workspace Layout

```text
brainrot/
├── backend/                  # Fastify v5 + node:sqlite API, EXIF stripper, campus ranker & RBAC
│   ├── src/
│   │   ├── algorithms/       # Non-addictive campusRanker.js (feed, peers, reels, trending)
│   │   ├── config/           # Environment, department maps, security limits
│   │   ├── db/               # SQLite schema & deterministic campus seed data
│   │   ├── middleware/       # Bearer session auth, rate limiting, admin & re-auth guards
│   │   ├── routes/           # auth, feed, social, admin endpoints under /api/v1
│   │   └── utils/            # Scrypt password hashing, EXIF/XMP/comment binary scrubber
│   └── tests/                # Unit + HTTP integration suite (node:test)
└── frontend/                 # React 19 + Vite + 4-token Tailwind design system
    ├── public/               # SVG + PNG favicons, Apple touch icon, PWA icons & manifest
    └── src/
        ├── components/       # Shared UI primitives, QuadLogo, PostCard, ErrorBoundary
        ├── context/          # AuthContext, AppContext, ThemeContext, ToastContext
        ├── screens/          # Welcome, Sign-up stepper, Feed, Personal Space, Reels, Threads, Settings, stealth AdminPanel
        └── services/         # apiClient.js, realAuthService.js, mockAuthService.js, adminService.js
```

## Quick Start

### 1. Start the Backend (`http://127.0.0.1:4000`)

Requires Node.js >= 22.5 (tested on Node v24 with built-in `node:sqlite`).

```powershell
cd backend
copy .env.example .env
npm install
npm start
```

On first boot, the backend automatically initializes `./data/quad.db` from `src/db/schema.sql` and seeds campus students, posts, reels, threads, reports, and the stealth admin account.

Run backend tests:

```powershell
cd backend
npm test
```

### 2. Start the Frontend (`http://localhost:5173`)

`frontend/.env` ships with `VITE_AUTH_MODE=real` and `VITE_API_BASE_URL=/api/v1`, and `frontend/vite.config.js` proxies `/api` to `http://127.0.0.1:4000`.

```powershell
cd frontend
npm install
npm run dev
```

To run the frontend in isolated browser-only mock mode instead, set `VITE_AUTH_MODE=mock` in `frontend/.env`.

Verify frontend lint, design-token compliance, and production bundle:

```powershell
cd frontend
npm run lint
node scripts/lint-tokens.js
npm run build
```

## Seeded Local Accounts

Configured via `backend/.env` (`SEED_STUDENT_PASSWORD`, `SEED_ADMIN_PASSWORD`, `MOCK_ADMIN_EMAIL`, `MOCK_ADMIN_USERNAME`):

| Role | Username | Email | Password |
|---|---|---|---|
| Student | `quantum_dev` | `aarav.patel@btech.college.edu.in` | `Campus@2026` |
| Student | `cyber_sage` | `rohan.verma@btech.college.edu.in` | `Campus@2026` |
| Admin (Stealth) | `quad_admin` | `admin.lead@btech.college.edu.in` | `Admin@Campus2026` |

## Architecture Highlights

- **Non-Addictive Campus Algorithm (`backend/src/algorithms/campusRanker.js`)**:
  - **Public Feed**: Strict exclusion of blocked/muted authors, dismissed posts, and Personal Space posts (`isPersonal = 1`), combined with time decay (`~30h` half-life), same-branch / same-year relevance, verified-answer Question help boosts (favoring unanswered questions for 36 hours), creator diversity attenuation, and soft negative penalties for excessive external links.
  - **Discovery (`rankDiscoverablePeers`)**: Excludes accounts without `discoverable_by_branch = 1` and scores opted-in classmates by branch/year match, shared academic interests, and campus help contributions.
  - **Campus Reels (`rankCampusReels`)**: Prioritizes unseen reels first, then blends academic/department relevance with balanced watch completion (capped against viral runaway).
  - **Trending Topics (`computeRealTrendingTopics`)**: Computes topic momentum directly from recent non-personal campus posts without dark-pattern artificial urgency.
- **Privacy & Security Enforcements**:
  - **Zero Section Exposure**: Class `section` is stored for campus eligibility and never returned in public/peer payloads; `branch` and `year` are hidden unless opted into `discoverable`.
  - **Binary EXIF/GPS Stripping (`backend/src/utils/exifStripper.js`)**: Validates JPEG/PNG/WebP magic bytes and strips JPEG `APP1`/`APP12`/`APP13`/`COM`, PNG `eXIf`/`tEXt`/`zTXt`/`iTXt`/`tIME`, and WebP `EXIF`/`XMP ` metadata before persistence.
  - **Access-Controlled Media (`GET /api/v1/media/:id`)**: Enforces visibility rules (returning `403` for another student's private Personal Space media).
  - **Stealth Admin Panel (`/admin/`)**: Lazy-loaded only after role check; normal users see the standard 404 page; destructive admin actions enforce shorter session expiry, inactivity timeout, audit logging, and password re-authentication (`REAUTH_REQUIRED`).
  - **Data Rights**: Authenticated users can export all their data as JSON (`GET /api/v1/auth/export`) or permanently delete their account (`DELETE /api/v1/auth/account`).

## License & Proprietary Notice

**Proprietary — All Rights Reserved.** See [LICENSE](./LICENSE).
Copying, cloning, mirroring, modifying, redistributing, or deploying any part of this repository without explicit prior written permission from the Copyright Holder is strictly prohibited.

