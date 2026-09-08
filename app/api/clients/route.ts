import { NextResponse } from 'next/server'

import { checkApiAccess } from '@/lib/guard'
import { audit } from '@/lib/audit'
import { getClientOrganisations, filterOrganisations } from '@/services/clientService'
import { isEnvId, type EnvId } from '@/config/environments'

/**
 * GET /api/clients
 *
 * Aucune requête SQL n'est acceptée en entrée : les seuls paramètres sont un
 * texte de recherche et un identifiant d'environnement validé contre la liste
 * blanche.
 */
export async function GET(request: Request) {
  const access = await checkApiAccess()
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status })
  }

  const url = new URL(request.url)
  const search = (url.searchParams.get('q') ?? '').slice(0, 100)
  const envParam = url.searchParams.get('env')
  const env: EnvId | 'ALL' = isEnvId(envParam) ? envParam : 'ALL'

  audit({ user: access.user.email, action: 'view_clients' })

  try {
    const all = await getClientOrganisations()
    const organisations = filterOrganisations(all, search, env)

    return NextResponse.json({
      total: organisations.length,
      clients: organisations.map((o) => ({
        code: o.code,
        name: o.name,
        environments: o.availableEnvs,
        agents: o.totalAgents,
      })),
    })
  } catch (error) {
    console.error('[api/clients]', error)
    return NextResponse.json(
      { error: 'La base système est momentanément indisponible.' },
      { status: 503 },
    )
  }
}
