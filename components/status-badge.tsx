'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import type { EnvId } from '@/config/environments'

/**
 * Pastille d'état, en bas à gauche.
 *
 * Reprend l'esprit de l'indicateur de développement de Next.js — un rond noir,
 * un logo, un arc qui tourne — qui n'existe pas en production. Là où celui de
 * Next signalait une recompilation, sans objet une fois l'application
 * construite, celui-ci indique l'environnement interrogé par la couleur de son
 * arc, et révèle au survol depuis combien de temps les chiffres ont été lus.
 *
 * Un clic relit les bases. Les pages étant rendues à chaque requête, un
 * `router.refresh()` suffit : l'état de la page est conservé.
 *
 * ATTENTION : ce composant doit rester HORS du `<header>`. Celui-ci porte un
 * `backdrop-blur`, et un filtre CSS fait de l'élément un bloc conteneur pour
 * ses descendants `position: fixed` — la pastille se calait alors sur le
 * header, donc en haut de l'écran, par-dessus la navigation.
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

  const arc =
    env === 'PROD' ? '#f87171' : env === 'INT' ? '#38bdf8' : '#34d399'

  return (
    <div className="fixed bottom-5 left-5 z-50 print:hidden">
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
        aria-label="Relire les données depuis les bases"
        className={cn(
          'group relative flex h-11 w-11 items-center justify-center rounded-full',
          'bg-neutral-950 text-white shadow-[0_4px_16px_rgba(0,0,0,0.35)]',
          'ring-1 ring-white/15 transition-transform',
          'hover:scale-105 active:scale-95 disabled:cursor-wait',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'focus-visible:outline-white/60',
        )}
      >
        {/* Arc tournant. Plus rapide pendant une relecture. */}
        <svg
          viewBox="0 0 44 44"
          className={cn(
            'absolute inset-0 h-full w-full',
            'motion-safe:animate-spin',
            pending ? '[animation-duration:0.7s]' : '[animation-duration:3.5s]',
          )}
          aria-hidden
        >
          <circle
            cx="22"
            cy="22"
            r="20"
            fill="none"
            stroke={arc}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="34 92"
            opacity="0.95"
          />
        </svg>

        {/* Le N de Novamap. */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path
            d="M6 18V6l12 12V6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Détail au survol, à droite du rond. */}
        <span
          className={cn(
            'pointer-events-none absolute left-[52px] whitespace-nowrap rounded-full',
            'bg-neutral-950/95 px-3 py-1.5 text-[11px] font-medium text-neutral-200',
            'ring-1 ring-white/15 shadow-lg',
            'opacity-0 transition-opacity duration-150 group-hover:opacity-100',
            'group-focus-visible:opacity-100',
          )}
        >
          {env && env !== 'ALL' ? (
            <span className="font-semibold uppercase tracking-wider">{env}</span>
          ) : (
            <span className="font-semibold">Novamap</span>
          )}
          <span className="mx-1.5 text-neutral-500">·</span>
          <span className="tabular-nums text-neutral-400">
            {pending ? 'lecture…' : (age ?? '—')}
          </span>
        </span>
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
