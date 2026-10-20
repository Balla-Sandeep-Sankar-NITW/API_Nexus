<div align="center">

  <h1>🌐 API Nexus</h1>

  <p><b>Collaborative API Dependency Mapping & Impact Analysis Platform</b></p>

  <p>
    Import OpenAPI specs, auto-generate interactive dependency graphs, collaborate with your team, and simulate breaking changes before pushing to production.
  </p>

  <p>
    <a href="https://apinexus.vercel.app/"><strong>Explore the Live Demo »</strong></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
    <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Deployment-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
  </p>

  <br />

  <img height = 50% width = 80% src="https://github.com/user-attachments/assets/469fd959-fe11-41f3-b334-14bd5cafe99a" alt="API Nexus Hero" width="100%" />

</div>


---

## 📖 Overview

**API Nexus** turns your OpenAPI specs into a living, interactive dependency map, so you can answer the scariest question in software: *"what breaks if I change this?"*

It maps every endpoint, schema and auth scheme, lets your team add the services, databases and third parties that specs don't describe, and then helps you **analyse impact, plan freezes, score risk, track deprecations, and even call the APIs**, all in one place.

---

## ✨ Features

### 🔐 Accounts & Security
- Sign up with **email verification**; log in and out with **JWT access + refresh tokens** (sessions refresh silently)
- **Password reset** by email link, plus resend-verification
- Passwords hashed with **bcrypt**
- Profile settings and a **sign-in history** of successful and failed logins
- **Role-based access control** (Leader / Member / Viewer) enforced on the server for every action
- **Audit trail** of who did what, and when

### 📁 Projects & Teams
- Create, rename, describe, **archive / restore** and delete projects (delete is owner-only)
- Dashboard with **totals** across your projects: projects, nodes, dependency links and memberships
- Invite members by email, **change roles** and remove members
- **Public read-only share link** you can turn on and off, with a view-only graph page for anyone who has it
- **Notification centre**: mentions, role changes, new members, freezes, imports, suggestion reviews and owner alerts, with mark-read, dismiss and clear-all

### 📥 OpenAPI Import & Versions
- Import **OpenAPI 3.x as JSON or YAML**: upload a file or paste it
- **Validation** with clear errors and a **preview before importing** (endpoint, schema and security-scheme counts, lists and warnings)
- Auto-generates nodes for **endpoints, schemas and auth schemes**, and links for **endpoint → schema** and **endpoint → auth** (including per-operation security overrides)
- **Import version history** and a **side-by-side comparison** of any two versions (added and removed endpoints, schemas and security schemes)
- Warns when re-importing a spec that is already in the project

### 🕸️ Interactive Dependency Graph
- Custom-built canvas: **zoom, pan, drag nodes, fit to screen**, keyboard shortcuts and a legend
- **Auto-arrange** layered layout (with confirmation) and smart free-slot placement for new nodes
- **Search** and **filter by node type**
- Seven node types: **API, Schema, Auth, Service, Database, External, Custom**; five link types: **depends on, calls, uses schema, uses auth, custom**
- Add, **edit and delete** nodes and links by hand, so the graph covers what specs don't
- **Path explorer** to find the shortest dependency path between any two nodes
- **Focus mode** that isolates a node and its neighbours up to a chosen radius
- Detail panel per node: type, source, owner, dependents, dependencies, risk and links, with collapsible tools
- Export the graph as **JSON, CSV, SVG image** or a **full HTML report**

### 💥 Impact Analysis & Freeze
- **Impact preview** in both directions: *who depends on this* and *what this depends on*
- **Depth control** (direct only, 2 or 3 levels, all) and a **kind-of-change filter** (schema, auth, calls...)
- Direct vs indirect counts and **"why is this affected?" dependency chains**, highlighted on the graph
- Results **update live** as you change settings
- **Temporary freeze** (visual) and **permanent project freeze** (leaders), with clear status colours: active, impacted, frozen, selected
- **What-if simulation**: remove a node, or take it down temporarily, and see what's affected and what would lose every dependency
- **"Safe to remove?" check** that names exactly what still depends on a node

### 🧊 Freeze Plans
- Generate an **ordered, step-by-step plan** from any node
- Track each step through **Pending → Frozen → Testing → Verified → Unfrozen**
- Collapsible plan cards with **progress bars** and an "all steps done" indicator
- **Delete plans** with a confirmation when they are finished or created by mistake

