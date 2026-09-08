import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'

import { serverEnv, isAuthConfigured } from '@/config/env'

/**
 * Authentification Microsoft Entra ID.
 *
 * Deux barrières, toutes deux côté serveur :
 *
 *  1. Le provider est configuré sur le tenant Novamap (`issuer` avec le
 *     tenantId) : un compte Microsoft d'un autre tenant ne peut pas obtenir
 *     de jeton valide.
 *  2. Le callback `signIn` vérifie le domaine de l'e-mail vérifié renvoyé par
 *     Entra ID contre ALLOWED_EMAIL_DOMAINS. Cette vérification a lieu dans
 *     le callback serveur, pas dans l'interface : elle ne peut pas être
 *     contournée depuis le navigateur.
 */

function emailDomainAllowed(email: string | null | undefined): boolean {
  if (!email) return false
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return serverEnv.auth.allowedDomains.includes(domain)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: serverEnv.auth.secret || undefined,

  providers: isAuthConfigured
    ? [
        MicrosoftEntraID({
          clientId: serverEnv.auth.clientId,
          clientSecret: serverEnv.auth.clientSecret,
          // Restreint l'émetteur au seul tenant Novamap.
          issuer: `https://login.microsoftonline.com/${serverEnv.auth.tenantId}/v2.0`,
          authorization: { params: { scope: 'openid profile email User.Read' } },
        }),
      ]
    : [],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    /** Barrière n°2 : domaine e-mail, vérifié côté serveur. */
    async signIn({ profile, account }) {
      if (account?.provider !== 'microsoft-entra-id') return false

      // Entra ID renvoie l'identifiant selon la configuration du tenant.
      const email =
        (profile?.email as string | undefined) ??
        (profile?.preferred_username as string | undefined) ??
        (profile?.upn as string | undefined) ??
        null

      if (!emailDomainAllowed(email)) {
        console.warn(
          `[auth] Connexion refusée : domaine non autorisé pour « ${email ?? 'inconnu'} »`,
        )
        return false
      }
      return true
    },

    async jwt({ token, profile }) {
      if (profile) {
        token.email =
          (profile.email as string | undefined) ??
          (profile.preferred_username as string | undefined) ??
          token.email
        token.name = (profile.name as string | undefined) ?? token.name
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) ?? session.user.email
        session.user.name = (token.name as string) ?? session.user.name
      }
      return session
    },
  },
})

/**
 * Session validée pour une route serveur.
 * Renvoie `null` si non authentifié, `'forbidden'` si authentifié mais hors
 * domaine autorisé — ce qui permet de distinguer 401 et 403.
 */
export async function requireSession(): Promise<
  { email: string; name: string } | null | 'forbidden'
> {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return null
  if (!emailDomainAllowed(email)) return 'forbidden'
  return { email, name: session.user?.name ?? email }
}
