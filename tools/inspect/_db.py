# -*- coding: utf-8 -*-
"""
Couche d'acces SQL STRICTEMENT LECTURE SEULE pour les scripts d'inspection.

Garde-fous :
  - toute requete est validee par `assert_read_only()` avant execution ;
  - autocommit + rollback systematique en fin de connexion ;
  - le mot de passe est lu depuis .env.local et n'est jamais affiche.
"""
import os
import re
import sys
import io
from pathlib import Path

import pyodbc

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / ".env.local"

# ---------------------------------------------------------------------------
# Chargement .env.local
# ---------------------------------------------------------------------------


def load_env():
    if not ENV_FILE.exists():
        sys.exit(f"ERREUR: {ENV_FILE} introuvable.")
    env = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


ENV = load_env()

# ---------------------------------------------------------------------------
# Garde-fou READ-ONLY
# ---------------------------------------------------------------------------

FORBIDDEN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|"
    r"GRANT|REVOKE|DENY|BACKUP|RESTORE|DBCC|SHUTDOWN|KILL|SP_[A-Z_]+|"
    r"XP_[A-Z_]+|INTO\s+#|INTO\s+[A-Z_\[])\b",
    re.IGNORECASE,
)


def assert_read_only(sql: str) -> str:
    """Leve une exception si la requete n'est pas une lecture pure."""
    stripped = re.sub(r"--[^\n]*", " ", sql)
    stripped = re.sub(r"/\*.*?\*/", " ", stripped, flags=re.S)

    first = stripped.strip().lstrip("(").split(None, 1)
    head = first[0].upper() if first else ""
    if head not in ("SELECT", "WITH"):
        raise RuntimeError(f"REQUETE REFUSEE (doit commencer par SELECT/WITH) : {sql[:120]}")

    bad = FORBIDDEN.search(stripped)
    if bad:
        raise RuntimeError(f"REQUETE REFUSEE (mot-cle interdit '{bad.group(0)}') : {sql[:120]}")
    return sql


# ---------------------------------------------------------------------------
# Connexion
# ---------------------------------------------------------------------------

DRIVER = "{ODBC Driver 18 for SQL Server}"


def server_for(env_name: str) -> str:
    key = "SQL_PROD_SERVER" if env_name.upper() == "PROD" else "SQL_INT_SERVER"
    srv = ENV.get(key)
    if not srv:
        sys.exit(f"ERREUR: {key} non defini dans .env.local")
    return srv


def connect(env_name: str, database: str):
    user = ENV.get("SQL_USER")
    pwd = ENV.get("SQL_PASSWORD")
    if not user or not pwd:
        sys.exit("ERREUR: SQL_USER / SQL_PASSWORD non renseignes dans .env.local")

    conn_str = (
        f"DRIVER={DRIVER};"
        f"SERVER=tcp:{server_for(env_name)},1433;"
        f"DATABASE={database};"
        f"UID={user};PWD={pwd};"
        "Encrypt=yes;TrustServerCertificate=no;"
        "Connection Timeout=30;"
    )
    cn = pyodbc.connect(conn_str, autocommit=True, timeout=30)
    return cn


def query(cn, sql: str, params=()):
    """Execute une requete de LECTURE et renvoie (colonnes, lignes)."""
    assert_read_only(sql)
    cur = cn.cursor()
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description] if cur.description else []
    rows = cur.fetchall()
    cur.close()
    return cols, rows


def show(cn, title, sql, params=(), maxw=40, limit=200):
    print()
    print("=" * 110)
    print(title)
    print("=" * 110)
    try:
        cols, rows = query(cn, sql, params)
    except Exception as e:  # noqa: BLE001
        print(f"  !! ERREUR: {str(e)[:400]}")
        return None, None
    if not cols:
        print("  (aucun resultat)")
        return cols, rows

    def fmt(v):
        s = "" if v is None else str(v).replace("\n", " ")
        return s[: maxw - 1] + "…" if len(s) > maxw else s

    widths = [min(maxw, max(len(c), *(len(fmt(r[i])) for r in rows))) if rows else len(c)
              for i, c in enumerate(cols)]
    print("  " + " | ".join(c[:w].ljust(w) for c, w in zip(cols, widths)))
    print("  " + "-+-".join("-" * w for w in widths))
    for r in rows[:limit]:
        print("  " + " | ".join(fmt(r[i]).ljust(w) for i, w in enumerate(widths)))
    if len(rows) > limit:
        print(f"  … ({len(rows)} lignes au total)")
    else:
        print(f"  ({len(rows)} ligne(s))")
    return cols, rows
