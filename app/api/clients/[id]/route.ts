import { NextResponse } from 'next/server'

import { checkApiAccess } from '@/lib/guard'
import { audit } from '@/lib/audit'
import { getClientOrganisation } from '@/services/clientService'
import { getClientModules } from '@/services/systemDbService'
import { getClientUserStats } from '@/services/agentService'
import { parseEnvId } from '@/config/environments'

/**
 * GET /api/clients/[id]
 *
 * `id` est le trigramme de l'organisme. La réponse ne contient aucune donnée
 * sensible : ni chaîne de connexion, ni clé, ni secret. Le nom de base est
 * exposé car il figure déjà dans l'onglet Technique et ne constitue pas un
 * élément d'authentification.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await checkApiAccess()
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status })
  }

  const { id: code } = await params
  const organisation = await getClientOrganisation(code)
  if (!organisation) {
    return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 })
  }

  const env = parseEnvId(new URL(request.url).searchParams.get('env'))
  const instance =
    organisation.instances.find((i) => i.env === env) ?? organisation.instances[0]

  audit({
    user: access.user.email,
    action: 'view_client',
    clientCode: organisation.code,
    clientId: instance.id,
    env: instance.env,
  })

  try {
    const [modules, userStats] = await Promise.all([
      getClientModules(instance.id),
      getClientUserStats(instance.id),
    ])

    return NextResponse.json({
      code: organisation.code,
      name: organisation.name,
      environments: organisation.availableEnvs,
      current: {
        env: instance.env,
        clientId: instance.id,
        name: instance.name,
        database: instance.database,
        databaseSource: instance.databaseSource,
        organisationId: instance.organisationId,
        agents: instance.agentCount,
      },
      users: userStats,
      modules,
    })
  } catch (error) {
    console.error('[api/clients/[id]]', error)
    return NextResponse.json(
      { error: 'La base système est momentanément indisponible.' },
      { status: 503 },
    )
  }
}
