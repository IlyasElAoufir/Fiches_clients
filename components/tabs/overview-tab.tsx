import { AlertTriangle, Package } from 'lucide-react'

import { KpiCard } from '@/components/kpi-card'
import { Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui/primitives'
import { getClientDbSnapshot } from '@/services/clientDbService'
import { getClientModules } from '@/services/systemDbService'
import { getClientUserStats } from '@/services/agentService'
import { formatNumber } from '@/lib/utils'
import type { ClientInstance, ClientOrganisation } from '@/types'

export async function OverviewTab({
  organisation,
  instance,
}: {
  organisation: ClientOrganisation
  instance: ClientInstance
}) {
  // Lectures indépendantes : lancées en parallèle.
  // Une base client injoignable ne doit pas faire tomber la page — d'où
  // `getClientDbSnapshot`, qui dégrade proprement.
  const [snapshot, modules, userStats] = await Promise.all([
    instance.database
      ? getClientDbSnapshot(instance.env, instance.database)
      : Promise.resolve(null),
    getClientModules(instance.id),
    getClientUserStats(instance.id),
  ])

  return (
    <div className="space-y-8">
      {!instance.database ? (
        <UnavailableNotice
          title="Base non résolue"
          message={`La base de « ${organisation.name} » en ${instance.env} n’a pas pu être déterminée depuis NovamapSystemDB. La chaîne de connexion est chiffrée et aucun snapshot n’est disponible. Ajoutez une entrée dans config/client-mapping.ts pour l’associer explicitement.`}
        />
      ) : snapshot && !snapshot.available ? (
        <UnavailableNotice
          title="Certaines statistiques sont temporairement indisponibles"
          message={`La base « ${instance.database} » n’a pas répondu. Les informations issues de NovamapSystemDB restent affichées.`}
        />
      ) : null}

      {/* --- KPI patrimoine --------------------------------------------- */}
      {snapshot && snapshot.available ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Patrimoine et activité
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot.kpis.map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} />
            ))}
          </div>
        </section>
      ) : null}

      {/* --- Utilisateurs ------------------------------------------------ */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Utilisateurs
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            kpi={{
              key: 'users-total',
              label: 'Utilisateurs rattachés',
              value: userStats.total,
              source: 'NOVA_AGENT_CLIENT · CLT_ID_CLIENT',
            }}
          />
          <KpiCard
            kpi={{
              key: 'users-active',
              label: 'Actifs',
              value: userStats.active,
              source: 'NOVA_AGENT · AGT_DT_FIN absente ou future',
              note: 'AGT_ISALLOW n’est pas fiable pour ce calcul',
            }}
          />
          <KpiCard
            kpi={{
              key: 'users-recent',
              label: 'Connectés (3 mois)',
              value: userStats.connectedLast3Months,
              source: 'NOVA_AGENT_CLIENT · AGT_DT_LAST_CONNECT',
            }}
          />
          <KpiCard
            kpi={{
              key: 'users-federated',
              label: 'Comptes fédérés',
              value: userStats.federated,
              source: 'NOVA_AGENT · AGT_AD_OBJECTID non nul',
              note: 'Authentification Entra ID',
            }}
          />
        </div>
      </section>

      {/* --- Modules ----------------------------------------------------- */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Modules souscrits
        </h2>
        {modules.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">
            Aucun module actif dans NOVA_MODULE_CLIENT pour ce client.
          </Card>
        ) : (
          <ModulesByDomain modules={modules} />
        )}
      </section>

      {/* --- Répartition des équipements --------------------------------- */}
      {snapshot && snapshot.equipmentByType.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Principaux types d’équipements
          </h2>
          <Card>
            <CardContent className="pt-5">
              <ul className="space-y-2.5">
                {snapshot.equipmentByType.slice(0, 8).map((item) => {
                  const max = snapshot.equipmentByType[0]?.value || 1
                  return (
                    <li key={item.name} className="flex items-center gap-3 text-sm">
                      <span className="w-56 shrink-0 truncate" title={item.name}>
                        {item.name}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <span
                          className="block h-full rounded-full bg-foreground/70"
                          style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
                        />
                      </span>
                      <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
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
    </div>
  )
}

function ModulesByDomain({
  modules,
}: {
  modules: Awaited<ReturnType<typeof getClientModules>>
}) {
  const byDomain = new Map<string, typeof modules>()
  for (const item of modules) {
    const key = item.domain ?? 'Autres'
    const list = byDomain.get(key)
    if (list) list.push(item)
    else byDomain.set(key, [item])
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {[...byDomain.entries()].map(([domain, list]) => (
        <Card key={domain}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
              {domain}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-1.5">
              {list.map((item) => (
                <li key={item.code}>
                  <Badge variant="outline" title={item.code}>
                    {item.label}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function UnavailableNotice({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
      <div>
        <p className="text-sm font-medium text-amber-900">{title}</p>
        <p className="mt-1 text-sm text-amber-800">{message}</p>
      </div>
    </div>
  )
}
