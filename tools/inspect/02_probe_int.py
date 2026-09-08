# -*- coding: utf-8 -*-
"""Diagnostic READ-ONLY de l'acces au serveur INT : login ? bases visibles ?"""
import sys
from _db import connect, show

ENVNAME = (sys.argv[1] if len(sys.argv) > 1 else "INT").upper()

for db in ("master", "NovamapSystemDB"):
    print()
    print("#" * 100)
    print(f"# {ENVNAME} / tentative de connexion a la base : {db}")
    print("#" * 100)
    try:
        cn = connect(ENVNAME, db)
    except Exception as e:  # noqa: BLE001
        print(f"  !! CONNEXION REFUSEE : {str(e)[:300]}")
        continue
    show(cn, f"Contexte ({db})",
         "SELECT DB_NAME() AS base, SUSER_SNAME() AS login_sql", maxw=40)
    show(cn, f"Bases visibles depuis {db}",
         "SELECT name, database_id, state_desc, create_date "
         "FROM sys.databases ORDER BY name", maxw=40, limit=300)
    cn.close()
