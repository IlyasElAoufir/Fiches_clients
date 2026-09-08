import Link from 'next/link'

import { Button } from '@/components/ui/primitives'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
        Novamap Clients
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Ce client n’existe pas, ou n’est pas exposé par l’application.
      </p>
      <Button asChild className="mt-6">
        <Link href="/clients">Retour aux clients</Link>
      </Button>
    </main>
  )
}
