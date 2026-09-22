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

  <img src="https://github.com/user-attachments/assets/469fd959-fe11-41f3-b334-14bd5cafe99a" alt="API Nexus Hero" width="100%" />

</div>


---

## 📖 Overview

**API Nexus** solves the microservice dependency black box. When working with complex API architectures, understanding downstream impacts during breaking changes is critical. 

By parsing OpenAPI specifications, API Nexus automatically constructs visual dependency trees, allows real-time team collaboration, and features a powerful **Freeze & Impact Analysis engine** to show you exactly what will break before a deployment happens.

---

## ✨ Key Features

- **🔐 Auth & RBAC** — Secure JWT authentication with email verification, password reset workflows, and granular role permissions (`Leader`, `Member`, `Viewer`).
- **📑 OpenAPI Parsing & Diffing** — Instantly convert OpenAPI (Swagger) specs into structured dependency graphs with built-in version history and diff tracking.
- **🤝 Real-Time Collaboration** — Add, edit, or delete nodes and edges alongside teammates. Supports inline comments, `@mentions`, and proposed change suggestions.
- **❄️ Freeze & Impact Analysis** — Lock down any endpoint or service node to visually highlight all impacted downstream dependencies across your architectural tree.
- **🧪 What-If Simulation** — Safely model the removal, migration, or downtime of specific endpoints before altering production environments.
- **📊 Architectural Insights** — Automated system health audits detailing dependency heatmaps, high-fan-in hotspots, unauthenticated endpoints, and isolated services.
- **📦 Multi-Format Export** — Export graph diagrams as `JSON`, `CSV`, `SVG`, or `PNG`, or generate clean, print-ready PDF impact reports.
- **📜 Audit Log & Notifications** — Complete visibility into system edits, project history, and collaborative activity.

---

## 📸 Screenshots

<table>
  <tr>
    <td width="50%" align="center">
      <b>Projects Dashboard</b><br/><br/>
      <img src="https://github.com/user-attachments/assets/a2ed032c-0b05-4554-9650-294540461bce" alt="Projects Dashboard" width="100%"/>
    </td>
    <td width="50%" align="center">
      <b>Interactive Dependency Graph</b><br/><br/>
      <img src="https://github.com/user-attachments/assets/e328a9fd-54d4-49c5-8214-cc2115cda5b4" alt="Graph View" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <b>Architectural Insights</b><br/><br/>
      <img src="https://github.com/user-attachments/assets/ac013084-7609-4353-be7e-1cf31ad88a49" alt="Insights" width="100%"/>
    </td>
    <td width="50%" align="center">
      <b>Activity & Audit Log</b><br/><br/>
      <img src="https://github.com/user-attachments/assets/bcbda6f7-799c-4f3e-8574-9fb9a18c73aa" alt="Activity Log" width="100%"/>
    </td>
  </tr>
</table>

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18 + Vite
- **UI & Styling:** Tailwind CSS, Radix UI
- **Graph Engine:** React Flow / Cytoscape.js
- **State & Query Management:** React Query, Zustand

### Backend
- **Framework:** FastAPI (Python 3.10+)
- **ORM & DB Access:** SQLAlchemy / SQLModel
- **Auth:** JWT, Passlib (Bcrypt)
- **Parser:** OpenAPI Spec Validator

### Database & Hosting
- **Database:** PostgreSQL
- **Frontend Hosting:** Vercel
- **Backend Hosting:** Render / Railway

---
