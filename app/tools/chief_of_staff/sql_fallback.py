"""Guarded read-only SQL fallback.

The primary path is always a parameterized read tool. This exists only for the
long tail. Validation is done IN CODE (not trusted to the model): single
statement, must start with SELECT, no write/DDL verbs, no stacked statements,
forced ``LIMIT <= 200``. The query runs against a per-tenant SQLite view that
contains ONLY this tenant's rows (tenant filter is structural, not textual).
"""

from __future__ import annotations

import re

from .context import ToolContext

MAX_LIMIT = 200

_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|replace|merge|grant|"
    r"revoke|copy|attach|detach|pragma|vacuum|reindex|begin|commit)\b",
    re.IGNORECASE,
)
_SELECT_START = re.compile(r"^\s*select\b", re.IGNORECASE)
_LIMIT_RE = re.compile(r"\blimit\b\s+(\d+)", re.IGNORECASE)


class SqlRejected(Exception):
    pass


def validate_sql(sql: str) -> str:
    """Return a safe, LIMIT-capped SELECT or raise :class:`SqlRejected`."""
    if not sql or not sql.strip():
        raise SqlRejected("empty query")

    cleaned = sql.strip().rstrip(";").strip()

    # Reject stacked statements: any ';' remaining mid-statement.
    if ";" in cleaned:
        raise SqlRejected("multiple statements are not allowed")
    # Reject SQL comments outright (could hide a second clause).
    if "--" in cleaned or "/*" in cleaned:
        raise SqlRejected("comments are not allowed")
    if not _SELECT_START.match(cleaned):
        raise SqlRejected("only SELECT statements are allowed")
    if _FORBIDDEN.search(cleaned):
        raise SqlRejected("write/DDL keywords are not allowed")

    # Force LIMIT <= 200.
    m = _LIMIT_RE.search(cleaned)
    if m:
        if int(m.group(1)) > MAX_LIMIT:
            cleaned = _LIMIT_RE.sub(f"LIMIT {MAX_LIMIT}", cleaned, count=1)
    else:
        cleaned = f"{cleaned} LIMIT {MAX_LIMIT}"
    return cleaned


def run_sql_readonly(ctx: ToolContext, *, sql: str, purpose: str = "") -> dict:
    try:
        safe_sql = validate_sql(sql)
    except SqlRejected as exc:
        return {"ok": False, "rejected": True, "reason": str(exc)}

    conn = ctx.db.sqlite_for_tenant(ctx.tenant_id)
    try:
        cur = conn.execute(safe_sql)
        rows = [dict(r) for r in cur.fetchall()]
    except Exception as exc:  # invalid columns/tables → surface, don't crash
        return {"ok": False, "rejected": True, "reason": f"sql_error: {exc}"}
    finally:
        conn.close()
    return {"ok": True, "purpose": purpose, "executed_sql": safe_sql,
            "row_count": len(rows), "rows": rows}
