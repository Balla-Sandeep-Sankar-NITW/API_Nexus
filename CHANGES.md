# What changed in this version

## 1. Security + email (works on Render's free plan)
- **Fixed:** tokens were returned in API responses whenever an email failed to send, which let anyone reset any password. Tokens now leave **only by email**. They appear in responses only when `APP_ENV=development` and no email provider is set.
- Email goes over HTTPS (Brevo API, free 300/day) instead of SMTP, which Render's free plan blocks. SMTP remains as an optional fallback.
- Emails send in the background with a 10s timeout, so a slow provider never freezes a request.
- Verification links expire after 24h; reset links after 30 min; both are single-use and stored hashed.
- Reset also verifies the email and signs out every other session.
- The server refuses to start in production with a missing/short `JWT_SECRET_KEY`.
- Refresh token now travels in the request body, not the URL.
- Sign-up no longer reveals whether an email is registered.

## 2. Accounts
- **Continue with GitHub** (free OAuth). Shown only when configured.
- Rate limiting + lockout on login (6 failures / 15 min per email+IP), sign-up, resend and reset.
- Change password (also sets one for GitHub-only accounts), sign out other devices, download my data, delete account (projects pass to another leader if one exists, otherwise they are deleted).
- Password strength meter, show/hide, common-password blocklist.
- Project deletion is now foreign-key safe on Postgres (audit logs, snapshots, plans).

## 3. Pages
Terms, Privacy, Acceptable Use, Cookies, About, Help/FAQ, 404, and a footer with links. Consent checkbox on sign-up. The legal pages are plain-language templates written for how this app works; have them reviewed for your country.

## 4. Dashboard + smoothness
- Dashboard keeps its original layout (History, New project, table), now with a project count and a search bar.
- Dashboard shows cached data instantly and refreshes in the background; graph page code is preloaded on hover.
- Skeleton loaders instead of spinners, a thin progress bar for requests, soft page/modal/toast transitions, press feedback on buttons. All motion is disabled for people who prefer reduced motion.
- If the free server is asleep, reads are retried automatically on 502/503/504 (no popup).

## Update 2: dashboard, GitHub button, phone and tablet
- Dashboard: project count next to the title, always-visible search (press `/` to jump to it), status filter, sort, and clean image-free project cards.
- "Continue with GitHub" is always shown. If the server has not been set up for it, the click explains that instead of hiding the button. To turn it on, set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `BACKEND_BASE_URL` on the backend and redeploy.
- Removed the "waking up the server" popup.
- Phone/tablet: compact project header with an icon-only settings button, tab strip with edge fades that keeps the open tab in view, wrapping toolbars (no clipped buttons), the attention list keeps project names, no duplicate title bar, larger touch targets.

# Setup (all free)

## Backend (Render) environment variables
| Variable | Value |
|---|---|
| `APP_ENV` | `production` |
| `JWT_SECRET_KEY` | output of `openssl rand -hex 32` |
| `DATABASE_URL` | your Neon connection string |
| `CORS_ORIGINS` | your Vercel URL |
| `FRONTEND_BASE_URL` | your Vercel URL |
| `BREVO_API_KEY` | from Brevo (below) |
| `EMAIL_FROM_ADDRESS` | the sender you verified in Brevo |
| `BACKEND_BASE_URL` | your Render URL, e.g. `https://api-nexus.onrender.com` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional, from GitHub (below) |

Remove `SMTP_*` variables on Render; they are not needed.

### Brevo (email)
1. Sign up at brevo.com (free plan, no card).
2. Settings -> SMTP & API -> API keys -> create a key.
3. Settings -> Senders -> add the address you want mail to come from, and click the link Brevo emails you. A Gmail address works to start; a domain you own gives better inbox placement.

### GitHub sign-in
GitHub -> Settings -> Developer settings -> OAuth Apps -> New. Homepage = your frontend URL. Callback = `<BACKEND_BASE_URL>/api/auth/github/callback`.

## Frontend (Vercel) environment variables
`VITE_API_BASE_URL` = `https://<your-render-url>/api` (as before). Optional, shown on the legal/About pages: `VITE_OPERATOR_NAME`, `VITE_CONTACT_EMAIL`, `VITE_REPO_URL`.

## Keep the free server awake (optional)
Create a free monitor at uptimerobot.com hitting `https://<your-render-url>/api/health` every 5 minutes.

## Database
New columns are added automatically on startup. Pending verification links created before this update stop working (tokens are now hashed); people can request a new one.
