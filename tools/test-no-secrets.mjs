/**
 * Contrôle anti-fuite.
 *
 * Vérifie que ni les données extraites de l'Excel, ni le bundle client, ni le
 * dépôt ne contiennent de secret.
 *
 *   node tools/test-no-secrets.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

/**
 * Motifs sensibles : JAMAIS ecrits en dur dans le depot.
 *
 * Sources, par ordre de force :
 *  1. `.env.local` — les secrets reellement configures (non versionne)
 *  2. `tools/known-secrets.local.json` — tableau JSON des mots de passe
 *     connus du classeur, non versionne
 *
 * Si aucune source n'est disponible, les controles correspondants sont
 * annonces comme NON EXECUTES : ils ne doivent jamais passer en silence.
 */
function loadNeedles() {
  const out = []
  const envFile = join(ROOT, '.env.local')
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
      const m = /^\s*(SQL_PASSWORD|AUTH_SECRET|AZURE_AD_CLIENT_SECRET|SQL_PROD_SERVER|SQL_INT_SERVER)\s*=\s*(.+)\s*$/.exec(line)
      if (m && m[2].trim().length >= 6) out.push({ label: m[1], value: m[2].trim() })
    }
  }
  const extra = join(ROOT, 'tools', 'known-secrets.local.json')
  if (existsSync(extra)) {
    try {
      for (const v of JSON.parse(readFileSync(extra, 'utf-8'))) {
        if (typeof v === 'string' && v.length >= 6) {
          out.push({ label: 'secret connu du classeur', value: v })
        }
      }
    } catch {
      console.log('  AVERTISSEMENT  tools/known-secrets.local.json illisible')
    }
  }
  return out
}

const NEEDLES = loadNeedles()

let failures = 0
function check(label, ok, detail = '') {
  console.log(`  ${ok ? 'ok    ' : 'ECHEC '} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

/** Motifs de secrets réellement présents dans le classeur source. */
const SECRET_PATTERNS = [
  { name: 'clé Azure Storage', re: /[A-Za-z0-9+/]{60,}={0,2}/ },
  { name: 'hash MD5', re: /\b[a-f0-9]{32}\b/ },
  { name: 'libellé mot de passe', re: /"(mdp|password|motDePasse|azureShareKey)"/i },
  { name: 'chaîne de connexion', re: /(Password|Pwd)\s*=\s*[^;"\s]{3,}/i },
]

function scan(label, content) {
  for (const { name, re } of SECRET_PATTERNS) {
    const match = re.exec(content)
    check(
      `${label} — aucun ${name}`,
      !match,
      match ? `trouvé : ${match[0].slice(0, 40)}` : '',
    )
  }
}

console.log('Données Excel extraites (data/excel-clients.json) :')
const dataFile = join(ROOT, 'data', 'excel-clients.json')
if (existsSync(dataFile)) {
  scan('data', readFileSync(dataFile, 'utf-8'))
} else {
  check('fichier présent', false, 'lancez « npm run excel:extract »')
}

console.log('\nBundle client (.next/static) :')
const staticDir = join(ROOT, '.next', 'static')
if (existsSync(staticDir)) {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(js|css|map)$/.test(entry)) files.push(full)
    }
  }
  walk(staticDir)

  const bundle = files.map((f) => readFileSync(f, 'utf-8')).join('\n')
  console.log(`  (${files.length} fichiers analysés)`)

  // Le bundle contient légitimement du base64 (sourcemaps, polices) : on ne
  // teste ici que les secrets réellement identifiables.
  for (const name of [
    'SQL_PASSWORD',
    'AZURE_AD_CLIENT_SECRET',
    'AUTH_SECRET',
    'CLT_LI_DB_CONNECTION',
    'AGT_MD5_PASSWORD',
    'AGT_BCRYPT_PASSWORD',
  ]) {
    check(`bundle sans « ${name} »`, !bundle.includes(name))
  }

  // Valeurs sensibles reelles, chargees hors depot.
  if (NEEDLES.length === 0) {
    console.log(
      '  NON EXECUTE  recherche des secrets reels : ni .env.local ni ' +
        'tools/known-secrets.local.json',
    )
    failures++
  }
  for (const { label, value } of NEEDLES) {
    check(`bundle sans la valeur de ${label}`, !bundle.includes(value))
  }
} else {
  console.log('  (.next/static absent — lancez « npm run build »)')
}

console.log('\nFichiers versionnables :')
check(
  '.env.local est ignoré par Git',
  readFileSync(join(ROOT, '.gitignore'), 'utf-8').includes('.env.*'),
)
check(
  '.env.example ne contient aucune valeur',
  !/^(SQL_PASSWORD|AZURE_AD_CLIENT_SECRET|AUTH_SECRET)=.+$/m.test(
    readFileSync(join(ROOT, '.env.example'), 'utf-8'),
  ),
)

console.log(
  failures === 0 ? '\nAUCUNE FUITE DÉTECTÉE' : `\n${failures} PROBLÈME(S)`,
)
process.exit(failures === 0 ? 0 : 1)
