# Changelog

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
