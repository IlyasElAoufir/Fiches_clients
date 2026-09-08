'use client'

import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, LogOut, User } from 'lucide-react'

import { signOutAction } from '@/app/actions/auth-actions'

export function UserMenu({ user }: { user: { name: string; email: string } | null }) {
  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <User className="h-4 w-4" />
        Se connecter
      </Link>
    )
  }

  const initials = (user.name || user.email)
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
          {initials}
        </span>
        <span className="hidden max-w-[160px] truncate sm:inline">{user.name}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[220px] rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {/* Déconnexion en POST via une action serveur : un lien GET serait
              déclenchable par une requête tierce. */}
          <DropdownMenu.Item asChild onSelect={(e) => e.preventDefault()}>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-accent"
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </button>
            </form>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