### 🧠 Smart Insights
- **Risk score (0 to 100)** for every node, explained factor by factor: blast radius, direct dependents, dependency depth, missing authentication, missing owner and deprecated-but-still-used
- **Risk heatmap** overlay on the graph and a ranked risk table
- **Findings** with severity and remediation guidance
- **Security view**: authentication coverage, endpoints without auth, coverage per auth scheme and sensitive-looking schemas exposed without auth
- **Ownership**: owning team and contact on every node, with owner coverage shown; owners who are project members are **notified** when their components are affected
- **Deprecation tracker**: mark nodes deprecated with a sunset date and note, then see what is **overdue, still in use, or safe to remove**
- **One-click report** (HTML, print-to-PDF ready) covering risk, security, findings, deprecations and ownership gaps

### ⏪ Snapshots & Time Travel
- Save **named snapshots** of the graph
- **Compare** any snapshot with the live graph
- **Restore** a snapshot (leaders)
- **Time Travel**: replay your architecture snapshot by snapshot with a slider, play and step controls, and see what was added or removed at each step
- Delete snapshots you no longer need

### 🧪 API Explorer
- **Try your endpoints like Swagger**, straight from the spec you imported, and jump in from any API node on the graph
- Forms **pre-filled from the spec**: path, query, header and cookie parameters, enums, and example request bodies built from schemas
- **Authorize** with bearer tokens, basic auth or API keys (header, query or cookie); the right credentials are picked for each endpoint
- JSON, form-encoded and text bodies with validation, **Format JSON** and **Reset to example**
- Custom headers, and a live preview of the exact URL that will be called
- Response viewer with **status, timing, size, headers and colour-coded JSON**, plus a flag showing whether the status code is **documented in the spec**
- **Copy as cURL** with secrets automatically hidden, and a session **request history**
- Clear, plain-language errors for blocked addresses, timeouts, unknown hosts and refused connections

### 💬 Collaboration
- **Comments** on any node
- **@mentions** with a teammate picker and instant notifications
- **Change suggestions** that leaders approve or reject
- Delete your own comments (leaders can delete any)

### 🕓 Activity & History
- Per-project **Activity log** and a **History** panel on the dashboard, in plain-English labels
- **Filter by time**: last hour, today, last 7 days, this month, all logs, or pick a specific **day** or **month**
- **Load more** paging through the full history

### 🛡️ Built-in Safeguards
- **SSRF protection** for the API Explorer: private, internal and cloud-metadata addresses are blocked by default, hostnames are resolved and pinned to the checked IP, and redirects are never followed
- Request time, size and per-user rate limits; viewers can read APIs but cannot send requests
- Credentials live only in the browser tab and are wiped on logout; request and response bodies are never stored
- Foreign-key-safe deletes, so removing a node cleans up its comments and plans
- **Automatic database migration** on startup for existing installs

### 📱 Experience
- Fully **responsive**: desktop, tablet and phone
- Keyboard-friendly with accessible labels and focus states
- Consistent design system, readable empty states and loading states throughout

---

## 📸 Screenshots

<table>
  <tr>
    <td width="50%" align="center">
      <b>Projects Dashboard</b><br/><br/>
      <img src="https://github.com/user-attachments/assets/18a9b697-c4ad-41dc-bc26-2cd806c568b5" alt="Projects Dashboard" width="100%"/>
    </td>
    <td width="50%" align="center">
      <b>Interactive Dependency Graph</b><br/><br/>
      <img src="https://github.com/user-attachments/assets/aca5a8e7-7495-4c88-afd3-49270ed0bb26" alt="Graph View" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <b>API Explorer</b><br/><br/>
      <img src="https://github.com/user-attachments/assets/fa525a60-c0a3-4233-9e4a-70286a41673b" alt="API Explorer" width="100%"/>
    </td>
    <td width="50%" align="center">
      <b>Architectural Insights</b><br/><br/>
      <img src="https://github.com/user-attachments/assets/eb193dc3-3334-4ec1-b5e5-173a66080d50" alt="Insights" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <b>Freeze plans</b><br/><br/>
      <img src="https://github.com/user-attachments/assets/30807fc1-4f29-4034-baf5-0790eb6af0f2" alt="Freeze plans" width="100%"/>
    </td>
    <td width="50%" align="center">
      <b>Activity & Audit Log</b><br/><br/>
      <img src="https://github.com/user-attachments/assets/a5b575a3-c5c6-460c-85df-2c159ff8cfb8" alt="Activity Log" width="100%"/>
    </td>
  </tr>
</table>

---

## 🛠️ Tech Stack

**Frontend**
- React 19 + Vite, React Router
- Custom SVG graph canvas and layered layout engine
- Hand-written CSS design system, no UI framework

**Backend**
- FastAPI (Python) with Pydantic validation
- SQLAlchemy ORM, httpx for the API Explorer, PyYAML for spec parsing
- JWT (python-jose) and bcrypt (passlib)

**Data & Hosting**
- PostgreSQL in production, SQLite for local development
- Vercel (frontend), Render (backend)
