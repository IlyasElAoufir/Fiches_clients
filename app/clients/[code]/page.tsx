import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Header } from '@/components/header'
import { ClientLogo } from '@/components/client-logo'
import { EnvBanner } from '@/components/env-badge'
import { EnvSwitcher } from '@/components/env-switcher'
import { ClientTabs } from '@/components/client-tabs'
import { Skeleton } from '@/components/ui/primitives'
import { requireUser } from '@/lib/guard'
import { audit } from '@/lib/audit'
import { getClientOrganisation, pickInstance } from '@/services/clientService'
import { parseEnvId } from '@/config/environments'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const organisation = await getClientOrganisation(code)
  return { title: organisation?.name ?? 'Client introuvable' }
}

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ env?: string; tab?: string }>
}) {
  const user = await requireUser()
  const { code } = await params
  const query = await searchParams

  const organisation = await getClientOrganisation(code)
  if (!organisation) notFound()

  // L'environnement demandé est validé contre la liste blanche, puis
  // confronté à ce qui existe réellement pour cet organisme.
  const requested = parseEnvId(query.env)
  const instance = pickInstance(organisation, requested)

  audit({
    user: user.email,
    action: 'view_client',
    clientCode: organisation.code,
    clientId: instance.id,
    env: instance.env,
  })

  return (
    <>
      <Header user={user} active="clients" />

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Clients
        </Link>

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
          <ClientLogo code={organisation.code} name={organisation.name} size="lg" />

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {organisation.name}
            </h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {organisation.code}
            </p>
          </div>

          <EnvSwitcher
            code={organisation.code}
            current={instance.env}
            available={organisation.availableEnvs}
          />
        </div>

        <div className="mt-5">
          <EnvBanner env={instance.env} database={instance.database} />
        </div>

        {/* L'environnement effectif peut différer de celui demandé si
            l'organisme n'a pas d'instance dans cet environnement. */}
        {requested !== instance.env ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Cet organisme n’a pas d’environnement {requested}. Affichage de{' '}
            {instance.env}.
          </p>
        ) : null}

        <div className="mt-7">
          <Suspense fallback={<TabsSkeleton />}>
            <ClientTabs
              organisation={organisation}
              instance={instance}
              activeTab={query.tab}
            />
          </Suspense>
        </div>
      </main>
    </>
  )
}

function TabsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full max-w-lg" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  )
}
