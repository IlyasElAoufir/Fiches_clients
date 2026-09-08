'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  ShieldCheck,
} from 'lucide-react'

import { Badge, Card, Input } from '@/components/ui/primitives'
import { cn, formatDate, formatDateTime, formatNumber } from '@/lib/utils'
import type { ClientUser, PagedResult } from '@/types'

type StatusFilter = 'all' | 'active' | 'inactive'

const COLUMNS = [
  { id: 'name', label: 'Nom', sortable: true },
  { id: 'login', label: 'Login', sortable: true },
  { id: 'email', label: 'E-mail', sortable: true },
  { id: 'status', label: 'Statut', sortable: true },
  { id: 'lastConnect', label: 'Dernière connexion', sortable: true },
  { id: 'permissions', label: 'Droits', sortable: false },
] as const

export function UsersTable({
  clientId,
  initial,
}: {
  clientId: number
  initial: PagedResult<ClientUser>
}) {
  const [data, setData] = useState(initial)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState('name')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pending, startTransition] = useTransition()

  // Chaque changement de critère repart vers le serveur : le filtrage n'a
  // jamais lieu sur un jeu partiel côté navigateur.
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        sort,
        direction,
        status,
      })
      if (search) params.set('q', search)

      try {
        const response = await fetch(
          `/api/clients/${clientId}/users?${params.toString()}`,
          { signal: controller.signal },
        )
        if (!response.ok) return
        const json = (await response.json()) as PagedResult<ClientUser>
        startTransition(() => setData(json))
      } catch {
        // Requête annulée par une saisie plus récente : rien à faire.
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [clientId, search, status, sort, direction, page])

  function toggleSort(column: string) {
    if (sort === column) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(column)
      setDirection('asc')
    }
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1
  const to = Math.min(data.page * data.pageSize, data.total)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Rechercher par nom, prénom, e-mail, login..."
            aria-label="Rechercher un utilisateur"
            className="pl-9"
          />
        </div>

        <div
          className="flex items-center gap-1 rounded-md border border-border p-1"
          role="group"
          aria-label="Filtrer par statut"
        >
          {(
            [
              { id: 'all', label: 'Tous' },
              { id: 'active', label: 'Actifs' },
              { id: 'inactive', label: 'Sortis' },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setStatus(option.id)
                setPage(1)
              }}
              aria-pressed={status === option.id}
              className={cn(
                'rounded px-3 py-1 text-sm transition-colors',
                status === option.id
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="text-sm text-muted-foreground sm:ml-auto" aria-live="polite">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-label="Chargement" />
          ) : (
            `${formatNumber(data.total)} utilisateur${data.total > 1 ? 's' : ''}`
          )}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left">
              {COLUMNS.map((column) => (
                <th key={column.id} scope="col" className="px-4 py-2.5 font-medium">
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.id)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {column.label}
                      <ArrowUpDown
                        className={cn(
                          'h-3 w-3',
                          sort === column.id ? 'text-foreground' : 'text-muted-foreground/50',
                        )}
                        aria-hidden
                      />
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className={cn(pending && 'opacity-50 transition-opacity')}>
            {data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  Aucun utilisateur ne correspond à ces critères.
                </td>
              </tr>
            ) : (
              data.rows.map((user) => (
                <tr
                  key={user.login}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{user.lastName}</span>
                    {user.firstName ? (
                      <span className="text-muted-foreground"> {user.firstName}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{user.login}</td>
                  <td className="max-w-[240px] truncate px-4 py-2.5" title={user.email}>
                    {user.email || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {user.isActive ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge
                        variant="default"
                        title={user.endDate ? `Fin : ${formatDate(user.endDate)}` : undefined}
                      >
                        Sorti
                      </Badge>
                    )}
                    {user.isFederated ? (
                      <ShieldCheck
                        className="ml-1.5 inline h-3.5 w-3.5 align-text-bottom text-sky-600"
                        aria-label="Compte fédéré Entra ID"
                      />
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {formatDateTime(user.lastConnect)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {formatNumber(user.permissionCount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          {from}–{to} sur {formatNumber(data.total)}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={data.page <= 1}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Précédent
          </button>
          <span className="text-muted-foreground">
            {data.page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={data.page >= totalPages}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 disabled:opacity-40"
          >
            Suivant
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </Card>
  )
}
