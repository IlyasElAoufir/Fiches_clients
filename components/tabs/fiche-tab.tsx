import { FileWarning, Mail, Phone, ExternalLink } from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  EmptyState,
} from '@/components/ui/primitives'
import { EnvBadge } from '@/components/env-badge'
import { getClientExcelInfo, buildFicheSections } from '@/services/excelService'
import type { ClientOrganisation } from '@/types'

/**
 * Fiche issue de « Fiches Clients.xlsx ».
 *
 * Le contenu est regroupé par sections métier, pas recopié tel quel depuis le
 * classeur. Les champs sensibles (mots de passe, clés Azure, comptes SQL,
 * clés API) ont été écartés dès l'extraction par une allowlist : ils
 * n'existent pas dans les données que reçoit cette page.
 */
export async function FicheTab({
  organisation,
}: {
  organisation: ClientOrganisation
}) {
  const databases = organisation.instances
    .map((i) => i.database)
    .filter((d): d is string => Boolean(d))

  const sheet = await getClientExcelInfo(
    organisation.code,
    organisation.name,
    databases,
  )

  if (!sheet) {
    return (
      <EmptyState
        icon={<FileWarning className="h-8 w-8" />}
        title="Aucune fiche Excel rattachée"
        description={`Aucune feuille de « Fiches Clients.xlsx » n’a pu être associée à ${organisation.name} (${organisation.code}) de façon fiable. Plutôt qu’un rapprochement approximatif, ajoutez une correspondance explicite dans config/client-mapping.ts.`}
      />
    )
  }

  const sections = buildFicheSections(sheet)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Source&nbsp;: feuille{' '}
          <span className="font-medium text-foreground">« {sheet.sheet} »</span>
        </span>
        <Badge variant="outline">
          Modèle {sheet.format === 'NOUVEAU' ? 'récent' : 'historique'}
        </Badge>
        {sheet.aSupprimer ? (
          <Badge variant="warning">Marquée « à supprimer »</Badge>
        ) : null}
      </div>

      {sheet._anomalies?.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Anomalies détectées dans le classeur</p>
          <ul className="mt-1 list-inside list-disc">
            {sheet._anomalies.map((anomaly) => (
              <li key={anomaly}>{anomaly}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-3">
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                {section.fields.map((field, index) => (
                  <div
                    key={`${field.label}-${index}`}
                    className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4"
                  >
                    {field.label ? (
                      <dt className="text-sm text-muted-foreground">{field.label}</dt>
                    ) : null}
                    <dd className="break-words text-sm">
                      <FieldValue value={field.value} />
                      {field.intValue ? (
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <EnvBadge env="INT" size="sm" />
                          <FieldValue value={field.intValue} />
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}

        {sheet.contacts.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle>Contacts ({sheet.contacts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sheet.contacts.map((contact, index) => (
                  <div
                    key={`${contact.role}-${index}`}
                    className="rounded-md border border-border p-3"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {contact.role}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {[contact.prenom, contact.nom].filter(Boolean).join(' ') || '—'}
                    </p>
                    {contact.poste ? (
                      <p className="text-xs text-muted-foreground">{contact.poste}</p>
                    ) : null}
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="mt-2 flex items-center gap-1.5 text-xs text-foreground hover:underline"
                      >
                        <Mail className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{contact.email}</span>
                      </a>
                    ) : null}
                    {contact.tel || contact.portable ? (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" aria-hidden />
                        {contact.tel ?? contact.portable}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Les champs sensibles du classeur (mots de passe, clés de stockage,
        comptes SQL, clés API) sont exclus à l’extraction et n’ont jamais été
        chargés par l’application.
      </p>
    </div>
  )
}

function FieldValue({ value }: { value: string }) {
  if (/^https?:\/\//i.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 text-foreground underline decoration-muted-foreground underline-offset-2 hover:decoration-foreground"
      >
        <span className="break-all">{value}</span>
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
      </a>
    )
  }

  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(value)) {
    return (
      <a href={`mailto:${value}`} className="hover:underline">
        {value}
      </a>
    )
  }

  return <span>{value}</span>
}
