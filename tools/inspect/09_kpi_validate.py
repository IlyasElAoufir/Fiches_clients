# -*- coding: utf-8 -*-
"""
PHASE 5 — Validation des KPI candidats : execution reelle, chiffres et temps.

Usage : python 09_kpi_validate.py <PROD|INT> <nom_base>
Uniquement des SELECT.
"""
import sys
import time
from _db import connect, show, query

if len(sys.argv) < 3:
    sys.exit("Usage: python 09_kpi_validate.py <PROD|INT> <nom_base>")

ENVNAME, DBNAME = sys.argv[1].upper(), sys.argv[2]
cn = connect(ENVNAME, DBNAME)

# --- Ou est le lien locataire <-> logement ? -------------------------------
show(cn, "0. TABLES LIEES AUX LOCATAIRES", """
SELECT s.name AS sch, t.name AS objet, SUM(p.rows) AS nb_lignes
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE t.name LIKE '%LOCATAIRE%' OR t.name LIKE '%OCCUP%' OR t.name LIKE '%BAIL%'
GROUP BY s.name, t.name
ORDER BY SUM(p.rows) DESC
""", limit=40)

show(cn, "0b. COLONNES DE Pa_B_Novamap_Locataire", """
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Pa_B_Novamap_Locataire'
ORDER BY ORDINAL_POSITION
""", limit=40)

# --- KPI candidats ---------------------------------------------------------
KPIS = [
    ("Residences (actives)",
     "SELECT COUNT(*) FROM BLOC WHERE BLC_TYPE_BLOC = 'RES' AND BLC_DT_FIN > GETDATE()"),
    ("Batiments (actifs)",
     "SELECT COUNT(*) FROM BLOC WHERE BLC_TYPE_BLOC = 'BAT' AND BLC_DT_FIN > GETDATE()"),
    ("Entrees / cages (actives)",
     "SELECT COUNT(*) FROM BLOC WHERE BLC_TYPE_BLOC = 'ENT' AND BLC_DT_FIN > GETDATE()"),
    ("Logements (actifs)",
     "SELECT COUNT(*) FROM BLOC WHERE BLC_TYPE_BLOC = 'LOG' AND BLC_DT_FIN > GETDATE()"),
    ("Locaux techniques (actifs)",
     "SELECT COUNT(*) FROM BLOC WHERE BLC_TYPE_BLOC = 'TEC' AND BLC_DT_FIN > GETDATE()"),
    ("Equipements (actifs, hors systeme)",
     "SELECT COUNT(*) FROM EQUIPEMENT WHERE EQPT_VF_ACTIF = 1 AND EQPT_VF_SYSTEME = 0"),
    ("Equipements (tous)",
     "SELECT COUNT(*) FROM EQUIPEMENT"),
    ("Locataires (fiches)",
     "SELECT COUNT(*) FROM GMP_LOCATAIRE"),
    ("Reclamations (total)",
     "SELECT COUNT(*) FROM GMP_RECLAMATION"),
    ("Reclamations 12 derniers mois",
     "SELECT COUNT(*) FROM GMP_RECLAMATION WHERE DT_CREATION >= DATEADD(month, -12, GETDATE())"),
    ("Visites patrimoine",
     "SELECT COUNT(*) FROM VISITE_PATRIMOINE"),
    ("Interventions",
     "SELECT COUNT(*) FROM GMP_INTERVENTION"),
]

print()
print("=" * 100)
print("KPI CANDIDATS — execution reelle")
print("=" * 100)
print(f"{'KPI':<40} {'VALEUR':>14} {'TEMPS':>9}")
print("-" * 100)
for label, sql in KPIS:
    t0 = time.time()
    try:
        _, rows = query(cn, sql)
        val = f"{rows[0][0]:,}".replace(",", " ")
    except Exception as e:  # noqa: BLE001
        val = "ERREUR: " + str(e)[:40]
    print(f"{label:<40} {val:>14} {time.time()-t0:>8.2f}s")

# --- Repartition par type d'equipement -------------------------------------
show(cn, "TOP 15 TYPES D'EQUIPEMENT (actifs, hors systeme)", """
SELECT TOP (15) et.EQT_LI_EQUIPEMENT AS type_equipement,
       COUNT(*) AS nb
FROM EQUIPEMENT e
JOIN EQUIPEMENT_TYPE et ON et.ID_EQUIPEMENT_TYPE = e.ID_EQUIPEMENT_TYPE
WHERE e.EQPT_VF_ACTIF = 1 AND e.EQPT_VF_SYSTEME = 0
GROUP BY et.EQT_LI_EQUIPEMENT
ORDER BY COUNT(*) DESC
""", maxw=45, limit=15)

cn.close()
print()
print("### FIN — aucune ecriture effectuee ###")
