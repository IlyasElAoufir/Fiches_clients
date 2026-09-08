'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { cn } from '@/lib/utils'
import { ENVIRONMENTS, type EnvId } from '@/config/environments'

/**
 * Bascule d'environnement.
 *
 * L'environnement n'est qu'un paramètre d'affichage : le backend le valide
 * contre la liste blanche puis résout lui-même la base autorisée depuis
 * NOVA_CLIENT. Une valeur forgée dans l'URL ne donne accès à rien.
 */
export function EnvSwitcher({
  code,
  current,
  available,
}: {
  code: string
  current: EnvId
  available: EnvId[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  if (available.length < 2) return null

  function select(env: EnvId) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('env', env)
    startTransition(() => {
      router.push(`/clients/${encodeURIComponent(code)}?${params.toString()}`)
    })
  }

  return (
    <div className="shrink-0">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        Environnement
      </p>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md border border-border bg-card p-1',
          pending && 'opacity-60',
        )}
        role="group"
        aria-label="Changer d’environnement"
      >
        {ENVIRONMENTS.filter((e) => available.includes(e.id)).map((environment) => {
          const isActive = environment.id === current
          const isProd = environment.id === 'PROD'
          return (
            <button
              key={environment.id}
              type="button"
              onClick={() => select(environment.id)}
              aria-pressed={isActive}
              className={cn(
                'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                !isActive && 'text-muted-foreground hover:text-foreground',
                isActive && isProd && 'bg-red-600 text-white',
                isActive && !isProd && 'bg-sky-100 text-sky-800',
              )}
            >
              {environment.shortLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}
