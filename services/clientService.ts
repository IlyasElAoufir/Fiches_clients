import 'server-only'
import { cache } from 'react'

import { getClientInstances } from '@/services/systemDbService'
import { DEFAULT_ENV, type EnvId } from '@/config/environments'
import { normalizeForSearch } from '@/lib/utils'
import type { ClientInstance, ClientOrganisation } from '@/types'

/**
 * Regroupement en organismes.
 *
 * NOVA_CLIENT contient une ligne par client ET par environnement : « CLIENT »,
 * « CLIENT INT » et « CLIENT Formation » sont trois lignes distinctes. Une
 * card de la page d'accueil représente un organisme, pas une ligne.
 *
 * Le regroupement se fait sur AGT_CO_AGENT_PREFIX (le trigramme), qui est la
 * seule clé stable entre environnements.
 */

/** Environnements internes Novamap, exclus de la liste métier. */
const INTERNAL_CODES = new Set(['NV', 'NOV', 'NSD', 'BSD', 'LPTB', 'LSTB', 'SER'])

/** Motifs de noms techniques (bases blanches, copies, jeux d'essai). */
const TECHNICAL_NAME = /\b(TEST|BLANK|DEMO|COPIE|COPIER|SANDBOX|TEMPLATE|INDEX|SINDEX)\b/i

/**
 * Instances de FORMATION. Elles portent CTL_TYPE_ENVIRONEMENT = 'PROD' dans
 * NOVA_CLIENT alors qu'elles tournent sur le serveur de formation : sans ce filtre
 * elles apparaîtraient comme des organismes distincts (« VL-FORM »,
 * « TMH-FORM ») à côté du vrai client.
 */
const FORMATION = /\b(FORMATION|FORM)\b|-FORM$/i

/**
 * Bases mutualisées, blanches, de sauvegarde ou de reprise. Une instance
 * pointant dessus n'est pas un client de production : c'est le cas d'AGL
 * (« Aiguillon Construction », 6 agents sur NovamapSharedDB-int-BLANK) face à
 * AGC (le vrai client, 129 agents sur maverick).
 */
const TECHNICAL_DATABASE =
  /(SharedDB|BLANK|_bck|_bckp|\.bck|_old|-old|Copier|_\d{8}|_\d{4}-\d{2}-\d{2}|-form$|ABO_)/i

function isBusinessInstance(instance: ClientInstance): boolean {
  if (INTERNAL_CODES.has(instance.code)) return false
  if (FORMATION.test(instance.code)) return false
  if (FORMATION.test(instance.name)) return false
  if (TECHNICAL_NAME.test(instance.name)) return false
  if (instance.database && TECHNICAL_DATABASE.test(instance.database)) return false
  return true
}

function displayName(instances: ClientInstance[]): string {
  // Le nom de l'instance de production fait foi ; on retire les suffixes
  // d'environnement que porte le libellé NOVA_CLIENT.
  // L'ordre compte : « ALOGEA - Base Production » doit perdre le groupe
  // entier, pas seulement « Production » — sinon il reste « ALOGEA - Base ».
  const prod = instances.find((i) => i.env === 'PROD') ?? instances[0]
  return prod.name
    .replace(/\s*[-–]\s*Base\s+(de\s+)?(Production|Test|Formation|Recette)\s*$/i, '')
    .replace(
      /\s*[-–]?\s*\b(INT|INTEGRATION|INTÉGRATION|FORMATION|FORM|PROD|PRODUCTION|DEV|TEST|RECETTE)\b\s*\.?$/i,
      '',
    )
    .replace(/\s*[-–]\s*$/, '')
    .trim()
}

export const getClientOrganisations = cache(
  async (): Promise<ClientOrganisation[]> => {
    const instances = await getClientInstances()

    const byCode = new Map<string, ClientInstance[]>()
    for (const instance of instances) {
      if (!instance.code) continue
      if (!isBusinessInstance(instance)) continue

      const list = byCode.get(instance.code)
      if (list) list.push(instance)
      else byCode.set(instance.code, [instance])
    }

    const organisations: ClientOrganisation[] = []
    for (const [code, list] of byCode) {
      // Une organisation peut avoir plusieurs lignes par environnement
      // (ex. bases de reprise) : on garde celle qui a le plus d'agents.
      const bestPerEnv = new Map<EnvId, ClientInstance>()
      for (const instance of list) {
        const current = bestPerEnv.get(instance.env)
        if (!current || instance.agentCount > current.agentCount) {
          bestPerEnv.set(instance.env, instance)
        }
      }

      const kept = [...bestPerEnv.values()]
      organisations.push({
        code,
        name: displayName(kept),
        instances: kept,
        availableEnvs: kept.map((i) => i.env),
        hasIcon: kept.some((i) => i.hasIcon),
        totalAgents: kept.reduce((sum, i) => sum + i.agentCount, 0),
      })
    }

    return organisations.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  },
)

export async function getClientOrganisation(
  code: string,
): Promise<ClientOrganisation | null> {
  const upper = code.toUpperCase()
  const all = await getClientOrganisations()
  return all.find((o) => o.code === upper) ?? null
}

/**
 * Sélectionne l'instance à consulter.
 * Si l'environnement demandé n'existe pas pour cet organisme, on retombe sur
 * la production plutôt que d'afficher un environnement que l'utilisateur n'a
 * pas demandé — et l'appelant affiche l'environnement réellement consulté.
 */
export function pickInstance(
  organisation: ClientOrganisation,
  requested: EnvId,
): ClientInstance {
  return (
    organisation.instances.find((i) => i.env === requested) ??
    organisation.instances.find((i) => i.env === DEFAULT_ENV) ??
    organisation.instances[0]
  )
}

/** Recherche côté serveur sur le nom et le code. */
export function filterOrganisations(
  organisations: ClientOrganisation[],
  search: string,
  env: EnvId | 'ALL',
): ClientOrganisation[] {
  const needle = normalizeForSearch(search)

  return organisations.filter((o) => {
    if (env !== 'ALL' && !o.availableEnvs.includes(env)) return false
    if (!needle) return true
    return (
      normalizeForSearch(o.name).includes(needle) ||
      normalizeForSearch(o.code).includes(needle) ||
      o.instances.some((i) =>
        normalizeForSearch(i.database ?? '').includes(needle),
      )
    )
  })
}
