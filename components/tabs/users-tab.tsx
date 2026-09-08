import { getClientUsers, getClientUserStats } from '@/services/agentService'
import { UsersTable } from '@/components/users-table'
import { StatCard } from '@/components/kpi-card'
import type { ClientInstance } from '@/types'

/**
 * Onglet Utilisateurs.
 *
 * La recherche, le tri et la pagination sont exécutés côté SQL : la table
 * NOVA_AGENT compte 19 830 lignes et certains clients dépassent 1 000 agents.
 * On ne rapatrie jamais la liste complète.
 */
export async function UsersTab({ instance }: { instance: ClientInstance }) {
  const [stats, firstPage] = await Promise.all([
    getClientUserStats(instance.id),
    getClientUsers({ clientId: instance.id, page: 1, pageSize: 25 }),
  ])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total rattachés" value={stats.total} />
        <StatCard
          label="Actifs"
          value={stats.active}
          hint="Date de fin absente ou future"
        />
        <StatCard
          label="Connectés (3 mois)"
          value={stats.connectedLast3Months}
          hint="Dernière connexion sur ce client"
        />
        <StatCard
          label="Comptes fédérés"
          value={stats.federated}
          hint="Entra ID (AGT_AD_OBJECTID)"
        />
      </div>

      <UsersTable clientId={instance.id} initial={firstPage} />
    </div>
  )
}
