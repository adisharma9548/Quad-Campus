# Changelog

## 2.7.1 (WIP — Reels Improvements Needed)

> [!NOTE]
> **Reels Status**: Core playback, FFmpeg transcoding, seek/keyboard controls, and Personal Space management are implemented, **but the Reels experience still needs further changes and improvements** (listed below) before final release.

### Fixes & Improvements Included
- **Layout (Part 1)**: Widened 3-column container up to 1600px (`240px` left nav / flexible center / `340px` right rail) with sticky side panels, in-flow footer links, right panel hidden below `1100px`, and mobile bottom bar below `768px`.
- **Directory & Who to Follow (Part 2)**: Unified single-source-of-truth filtering around `directoryVisible === true`, excluding self, accepted follows, bidirectional blocks, and pending requests from Who to follow while keeping browsing open for Directory-OFF students.
- **Threads & Reporting (Parts 3–4)**: Verified nested replies (`@mention` replies work for Directory-OFF peers) and aligned comment report toast/non-hiding behavior with Feed.
- **Reels Core Overhaul (Part 5)**:
  - Removed mock/placeholder reels and unused SVG covers.
  - Added server-side disk storage (`uploads/reels/`), `ffprobe` real duration/dimension detection, off-thread `ffmpeg` H.264/AAC transcoding (`1080×1920`, `-movflags +faststart`, `-map_metadata -1` GPS strip), and HTTP `206` byte-range streaming.
  - Synced timeline (`0:xx / 0:yy`) and interactive seek slider with real video duration, blocked native video right-click menu, added cover fade + buffering/error retry, play/pause center flash, session mute persistence, and keyboard shortcuts (`Space`, `M`, `←`/`→`, `↑`/`↓`/`J`/`K`).
  - Added `Reels` tab, grid, viewer modal, and deletion flow (with open-report moderation media retention) in Personal Space plus Peer Profile reels grid.
- **Automated Tests (Part 6)**: Added FFmpeg/ffprobe transcode, range-request, metadata-strip, delete authorization, open-report retention, and peer-profile visibility tests (33/33 backend tests passing).

### Reels — Needs Further Changes & Improvements
- Make reel creator `@username` handles interactive to open the peer's profile modal directly from the Reels player.
- Support full inline comment sheet inside Personal Space and Peer Profile reel viewer modals (currently points users to Campus Reels).
- Support direct permalink routing (`/?screen=reels&reel=<id>`) so shared reel links jump straight to the target reel.
- Polish reel upload retry/cancel UX, adaptive bitrate / preloading, and further UI/UX refinements requested next.

## 2.7.0

### Security and production readiness
- The server refuses to start in production without a strong `AUTH_SECRET`.
- Removed the publicly known default administrator password. The admin password is now generated at first start (development) or must be provided explicitly (production).
- Demo data is off by default in production; a production first start creates only the administrator you configure.
- Admins can no longer delete posts through the student endpoint (that path skipped password re-authentication and audit logging). Admin deletes go through `/api/v1/admin/posts/:id`.
- Baseline security headers on all API responses.
- Login page no longer shows demo credentials in real-backend builds; the offline mock auth service and its passwords are no longer bundled in real-backend builds.
- Fonts are self-hosted instead of loaded from Google Fonts (no third-party requests, matching the zero-tracking promise).

### White-label configuration
- New institution profile: programs, years, sections, email rules, and branding text come from `GET /api/v1/config`. Presets `engineering` and `university`, plus a JSON override file. Email policy can be `edu`, `domains`, or `open`.
- Sign-up, welcome, settings, and profile screens read this configuration.

### New features
- Edit your own posts (shows an "edited" label) and delete your own posts from the post menu.
- Search posts, usernames, and tags from the feed; trending tags open a filtered feed.
- Notification bell with unread count and "mark all as read". Follow requests and accepted requests now create notifications.
- "My branch" and "My year" filters now run on the server, fixing posts being wrongly excluded for authors who are not discoverable.

### Accessibility and UI
- WCAG 2.1 AA: light-mode accent and danger colors darkened to meet 4.5:1, hover states no longer lower contrast, accessible names fixed, progress bar labelled. axe-core reports 0 violations across 8 screens in light and dark.
- "Copy link" now shares the post text (the app has no per-post URLs yet) instead of copying a misleading page link.
- Removed leftover demo-user fallbacks (`quantum_dev`, `CSE`, a fake email and bio) from the UI.
- Mobile tab renamed from "Alerts" to "Requests" to match what it opens.

### Tests
- 11 new backend tests (24 total): institution rules, config endpoint, edit/delete authorization, security headers, production secret guard, production seeding.
