'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Search, Loader2 } from 'lucide-react'

import { Input } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { ENVIRONMENTS, type EnvId } from '@/config/environments'

const FILTERS: { id: EnvId | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'Tous' },
  ...ENVIRONMENTS.map((e) => ({ id: e.id as EnvId, label: e.label })),
]

export function ClientFilters({
  defaultSearch,
  defaultEnv,
}: {
  defaultSearch: string
  defaultEnv: EnvId | 'ALL'
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(defaultSearch)

  // La recherche est reportée dans l'URL : l'état est partageable et le
  // filtrage reste exécuté côté serveur.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set('q', value)
      else params.delete('q')

      const next = params.toString()
      startTransition(() => {
        router.replace(next ? `/clients?${next}` : '/clients', { scroll: false })
      })
    }, 250)

    return () => clearTimeout(timer)
    // `searchParams` est volontairement hors dépendances : seul le texte pilote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function setEnv(env: EnvId | 'ALL') {
    const params = new URLSearchParams(searchParams.toString())
    if (env === 'ALL') params.delete('env')
    else params.set('env', env)
    const next = params.toString()
    startTransition(() => {
      router.replace(next ? `/clients?${next}` : '/clients', { scroll: false })
    })
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Rechercher un client..."
          aria-label="Rechercher un client"
          className="pl-9 pr-9"
        />
        {pending ? (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>

      <div
        className="flex items-center gap-1 rounded-md border border-border bg-card p-1"
        role="group"
        aria-label="Filtrer par environnement"
      >
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setEnv(filter.id)}
            aria-pressed={defaultEnv === filter.id}
            className={cn(
              'rounded px-3 py-1.5 text-sm transition-colors',
              defaultEnv === filter.id
                ? 'bg-secondary font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  )
}
