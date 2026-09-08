# -*- coding: utf-8 -*-
"""
PHASE 5b — Portabilite du schema : les tables KPI existent-elles partout ?

Usage : python 10_portability.py <PROD|INT> <base1> <base2> ...
Uniquement des SELECT sur INFORMATION_SCHEMA + COUNT legers.
"""
import sys
from _db import connect, query

if len(sys.argv) < 3:
    sys.exit("Usage: python 10_portability.py <PROD|INT> <base1> [base2 ...]")

ENVNAME = sys.argv[1].upper()
BASES = sys.argv[2:]

TABLES = ["BLOC", "EQUIPEMENT", "EQUIPEMENT_TYPE", "GMP_RESIDENCE",
          "GMP_BATIMENT", "GMP_LOCATAIRE", "GMP_RECLAMATION",
          "VISITE_PATRIMOINE", "GMP_INTERVENTION"]

print(f"{'BASE':<16} " + " ".join(f"{t[:11]:<12}" for t in TABLES))
print("-" * (17 + 13 * len(TABLES)))

types_par_base = {}

for db in BASES:
    try:
        cn = connect(ENVNAME, db)
    except Exception as e:  # noqa: BLE001
        print(f"{db:<16} !! INACCESSIBLE : {str(e)[:70]}")
        continue

    try:
        _, rows = query(cn, """
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_TYPE = 'BASE TABLE'
""")
        present = {r[0] for r in rows}
        line = f"{db:<16} " + " ".join(
            f"{('oui' if t in present else 'NON'):<12}" for t in TABLES)
        print(line)

        if "BLOC" in present:
            _, tr = query(cn, """
SELECT BLC_TYPE_BLOC, COUNT(*) FROM BLOC
WHERE BLC_DT_FIN > GETDATE()
GROUP BY BLC_TYPE_BLOC ORDER BY BLC_TYPE_BLOC
""")
            types_par_base[db] = {r[0]: r[1] for r in tr}
    except Exception as e:  # noqa: BLE001
        print(f"{db:<16} !! ERREUR : {str(e)[:70]}")
    finally:
        cn.close()

print()
print("=" * 100)
print("VALEURS DE BLC_TYPE_BLOC (blocs actifs) PAR BASE")
print("=" * 100)
tous = sorted({t for d in types_par_base.values() for t in d})
print(f"{'BASE':<16} " + " ".join(f"{t:>10}" for t in tous))
print("-" * (17 + 11 * len(tous)))
for db, d in types_par_base.items():
    print(f"{db:<16} " + " ".join(f"{d.get(t, 0):>10,}".replace(",", " ") for t in tous))
