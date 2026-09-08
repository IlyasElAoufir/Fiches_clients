# -*- coding: utf-8 -*-
"""
PHASE 10 — Contraintes reseau des serveurs Azure SQL (LECTURE SEULE).

On lit sys.firewall_rules depuis master. AUCUNE modification n'est faite :
les regles de pare-feu de production ne doivent jamais etre touchees par
cet outil.
"""
import sys
from _db import connect, show

for env in ("PROD", "INT"):
    print()
    print("#" * 100)
    print(f"# {env}")
    print("#" * 100)
    try:
        cn = connect(env, "master")
    except Exception as e:  # noqa: BLE001
        print(f"  !! connexion impossible : {str(e)[:200]}")
        continue

    show(cn, f"{env} — regles de pare-feu au niveau serveur", """
SELECT name, start_ip_address, end_ip_address
FROM sys.firewall_rules
ORDER BY name
""", maxw=42, limit=200)

    show(cn, f"{env} — synthese", """
SELECT
  COUNT(*) AS nb_regles,
  SUM(CASE WHEN start_ip_address = '0.0.0.0' AND end_ip_address = '0.0.0.0'
           THEN 1 ELSE 0 END) AS autoriser_services_azure,
  SUM(CASE WHEN start_ip_address = '0.0.0.0' AND end_ip_address = '255.255.255.255'
           THEN 1 ELSE 0 END) AS ouvert_a_tous
FROM sys.firewall_rules
""", maxw=26)

    cn.close()

print()
print("### FIN — aucune ecriture effectuee, aucune regle modifiee ###")
