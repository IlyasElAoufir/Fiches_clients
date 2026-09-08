# -*- coding: utf-8 -*-
"""
PHASE 5 — Valeurs reelles des discriminants, pour batir des KPI justes.

Usage : python 08_kpi_values.py <PROD|INT> <nom_base>
"""
import sys
from _db import connect, show

if len(sys.argv) < 3:
    sys.exit("Usage: python 08_kpi_values.py <PROD|INT> <nom_base>")

ENVNAME, DBNAME = sys.argv[1].upper(), sys.argv[2]
cn = connect(ENVNAME, DBNAME)

show(cn, "1. BLOC — repartition par BLC_TYPE_BLOC et validite", """
SELECT BLC_TYPE_BLOC AS type_bloc,
       COUNT(*) AS total,
       SUM(CASE WHEN BLC_DT_FIN > GETDATE() THEN 1 ELSE 0 END) AS actifs,
       SUM(CASE WHEN BLC_DT_FIN <= GETDATE() THEN 1 ELSE 0 END) AS clos,
       MIN(BLC_DT_FIN) AS min_fin, MAX(BLC_DT_FIN) AS max_fin
FROM BLOC
GROUP BY BLC_TYPE_BLOC
ORDER BY COUNT(*) DESC
""", maxw=28, limit=60)

show(cn, "2. EQUIPEMENT — colonnes de type/etat/validite", """
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'EQUIPEMENT' AND TABLE_SCHEMA = 'dbo'
ORDER BY ORDINAL_POSITION
""", limit=80)

show(cn, "3. EQUIPEMENT_TYPE — referentiel", """
SELECT TOP (40) * FROM EQUIPEMENT_TYPE
""", maxw=30, limit=40)

show(cn, "4. GMP_RESIDENCE — colonnes", """
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'GMP_RESIDENCE' AND TABLE_SCHEMA = 'dbo'
ORDER BY ORDINAL_POSITION
""", limit=60)

show(cn, "5. GMP_LOCATAIRE — colonnes", """
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'GMP_LOCATAIRE' AND TABLE_SCHEMA = 'dbo'
ORDER BY ORDINAL_POSITION
""", limit=60)

show(cn, "6. GMP_RECLAMATION — colonnes", """
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'GMP_RECLAMATION' AND TABLE_SCHEMA = 'dbo'
ORDER BY ORDINAL_POSITION
""", limit=60)

cn.close()
print()
print("### FIN — aucune ecriture effectuee ###")
