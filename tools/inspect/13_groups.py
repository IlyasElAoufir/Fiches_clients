# -*- coding: utf-8 -*-
"""Profils/groupes : structure reelle et cout de la requete."""
import time
from _db import ENV, connect, show, query

import sys

# Client servant d'echantillon, passe en argument pour qu'aucun identifiant
# reel ne figure dans le depot :
#   python 13_groups.py <CLT_ID_CLIENT> [<CLT_ID_CLIENT_2>]
ID_TEST = int(sys.argv[1]) if len(sys.argv) > 1 else 0
ID_TEST2 = int(sys.argv[2]) if len(sys.argv) > 2 else ID_TEST

cn = connect("PROD", ENV.get("SQL_SYSTEM_DATABASE", "NovamapSystemDB"))

show(cn, "1. NOVA_GROUP — echantillon", """
SELECT TOP (15) GRP_ID_GROUP, GRP_CO_GROUP, GRP_LI_DESCRIPTION,
       PRC_ID_PROCESSUS, GRP_IS_ADMIN_REQUIRED
FROM NOVA_GROUP ORDER BY GRP_ID_GROUP
""", maxw=40, limit=15)

show(cn, f"2. Groupes des agents du client {ID_TEST}", f"""
SELECT TOP (20) g.GRP_CO_GROUP AS code_groupe,
       g.GRP_LI_DESCRIPTION AS description,
       COUNT(DISTINCT gm.AGT_CO_AGENT) AS nb_agents
FROM   NOVA_AGENT_CLIENT ac
JOIN   NOVA_GROUP_MEMBER gm ON gm.AGT_CO_AGENT = ac.AGT_CO_AGENT
JOIN   NOVA_GROUP g ON g.GRP_ID_GROUP = gm.GRP_ID_GROUP
WHERE  ac.CLT_ID_CLIENT = {ID_TEST} AND gm.GRP_IS_GRANTED = 1
GROUP BY g.GRP_CO_GROUP, g.GRP_LI_DESCRIPTION
ORDER BY COUNT(DISTINCT gm.AGT_CO_AGENT) DESC
""", maxw=44, limit=20)

# --- Cout de la requete utilisateurs paginee avec profils ------------------
SQL_USERS = f"""
SELECT  a.AGT_CO_AGENT AS login, a.AGT_NOM_AGT AS lastName,
        a.AGT_PRENOM_AGT AS firstName, a.AGT_MAIL_AGT AS email,
        ac.AGT_DT_LAST_CONNECT AS lastConnect,
        a.AGT_DT_FIN AS endDate,
        (SELECT STRING_AGG(g2.GRP_CO_GROUP, ', ')
           FROM NOVA_GROUP_MEMBER gm2
           JOIN NOVA_GROUP g2 ON g2.GRP_ID_GROUP = gm2.GRP_ID_GROUP
          WHERE gm2.AGT_CO_AGENT = a.AGT_CO_AGENT
            AND gm2.GRP_IS_GRANTED = 1) AS profils
FROM    NOVA_AGENT_CLIENT ac
JOIN    NOVA_AGENT a ON a.AGT_CO_AGENT = ac.AGT_CO_AGENT
WHERE   ac.CLT_ID_CLIENT = {ID_TEST}
ORDER BY a.AGT_NOM_AGT, a.AGT_PRENOM_AGT
OFFSET 0 ROWS FETCH NEXT 25 ROWS ONLY
"""
t0 = time.time()
cols, rows = query(cn, SQL_USERS)
print()
print(f"Requete utilisateurs paginee (25 lignes + profils) : {time.time()-t0:.2f}s")
for r in rows[:8]:
    print("   ", " | ".join(str(v)[:26] for v in r))

# --- Cout sur le plus gros client -----------------------------------------
t0 = time.time()
_, rows = query(cn, SQL_USERS.replace(str(ID_TEST), str(ID_TEST2)))
print(f"Idem sur le client {ID_TEST2} : {time.time()-t0:.2f}s")

cn.close()
print()
print("### FIN — aucune ecriture effectuee ###")
