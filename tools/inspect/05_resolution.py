# -*- coding: utf-8 -*-
"""
PHASE 3c — Strategie definitive de resolution CLIENT -> BASE.

Deux sources cote systeme :
  S1  VW_NOVA_CLIENT_BASE   (chaine de connexion en clair)  -> 71 clients
  S2  DASHBOARD_CLIENT      (IdClient + DatabaseName)       -> ?

On mesure la couverture de chacune, leur accord, et ce qui reste non resolu.
"""
import sys
from _db import ENV, connect, show

ENVNAME = (sys.argv[1] if len(sys.argv) > 1 else "PROD").upper()
cn = connect(ENVNAME, ENV.get("SQL_SYSTEM_DATABASE", "NovamapSystemDB"))

# Derniere ligne DASHBOARD_CLIENT par IdClient
S2 = """
SELECT d.IdClient, d.DatabaseName, d.SQLServers, d.Date
FROM DASHBOARD_CLIENT d
JOIN (SELECT IdClient, MAX(Date) AS mx
      FROM DASHBOARD_CLIENT
      WHERE IdClient IS NOT NULL
      GROUP BY IdClient) m
  ON m.IdClient = d.IdClient AND m.mx = d.Date
"""

show(cn, "1. COUVERTURE COMBINEE DES DEUX SOURCES", f"""
WITH s2 AS ({S2})
SELECT
  COUNT(*)                                                          AS clients_total,
  SUM(CASE WHEN v.base IS NOT NULL THEN 1 ELSE 0 END)               AS via_vue,
  SUM(CASE WHEN s2.DatabaseName IS NOT NULL THEN 1 ELSE 0 END)      AS via_dashboard,
  SUM(CASE WHEN v.base IS NOT NULL OR s2.DatabaseName IS NOT NULL
           THEN 1 ELSE 0 END)                                       AS resolus,
  SUM(CASE WHEN v.base IS NULL AND s2.DatabaseName IS NULL
           THEN 1 ELSE 0 END)                                       AS non_resolus
FROM NOVA_CLIENT c
LEFT JOIN VW_NOVA_CLIENT_BASE v ON v.CLT_ID_CLIENT = c.CLT_ID_CLIENT
LEFT JOIN s2 ON s2.IdClient = c.CLT_ID_CLIENT
""")

show(cn, "2. LES DEUX SOURCES SONT-ELLES D'ACCORD ?", f"""
WITH s2 AS ({S2})
SELECT c.CLT_ID_CLIENT AS id, c.CLT_LI_NOM_CLIENT AS nom,
       v.base AS base_vue, s2.DatabaseName AS base_dashboard
FROM NOVA_CLIENT c
JOIN VW_NOVA_CLIENT_BASE v ON v.CLT_ID_CLIENT = c.CLT_ID_CLIENT
JOIN s2 ON s2.IdClient = c.CLT_ID_CLIENT
WHERE v.base <> s2.DatabaseName
ORDER BY c.CLT_LI_NOM_CLIENT
""", maxw=38, limit=80)

show(cn, "3. CLIENTS NON RESOLUS PAR AUCUNE SOURCE", f"""
WITH s2 AS ({S2})
SELECT c.CLT_ID_CLIENT AS id, c.CLT_LI_NOM_CLIENT AS nom,
       c.AGT_CO_AGENT_PREFIX AS prefixe, c.CTL_TYPE_ENVIRONEMENT AS env,
       c.CLT_NB_USER AS quota,
       (SELECT COUNT(*) FROM NOVA_AGENT_CLIENT ac
         WHERE ac.CLT_ID_CLIENT = c.CLT_ID_CLIENT) AS nb_agents
FROM NOVA_CLIENT c
LEFT JOIN VW_NOVA_CLIENT_BASE v ON v.CLT_ID_CLIENT = c.CLT_ID_CLIENT
LEFT JOIN s2 ON s2.IdClient = c.CLT_ID_CLIENT
WHERE v.base IS NULL AND s2.DatabaseName IS NULL
ORDER BY nb_agents DESC, c.CLT_LI_NOM_CLIENT
""", maxw=40, limit=200)

show(cn, "4. VUE CONSOLIDEE : clients actifs (>=1 agent) et leur base", f"""
WITH s2 AS ({S2})
SELECT c.CLT_ID_CLIENT AS id, c.CLT_LI_NOM_CLIENT AS nom,
       c.AGT_CO_AGENT_PREFIX AS prefixe, c.CTL_TYPE_ENVIRONEMENT AS env,
       COALESCE(v.base, s2.DatabaseName) AS base,
       CASE WHEN v.base IS NOT NULL THEN 'VUE' ELSE 'DASHBOARD' END AS source,
       s2.SQLServers AS serveur,
       (SELECT COUNT(*) FROM NOVA_AGENT_CLIENT ac
         WHERE ac.CLT_ID_CLIENT = c.CLT_ID_CLIENT) AS nb_agents
FROM NOVA_CLIENT c
LEFT JOIN VW_NOVA_CLIENT_BASE v ON v.CLT_ID_CLIENT = c.CLT_ID_CLIENT
LEFT JOIN s2 ON s2.IdClient = c.CLT_ID_CLIENT
WHERE COALESCE(v.base, s2.DatabaseName) IS NOT NULL
  AND (SELECT COUNT(*) FROM NOVA_AGENT_CLIENT ac
        WHERE ac.CLT_ID_CLIENT = c.CLT_ID_CLIENT) > 0
ORDER BY nb_agents DESC
""", maxw=36, limit=250)

cn.close()
print()
print("### FIN — aucune ecriture effectuee ###")
