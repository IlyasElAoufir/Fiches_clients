# -*- coding: utf-8 -*-
"""
PHASE 4 — Inspection READ-ONLY de la base d'un client.

Usage : python 06_client_db.py <PROD|INT> <nom_base>
Exemple : python 06_client_db.py PROD <nom_de_base>

Aucun COUNT(*) sur les grosses tables a ce stade : on lit sys.partitions
(metadonnees) pour la volumetrie, ce qui est instantane et sans charge.
"""
import sys
from _db import connect, show

if len(sys.argv) < 3:
    sys.exit("Usage: python 06_client_db.py <PROD|INT> <nom_base>")

ENVNAME = sys.argv[1].upper()
DBNAME = sys.argv[2]

print("#" * 110)
print(f"# BASE CLIENT : {DBNAME}  (environnement {ENVNAME})")
print("#" * 110)

cn = connect(ENVNAME, DBNAME)

show(cn, "0. CONTEXTE", "SELECT DB_NAME() AS base, SUSER_SNAME() AS login_sql", maxw=40)

show(cn, "1. TABLES ET VUES — volumetrie via sys.partitions (metadonnees)", """
SELECT s.name AS sch, t.name AS objet, 'TABLE' AS type_objet,
       SUM(p.rows) AS nb_lignes,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS nb_col
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
GROUP BY s.name, t.name, t.object_id
ORDER BY SUM(p.rows) DESC
""", limit=400)

show(cn, "2. VUES DISPONIBLES", """
SELECT s.name AS sch, v.name AS vue,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = v.object_id) AS nb_col
FROM sys.views v
JOIN sys.schemas s ON s.schema_id = v.schema_id
ORDER BY v.name
""", limit=400)

# --- Tables metier recherchees ---------------------------------------------
show(cn, "3. TABLES CANDIDATES POUR LES KPI (recherche par nom)", """
SELECT s.name AS sch, t.name AS objet, SUM(p.rows) AS nb_lignes
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE t.name LIKE '%BLOC%'      OR t.name LIKE '%EQUIPEMENT%'
   OR t.name LIKE '%LOT%'       OR t.name LIKE '%LOCATAIRE%'
   OR t.name LIKE '%TENANT%'    OR t.name LIKE '%RESIDENCE%'
   OR t.name LIKE '%BATIMENT%'  OR t.name LIKE '%PATRIMOINE%'
   OR t.name LIKE '%MARCHE%'    OR t.name LIKE '%CONTROLE%'
   OR t.name LIKE '%CTRL%'      OR t.name LIKE '%INTERVENTION%'
   OR t.name LIKE '%VISITE%'    OR t.name LIKE '%EDL%'
   OR t.name LIKE '%RECLAMATION%' OR t.name LIKE '%AGENT%'
   OR t.name LIKE '%FOURNISSEUR%' OR t.name LIKE '%SUPPLIER%'
GROUP BY s.name, t.name
ORDER BY SUM(p.rows) DESC
""", limit=300)

cn.close()
print()
print("### FIN — aucune ecriture effectuee ###")
