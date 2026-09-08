import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { Header } from '@/components/header'
import { StatCard } from '@/components/kpi-card'
import { Card, CardHeader, CardTitle, CardContent, Skeleton } from '@/components/ui/primitives'
import { EnvBadge } from '@/components/env-badge'
import { requireUser } from '@/lib/guard'
import { getGlobalStats } from '@/services/dashboardService'
import { getClientOrganisations } from '@/services/clientService'
import { formatNumber, formatDate } from '@/lib/utils'

export const metadata = { title: 'Vue globale' }

// Page dynamique (contrôle d'accès à chaque requête) ; l'agrégat global est
// mis en cache 10 minutes au niveau des données, dans dashboardService.
export const dynamic = 'force-dynamic'

export default async function GlobalDashboardPage() {
  const user = await requireUser()

  return (
    <>
      <Header user={user} active="dashboard" />

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Novamap
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Vue globale</h1>
        </div>

        <Suspense fallback={<GlobalSkeleton />}>
          <GlobalContent />
        </Suspense>
      </main>
    </>
  )
}

async function GlobalContent() {
  const [stats, organisations] = await Promise.all([
    getGlobalStats(),
    getClientOrganisations(),
  ])

  const topClients = [...organisations]
    .sort((a, b) => b.totalAgents - a.totalAgents)
    .slice(0, 10)

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Clients"
            value={organisations.length}
            hint="Organismes, tous environnements"
          />
          <StatCard
            label="Utilisateurs"
            value={stats.utilisateurs}
            hint="Agents distincts rattachés en production"
          />
          <StatCard
            label="Équipements"
            value={stats.equipements}
            hint="Somme des derniers snapshots"
          />
          <StatCard
            label="Locataires"
            value={stats.locataires}
            hint="Somme des derniers snapshots"
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Équipements et locataires proviennent de DASHBOARD_CLIENT, la table de
          snapshots mensuels
          {stats.derniereDate
            ? ` (dernier relevé du ${formatDate(stats.derniereDate)})`
            : ''}
          . Ils ne sont pas recalculés dans les 50 bases clients à chaque
          affichage&nbsp;: ce serait lent et inutilement coûteux pour la
          production. Les chiffres exacts figurent sur la fiche de chaque
          client.
        </p>
      </section>

      <section>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Clients par nombre d’utilisateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {topClients.map((organisation) => {
                const max = topClients[0]?.totalAgents || 1
                return (
                  <li key={organisation.code}>
                    <Link
                      href={`/clients/${encodeURIComponent(organisation.code)}`}
                      className="group flex items-center gap-3 rounded-md px-1 py-1 text-sm hover:bg-secondary/40"
                    >
                      <span className="w-56 shrink-0 truncate font-medium">
                        {organisation.name}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {organisation.availableEnvs.map((env) => (
                          <EnvBadge key={env} env={env} size="sm" />
                        ))}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <span
                          className="block h-full rounded-full bg-foreground/70"
                          style={{
                            width: `${Math.max(2, (organisation.totalAgents / max) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
                        {formatNumber(organisation.totalAgents)}
                      </span>
                      <ArrowUpRight
                        className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function GlobalSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  )
}
