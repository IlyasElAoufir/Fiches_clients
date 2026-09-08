/**
 * Tests fonctionnels de l'API contre le serveur de développement.
 *   node tools/test-api.mjs [baseUrl]
 */
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:3100'
// Client servant d'echantillon. Lu depuis .env.local (non versionne) ou
// passe en argument : node tools/test-api.mjs <baseUrl> <clientId>
function envValue(key) {
  try {
    const file = new URL('../.env.local', import.meta.url)
    for (const line of readFileSync(file, 'utf-8').split(/\r?\n/)) {
      const m = new RegExp('^' + key + '=(.+)$').exec(line.trim())
      if (m) return m[1].trim()
    }
  } catch {}
  return ''
}

const CLIENT_ID = Number(
  process.argv[3] || process.env.TEST_CLIENT_ID || envValue('TEST_CLIENT_ID') || 0,
)

if (!CLIENT_ID) {
  console.error(
    'Aucun client d echantillon. Renseignez TEST_CLIENT_ID dans .env.local ' +
      'ou passez-le en argument : node tools/test-api.mjs <baseUrl> <clientId>',
  )
  process.exit(1)
}

async function j(path) {
  const response = await fetch(`${BASE}${path}`)
  if (!response.ok) throw new Error(`HTTP ${response.status} sur ${path}`)
  return response.json()
}

const users = `/api/clients/${CLIENT_ID}/users`
let failures = 0

function check(label, condition, detail = '') {
  const status = condition ? 'ok    ' : 'ECHEC '
  if (!condition) failures++
  console.log(`  ${status} ${label}${detail ? ` — ${detail}` : ''}`)
}

console.log('API utilisateurs :')

// pageSize est borné à [10, 200] côté service : on vérifie contre la valeur
// effectivement renvoyée, pas contre celle demandée.
const p1 = await j(`${users}?page=1&pageSize=10`)
check(
  'pagination page 1',
  p1.rows.length === p1.pageSize,
  `${p1.rows.length} lignes, pageSize ${p1.pageSize}, total ${p1.total}`,
)

const small = await j(`${users}?pageSize=2`)
check('pageSize minimum forcé à 10', small.pageSize === 10, `pageSize = ${small.pageSize}`)

const p2 = await j(`${users}?page=2&pageSize=10`)
check(
  'page 2 différente de la page 1',
  p2.rows[0]?.login !== p1.rows[0]?.login,
  `${p1.rows[0]?.login} vs ${p2.rows[0]?.login}`,
)

const search = await j(`${users}?q=mar&pageSize=5`)
check(
  'recherche filtre bien',
  search.total < p1.total && search.total > 0,
  `q=mar → ${search.total} sur ${p1.total}`,
)
check(
  'les résultats contiennent le terme',
  search.rows.every((u) =>
    `${u.lastName} ${u.firstName} ${u.email} ${u.login}`.toLowerCase().includes('mar'),
  ),
)

const active = await j(`${users}?status=active&pageSize=1`)
const inactive = await j(`${users}?status=inactive&pageSize=1`)
check(
  'actifs + sortis = total',
  active.total + inactive.total === p1.total,
  `${active.total} + ${inactive.total} = ${active.total + inactive.total} vs ${p1.total}`,
)

const sorted = await j(`${users}?sort=lastConnect&pageSize=10`)
check(
  'tri par dernière connexion (décroissant)',
  sorted.rows[0]?.lastConnect >= (sorted.rows[1]?.lastConnect ?? ''),
  `${sorted.rows[0]?.lastConnect} puis ${sorted.rows[1]?.lastConnect}`,
)

const injected = await j(`${users}?sort=${encodeURIComponent('DROP TABLE NOVA_AGENT')}&pageSize=10`)
check(
  'tri non reconnu → repli sur le tri par nom, pas d’erreur SQL',
  injected.rows.length === injected.pageSize,
  `1er : ${injected.rows[0]?.lastName}`,
)

const injectedSearch = await j(
  `${users}?q=${encodeURIComponent("'; DROP TABLE NOVA_AGENT; --")}&pageSize=10`,
)
check(
  'recherche avec charge SQL → 0 résultat, aucune erreur',
  injectedSearch.total === 0,
  `total ${injectedSearch.total}`,
)

const pageSizeAbuse = await j(`${users}?pageSize=100000`)
check(
  'pageSize borné à 200',
  pageSizeAbuse.pageSize <= 200,
  `pageSize = ${pageSizeAbuse.pageSize}`,
)

console.log('\nAPI clients :')
const clients = await j('/api/clients')
check('liste des clients', clients.total > 0, `${clients.total} clients`)

const filtered = await j('/api/clients?q=unicil')
check('recherche client', filtered.total >= 1, `${filtered.total} résultat(s)`)

const envFiltered = await j('/api/clients?env=INT')
check(
  'filtre environnement',
  envFiltered.total > 0 && envFiltered.total <= clients.total,
  `${envFiltered.total} en INT sur ${clients.total}`,
)

console.log(
  failures === 0 ? '\nTOUS LES TESTS PASSENT' : `\n${failures} ECHEC(S)`,
)
process.exit(failures === 0 ? 0 : 1)
