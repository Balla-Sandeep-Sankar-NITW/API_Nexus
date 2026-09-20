from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/public", tags=["public"])


def _get_shared_project(db: Session, share_token: str) -> models.Project:
    project = db.query(models.Project).filter(models.Project.share_token == share_token).first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This share link is invalid or has been revoked")
    return project


@router.get("/{share_token}/project")
def public_project(share_token: str, db: Session = Depends(get_db)):
    project = _get_shared_project(db, share_token)
    return {
        "name": project.name,
        "description": project.description,
        "node_count": len(project.nodes),
        "edge_count": len(project.edges),
    }


@router.get("/{share_token}/graph", response_model=schemas.GraphOut)
def public_graph(share_token: str, db: Session = Depends(get_db)):
    project = _get_shared_project(db, share_token)
    nodes = db.query(models.GraphNode).filter(models.GraphNode.project_id == project.id).all()
    edges = db.query(models.GraphEdge).filter(models.GraphEdge.project_id == project.id).all()
    return schemas.GraphOut(nodes=nodes, edges=edges)
