# Quad — Campus, on your terms (`v2.7.0`)

A privacy-first, non-addictive B.Tech campus social network split cleanly into `frontend/` (TypeScript + React 19 + Vite + Tailwind) and `backend/` (TypeScript + Fastify v5 + Node.js `node:sqlite`).

> **v2.7.1 (WIP — Reels Improvements Needed)**: Fixed 3-column wide layout, unified Directory / Who to follow visibility, verified Threads nested replies & reporting, and overhauled Reels with FFmpeg H.264/AAC disk transcoding, `ffprobe` real durations, HTTP `206` streaming, interactive controls, and Personal Space reel management. **Note: Reels still requires further changes and improvements** (see [CHANGELOG.md](./CHANGELOG.md) and [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).
>
> **v2.7.0 Update**: Production-readiness release: white-label institution profile (presets, JSON override, open/allowlist/edu email policies), safer secrets and seeding, edit/delete own posts, search, notification bell, WCAG 2.1 AA colors and labels, self-hosted fonts, and global scrollbar-hidden UI. See [CHANGELOG.md](./CHANGELOG.md), [DEPLOYMENT.md](./DEPLOYMENT.md), and **[KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) (read before selling)**.
>
> **v2.6.0 Update**: Converted the entire `backend/` and `frontend/` codebase to strict TypeScript (`.ts` / `.tsx`) with typechecking via `tsc --noEmit` and Node v24 native `.ts` execution.
> **v2.5.0 Update**: Fixed unauthenticated and mid-registration Terms & Conditions / Privacy Policy navigation so viewing legal documents renders in an isolated guest layout / in-flow modal without redirecting to the main Feed or losing sign-up progress; added strict Proprietary License (`LICENSE`).

## Workspace Layout

```text
brainrot/
├── backend/                  # Fastify v5 + node:sqlite API, EXIF stripper, campus ranker & RBAC (TypeScript)
│   ├── src/
│   │   ├── algorithms/       # Non-addictive campusRanker.ts (feed, peers, reels, trending)
│   │   ├── config/           # constants.ts (environment, department maps, security limits)
│   │   ├── db/               # SQLite schema & database setup (database.ts)
│   │   ├── middleware/       # Bearer session auth, rate limiting, admin & re-auth guards (auth.ts)
│   │   ├── routes/           # auth.ts, feed.ts, social.ts, admin.ts endpoints under /api/v1
│   │   └── utils/            # Scrypt password hashing (crypto.ts), EXIF/XMP/comment scrubber (exifStripper.ts)
│   └── tests/                # Unit + HTTP integration suite (api.test.ts via node --test)
└── frontend/                 # TypeScript + React 19 + Vite + 4-token Tailwind design system
    ├── public/               # SVG + PNG favicons, Apple touch icon, PWA icons & manifest
    └── src/
        ├── components/       # Shared UI primitives, QuadLogo, PostCard, ErrorBoundary
        ├── context/          # AuthContext.tsx, AppContext.tsx, ThemeContext.tsx, ToastContext.tsx
        ├── screens/          # Welcome, Sign-up stepper, Feed, Personal Space, Reels, Threads, Settings, stealth AdminPanel
        ├── services/         # apiClient.ts, realAuthService.ts, mockAuthService.ts, adminService.ts
        └── types/            # Shared Quad domain & API interfaces (quad.ts)
```

## Quick Start

### 1. Start the Backend (`http://127.0.0.1:4000`)

Requires Node.js >= 22.5 (tested on Node v24 with built-in `node:sqlite` and native `.ts` stripping).

```powershell
cd backend
copy .env.example .env
npm install
npm run typecheck
npm start
```

On first boot, the backend automatically initializes `./data/quad.db` from `src/db/schema.sql`.

Run backend typecheck and tests:

```powershell
cd backend
npm run typecheck
npm test
```

### 2. Start the Frontend (`http://localhost:5173`)

`frontend/.env` ships with `VITE_AUTH_MODE=real` and `VITE_API_BASE_URL=/api/v1`, and `frontend/vite.config.ts` proxies `/api` to `http://127.0.0.1:4000`.

```powershell
cd frontend
npm install
npm run dev
```

To run the frontend in isolated browser-only mock mode instead, set `VITE_AUTH_MODE=mock` in `frontend/.env`.

Verify frontend TypeScript, lint, design-token compliance, and production bundle:

```powershell
cd frontend
npm run typecheck
npm run lint
node scripts/lint-tokens.ts
npm run build
```

## Architecture Highlights

- **Non-Addictive Campus Algorithm (`backend/src/algorithms/campusRanker.ts`)**:
  - **Public Feed**: Strict exclusion of blocked/muted authors, dismissed posts, and Personal Space posts (`isPersonal = 1`), combined with time decay (`~30h` half-life), same-branch / same-year relevance, verified-answer Question help boosts (favoring unanswered questions for 36 hours), creator diversity attenuation, and soft negative penalties for excessive external links.
  - **Discovery (`rankDiscoverablePeers`)**: Excludes accounts without `discoverable_by_branch = 1` and scores opted-in classmates by branch/year match, shared academic interests, and campus help contributions.
  - **Campus Reels (`rankCampusReels`)**: Prioritizes unseen reels first, then blends academic/department relevance with balanced watch completion (capped against viral runaway).
  - **Trending Topics (`computeRealTrendingTopics`)**: Computes topic momentum directly from recent non-personal campus posts without dark-pattern artificial urgency.
- **Privacy & Security Enforcements**:
  - **Zero Section Exposure**: Class `section` is stored for campus eligibility and never returned in public/peer payloads; `branch` and `year` are hidden unless opted into `discoverable`.
  - **Binary EXIF/GPS Stripping (`backend/src/utils/exifStripper.ts`)**: Validates JPEG/PNG/WebP magic bytes and strips JPEG `APP1`/`APP12`/`APP13`/`COM`, PNG `eXIf`/`tEXt`/`zTXt`/`iTXt`/`tIME`, and WebP `EXIF`/`XMP ` metadata before persistence.
  - **Access-Controlled Media (`GET /api/v1/media/:id`)**: Enforces visibility rules (returning `403` for another student's private Personal Space media).
  - **Stealth Admin Panel (`/admin/`)**: Lazy-loaded only after role check; normal users see the standard 404 page; destructive admin actions enforce shorter session expiry, inactivity timeout, audit logging, and password re-authentication (`REAUTH_REQUIRED`).
  - **Data Rights**: Authenticated users can export all their data as JSON (`GET /api/v1/auth/export`) or permanently delete their account (`DELETE /api/v1/auth/account`).

## License & Proprietary Notice

**Proprietary — All Rights Reserved.** See [LICENSE](./LICENSE).
Copying, cloning, mirroring, modifying, redistributing, or deploying any part of this repository without explicit prior written permission from the Copyright Holder is strictly prohibited.

