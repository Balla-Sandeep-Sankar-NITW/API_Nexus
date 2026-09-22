# API Nexus

A collaborative API dependency mapping and impact-analysis platform. Import an OpenAPI spec, get an auto-generated dependency graph, edit it as a team, and freeze any node to see exactly what breaks.

**Stack:** React (Vite) · FastAPI · PostgreSQL

Demo Link : <a href = "https://apinexus.vercel.app "> API Nexus </a>

![Login](<img width="2859" height="1537" alt="image" src="https://github.com/user-attachments/assets/23ec3f08-e5c3-4286-9f0b-9becc0dd94f7" />
)

## Screenshots

| Projects Dashboard | Dependency Graph |
|---|---|
| ![Projects Dashboard](<img width="2866" height="1530" alt="image" src="https://github.com/user-attachments/assets/70e52e7e-0774-48c3-b257-3f7338cdf861" />
) | ![Graph View](
) |

| Insights | Activity Log |
|---|---|
| ![Insights](
) | ![Activity Log](
) |

## Features

- **Auth & RBAC** — JWT-based login, email verification, password reset, Leader/Member/Viewer roles
- **OpenAPI import** — parses specs into an auto-generated dependency graph, with version history and diffing
- **Collaborative graph editing** — add/edit/delete nodes and edges, comments, @mentions, change suggestions
- **Freeze & impact analysis** — select a node, freeze it, and see everything downstream that's affected
- **What-if simulation** — preview the impact of removing or failing a node before doing it
- **Insights** — dependency heatmap, high-fan-in detection, missing-auth and isolated-endpoint findings
- **Export** — graph as JSON/CSV/SVG/PNG, printable PDF report
- **Audit log & notifications** — full activity trail per project

## Getting Started

