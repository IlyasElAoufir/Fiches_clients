import { Database } from 'lucide-react'

import { cn } from '@/lib/utils'
import { getEnvironment, type EnvId } from '@/config/environments'

/**
 * Badge d'environnement.
 *
 * Exigence explicite du projet : un utilisateur ne doit jamais croire
 * consulter l'intégration alors qu'il regarde la production. Le badge est
 * donc toujours affiché, jamais en nuance discrète, et PROD porte une couleur
 * distincte et saturée.
 */
export function EnvBadge({
  env,
  size = 'default',
  className,
}: {
  env: EnvId
  size?: 'default' | 'sm' | 'lg'
  className?: string
}) {
  const environment = getEnvironment(env)
  const isProd = env === 'PROD'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-semibold uppercase tracking-wide',
        isProd
          ? 'border-red-300 bg-red-600 text-white'
          : 'border-sky-300 bg-sky-100 text-sky-800',
        size === 'sm' && 'px-1.5 py-0.5 text-[10px]',
        size === 'default' && 'px-2 py-0.5 text-xs',
        size === 'lg' && 'px-3 py-1 text-sm',
        className,
      )}
      title={`Environnement ${environment.label}`}
    >
      <span
        className={cn(
          'inline-block rounded-full',
          size === 'lg' ? 'h-2 w-2' : 'h-1.5 w-1.5',
          isProd ? 'bg-white' : 'bg-sky-600',
        )}
        aria-hidden
      />
      {environment.shortLabel}
    </span>
  )
}

/** Bandeau permanent en haut de la fiche client. */
export function EnvBanner({ env, database }: { env: EnvId; database: string | null }) {
  const isProd = env === 'PROD'

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2.5 text-sm',
        isProd
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-sky-200 bg-sky-50 text-sky-900',
      )}
    >
      <EnvBadge env={env} size="lg" />
      <span className="font-medium">
        {isProd
          ? 'Vous consultez les données de production.'
          : 'Vous consultez les données d’intégration.'}
      </span>
      {database ? (
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-xs opacity-80">
          <Database className="h-3.5 w-3.5" aria-hidden />
          {database}
        </span>
      ) : null}
    </div>
  )
}
