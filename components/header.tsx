import Link from 'next/link'
import { LayoutGrid, Users } from 'lucide-react'

import { StatusBadge } from '@/components/status-badge'
import { UserMenu } from '@/components/user-menu'
import { cn } from '@/lib/utils'
import type { EnvId } from '@/config/environments'

export function Header({
  user,
  active,
  env,
}: {
  user: { name: string; email: string; isDevBypass?: boolean } | null
  active?: 'clients' | 'dashboard'
  /** Environnement interrogé, affiché par la pastille d'état. */
  env?: EnvId | 'ALL'
}) {
  // Les pages sont rendues à chaque requête : l'instant du rendu est donc
  // bien celui de la lecture des bases.
  const readAt = Date.now()

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
          <Link href="/clients" className="flex items-baseline gap-2">
            <span className="text-sm font-bold uppercase tracking-[0.18em] text-foreground">
              Novamap
            </span>
            <span className="text-sm text-muted-foreground">Clients</span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="Navigation principale">
            <NavLink
              href="/clients"
              icon={<LayoutGrid className="h-4 w-4" />}
              active={active === 'clients'}
            >
              Clients
            </NavLink>
            <NavLink
              href="/dashboard"
              icon={<Users className="h-4 w-4" />}
              active={active === 'dashboard'}
            >
              Vue globale
            </NavLink>
          </nav>

          {/* En accès local sans Entra ID, il n'y a pas de session : ni identité
              à afficher, ni déconnexion qui aurait un sens. Le menu n'apparaît
              donc que lorsqu'une authentification réelle est en place. */}
          {user?.isDevBypass ? null : (
            <div className="ml-auto">
              <UserMenu user={user} />
            </div>
          )}
        </div>
      </header>

      {/* Hors du <header> : son `backdrop-blur` ferait de lui le bloc conteneur
          de tout descendant `position: fixed`, et la pastille se calerait en
          haut de l'écran, par-dessus la navigation. */}
      <StatusBadge env={env} readAt={readAt} />
    </>
  )
}

function NavLink({
  href,
  icon,
  active,
  children,
}: {
  href: string
  icon: React.ReactNode
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-secondary font-medium text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </Link>
  )
}
