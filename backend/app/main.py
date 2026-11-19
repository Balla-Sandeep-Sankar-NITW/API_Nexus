from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.migrations import ensure_columns
from app.utils.email import email_enabled
from app.routers import auth, oauth, projects, openapi_import, graph, insights, explorer, me, public

# Auto-create tables. For a real production rollout against Neon, replace
# this with Alembic migrations (see README.md).
Base.metadata.create_all(bind=engine)
ensure_columns(engine)

app = FastAPI(title="API Nexus", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(oauth.router)
app.include_router(projects.router)
app.include_router(openapi_import.router)
app.include_router(graph.router)
app.include_router(insights.router)
app.include_router(explorer.router)
app.include_router(me.router)
app.include_router(public.router)


if not email_enabled():
    print(
        "[WARNING] No email provider configured (set BREVO_API_KEY + EMAIL_FROM_ADDRESS). "
        "People will not receive verification or password-reset emails."
        + (" Development mode: tokens are returned in API responses." if settings.is_dev else "")
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}
