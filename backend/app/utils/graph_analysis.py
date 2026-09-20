"""
Impact analysis over the project dependency graph.

An edge (source -> target) means "source depends on target"
(e.g. an API operation depends on / uses a schema or auth scheme, or
a manually-created service->service dependency).

"dependencies" direction: starting at a node, walk outgoing edges
    (source == current) to find what IT depends on.
"dependents" direction: starting at a node, walk incoming edges
    (target == current) to find what depends ON it. This is the
    direction used for Freeze/Impact analysis - "if this breaks,
    what else breaks".
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass


@dataclass
class Edge:
    id: str
    source_node_id: str
    target_node_id: str
    edge_type: str = "depends_on"


@dataclass
class AffectedNode:
    node_id: str
    depth: int
    path: list[str]   # list of node_ids from source to this node


def compute_impact(
    source_node_id: str,
    edges: list[Edge],
    direction: str = "dependents",
    max_depth: int | None = None,
    edge_types: list[str] | None = None,
) -> list[AffectedNode]:
    """BFS traversal returning every node reachable from source_node_id,
    tagged with its depth (1 = direct) and the path taken to reach it.
    Cycle-safe: a node is only ever visited once (shortest-path depth wins).
    If edge_types is given, only edges of those types are traversed - this
    powers "change impact mode" (e.g. only follow schema-usage edges to see
    what a schema change would affect).
    """
    filtered = [e for e in edges if edge_types is None or e.edge_type in edge_types]
    adjacency: dict[str, list[str]] = {}
    for e in filtered:
        if direction == "dependents":
            # who points AT source -> incoming edges
            adjacency.setdefault(e.target_node_id, []).append(e.source_node_id)
        else:
            # what source points AT -> outgoing edges
            adjacency.setdefault(e.source_node_id, []).append(e.target_node_id)

    visited: set[str] = {source_node_id}
    results: list[AffectedNode] = []
    queue: deque[tuple[str, int, list[str]]] = deque()
    queue.append((source_node_id, 0, [source_node_id]))

    while queue:
        current, depth, path = queue.popleft()
        if max_depth is not None and depth >= max_depth:
            continue
        for neighbor in adjacency.get(current, []):
            if neighbor in visited:
                continue
            visited.add(neighbor)
            new_path = path + [neighbor]
            results.append(AffectedNode(node_id=neighbor, depth=depth + 1, path=new_path))
            queue.append((neighbor, depth + 1, new_path))

    return results


def find_orphaned(
    removed_node_id: str,
    affected: list[AffectedNode],
    edges: list[Edge],
) -> list[AffectedNode]:
    """Of the nodes affected by removing removed_node_id (in the 'dependents'
    direction - i.e. affected = things that depend on it), work out which
    ones would lose ALL of their outgoing dependencies once removed_node_id
    and every other affected node are gone. Those are truly orphaned rather
    than just "touched" by the change - useful for a removal/failure
    simulation, which is a stronger claim than plain reachability.
    """
    removed_set = {removed_node_id} | {a.node_id for a in affected}
    # outgoing edges per node (what each node currently depends on)
    depends_on: dict[str, list[str]] = {}
    for e in edges:
        depends_on.setdefault(e.source_node_id, []).append(e.target_node_id)

    orphaned = []
    for a in affected:
        deps = depends_on.get(a.node_id, [])
        if deps and all(d in removed_set for d in deps):
            orphaned.append(a)
    return orphaned
