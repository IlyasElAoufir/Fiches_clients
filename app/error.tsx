'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/primitives'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] Erreur non gérée', error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Une erreur est survenue
      </h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        L’application n’a pas pu afficher cette page. Il s’agit le plus souvent
        d’une base momentanément injoignable ou d’une règle de pare-feu Azure
        SQL bloquant l’adresse IP du serveur.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Référence : {error.digest}
        </p>
      ) : null}
      <Button onClick={reset} className="mt-6">
        Réessayer
      </Button>
    </main>
  )
}
