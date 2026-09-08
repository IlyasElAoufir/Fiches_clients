# -*- coding: utf-8 -*-
"""
PHASE 3 — Comment NOVA_CLIENT permet de retrouver la base de chaque client.

IMPORTANT : CLT_LI_DB_CONNECTION est une chaine de connexion contenant un mot
de passe. On n'en extrait QUE le serveur et le catalogue, cote SQL, via
SUBSTRING/CHARINDEX. Le mot de passe n'est jamais selectionne ni affiche.
"""
import sys
from _db import ENV, connect, show

ENVNAME = (sys.argv[1] if len(sys.argv) > 1 else "PROD").upper()
DB = ENV.get("SQL_SYSTEM_DATABASE", "NovamapSystemDB")

cn = connect(ENVNAME, DB)

# --- La vue VW_NOVA_CLIENT_BASE fait-elle deja le travail ? -----------------
show(cn, "A. DEFINITION DE LA VUE VW_NOVA_CLIENT_BASE", """
SELECT m.definition
FROM sys.sql_modules m
JOIN sys.objects o ON o.object_id = m.object_id
WHERE o.name = 'VW_NOVA_CLIENT_BASE'
""", maxw=3000)

show(cn, "B. CONTENU DE VW_NOVA_CLIENT_BASE (TOP 20)",
     "SELECT TOP (20) * FROM VW_NOVA_CLIENT_BASE", maxw=45, limit=20)

# --- Resolution client -> base, via la vue existante ------------------------
# La vue gere deja les deux formes de chaine ('Initial Catalog=' / 'Database=')
# et n'expose jamais le mot de passe.
EXTRACT = """
SELECT  c.CLT_ID_CLIENT                       AS id,
        c.CLT_LI_NOM_CLIENT                   AS nom,
        c.AGT_CO_AGENT_PREFIX                 AS prefixe,
        c.CTL_TYPE_ENVIRONEMENT               AS env,
        c.ORG_ID_ORGANISATION                 AS org_id,
        c.CLT_NB_USER                         AS quota_users,
        CASE WHEN c.CLT_BIN_ICON_CLIENT IS NULL THEN 0 ELSE 1 END AS a_logo,
        v.base                                AS db_name,
        LEN(c.CLT_LI_DB_CONNECTION)           AS len_cnx
FROM NOVA_CLIENT c
LEFT JOIN VW_NOVA_CLIENT_BASE v ON v.CLT_ID_CLIENT = c.CLT_ID_CLIENT
"""

show(cn, "C. RESOLUTION CLIENT -> BASE (via VW_NOVA_CLIENT_BASE)",
     EXTRACT + " ORDER BY c.CLT_LI_NOM_CLIENT, c.CTL_TYPE_ENVIRONEMENT",
     maxw=42, limit=300)

# --- Repartition par environnement -----------------------------------------
show(cn, "D. REPARTITION PAR CTL_TYPE_ENVIRONEMENT", """
SELECT CTL_TYPE_ENVIRONEMENT AS env, COUNT(*) AS nb,
       SUM(CASE WHEN CLT_BIN_ICON_CLIENT IS NULL THEN 0 ELSE 1 END) AS avec_logo
FROM NOVA_CLIENT
GROUP BY CTL_TYPE_ENVIRONEMENT
ORDER BY COUNT(*) DESC
""")

# --- Clients dont la base n'a pas pu etre resolue ---------------------------
show(cn, "E. CLIENTS SANS BASE RESOLUE (chaine de connexion atypique)", f"""
WITH x AS ({EXTRACT})
SELECT id, nom, prefixe, env, len_cnx
FROM x WHERE db_name IS NULL OR db_name = ''
ORDER BY nom
""", maxw=45, limit=100)

# --- Le prefixe agent est-il une cle fiable ? ------------------------------
show(cn, "F. PREFIXES AGENT EN DOUBLON (par environnement)", """
SELECT AGT_CO_AGENT_PREFIX AS prefixe, CTL_TYPE_ENVIRONEMENT AS env,
       COUNT(*) AS nb
FROM NOVA_CLIENT
GROUP BY AGT_CO_AGENT_PREFIX, CTL_TYPE_ENVIRONEMENT
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
""", limit=100)

# --- Modules reellement actives par client ---------------------------------
show(cn, "G. NOVA_MODULE (referentiel des modules)",
     "SELECT * FROM NOVA_MODULE ORDER BY MOD_ID_MODULE", maxw=40, limit=50)

cn.close()
print()
print("### FIN — aucune ecriture effectuee ###")
