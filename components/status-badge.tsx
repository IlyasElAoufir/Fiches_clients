'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { EnvId } from '@/config/environments'

/**
 * Pastille d'état, en bas à gauche.
 *
 * Elle remplace l'indicateur de développement de Next.js, qui n'existe pas en
 * production. Celui-ci signalait une recompilation : sans objet une fois
 * l'application construite. Celle-ci montre ce qui compte vraiment ici —
 * quel environnement est interrogé, et depuis combien de temps les chiffres
 * affichés ont été lus.
 *
 * Un clic relit les bases. Les pages étant rendues à chaque requête, un
 * `router.refresh()` suffit : aucun rechargement complet, l'état de la page
 * est conservé.
 */
export function StatusBadge({
  env,
  readAt,
}: {
  env?: EnvId | 'ALL'
  /** Instant de lecture des données, en millisecondes. */
  readAt: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // Rendu serveur et premier rendu client doivent coïncider : l'âge n'est
  // calculé qu'une fois monté, sinon l'hydratation diverge d'une seconde.
  const [age, setAge] = useState<string | null>(null)

  useEffect(() => {
    const calcul = () => setAge(formatAge(Date.now() - readAt))
    calcul()
    const t = setInterval(calcul, 1000)
    return () => clearInterval(t)
  }, [readAt])

  const isProd = env === 'PROD'
  const isInt = env === 'INT'

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40 print:hidden">
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
        aria-label="Relire les données depuis les bases"
        title="Relire les données depuis les bases"
        className={cn(
          'pointer-events-auto inline-flex items-center gap-2 rounded-full',
          'border border-white/15 bg-neutral-900/90 py-1.5 pl-2.5 pr-3',
          'text-[11px] font-medium text-neutral-100 shadow-lg backdrop-blur',
          'transition-colors hover:bg-neutral-800/90',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'focus-visible:outline-white/50 disabled:cursor-wait',
        )}
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-70',
              'motion-safe:animate-ping',
              isProd ? 'bg-red-400' : isInt ? 'bg-sky-400' : 'bg-emerald-400',
            )}
          />
          <span
            className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              isProd ? 'bg-red-500' : isInt ? 'bg-sky-500' : 'bg-emerald-500',
            )}
          />
        </span>

        {env && env !== 'ALL' ? (
          <span className="font-semibold uppercase tracking-wider">{env}</span>
        ) : (
          <span className="font-semibold tracking-wide">Novamap</span>
        )}

        <span className="text-neutral-400" aria-hidden>
          ·
        </span>

        {/* `min-w` fige la largeur : sans cela la pastille tressaute à chaque
            seconde, quand « 9 s » devient « 10 s ». */}
        <span className="min-w-[68px] text-left tabular-nums text-neutral-300">
          {pending ? 'lecture…' : (age ?? '—')}
        </span>

        <RefreshCw
          className={cn('h-3 w-3 text-neutral-400', pending && 'animate-spin')}
          aria-hidden
        />
      </button>
    </div>
  )
}

function formatAge(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 5) return 'à l’instant'
  if (s < 60) return `il y a ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  return `il y a ${h} h`
}
