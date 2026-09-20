# API Nexus

A collaborative API dependency mapping and impact-analysis platform.
Import an OpenAPI spec, get an auto-generated dependency graph, edit it as a
team with role-based permissions, and — the core feature — select any node
and **freeze** it to see exactly what breaks.

Stack: **Vite + React** (frontend) · **FastAPI** (backend) · **PostgreSQL / Neon** (database)

---

## 1. Quick start

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: paste your Neon DATABASE_URL and a random JWT_SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

Without a `.env` file, the backend falls back to a local SQLite file
(`api_nexus_dev.db`) so you can run it immediately without Neon for local
development. Tables are created automatically on first run via
`Base.metadata.create_all` — for production, replace this with real Alembic
migrations (not included here).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api/*` to
`http://127.0.0.1:8000` (see `vite.config.js`) — no CORS setup needed locally.

### Getting a Neon connection string

1. Create a free project at neon.tech.
2. Copy the connection string from the dashboard (it includes `?sslmode=require`).
3. Paste it into `backend/.env` as `DATABASE_URL`.
4. Restart the backend — tables are created automatically.

---

## 2. Try it in under 2 minutes

1. Register two accounts (e.g. a leader and a teammate).
2. As the leader, create a project.
3. Open **Graph → Import OpenAPI** and paste `backend/sample_openapi.json`
   (included) — this auto-generates the dependency graph.
4. Add the teammate under **Members** with the "Member" role.
5. Add a couple of manual `service` nodes and link them (**Add node** /
   **Add link**) to build a chain like `OrderService → PaymentService`.
6. Select `PaymentService`, set direction to "Who depends on this", and hit
   **Freeze** — everything downstream lights up as impacted.
7. Log in as the teammate and confirm they can add nodes/links but get a
   clear permission error on leader-only actions (delete project, permanent
   freeze, member management).

---

## 3. What's implemented

This is a real, tested implementation — not a mockup. Every backend endpoint was
exercised end-to-end with curl during development, and the frontend is built
against the same API contract and passes a production `vite build`.

**Authentication & authorization**
- Register / login / refresh, JWT access + refresh tokens, bcrypt hashing
- Password reset (request → token → confirm) and email verification —
  both token-based; since no email backend is configured, tokens are
  surfaced directly in the UI/API response instead of being emailed
  (clearly labeled as a dev-mode stand-in everywhere it appears)
- Profile editing, login history
- RBAC: Leader / Member / Viewer, enforced server-side per project (not just
  hidden buttons — verified via direct API calls that return 403/404)

**Projects & membership**
- Create / rename / archive / delete projects, dashboard with per-project stats
- Invite members by email, change roles, remove members
- Shareable public read-only links (enable/revoke, no login required to view)
- Audit log (paginated) of every meaningful action, plus a cross-project
  "recent activity" rollup for the dashboard
- In-app notifications (bell icon) for invites, role changes, mentions,
  suggestions, imports, and freezes

**OpenAPI import & versioning**
- Paste, upload, JSON or YAML — auto-generates nodes (endpoints, schemas,
  auth schemes) and edges (uses-schema, uses-auth) with a small
  dependency-free parser (`app/utils/openapi_parser.py`)
- Preview-before-import (dry run, no writes) showing endpoint/schema counts
  and warnings
- Version history and a structural diff (endpoints/schemas/security schemes
  added or removed) between any two versions

**Graph — manual & collaborative editing**
- Add/edit/delete nodes and edges (permission-gated), edit edge type and
  description in place via the link manager
- Custom node types, drag-to-reposition with persisted positions, one-time
  force-directed auto-layout, pan/zoom, search, type filters
- Right-click context menu on nodes (view / freeze / delete)
- Keyboard shortcuts: Delete removes the selected node, Escape clears
  selection, `/` focuses search
- Undo affordance on the delete-node toast (restores the node; links are
  not restored, which the toast says explicitly)
- Comments per node with @mention parsing (highlighted, triggers a
  notification) and a suggestion workflow (Members flag a comment as a
  suggested change; Leaders approve/reject, both sides get notified)

**Freeze / impact analysis — the core feature**
- Select a node → **Freeze** → every dependent (direct and indirect) is
  computed via BFS and visually marked, with a "why is this affected" path
  per node and an animated dependency-chain highlight
- Direction toggle, depth control, and a **Change Impact Mode** selector
  that restricts traversal to schema/auth/service-type edges only
- Temporary freeze (visualization only) vs. permanent project freeze
  (Leader-only, persisted)
- **Focus / Isolate** mode and a **dependency path explorer** (shortest path
  between any two nodes)
- **What-if simulation** (removal or temporary failure) that distinguishes
  merely "affected" nodes from ones that would be fully **orphaned**
  (lose every remaining dependency)
- **Freeze plans**: generate an ordered rollout checklist from an impact
  calculation, track each step through Pending → Frozen → Testing → Verified

**Version control**
- OpenAPI spec versions (above) plus independent **graph snapshots**: save
  the current node/edge state under a label, diff any snapshot against the
  live graph, and restore a snapshot (Leader-only, confirmation-gated,
  destructive and documented as such)

**Insights & findings**
- Dependency heatmap and "high dependency concentration" detection
- A findings/severity system (`GET /findings`) — fan-in risk, missing-auth
  detection, isolated-endpoint detection — each with a severity and a
  concrete suggested action

**Export**
- Graph as JSON, dependency list as CSV, graph as SVG or PNG (rasterized
  client-side from the live canvas), and a printable report (project stats
  + findings) via the browser's native print-to-PDF

**Design**
- Hand-written design system (no UI kit): neutral palette, functional status
  colors only, Inter + IBM Plex Mono, confirmation dialogs on destructive
  actions, toasts (with an action-button variant for Undo), empty/loading
  states — reviewed against the "real engineering tool, not an AI dashboard"
  brief

## 4. What's intentionally out of scope here

- **Google/GitHub OAuth login** — needs an external OAuth app's client ID
  and secret that only you can provision; the email/password flow is fully
  built, but social login isn't wired up
- **Direct operation-to-operation dependency inference** — the graph infers
  dependency through shared schemas and auth schemes (which is what's
  actually derivable from an OpenAPI spec); true call-graph inference
  between operations isn't reliably derivable from the spec alone
- **A production email provider isn't included** — see "Email delivery"
  below for what is included: real SMTP sending works today if you point it
  at any SMTP server
- **Real-time multi-user collaboration (WebSockets/live cursors)** — the
  app is request/response; two people editing the same graph won't see each
  other's cursors or live updates without a manual refresh
- **Alembic migrations** — schema is created via `create_all`, fine for
  development but you'll want real migrations before production

## 5. Email delivery (verification / password reset)

Real SMTP sending is implemented in `app/utils/email.py` — not a stub. It's
tested end-to-end (see the code history) against a local test SMTP server:
with `SMTP_HOST` set, registering, resending verification, or requesting a
password reset actually sends a real email containing a working link, and
the raw token is **never** included in the API response once SMTP is
configured (returning it alongside a genuinely-sent email would let anyone
reset any account without owning the inbox — this is checked and enforced
server-side, not just a frontend convention).

**To enable it**, set in `backend/.env`:
```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_BASE_URL=https://your-deployed-frontend.com
```
Any standard SMTP provider works (Gmail SMTP, SendGrid, Postmark, AWS SES's
SMTP interface, Mailgun, etc.).

**Without `SMTP_HOST` set** (the default), the app runs in dev mode: emails
are logged to the backend console instead of sent, and `verification_token`
/ `reset_token` are returned directly in the API response so the flow is
still fully testable without a mailbox — this is what the "no SMTP
configured" messaging in the UI is telling you, not an error.

**Login is gated on verification.** Registering does not create a session —
it only creates the account and issues a verification email/token; the
frontend shows a "check your email" screen instead of dropping you into
the dashboard. `/login` returns 403 for an unverified account even with the
correct password, and the login form surfaces a "resend verification link"
action in that case.

## 6. Project structure

```
api-nexus/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app, CORS, router registration
│   │   ├── config.py          Settings (reads .env)
│   │   ├── database.py        SQLAlchemy engine/session
│   │   ├── models.py          All ORM models
│   │   ├── schemas.py         Pydantic request/response models
│   │   ├── auth.py            JWT + password hashing
│   │   ├── deps.py            get_current_user, RBAC dependency factory
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── projects.py    Projects, members, audit log
│   │   │   ├── openapi_import.py   Import + version history/diff
│   │   │   └── graph.py       Nodes, edges, freeze/impact, path, comments
│   │   └── utils/
│   │       ├── openapi_parser.py   Spec -> nodes/edges
│   │       ├── graph_analysis.py   BFS impact traversal
│   │       └── audit.py
│   ├── requirements.txt
│   ├── .env.example
│   └── sample_openapi.json    Try the import flow with this
└── frontend/
    ├── src/
    │   ├── api/client.js       fetch wrapper, token storage
    │   ├── context/            Auth + Toast providers
    │   ├── components/         GraphCanvas, NodeDetailPanel, modals, panels
    │   ├── pages/               Login, Register, Dashboard, ProjectGraph
    │   └── utils/               force layout, export helpers
    └── vite.config.js           dev proxy to the backend
```
