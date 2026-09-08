import Link from 'next/link'
import { Suspense } from 'react'

import { OverviewTab } from '@/components/tabs/overview-tab'
import { FicheTab } from '@/components/tabs/fiche-tab'
import { UsersTab } from '@/components/tabs/users-tab'
import { DashboardTab } from '@/components/tabs/dashboard-tab'
import { TechnicalTab } from '@/components/tabs/technical-tab'
import { Skeleton } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import type { ClientInstance, ClientOrganisation } from '@/types'

/**
 * Onglets pilotés par l'URL plutôt que par un état client.
 *
 * Conséquence voulue : chaque onglet est rendu côté serveur, et seules les
 * données de l'onglet affiché sont chargées. Un client à 1 000 utilisateurs
 * ne coûte rien tant qu'on reste sur « Vue d'ensemble ». L'état est aussi
 * partageable par lien.
 */

const TABS = [
  { id: 'overview', label: 'Vue d’ensemble' },
  { id: 'fiche', label: 'Fiche client' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'technical', label: 'Technique' },
] as const

type TabId = (typeof TABS)[number]['id']

function parseTab(value: string | undefined): TabId {
  return TABS.some((t) => t.id === value) ? (value as TabId) : 'overview'
}

export function ClientTabs({
  organisation,
  instance,
  activeTab,
}: {
  organisation: ClientOrganisation
  instance: ClientInstance
  activeTab?: string
}) {
  const active = parseTab(activeTab)

  return (
    <div>
      <div
        className="flex gap-1 overflow-x-auto border-b border-border"
        role="tablist"
        aria-label="Sections du client"
      >
        {TABS.map((tab) => {
          const href = `/clients/${encodeURIComponent(organisation.code)}?env=${instance.env}&tab=${tab.id}`
          const isActive = tab.id === active
          return (
            <Link
              key={tab.id}
              href={href}
              role="tab"
              aria-selected={isActive}
              scroll={false}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? 'border-foreground font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div className="pt-6" role="tabpanel">
        <Suspense key={active} fallback={<TabSkeleton />}>
          {active === 'overview' ? (
            <OverviewTab organisation={organisation} instance={instance} />
          ) : null}
          {active === 'fiche' ? <FicheTab organisation={organisation} /> : null}
          {active === 'users' ? <UsersTab instance={instance} /> : null}
          {active === 'dashboard' ? <DashboardTab instance={instance} /> : null}
          {active === 'technical' ? (
            <TechnicalTab organisation={organisation} instance={instance} />
          ) : null}
        </Suspense>
      </div>
    </div>
  )
}

function TabSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  )
}
