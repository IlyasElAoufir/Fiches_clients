# -*- coding: utf-8 -*-
"""
PHASE 3b — Nature de CLT_LI_DB_CONNECTION.

On n'affiche JAMAIS la valeur : uniquement des metadonnees (longueur,
presence de mots-cles, alphabet). Objectif : determiner si la chaine est en
clair ou chiffree, et donc si NOVA_CLIENT permet de resoudre la base.
"""
import sys
from _db import ENV, connect, show

ENVNAME = (sys.argv[1] if len(sys.argv) > 1 else "PROD").upper()
cn = connect(ENVNAME, ENV.get("SQL_SYSTEM_DATABASE", "NovamapSystemDB"))

show(cn, "1. FORME DE CLT_LI_DB_CONNECTION (metadonnees uniquement)", """
SELECT  LEN(CLT_LI_DB_CONNECTION) AS longueur,
        CASE WHEN CLT_LI_DB_CONNECTION LIKE '%;%'                THEN 1 ELSE 0 END AS a_pointvirgule,
        CASE WHEN CLT_LI_DB_CONNECTION LIKE '%Initial Catalog=%' THEN 1 ELSE 0 END AS a_initial_catalog,
        CASE WHEN CLT_LI_DB_CONNECTION LIKE '%Database=%'        THEN 1 ELSE 0 END AS a_database,
        CASE WHEN CLT_LI_DB_CONNECTION LIKE '%Server=%'          THEN 1 ELSE 0 END AS a_server,
        CASE WHEN CLT_LI_DB_CONNECTION LIKE '%[^A-Za-z0-9+/=]%'  THEN 0 ELSE 1 END AS alphabet_base64,
        COUNT(*) AS nb_clients
FROM NOVA_CLIENT
GROUP BY LEN(CLT_LI_DB_CONNECTION),
        CASE WHEN CLT_LI_DB_CONNECTION LIKE '%;%'                THEN 1 ELSE 0 END,
        CASE WHEN CLT_LI_DB_CONNECTION LIKE '%Initial Catalog=%' THEN 1 ELSE 0 END,
        CASE WHEN CLT_LI_DB_CONNECTION LIKE '%Database=%'        THEN 1 ELSE 0 END,
        CASE WHEN CLT_LI_DB_CONNECTION LIKE '%Server=%'          THEN 1 ELSE 0 END,
        CASE WHEN CLT_LI_DB_CONNECTION LIKE '%[^A-Za-z0-9+/=]%'  THEN 0 ELSE 1 END
ORDER BY COUNT(*) DESC
""", limit=60)

show(cn, "2. COMBIEN DE CLIENTS LA VUE RESOUT-ELLE ?", """
SELECT COUNT(*) AS total_clients,
       SUM(CASE WHEN v.base IS NULL THEN 0 ELSE 1 END) AS base_resolue,
       SUM(CASE WHEN v.base IS NULL THEN 1 ELSE 0 END) AS base_non_resolue
FROM NOVA_CLIENT c
LEFT JOIN VW_NOVA_CLIENT_BASE v ON v.CLT_ID_CLIENT = c.CLT_ID_CLIENT
""")

# --- Autres pistes pour retrouver la base ----------------------------------
show(cn, "3. DASHBOARD_CLIENT : couverture IdClient / DatabaseName", """
SELECT COUNT(*) AS lignes,
       COUNT(DISTINCT DatabaseName) AS bases_distinctes,
       COUNT(DISTINCT IdClient) AS clients_distincts,
       MIN(Date) AS premiere_date, MAX(Date) AS derniere_date
FROM DASHBOARD_CLIENT
""", maxw=30)

show(cn, "4. DASHBOARD_CLIENT : dernier snapshot par base (TOP 30)", """
SELECT TOP (30) d.DatabaseName, d.IdClient, d.clientName, d.SQLServers,
       d.Date, d.NbUser, d.NbBloc, d.NbLot, d.NbEquipement, d.NbTenant
FROM DASHBOARD_CLIENT d
JOIN (SELECT DatabaseName AS db, MAX(Date) AS mx
      FROM DASHBOARD_CLIENT GROUP BY DatabaseName) m
  ON m.db = d.DatabaseName AND m.mx = d.Date
ORDER BY d.NbLot DESC
""", maxw=28, limit=30)

show(cn, "5. SERVEURS SQL VUS DANS DASHBOARD_CLIENT", """
SELECT SQLServers, Location, COUNT(DISTINCT DatabaseName) AS nb_bases
FROM DASHBOARD_CLIENT
GROUP BY SQLServers, Location
ORDER BY COUNT(DISTINCT DatabaseName) DESC
""", maxw=45, limit=40)

cn.close()
print()
print("### FIN — aucune ecriture effectuee ###")
