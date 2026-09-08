import { NextResponse } from 'next/server'

/**
 * Point de contrôle de disponibilité.
 *
 * Seule route de l'application accessible sans authentification. Elle existe
 * pour être appelée régulièrement par un service de surveillance : sur le
 * palier gratuit d'Azure App Service, l'option « Always On » n'existe pas et
 * l'application est déchargée après une vingtaine de minutes sans requête.
 * Un appel périodique la maintient chargée et évite les redémarrages à froid,
 * qui sont de loin ce qui consomme le plus de quota processeur.
 *
 * Elle n'ouvre AUCUNE connexion aux bases : la maintenir éveillée ne doit rien
 * coûter, ni en quota, ni en charge SQL.
 *
 * Elle ne révèle rien non plus — ni version, ni environnement, ni
 * configuration : elle est publique par nécessité, donc muette par principe.
 */

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
