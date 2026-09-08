import { ShieldCheck, Server } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui/primitives'
import { EnvBadge } from '@/components/env-badge'
import { serverEnv } from '@/config/env'
import { formatNumber } from '@/lib/utils'
import type { ClientInstance, ClientOrganisation } from '@/types'

/**
 * Onglet Technique.
 *
 * Ce qui est affiché ici est délibérément limité aux informations de
 * localisation et de configuration NON SENSIBLES. Ne sont JAMAIS affichés :
 * mot de passe SQL, chaîne de connexion complète, clés Azure, secrets JWT,
 * jetons, clés API SMS. Ces colonnes de NOVA_CLIENT ne sont même pas
 * sélectionnées par les requêtes de l'application.
 */

const SOURCE_LABEL: Record<string, { label: string; tone: 'success' | 'info' | 'warning' }> = {
  view: {
    label: 'VW_NOVA_CLIENT_BASE (chaîne en clair)',
    tone: 'success',
  },
  dashboard: {
    label: 'DASHBOARD_CLIENT (dernier snapshot)',
    tone: 'info',
  },
  mapping: {
    label: 'config/client-mapping.ts (mapping explicite)',
    tone: 'warning',
  },
}

export async function TechnicalTab({
  organisation,
  instance,
}: {
  organisation: ClientOrganisation
  instance: ClientInstance
}) {
  const server = serverEnv.sql.servers[instance.env]
  const source = instance.databaseSource
    ? SOURCE_LABEL[instance.databaseSource]
    : null

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" aria-hidden />
            Environnement consulté
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            <Row label="Environnement">
              <EnvBadge env={instance.env} />
            </Row>
            <Row label="Serveur SQL">
              <span className="font-mono text-xs">{server}</span>
            </Row>
            <Row label="Base de données">
              {instance.database ? (
                <span className="font-mono text-xs">{instance.database}</span>
              ) : (
                <Badge variant="warning">Non résolue</Badge>
              )}
            </Row>
            <Row label="Résolution de la base">
              {source ? (
                <Badge variant={source.tone}>{source.label}</Badge>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Aucune source n’a permis de résoudre la base
                </span>
              )}
            </Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Identifiants Novamap</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            <Row label="Trigramme">
              <span className="font-mono text-xs">{organisation.code}</span>
            </Row>
            <Row label="CLT_ID_CLIENT">
              <span className="font-mono text-xs">{instance.id}</span>
            </Row>
            <Row label="Nom en base">
              <span className="text-sm">{instance.name}</span>
            </Row>
            <Row label="ORG_ID_ORGANISATION">
              <span className="font-mono text-xs">
                {instance.organisationId ?? '—'}
              </span>
            </Row>
            <Row label="Quota utilisateurs">
              <span className="text-sm">
                {instance.userQuota === 9999
                  ? 'Illimité (9999)'
                  : formatNumber(instance.userQuota)}
              </span>
            </Row>
            <Row label="Logo en base">
              <span className="text-sm">
                {instance.hasIcon ? 'Oui (CLT_BIN_ICON_CLIENT)' : 'Non'}
              </span>
            </Row>
          </dl>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            Instances déclarées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">Environnement</th>
                  <th scope="col" className="py-2 pr-4 font-medium">CLT_ID_CLIENT</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Nom en base</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Base</th>
                  <th scope="col" className="py-2 font-medium">Agents</th>
                </tr>
              </thead>
              <tbody>
                {organisation.instances.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4">
                      <EnvBadge env={item.env} size="sm" />
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{item.id}</td>
                    <td className="py-2 pr-4">{item.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {item.database ?? '—'}
                    </td>
                    <td className="py-2 tabular-nums">{formatNumber(item.agentCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Cette page n’affiche jamais de mot de passe, de chaîne de connexion
            complète, de clé de stockage ni de jeton. L’application accède aux
            bases en lecture seule&nbsp;: toute requête ne commençant pas par
            SELECT ou WITH est rejetée avant exécution.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-all">{children}</dd>
    </div>
  )
}
