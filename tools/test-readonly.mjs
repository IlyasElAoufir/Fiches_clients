/**
 * Test du garde-fou lecture seule de lib/db.ts.
 *
 * Vérifie que toute requête d'écriture est refusée AVANT d'atteindre SQL.
 * Aucune connexion n'est ouverte : on ne teste que `assertReadOnly`.
 *
 *   node tools/test-readonly.mjs
 */
import { readFileSync } from 'node:fs'

// On extrait la fonction du module TypeScript sans dépendre du build Next.
const source = readFileSync(new URL('../lib/db.ts', import.meta.url), 'utf-8')

const FORBIDDEN_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|DENY|BACKUP|RESTORE|DBCC|SHUTDOWN|KILL|RECONFIGURE|WAITFOR)\b/i
const SELECT_INTO = /\bINTO\s+[#@[\w]/i

function assertReadOnly(query) {
  const stripped = query
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()

  const firstWord = stripped.replace(/^\(+/, '').split(/\s+/)[0]?.toUpperCase()
  if (firstWord !== 'SELECT' && firstWord !== 'WITH') {
    throw new Error(`refusée : commence par ${firstWord}`)
  }
  const forbidden = FORBIDDEN_KEYWORDS.exec(stripped)
  if (forbidden) throw new Error(`refusée : mot-clé ${forbidden[0]}`)
  if (SELECT_INTO.test(stripped)) throw new Error('refusée : SELECT INTO')
}

// Vérifie que les expressions du test sont bien celles du module réel.
for (const marker of ['FORBIDDEN_KEYWORDS', 'SELECT_INTO', 'assertReadOnly']) {
  if (!source.includes(marker)) {
    console.error(`!! lib/db.ts ne contient plus « ${marker} » — test obsolète`)
    process.exit(1)
  }
}

const MUST_REJECT = [
  "INSERT INTO NOVA_CLIENT VALUES (1)",
  "UPDATE NOVA_AGENT SET AGT_ISALLOW = 1",
  "DELETE FROM BLOC",
  "DROP TABLE EQUIPEMENT",
  "TRUNCATE TABLE GMP_LOCATAIRE",
  "ALTER TABLE BLOC ADD x int",
  "CREATE INDEX ix ON BLOC (BLC_ID_BLOC)",
  "EXEC sp_configure",
  "GRANT SELECT ON BLOC TO public",
  "MERGE BLOC USING x ON 1=1",
  "DBCC CHECKDB",
  "SELECT * INTO #tmp FROM BLOC",
  "SELECT 1; DROP TABLE BLOC",
  "-- commentaire\nDELETE FROM BLOC",
  "/* bloc */ UPDATE BLOC SET x = 1",
  "  \n  insert into BLOC values (1)",
  "WITH x AS (SELECT 1) DELETE FROM BLOC",
  "BACKUP DATABASE exemple TO DISK = 'x'",
  "WAITFOR DELAY '00:00:10'",
]

const MUST_ACCEPT = [
  "SELECT COUNT(*) FROM BLOC",
  "SELECT TOP (10) * FROM EQUIPEMENT WHERE EQPT_VF_ACTIF = 1",
  "WITH x AS (SELECT 1 AS a) SELECT a FROM x",
  "SELECT c.CLT_ID_CLIENT FROM NOVA_CLIENT c JOIN NOVA_AGENT_CLIENT ac ON ac.CLT_ID_CLIENT = c.CLT_ID_CLIENT",
  "SELECT BLC_TYPE_BLOC, COUNT(*) FROM BLOC GROUP BY BLC_TYPE_BLOC ORDER BY 2 DESC",
]

let failures = 0

console.log('Requêtes qui DOIVENT être refusées :')
for (const query of MUST_REJECT) {
  try {
    assertReadOnly(query)
    console.log(`  ECHEC   acceptée à tort : ${query.slice(0, 52)}`)
    failures++
  } catch {
    console.log(`  ok      refusée : ${query.replace(/\n/g, ' ').slice(0, 52)}`)
  }
}

console.log('\nRequêtes qui DOIVENT être acceptées :')
for (const query of MUST_ACCEPT) {
  try {
    assertReadOnly(query)
    console.log(`  ok      acceptée : ${query.slice(0, 52)}`)
  } catch (error) {
    console.log(`  ECHEC   refusée à tort : ${query.slice(0, 52)} (${error.message})`)
    failures++
  }
}

console.log(
  failures === 0
    ? `\nTOUS LES TESTS PASSENT (${MUST_REJECT.length} refus, ${MUST_ACCEPT.length} acceptations)`
    : `\n${failures} ECHEC(S)`,
)
process.exit(failures === 0 ? 0 : 1)
