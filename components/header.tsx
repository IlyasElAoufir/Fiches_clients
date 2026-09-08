import Link from 'next/link'
import { LayoutGrid, Users } from 'lucide-react'

import { UserMenu } from '@/components/user-menu'
import { cn } from '@/lib/utils'

export function Header({
  user,
  active,
}: {
  user: { name: string; email: string } | null
  active?: 'clients' | 'dashboard'
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Link href="/clients" className="flex items-baseline gap-2">
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-foreground">
            Novamap
          </span>
          <span className="text-sm text-muted-foreground">Clients</span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Navigation principale">
          <NavLink href="/clients" icon={<LayoutGrid className="h-4 w-4" />} active={active === 'clients'}>
            Clients
          </NavLink>
          <NavLink href="/dashboard" icon={<Users className="h-4 w-4" />} active={active === 'dashboard'}>
            Vue globale
          </NavLink>
        </nav>

        <div className="ml-auto">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
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
