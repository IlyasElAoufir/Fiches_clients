import Link from 'next/link'
import { Users } from 'lucide-react'

import { ClientLogo } from '@/components/client-logo'
import { EnvBadge } from '@/components/env-badge'
import { formatNumber } from '@/lib/utils'
import type { ClientOrganisation } from '@/types'

export function ClientCard({ organisation }: { organisation: ClientOrganisation }) {
  return (
    <Link
      href={`/clients/${encodeURIComponent(organisation.code)}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md"
    >
      <div className="flex h-28 items-center justify-center bg-secondary/40 px-6">
        <ClientLogo code={organisation.code} name={organisation.name} size="lg" />
      </div>

      <div className="flex flex-1 flex-col gap-3 border-t border-border p-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold leading-snug text-foreground">
            {organisation.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Code&nbsp;: <span className="font-mono">{organisation.code}</span>
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {organisation.availableEnvs.map((env) => (
              <EnvBadge key={env} env={env} size="sm" />
            ))}
          </div>

          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {formatNumber(organisation.totalAgents)}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function ClientCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex h-28 items-center justify-center bg-secondary/40">
        <div className="skeleton h-20 w-20 rounded-xl" />
      </div>
      <div className="space-y-3 border-t border-border p-4">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
    </div>
  )
}
