import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'

import { EXCEL_SHEET_TO_CODE } from '@/config/client-mapping'
import { normalizeForSearch } from '@/lib/utils'
import type { ExcelClientSheet } from '@/types'

/**
 * Fiches clients issues de « Fiches Clients.xlsx ».
 *
 * Le classeur n'est PAS lu à chaud : il est converti hors ligne par
 * `tools/inspect/00_excel_extract.py` vers `data/excel-clients.json`.
 *
 * Cette étape n'est pas qu'un cache. L'extracteur applique une ALLOWLIST de
 * libellés : seuls les champs explicitement autorisés sont conservés. Le
 * classeur contient en clair des clés Azure Storage, des mots de passe ADMIN
 * et BOT, des comptes SQL de vues et des clés API SMS ; aucun de ces champs
 * n'a de correspondance dans l'allowlist, donc rien de tout cela n'atteint
 * jamais l'application. La feuille « Mdp Admin » n'est même pas ouverte.
 *
 * Pour régénérer après modification du classeur :
 *   npm run excel:extract
 */

/**
 * Emplacement du fichier extrait.
 *
 * En local : `data/excel-clients.json`, genere par `npm run excel:extract`.
 *
 * En production : le fichier ne peut pas etre versionne — il contient les
 * coordonnees des contacts clients — donc il n'est pas dans le paquet
 * deploye. On le depose une fois dans le stockage persistant de l'hote et on
 * pointe EXCEL_DATA_FILE dessus (sur Azure App Service Linux, tout ce qui est
 * sous /home survit aux redemarrages et aux deploiements).
 *
 *   EXCEL_DATA_FILE=/home/data/excel-clients.json
 *
 * Consequence utile : mettre a jour les fiches ne demande plus de redeployer,
 * il suffit de remplacer ce fichier.
 */
const DATA_FILE = process.env.EXCEL_DATA_FILE
  ? path.resolve(process.env.EXCEL_DATA_FILE)
  : path.join(process.cwd(), 'data', 'excel-clients.json')

