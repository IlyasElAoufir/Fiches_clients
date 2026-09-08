import { AlertTriangle } from 'lucide-react'

import { KpiCard } from '@/components/kpi-card'
import { Card, CardHeader, CardTitle, CardContent, EmptyState } from '@/components/ui/primitives'
import { DashboardCharts } from '@/components/dashboard-charts'
import { getClientDashboard } from '@/services/dashboardService'
import { formatNumber } from '@/lib/utils'
import type { ClientInstance } from '@/types'

export async function DashboardTab({ instance }: { instance: ClientInstance }) {
  const dashboard = await getClientDashboard(instance.id, instance.env)

  const hasAnything =
    dashboard.kpis.length > 0 ||
    dashboard.history.length > 0 ||
    dashboard.patrimony.length > 0

  if (!hasAnything) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-8 w-8" />}
        title="Aucune donnée disponible"
        description={
          dashboard.liveDataError ??
          'Ni la base du client ni les snapshots ne fournissent de données pour cet environnement.'
        }
      />
    )
  }

  return (
    <div className="space-y-8">
      {!dashboard.liveDataAvailable ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="text-sm font-medium text-amber-900">
              Certaines statistiques sont temporairement indisponibles
            </p>
            <p className="mt-1 text-sm text-amber-800">
              La base du client n’a pas répondu. Les courbes ci-dessous
              proviennent des snapshots mensuels et restent consultables.
            </p>
          </div>
        </div>
      ) : null}

      {dashboard.kpis.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Chiffres actuels
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.kpis.map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} />
            ))}
          </div>
        </section>
      ) : null}

      {dashboard.patrimony.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Patrimoine
          </h2>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                BLOC · regroupé par BLC_TYPE_BLOC · blocs dont BLC_DT_FIN est
                dans le futur
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {dashboard.patrimony.map((item) => {
                  const max = Math.max(...dashboard.patrimony.map((p) => p.value), 1)
                  return (
                    <li key={item.name} className="flex items-center gap-3 text-sm">
                      <span className="w-36 shrink-0">{item.name}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <span
                          className="block h-full rounded-full bg-foreground/70"
                          style={{ width: `${Math.max(1.5, (item.value / max) * 100)}%` }}
                        />
                      </span>
                      <span className="w-24 shrink-0 text-right font-medium tabular-nums">
                        {formatNumber(item.value)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {dashboard.history.length > 1 ? (
        <section>
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">
            Évolution
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Source&nbsp;: DASHBOARD_CLIENT — snapshots mensuels produits par
            Novamap. Distincte du calcul en direct ci-dessus.
          </p>
          <DashboardCharts
            history={dashboard.history}
            equipmentByType={dashboard.equipmentByType}
          />
        </section>
      ) : null}
    </div>
  )
}
