import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

import { auth, signIn } from '@/lib/auth'
import { isAuthConfigured, serverEnv } from '@/config/env'
import { Button, Card } from '@/components/ui/primitives'

export const metadata = { title: 'Connexion' }

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    'Ce compte n’est pas autorisé. L’accès est réservé aux comptes Novamap.',
  Configuration:
    'L’authentification Microsoft n’est pas configurée sur ce serveur.',
  Verification: 'Le lien de connexion a expiré. Réessayez.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>
}) {
  const session = await auth()
  if (session?.user?.email) redirect('/clients')

  const params = await searchParams
  const errorMessage = params.error
    ? (ERROR_MESSAGES[params.error] ?? 'La connexion a échoué. Réessayez.')
    : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">
            Novamap
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Application interne. L’accès est réservé aux comptes
            <span className="font-medium text-foreground">
              {' '}
              @{serverEnv.auth.allowedDomains[0] ?? 'novamap.fr'}
            </span>
            .
          </p>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {isAuthConfigured ? (
          <form
            action={async () => {
              'use server'
              await signIn('microsoft-entra-id', { redirectTo: '/clients' })
            }}
          >
            <Button type="submit" className="h-11 w-full">
              <MicrosoftLogo />
              Se connecter avec Microsoft
            </Button>
          </form>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Authentification non configurée</p>
            <p className="mt-1">
              Renseignez <code className="font-mono">AZURE_AD_CLIENT_ID</code>,{' '}
              <code className="font-mono">AZURE_AD_CLIENT_SECRET</code> et{' '}
              <code className="font-mono">AZURE_AD_TENANT_ID</code> dans{' '}
              <code className="font-mono">.env.local</code>, puis redémarrez le
              serveur. Voir le README, section « Microsoft Entra ID ».
            </p>
          </div>
        )}
      </Card>
    </main>
  )
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 23 23" className="h-4 w-4" aria-hidden focusable="false">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}
