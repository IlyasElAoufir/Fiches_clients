'use client'

import { useState } from 'react'

import { cn, initialsFrom, colorFromString, colorTextFromString } from '@/lib/utils'

/**
 * Logo client, avec repli propre.
 *
 * Ordre de résolution, appliqué par la route /api/clients/[code]/logo :
 *   1. public/clients/<code>.png — surcharge manuelle si elle existe
 *   2. NOVA_CLIENT.CLT_BIN_ICON_CLIENT — 112 clients sur 131 en production
 *   3. initiales
 *
 * Une image cassée n'est jamais affichée : `onError` bascule sur les
 * initiales, dont la couleur est dérivée du code client pour rester stable
 * d'une session à l'autre.
 */
export function ClientLogo({
  code,
  name,
  className,
  size = 'default',
}: {
  code: string
  name: string
  className?: string
  size?: 'sm' | 'default' | 'lg'
}) {
  const [failed, setFailed] = useState(false)
  const initials = initialsFrom(name, code)

  const dimension =
    size === 'sm' ? 'h-10 w-10 text-xs' : size === 'lg' ? 'h-20 w-20 text-xl' : 'h-16 w-16 text-base'

  if (failed) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl font-semibold tracking-wide',
          dimension,
          className,
        )}
        style={{
          backgroundColor: colorFromString(code || name),
          color: colorTextFromString(code || name),
        }}
        aria-label={name}
        role="img"
      >
        {initials}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- source dynamique (base ou fichier), pas d'optimisation Next possible
    <img
      src={`/api/clients/${encodeURIComponent(code)}/logo`}
      alt={`Logo ${name}`}
      className={cn(
        'shrink-0 rounded-xl border border-border bg-white object-contain p-1.5',
        dimension,
        className,
      )}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  )
}