export const getExcelSheets = cache(async (): Promise<ExcelClientSheet[]> => {
  try {
    const raw = await readFile(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as ExcelClientSheet[]
  } catch {
    console.warn(
      `[excel] ${DATA_FILE} introuvable — les fiches issues du classeur ` +
        `seront absentes. En local : « npm run excel:extract ». ` +
        `En production : deposez le fichier sur l'hote et renseignez ` +
        `EXCEL_DATA_FILE.`,
    )
    return []
  }
})

/**
 * Rapproche une fiche Excel d'un client, dans cet ordre :
 *   1. mapping explicite (config/client-mapping.ts)
 *   2. trigramme
 *   3. nom de base de production
 *   4. nom de l'organisme, normalisé
 *
 * Aucun rapprochement approximatif : si aucune de ces règles ne conclut, la
 * fiche n'est pas rattachée et l'onglet l'indique.
 */
export async function getClientExcelInfo(
  code: string,
  displayName: string,
  databases: string[],
): Promise<ExcelClientSheet | null> {
  const sheets = await getExcelSheets()
  const upperCode = code.toUpperCase()

  // 1. Mapping explicite
  for (const [sheetName, mappedCode] of Object.entries(EXCEL_SHEET_TO_CODE)) {
    if (mappedCode.toUpperCase() !== upperCode) continue
    const sheet = sheets.find((s) => s.sheet === sheetName)
    if (sheet) return sheet
  }

  // 2. Trigramme déclaré dans la fiche
  const byCode = sheets.find(
    (s) =>
      typeof s.application?.codeClient === 'string' &&
      s.application.codeClient.toUpperCase() === upperCode,
  )
  if (byCode) return byCode

  // 3. Nom de base de production
  const dbSet = new Set(databases.filter(Boolean).map((d) => d.toLowerCase()))
  if (dbSet.size > 0) {
    const byDb = sheets.find((s) => {
      const prod = s.resolved?.dbProd?.toLowerCase()
      const int = s.resolved?.dbInt?.toLowerCase()
      return (prod && dbSet.has(prod)) || (int && dbSet.has(int))
    })
    if (byDb) return byDb
  }

  // 4. Nom de l'organisme
  const needle = normalizeForSearch(displayName)
  if (needle.length >= 4) {
    const byName = sheets.find((s) => {
      const sheetName = normalizeForSearch(s.clientName)
      return sheetName === needle
    })
    if (byName) return byName
  }

  return null
}

// ---------------------------------------------------------------------------
// Mise en forme pour l'affichage
// ---------------------------------------------------------------------------

export interface FicheField {
  label: string
  value: string
  /** Valeur distincte en intégration, quand le champ dépend de l'environnement */
  intValue?: string
}

export interface FicheSection {
  title: string
  fields: FicheField[]
}

const IDENTITE_LABELS: Record<string, string> = {
  nomOrganisme: 'Nom de l’organisme',
  siteWeb: 'Site web',
  adresse: 'Adresse',
  codePostal: 'Code postal',
  ville: 'Ville',
  telOrganisme: 'Téléphone',
  emailOrganisme: 'E-mail de contact',
  lienInfosOrganisme: 'Fiche organisme',
}

const APPLICATION_LABELS: Record<string, string> = {
  codeClient: 'Trigramme client',
  idOrganisation: 'ID organisation',
  erp: 'ERP du client',
  utilisationNovamap: 'Utilisation Novamap',
  typeConnexion: 'Type de connexion utilisateurs',
  versionConnecteur: 'Version du connecteur',
  utilisateurTest: 'Utilisateur de test',
  referentNovamap: 'Référent Novamap',
  referentMetier: 'Référent métier',
  chefDeProjet: 'Chef de projet',
}

const ENVIRONNEMENT_LABELS: Record<string, string> = {
  baseNom: 'Nom de base déclaré',
  base: 'Base de données',
  store: 'Store',
  azureShareName: 'Azure Share',
  vmDediee: 'VM dédiée',
  urlConf: 'URL de configuration',
}

const MATERIEL_LABELS: Record<string, string> = {
  typeTablette: 'Type de tablette',
  versionOsTablette: 'Version OS',
  modelesIpad: 'Modèles iPad',
  plateforme: 'Plateforme',
}

function buildFields(
  data: Record<string, unknown> | undefined,
  labels: Record<string, string>,
): FicheField[] {
  if (!data) return []
  const fields: FicheField[] = []

  for (const [key, label] of Object.entries(labels)) {
    const raw = data[key]
    if (raw === undefined || raw === null || raw === '') continue

    if (typeof raw === 'object') {
      const env = raw as Record<string, string>
      const prod = env.prod ?? ''
      const int = env.int ?? ''
      if (!prod && !int) continue
      fields.push({ label, value: prod || '—', intValue: int || undefined })
    } else {
      fields.push({ label, value: String(raw) })
    }
  }

  return fields
}

/** Découpe la fiche en sections cohérentes plutôt qu'en copie brute de l'Excel. */
export function buildFicheSections(sheet: ExcelClientSheet): FicheSection[] {
  const sections: FicheSection[] = [
    { title: 'Informations générales', fields: buildFields(sheet.identite, IDENTITE_LABELS) },
    { title: 'Application', fields: buildFields(sheet.application, APPLICATION_LABELS) },
    { title: 'Environnements', fields: buildFields(sheet.environnements, ENVIRONNEMENT_LABELS) },
    { title: 'Matériel', fields: buildFields(sheet.materiel, MATERIEL_LABELS) },
  ]

  const notes = Object.values(sheet.notes ?? {}).filter(Boolean)
  if (notes.length > 0) {
    sections.push({
      title: 'Notes',
      fields: notes.map((n) => ({ label: '', value: String(n) })),
    })
  }

  return sections.filter((s) => s.fields.length > 0)
}
