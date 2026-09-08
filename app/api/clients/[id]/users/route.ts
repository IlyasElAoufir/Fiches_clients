import { NextResponse } from 'next/server'

import { checkApiAccess } from '@/lib/guard'
import { audit } from '@/lib/audit'
import { getClientUsers, type UserStatusFilter } from '@/services/agentService'
import { getClientInstances } from '@/services/systemDbService'

/**
 * GET /api/clients/[id]/users
 *
 * `id` est CLT_ID_CLIENT. Il est validé comme entier PUIS confronté à la liste
 * des clients réellement exposés : un identifiant arbitraire ne donne accès à
 * rien, même s'il existe en base (les environnements DEV, FORM et TEST ne sont
 * pas exposés par l'application).
 *
 * Le tri arrive sous forme d'identifiant, résolu contre une liste blanche dans
 * le service ; la recherche est liée en paramètre SQL.
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

  const instances = await getClientInstances()
  const instance = instances.find((i) => i.id === clientId)
  if (!instance) {
    return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 })
  }

  const url = new URL(request.url)
  const statusParam = url.searchParams.get('status')
  const status: UserStatusFilter =
    statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all'

  audit({
    user: access.user.email,
    action: 'view_users',
    clientCode: instance.code,
    clientId: instance.id,
    env: instance.env,
  })

  try {
    const result = await getClientUsers({
      clientId,
      search: (url.searchParams.get('q') ?? '').slice(0, 100),
      status,
      sort: url.searchParams.get('sort') ?? undefined,
      direction: url.searchParams.get('direction') ?? undefined,
      page: Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1,
      pageSize: Number.parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/clients/users]', error)
    return NextResponse.json(
      { error: 'Impossible de lire les utilisateurs pour le moment.' },
      { status: 503 },
    )
  }
}
