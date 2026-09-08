import { NextResponse } from 'next/server'

import { checkApiAccess } from '@/lib/guard'
import { audit } from '@/lib/audit'
import { getClientDashboard } from '@/services/dashboardService'
import { getClientInstances } from '@/services/systemDbService'
import { parseEnvId } from '@/config/environments'

/**
 * GET /api/clients/[id]/dashboard?env=PROD|INT
 *
 * L'environnement est validé contre la liste blanche ; la base associée est
 * résolue côté serveur depuis NovamapSystemDB. Il n'existe aucun paramètre
 * permettant de désigner une base directement.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await checkApiAccess()
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status })
  }

  const { id } = await params
  const clientId = Number.parseInt(id, 10)
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: 'Identifiant client invalide.' }, { status: 400 })
  }

  const env = parseEnvId(new URL(request.url).searchParams.get('env'))

  const instances = await getClientInstances()
  const instance = instances.find((i) => i.id === clientId && i.env === env)
  if (!instance) {
    return NextResponse.json(
      { error: 'Client introuvable dans cet environnement.' },
      { status: 404 },
    )
  }

  audit({
    user: access.user.email,
    action: 'view_dashboard',
    clientCode: instance.code,
    clientId: instance.id,
    env,
  })

  try {
    const dashboard = await getClientDashboard(clientId, env)
    return NextResponse.json(dashboard)
  } catch (error) {
    console.error('[api/clients/dashboard]', error)
    return NextResponse.json(
      { error: 'Impossible de calculer le tableau de bord pour le moment.' },
      { status: 503 },
    )
  }
}
