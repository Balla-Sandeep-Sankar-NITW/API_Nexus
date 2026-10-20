"""Tiny additive migrations.

Base.metadata.create_all() creates missing tables but never adds columns to a
table that already exists, so a database created by an earlier version of the
app would be missing the newer columns. This adds them. It only ever *adds*
nullable (or defaulted) columns, so it is safe to run on every startup, and it
does nothing on a fresh database. Replace with Alembic when you outgrow it.
"""
from sqlalchemy import inspect, text

# table -> [(column, DDL type, default clause or "")]
ADDED_COLUMNS = {
    "graph_nodes": [
        ("owner_team", "VARCHAR", ""),
        ("owner_contact", "VARCHAR", ""),
        ("deprecated", "BOOLEAN NOT NULL", "BOOL_FALSE"),
        ("sunset_date", "DATE", ""),
        ("deprecation_note", "TEXT", ""),
    ],
}


def ensure_columns(engine) -> list[str]:
    inspector = inspect(engine)
    added: list[str] = []
    false_literal = "0" if engine.dialect.name == "sqlite" else "FALSE"
    with engine.begin() as conn:
        for table, columns in ADDED_COLUMNS.items():
            if not inspector.has_table(table):
                continue  # create_all() just made it with every column
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl_type, default in columns:
                if name in existing:
                    continue
                clause = f" DEFAULT {false_literal}" if default == "BOOL_FALSE" else ""
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl_type}{clause}"))
                added.append(f"{table}.{name}")
    return added
