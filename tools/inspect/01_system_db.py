# -*- coding: utf-8 -*-
"""
PHASE 2 — Inspection READ-ONLY de NovamapSystemDB.

Usage : python tools/inspect/01_system_db.py [PROD|INT]
"""
import sys
from _db import ENV, connect, show, query

ENVNAME = (sys.argv[1] if len(sys.argv) > 1 else "INT").upper()
DB = ENV.get("SQL_SYSTEM_DATABASE", "NovamapSystemDB")

TARGETS = ["NOVA_CLIENT", "NOVA_AGENT_CLIENT", "NOVA_AGENT", "DASHBOARD_CLIENT"]

print("#" * 110)
print(f"# NovamapSystemDB — environnement {ENVNAME} — base {DB}")
print("#" * 110)

cn = connect(ENVNAME, DB)

# --- 0. Contexte -----------------------------------------------------------
show(cn, "0. CONTEXTE", """
SELECT DB_NAME() AS base, SUSER_SNAME() AS login_sql, USER_NAME() AS user_db,
       @@VERSION AS version
""", maxw=70)

# --- 1. Inventaire complet des tables et vues -------------------------------
show(cn, "1. TABLES ET VUES DE NovamapSystemDB", """
SELECT t.TABLE_SCHEMA, t.TABLE_NAME, t.TABLE_TYPE,
       (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c
         WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME) AS nb_colonnes
FROM INFORMATION_SCHEMA.TABLES t
ORDER BY t.TABLE_TYPE, t.TABLE_NAME
""", limit=400)

# --- 2. Nombre de lignes (metadonnees, sans COUNT(*) couteux) --------------
show(cn, "2. VOLUMETRIE APPROX. (sys.partitions — metadonnees, lecture seule)", """
SELECT s.name AS schema_name, t.name AS table_name, SUM(p.rows) AS nb_lignes
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
GROUP BY s.name, t.name
ORDER BY SUM(p.rows) DESC
""", limit=400)

# --- 3. Colonnes des 4 tables cibles ---------------------------------------
for tbl in TARGETS:
    show(cn, f"3. COLONNES DE {tbl}", """
SELECT c.ORDINAL_POSITION AS pos, c.COLUMN_NAME, c.DATA_TYPE,
       c.CHARACTER_MAXIMUM_LENGTH AS len, c.NUMERIC_PRECISION AS prec,
       c.IS_NULLABLE AS nullable, c.COLUMN_DEFAULT AS defaut
FROM INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_NAME = ?
ORDER BY c.ORDINAL_POSITION
""", (tbl,), limit=300)

# --- 4. Cles primaires -----------------------------------------------------
show(cn, "4. CLES PRIMAIRES / UNIQUES", """
SELECT tc.TABLE_NAME, tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME,
       kcu.COLUMN_NAME, kcu.ORDINAL_POSITION
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
WHERE tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'UNIQUE')
ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
""", limit=300)

# --- 5. Cles etrangeres (relations reelles) --------------------------------
show(cn, "5. CLES ETRANGERES (relations)", """
SELECT  fk.name                AS fk_name,
        sp.name + '.' + tp.name AS table_source,
        cp.name                AS colonne_source,
        sr.name + '.' + tr.name AS table_cible,
        cr.name                AS colonne_cible
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.tables  tp ON tp.object_id = fk.parent_object_id
JOIN sys.schemas sp ON sp.schema_id = tp.schema_id
JOIN sys.columns cp ON cp.object_id = tp.object_id AND cp.column_id = fkc.parent_column_id
JOIN sys.tables  tr ON tr.object_id = fk.referenced_object_id
JOIN sys.schemas sr ON sr.schema_id = tr.schema_id
JOIN sys.columns cr ON cr.object_id = tr.object_id AND cr.column_id = fkc.referenced_column_id
ORDER BY tp.name, fk.name
""", limit=300)

# --- 6. Echantillons -------------------------------------------------------
show(cn, "6a. ECHANTILLON NOVA_CLIENT (TOP 40)",
     "SELECT TOP (40) * FROM NOVA_CLIENT", maxw=32, limit=40)

show(cn, "6b. ECHANTILLON NOVA_AGENT_CLIENT (TOP 15)",
     "SELECT TOP (15) * FROM NOVA_AGENT_CLIENT", maxw=32, limit=15)

show(cn, "6c. ECHANTILLON NOVA_AGENT (TOP 15)",
     "SELECT TOP (15) * FROM NOVA_AGENT", maxw=32, limit=15)

show(cn, "6d. ECHANTILLON DASHBOARD_CLIENT (TOP 30)",
     "SELECT TOP (30) * FROM DASHBOARD_CLIENT", maxw=32, limit=30)

cn.close()
print()
print("### FIN — aucune ecriture effectuee ###")
