"""
Self-hosted PostgreSQL client with a Supabase-postgrest-compatible surface.

`get_supabase()` returns an object whose `.table(name)...execute()` chain mirrors
the supabase-py query builder the rest of the codebase already uses — so the data
files didn't have to change when we migrated off Supabase. Backed by psycopg2
against the local Postgres on the VPS.
"""
import uuid
import datetime
import decimal
import threading
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from psycopg2.pool import ThreadedConnectionPool
from backend.config import get_settings

_pool: ThreadedConnectionPool | None = None
_pool_lock = threading.Lock()


def _get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                dsn = get_settings().database_url
                _pool = ThreadedConnectionPool(1, 10, dsn=dsn)
    return _pool


def _adapt(v):
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()
    if isinstance(v, decimal.Decimal):
        return float(v)
    return v


def _row(r: dict) -> dict:
    return {k: _adapt(v) for k, v in r.items()}


def _val(v):
    """Adapt a Python value for a write — dict/list -> JSONB."""
    if isinstance(v, (dict, list)):
        return Json(v)
    return v


class _Result:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _Query:
    def __init__(self, table: str):
        self._table = table
        self._op = "select"
        self._cols = "*"
        self._count = False
        self._filters: list[tuple[str, list]] = []
        self._order = None       # (col, desc)
        self._limit = None
        self._offset = None
        self._single = False
        self._payload = None
        self._on_conflict = None

    # ---- ops ----
    def select(self, cols="*", count=None):
        self._op = "select"; self._cols = cols or "*"; self._count = (count == "exact"); return self

    def insert(self, payload):
        self._op = "insert"; self._payload = payload; return self

    def upsert(self, payload, on_conflict=None):
        self._op = "upsert"; self._payload = payload; self._on_conflict = on_conflict; return self

    def update(self, payload):
        self._op = "update"; self._payload = payload; return self

    def delete(self):
        self._op = "delete"; return self

    # ---- filters ----
    def eq(self, col, val): self._filters.append((f"{col} = %s", [val])); return self
    def neq(self, col, val): self._filters.append((f"{col} <> %s", [val])); return self
    def gt(self, col, val): self._filters.append((f"{col} > %s", [val])); return self
    def gte(self, col, val): self._filters.append((f"{col} >= %s", [val])); return self
    def lt(self, col, val): self._filters.append((f"{col} < %s", [val])); return self
    def lte(self, col, val): self._filters.append((f"{col} <= %s", [val])); return self

    def in_(self, col, vals):
        vals = list(vals)
        if not vals:
            self._filters.append(("FALSE", []))
        else:
            # Use IN (%s, %s, ...) not = ANY(array): psycopg2 binds each as a
            # quoted literal, so Postgres implicitly casts UUID strings (an
            # explicit text[] would fail with "operator does not exist: uuid = text").
            ph = ", ".join(["%s"] * len(vals))
            self._filters.append((f"{col} IN ({ph})", list(vals)))
        return self

    def or_(self, expr: str):
        # PostgREST OR: "col.op.val,col.op.val" -> (col OP %s OR ...)
        ops = {"eq": "=", "neq": "<>", "gt": ">", "gte": ">=", "lt": "<", "lte": "<=",
               "like": "LIKE", "ilike": "ILIKE"}
        parts, params = [], []
        for clause in expr.split(","):
            col, op, val = clause.split(".", 2)
            if op == "is" and val == "null":
                parts.append(f"{col} IS NULL")
            else:
                parts.append(f"{col} {ops.get(op, '=')} %s")
                params.append(val)
        self._filters.append(("(" + " OR ".join(parts) + ")", params))
        return self

    # ---- modifiers ----
    def order(self, col, desc=False): self._order = (col, desc); return self
    def limit(self, n): self._limit = n; return self
    def range(self, a, b): self._offset = a; self._limit = (b - a + 1); return self
    def single(self): self._single = True; return self
    def maybe_single(self): self._single = True; return self

    # ---- SQL build helpers ----
    def _where(self):
        if not self._filters:
            return "", []
        clauses, params = [], []
        for sql, ps in self._filters:
            clauses.append(sql); params.extend(ps)
        return " WHERE " + " AND ".join(clauses), params

    def _run(self, sql, params, fetch=True):
        pool = _get_pool()
        conn = pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall() if fetch and cur.description else []
            conn.commit()
            return [_row(dict(r)) for r in rows]
        except Exception:
            conn.rollback()
            raise
        finally:
            pool.putconn(conn)

    def execute(self) -> _Result:
        if self._op == "select":
            where, params = self._where()
            count = None
            if self._count:
                crows = self._run(f"SELECT COUNT(*) AS c FROM {self._table}{where}", params)
                count = crows[0]["c"] if crows else 0
            sql = f"SELECT {self._cols} FROM {self._table}{where}"
            if self._order:
                sql += f" ORDER BY {self._order[0]} {'DESC' if self._order[1] else 'ASC'}"
            if self._limit is not None:
                sql += f" LIMIT {int(self._limit)}"
            if self._offset is not None:
                sql += f" OFFSET {int(self._offset)}"
            rows = self._run(sql, params)
            data = (rows[0] if rows else None) if self._single else rows
            return _Result(data, count)

        if self._op in ("insert", "upsert"):
            items = self._payload if isinstance(self._payload, list) else [self._payload]
            if not items:
                return _Result([])
            cols = list(items[0].keys())
            collist = ", ".join(cols)
            ph = ", ".join(["(" + ", ".join(["%s"] * len(cols)) + ")" for _ in items])
            params = [_val(it[c]) for it in items for c in cols]
            sql = f"INSERT INTO {self._table} ({collist}) VALUES {ph}"
            if self._op == "upsert" and self._on_conflict:
                setcols = ", ".join([f"{c} = EXCLUDED.{c}" for c in cols])
                sql += f" ON CONFLICT ({self._on_conflict}) DO UPDATE SET {setcols}"
            elif self._op == "upsert":
                sql += " ON CONFLICT DO NOTHING"
            sql += " RETURNING *"
            return _Result(self._run(sql, params))

        if self._op == "update":
            where, wparams = self._where()
            setcols = ", ".join([f"{c} = %s" for c in self._payload.keys()])
            params = [_val(v) for v in self._payload.values()] + wparams
            sql = f"UPDATE {self._table} SET {setcols}{where} RETURNING *"
            return _Result(self._run(sql, params))

        if self._op == "delete":
            where, params = self._where()
            sql = f"DELETE FROM {self._table}{where} RETURNING *"
            return _Result(self._run(sql, params))

        raise ValueError(f"Unsupported op: {self._op}")


class _Client:
    def table(self, name: str) -> _Query:
        return _Query(name)


_client: _Client | None = None


def get_supabase() -> _Client:
    """Kept the name for drop-in compatibility; returns the local-Postgres client."""
    global _client
    if _client is None:
        _client = _Client()
    return _client
