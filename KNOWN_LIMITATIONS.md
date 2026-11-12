# Known limitations before selling or launching

These are real gaps. None are hidden; fix the first three before charging customers.

1. **Email is not actually verified.** Sign-up checks the *format* of the email (for example `.edu`) but never proves the person owns it. The "Verified College Network" wording is therefore stronger than the product. Add an email provider (SMTP or a service such as SES/Resend), send a one-time code at sign-up, and block access until it is confirmed.
2. **Password reset does not send email.** Same missing email provider.
3. **No production hosting setup.** The backend uses a single SQLite file. That is fine for one institution on one server with backups; for many customers on shared infrastructure, move to PostgreSQL or run one instance per customer. Put it behind HTTPS (a reverse proxy such as Caddy or nginx).
4. **Moderation is manual.** There is a report queue and admin panel, but no automated abuse detection, no appeals flow, and no age-verification beyond a date-of-birth check. Check the laws that apply to your customers (child safety rules, GDPR/DPDP, local data-protection law) and have the Terms and Privacy Policy reviewed by a lawyer. The legal text in the app is a template.
5. **No direct messages, no per-post links, no push notifications.**
6. **Session token is stored in browser local storage.** Standard for this architecture, but it is readable by any script that runs on the page. Serve the app with a strict Content-Security-Policy header (see DEPLOYMENT.md).
7. **Media storage is split.** Post image attachments are still stored in SQLite for small deployments; Reels are transcoded and stored on local disk (`backend/uploads/reels/`). Move both to S3-compatible object storage before scaling.
8. **Reels feature still needs further changes and improvements.** While FFmpeg transcoding, `206` streaming, real durations, custom controls, and Personal Space deletion work, Reels still lacks clickable `@username` profile links from the player, direct reel permalinks (`?reel=<id>`), inline comments inside Personal Space / Peer Profile reel modals, and additional UI/UX polish.
9. **Demo content strings remain inside the production JavaScript bundle** (usernames and sample posts used only by the offline demo mode). No passwords or secrets are included, but they add weight.
10. **Licence.** The repository `LICENSE` is proprietary. Confirm it matches how you intend to sell (for example per-customer licences) and that all third-party packages keep their own licences.
