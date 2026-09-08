# -*- coding: utf-8 -*-
"""
PHASE 4b — Structure des tables metier et faisabilite des KPI.

Usage : python 07_kpi_probe.py <PROD|INT> <nom_base>
Uniquement des SELECT / INFORMATION_SCHEMA.
"""
import sys
from _db import connect, show, query

if len(sys.argv) < 3:
    sys.exit("Usage: python 07_kpi_probe.py <PROD|INT> <nom_base>")

ENVNAME, DBNAME = sys.argv[1].upper(), sys.argv[2]
cn = connect(ENVNAME, DBNAME)

TABLES = ["BLOC", "GMP_RESIDENCE", "GMP_BATIMENT", "GMP_LOCATAIRE",
          "EQUIPEMENT", "EQUIPEMENT_TYPE", "GMP_RECLAMATION",
          "VISITE_PATRIMOINE", "GMP_INTERVENTION"]

for t in TABLES:
    show(cn, f"COLONNES — {t}", """
SELECT ORDINAL_POSITION AS pos, COLUMN_NAME, DATA_TYPE,
       CHARACTER_MAXIMUM_LENGTH AS len, IS_NULLABLE AS nullable
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = ? AND TABLE_SCHEMA = 'dbo'
ORDER BY ORDINAL_POSITION
""", (t,), limit=80)

# --- BLOC : quel est le discriminant de niveau ? ---------------------------
show(cn, "BLOC — colonnes potentiellement discriminantes", """
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'BLOC' AND TABLE_SCHEMA = 'dbo'
  AND (COLUMN_NAME LIKE '%TYPE%' OR COLUMN_NAME LIKE '%NIVEAU%'
       OR COLUMN_NAME LIKE '%NATURE%' OR COLUMN_NAME LIKE '%CATEG%'
       OR COLUMN_NAME LIKE '%LEVEL%' OR COLUMN_NAME LIKE '%CODE%')
ORDER BY ORDINAL_POSITION
""", limit=40)

cn.close()
print()
print("### FIN — aucune ecriture effectuee ###")
