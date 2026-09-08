# -*- coding: utf-8 -*-
"""Quel est le vrai indicateur d'activite d'un utilisateur ? Et son profil ?"""
from _db import ENV, connect, show

import sys

# Client servant d'echantillon, passe en argument pour qu'aucun identifiant
# reel ne figure dans le depot :
#   python 12_user_status.py <CLT_ID_CLIENT> [<CLT_ID_CLIENT_2>]
ID_TEST = int(sys.argv[1]) if len(sys.argv) > 1 else 0
ID_TEST2 = int(sys.argv[2]) if len(sys.argv) > 2 else ID_TEST

cn = connect("PROD", ENV.get("SQL_SYSTEM_DATABASE", "NovamapSystemDB"))

show(cn, f"1. Client {ID_TEST} : croisement AGT_ISALLOW / AGT_DT_FIN", f"""
SELECT  CASE WHEN a.AGT_DT_FIN IS NULL THEN 'sans date de fin'
             WHEN a.AGT_DT_FIN > GETDATE() THEN 'fin future (actif)'
             ELSE 'fin passee (sorti)' END          AS statut_date_fin,
        a.AGT_ISALLOW                                AS isallow,
        COUNT(*)                                     AS nb
FROM    NOVA_AGENT_CLIENT ac
JOIN    NOVA_AGENT a ON a.AGT_CO_AGENT = ac.AGT_CO_AGENT
WHERE   ac.CLT_ID_CLIENT = {ID_TEST}
GROUP BY CASE WHEN a.AGT_DT_FIN IS NULL THEN 'sans date de fin'
              WHEN a.AGT_DT_FIN > GETDATE() THEN 'fin future (actif)'
              ELSE 'fin passee (sorti)' END, a.AGT_ISALLOW
ORDER BY COUNT(*) DESC
""", maxw=24)

show(cn, "2. Comparaison avec DASHBOARD_CLIENT.NbUser", f"""
SELECT  COUNT(*) AS total_rattaches,
        SUM(CASE WHEN a.AGT_DT_FIN IS NULL OR a.AGT_DT_FIN > GETDATE()
                 THEN 1 ELSE 0 END) AS actifs_par_date_fin,
        SUM(CASE WHEN a.AGT_ISALLOW = 1 THEN 1 ELSE 0 END) AS isallow_vrai,
        SUM(CASE WHEN ac.AGT_DT_LAST_CONNECT >= DATEADD(month, -3, GETDATE())
                 THEN 1 ELSE 0 END) AS connectes_3_mois
FROM    NOVA_AGENT_CLIENT ac
JOIN    NOVA_AGENT a ON a.AGT_CO_AGENT = ac.AGT_CO_AGENT
WHERE   ac.CLT_ID_CLIENT = {ID_TEST}
""", maxw=22)

show(cn, "3. Valeurs distinctes de AGT_DT_FIN les plus frequentes", f"""
SELECT TOP (10) a.AGT_DT_FIN, COUNT(*) AS nb
FROM    NOVA_AGENT_CLIENT ac
JOIN    NOVA_AGENT a ON a.AGT_CO_AGENT = ac.AGT_CO_AGENT
WHERE   ac.CLT_ID_CLIENT = {ID_TEST}
GROUP BY a.AGT_DT_FIN
ORDER BY COUNT(*) DESC
""", maxw=30, limit=10)

show(cn, "4. NOVA_GROUP / NOVA_GROUP_MEMBER : colonnes", """
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('NOVA_GROUP', 'NOVA_GROUP_MEMBER', 'NOVA_ROLE', 'NOVA_ROLE_MEMBER')
  AND TABLE_SCHEMA = 'dbo'
ORDER BY TABLE_NAME, ORDINAL_POSITION
""", maxw=32, limit=40)

show(cn, "5. Profils/groupes du client (TOP 15)", f"""
SELECT TOP (15) g.GRP_LI_GROUP AS groupe, COUNT(*) AS nb_membres
FROM    NOVA_GROUP_MEMBER gm
JOIN    NOVA_GROUP g ON g.GRP_ID_GROUP = gm.GRP_ID_GROUP
WHERE   g.CLT_ID_CLIENT = {ID_TEST}
GROUP BY g.GRP_LI_GROUP
ORDER BY COUNT(*) DESC
""", maxw=45, limit=15)

cn.close()
print()
print("### FIN — aucune ecriture effectuee ###")
