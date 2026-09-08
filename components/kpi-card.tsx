import { Info } from 'lucide-react'

import { Card } from '@/components/ui/primitives'
import { formatNumber } from '@/lib/utils'
import type { Kpi } from '@/types'

/**
 * Carte de KPI.
 *
 * `source` est toujours affichée. C'est une règle du projet : on n'affiche un
 * chiffre que si on peut dire exactement quelle table, quelle colonne et quel
 * filtre le produisent. Un chiffre sans provenance n'a pas sa place ici.
 */
export function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{kpi.label}</p>

      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
        {kpi.value === null ? (
          <span className="text-xl text-muted-foreground">Indisponible</span>
        ) : (
          formatNumber(kpi.value)
        )}
      </p>

      {kpi.note ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{kpi.note}</p>
      ) : null}

      <p
        className="mt-3 flex items-start gap-1.5 border-t border-border pt-3 font-mono text-[11px] leading-relaxed text-muted-foreground"
        title={`Source : ${kpi.source}`}
      >
        <Info className="mt-px h-3 w-3 shrink-0" aria-hidden />
        {kpi.source}
      </p>
    </Card>
  )
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}
