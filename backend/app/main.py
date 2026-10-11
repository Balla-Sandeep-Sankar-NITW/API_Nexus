from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth, projects, openapi_import, graph, me, public

# Auto-create tables. For a real production rollout against Neon, replace
# this with Alembic migrations (see README.md).
Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Nexus", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(openapi_import.router)
app.include_router(graph.router)
app.include_router(me.router)
app.include_router(public.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
