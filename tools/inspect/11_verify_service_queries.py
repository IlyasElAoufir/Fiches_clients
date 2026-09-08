# -*- coding: utf-8 -*-
"""
Verification des colonnes utilisees par les services de l'application.
Objectif : ne jamais referencer une colonne qui n'existe pas.
"""
import sys
from _db import ENV, connect, show

cn = connect("PROD", ENV.get("SQL_SYSTEM_DATABASE", "NovamapSystemDB"))

# Base et client servant d'echantillon. Passes en argument pour qu'aucun nom
# reel n'apparaisse dans le depot :
#   python 11_verify_service_queries.py <nom_de_base> <CLT_ID_CLIENT>
DB_TEST = sys.argv[1] if len(sys.argv) > 1 else "<nom_de_base>"
ID_TEST = int(sys.argv[2]) if len(sys.argv) > 2 else 0

for t in ("NOVA_MODULE_CLIENT", "NOVA_DOMAINE_ACTIVITE", "NOVA_GROUP",
          "NOVA_GROUP_MEMBER", "NOVA_ROLE", "NOVA_ROLE_MEMBER",
          "NOVA_ORGANISATION"):
    show(cn, f"COLONNES — {t}", """
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = ? AND TABLE_SCHEMA = 'dbo'
ORDER BY ORDINAL_POSITION
""", (t,), limit=30)

# --- Requete utilisateurs telle qu'elle sera dans agentService -------------
show(cn, f"TEST - requete utilisateurs (id {ID_TEST})", f"""
SELECT TOP (10)
        a.AGT_CO_AGENT          AS login,
        a.AGT_NOM_AGT           AS lastName,
        a.AGT_PRENOM_AGT        AS firstName,
        a.AGT_MAIL_AGT          AS email,
        a.AGT_TEL_AGT           AS phone,
        a.AGT_MOB_AGT           AS mobile,
        a.AGT_ISALLOW           AS isActive,
        a.AGT_ROLE_AGT          AS role,
        a.AGT_DT_FIN            AS endDate,
        a.AGT_IS_NOVA_ACCOUNT   AS isNovaAccount,
        CASE WHEN a.AGT_AD_OBJECTID IS NULL THEN 0 ELSE 1 END AS isFederated,
        ac.AGT_DT_LAST_CONNECT  AS lastConnect
FROM    NOVA_AGENT_CLIENT ac
JOIN    NOVA_AGENT a ON a.AGT_CO_AGENT = ac.AGT_CO_AGENT
WHERE   ac.CLT_ID_CLIENT = {ID_TEST}
ORDER BY a.AGT_NOM_AGT, a.AGT_PRENOM_AGT
""", maxw=26, limit=10)

# --- Modules du client d'echantillon ------------------------------------------------------
show(cn, f"TEST - modules actives (id {ID_TEST})", """
SELECT  m.MOD_CO_MODULE AS code, m.MOD_LI_MODULE AS label,
        da.DAC_LI_DOMAINE_ACTIVITE AS domaine
FROM    NOVA_MODULE_CLIENT mc
JOIN    NOVA_MODULE m ON m.MOD_ID_MODULE = mc.MOD_ID_MODULE
LEFT JOIN NOVA_DOMAINE_ACTIVITE da
       ON da.DAC_ID_DOMAINE_ACTIVITE = m.DAC_ID_DOMAINE_ACTIVITE
WHERE   mc.CLT_ID_CLIENT = ?
ORDER BY da.DAC_LI_DOMAINE_ACTIVITE, m.MOD_LI_MODULE
""", maxw=45, limit=40)

# --- Historique dashboard d'un client -------------------------------------
show(cn, f"TEST - historique DASHBOARD_CLIENT ({DB_TEST}, 12 derniers)", """
SELECT TOP (12) Date, NbUser, NbCnx, NbEquipement, NbBloc, NbLot,
       NbTenant, NbRCL, NbEDL
FROM DASHBOARD_CLIENT
WHERE DatabaseName = ?
ORDER BY Date DESC
""", (DB_TEST,), maxw=22, limit=12)

cn.close()
print()
print("### FIN — aucune ecriture effectuee ###")
