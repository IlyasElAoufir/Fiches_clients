import { Suspense } from 'react'
import { SearchX } from 'lucide-react'

import { Header } from '@/components/header'
import { ClientCard, ClientCardSkeleton } from '@/components/client-card'
import { ClientFilters } from '@/components/client-filters'
import { EmptyState } from '@/components/ui/primitives'
import { requireUser } from '@/lib/guard'
import { audit } from '@/lib/audit'
import { getClientOrganisations, filterOrganisations } from '@/services/clientService'
import { isEnvId, type EnvId } from '@/config/environments'

export const metadata = { title: 'Clients' }

/**
 * Rendu dynamique obligatoire : le contrôle d'accès doit être réévalué à
 * chaque requête et ne jamais être servi depuis un cache de page.
 * Le cache est placé au niveau des données (`unstable_cache` dans
 * systemDbService), ce qui évite d'interroger la base système à chaque
 * affichage sans jamais mettre l'authentification en cache.
 */
export const dynamic = 'force-dynamic'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; env?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams

  const search = (params.q ?? '').slice(0, 100)
  const env: EnvId | 'ALL' = isEnvId(params.env) ? params.env : 'ALL'

  audit({ user: user.email, action: 'view_clients' })

  return (
    <>
      <Header user={user} active="clients" env={env} />

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Novamap
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Clients</h1>
        </div>

        <ClientFilters defaultSearch={search} defaultEnv={env} />

        <Suspense fallback={<ClientGridSkeleton />}>
          <ClientGrid search={search} env={env} />
        </Suspense>
      </main>
    </>
  )
}

async function ClientGrid({ search, env }: { search: string; env: EnvId | 'ALL' }) {
  const all = await getClientOrganisations()
  const organisations = filterOrganisations(all, search, env)

  if (organisations.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="h-8 w-8" />}
        title="Aucun client ne correspond"
        description={
          search
            ? `Aucun résultat pour « ${search} ». Essayez un nom d’organisme, un trigramme ou un nom de base.`
            : 'Aucun client pour cet environnement.'
        }
      />
    )
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {organisations.length} client{organisations.length > 1 ? 's' : ''}
        {search || env !== 'ALL' ? ` sur ${all.length}` : ''}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {organisations.map((organisation) => (
          <ClientCard key={organisation.code} organisation={organisation} />
        ))}
      </div>
    </>
  )
}

function ClientGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <ClientCardSkeleton key={i} />
      ))}
    </div>
  )
}
