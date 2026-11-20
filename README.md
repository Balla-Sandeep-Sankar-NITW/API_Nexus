<div align="center">

# API Nexus

**See what breaks before you change an API.**

Import an OpenAPI spec, get an interactive dependency map, and check the impact of a change before it ships. Free and open to everyone.

[**Live demo**](https://apinexus.vercel.app/) · [Report a bug](../../issues)

![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)


</div>

## Features

### Accounts and security
- Sign up with **email verification**, or **continue with GitHub** (with a "use a different GitHub account" option)
- Log in with **JWT access and refresh tokens** that renew silently
- **Password reset** by email link, **resend verification**, **change password**, and a password strength meter
- **Sign out other devices**, **download all your data** as JSON, and **delete your account**
- **Rate limiting and lockout** on login, sign-up and reset requests
- Emailed links are **single-use, expire, and are stored hashed**; passwords are hashed with bcrypt
- Email sent over an **HTTPS API** (Brevo), so it works on free hosting that blocks SMTP
- Profile settings and a **sign-in history** of successful and failed logins
- **Role-based access** (Leader, Member, Viewer) enforced on the server for every action
- **Audit trail** of who did what, and when

### Projects and teams
- Create, rename, describe, **archive and restore**, and delete projects (delete is owner-only)
- Dashboard with your **project count**, **search** (press `/` to jump to it) and a **History** panel
- A one-click **sample project** to explore the app
- Invite members by email, **change roles**, and remove members
- **Public read-only share link** you can turn on and off, with a view-only graph page
- **Notification centre** for mentions, role changes, new members, freezes, imports, suggestion reviews and owner alerts, with mark-read, dismiss and clear-all

### OpenAPI import and versions
- Import **OpenAPI 3.x as JSON or YAML** by uploading a file or pasting it
- **Validation** with clear errors and a **preview before importing** (endpoint, schema and security-scheme counts, lists and warnings)
- Auto-generates nodes for **endpoints, schemas and auth schemes**, and links for **endpoint to schema** and **endpoint to auth** (including per-operation security overrides)
- **Import version history** and a **side-by-side comparison** of any two versions
- Warns when you re-import a spec that is already in the project

### Interactive dependency graph
- Custom-built canvas with **zoom, pan, drag, fit to screen**, keyboard shortcuts and a legend
- **Auto-arrange** layered layout and smart placement for new nodes
- **Search** and **filter by node type**
- Seven node types (**API, Schema, Auth, Service, Database, External, Custom**) and five link types (**depends on, calls, uses schema, uses auth, custom**)
- Add, **edit and delete** nodes and links by hand, so the graph covers what specs can't describe
- **Path explorer** to find the shortest dependency path between two nodes
- **Focus mode** that isolates a node and its neighbours up to a chosen radius
- Detail panel per node: type, source, owner, dependents, dependencies, risk and links
- Export the graph as **JSON, CSV, SVG** or a **full HTML report**

### Impact analysis and freeze
- **Impact preview** in both directions: who depends on this, and what this depends on
- **Depth control** and a **kind-of-change filter**, with results that update live
- Direct and indirect counts, plus **"why is this affected?" dependency chains** highlighted on the graph
- **Temporary freeze** (visual) and **permanent project freeze** (leaders)
- **What-if simulation**: remove a node or take it down temporarily and see what is affected
- **"Safe to remove?" check** that names exactly what still depends on a node

### Freeze plans
- Generate an **ordered, step-by-step plan** from any node
- Track each step through **Pending, Frozen, Testing, Verified and Unfrozen**
- Plan cards with **progress bars**, and delete plans you no longer need

### Smart insights
- **Risk score (0 to 100)** for every node, explained factor by factor: blast radius, direct dependents, depth, missing authentication, missing owner and deprecated-but-still-used
- **Risk heatmap** on the graph and a ranked risk table
- **Findings** with severity and guidance on what to do
- **Security view**: authentication coverage, endpoints without auth, coverage per auth scheme and sensitive-looking schemas exposed without auth
- **Ownership** on every node, with coverage shown; owners who are project members are **notified** when their components are affected
- **Deprecation tracker** with sunset dates and notes, showing what is **overdue, still in use or safe to remove**
- **One-click report** (HTML, print-to-PDF ready) covering risk, security, findings, deprecations and ownership gaps

### Snapshots and time travel
- Save **named snapshots** of the graph and **compare** any snapshot with the live graph
- **Restore** a snapshot (leaders) or delete ones you don't need
- **Time travel**: replay your architecture snapshot by snapshot with a slider, play and step controls

### API Explorer
- **Try your endpoints like Swagger**, straight from the imported spec, or jump in from any API node on the graph
- Forms **pre-filled from the spec**: path, query, header and cookie parameters, enums and example request bodies
- **Authorize** with bearer tokens, basic auth or API keys (header, query or cookie)
- JSON, form-encoded and text bodies, **Format JSON**, **Reset to example**, custom headers and a live URL preview
- Response viewer with **status, timing, size, headers and colour-coded JSON**, and a flag for whether the status code is **documented in the spec**
- **Copy as cURL** with secrets hidden, and a session **request history**
- Plain-language errors for blocked addresses, timeouts, unknown hosts and refused connections

### Collaboration
- **Comments** on any node, and **@mentions** with a teammate picker and instant notifications
- **Change suggestions** that leaders approve or reject
- Delete your own comments (leaders can delete any)

### Activity and history
- Per-project **activity log** in plain-English labels
- **Filter by time**: last hour, today, last 7 days, this month, all, or a specific day or month
- **Load more** paging through the full history

### Built-in safeguards
- **SSRF protection** for the API Explorer: private, internal and cloud-metadata addresses are blocked, hostnames are resolved and pinned to the checked IP, and redirects are never followed
- Request time, size and per-user rate limits; viewers can read APIs but cannot send requests
- Credentials stay in the browser tab and are wiped on logout; request and response bodies are never stored
- Foreign-key-safe deletes for nodes, projects and accounts
- **Automatic database migration** on startup for existing installs
- The server refuses to start in production without a strong JWT secret

### Experience
- Fully **responsive** on desktop, tablet and phone
- **Skeleton loaders**, a slim request progress bar and soft page transitions (all switched off for people who prefer reduced motion)
- Reads **retry automatically** while a free-tier server wakes up
- Keyboard friendly, with accessible labels and focus states
- **About, Help and FAQ**, **Terms**, **Privacy**, **Acceptable Use** and **Cookies** pages, and a proper 404



## Tech stack

- **Frontend:** React 19, Vite, React Router, a custom SVG graph canvas and layout engine, hand-written CSS
- **Backend:** FastAPI, Pydantic, SQLAlchemy, httpx, PyYAML, JWT (python-jose), bcrypt
- **Data and hosting:** PostgreSQL in production and SQLite locally; runs free on Vercel, Render, Neon and Brevo