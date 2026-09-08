'use server'

import { signOut } from '@/lib/auth'

/**
 * Déconnexion.
 *
 * Passe par une action serveur invoquée en POST plutôt que par un lien GET
 * vers `/api/auth/signout` : un lien GET est déclenchable par une requête
 * tierce (image, iframe, préchargement du navigateur) et déconnecterait
 * l'utilisateur à son insu.
 */
export async function signOutAction() {
  await signOut({ redirectTo: '/login' })
}
