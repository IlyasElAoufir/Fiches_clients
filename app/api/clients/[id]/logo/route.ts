import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

import { checkApiAccess } from '@/lib/guard'
import { getClientOrganisation } from '@/services/clientService'
import { getClientIcon } from '@/services/systemDbService'

/**
 * GET /api/clients/[id]/logo
 *
 * `id` est ici le trigramme de l'organisme (le même segment dynamique que les
 * autres routes, Next.js n'en autorisant qu'un seul par niveau).
 *
 * Ordre de résolution :
 *   1. public/clients/<code>.png|jpg|svg|webp — surcharge manuelle
 *   2. NOVA_CLIENT.CLT_BIN_ICON_CLIENT — présent pour 112 clients sur 131
 *   3. 404 → le composant bascule sur les initiales
 *
 * Le code est validé (alphanumérique court) avant toute lecture disque, ce
 * qui exclut toute remontée de chemin.
 */

const SAFE_CODE = /^[A-Za-z0-9-]{1,12}$/

const EXTENSIONS = [
  { ext: 'png', type: 'image/png' },
  { ext: 'svg', type: 'image/svg+xml' },
  { ext: 'jpg', type: 'image/jpeg' },
  { ext: 'jpeg', type: 'image/jpeg' },
  { ext: 'webp', type: 'image/webp' },
] as const

/** Détecte le type d'image à partir des premiers octets. */
function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif'
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp'
  return null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await checkApiAccess()
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status })
  }

  const { id: code } = await params
  if (!SAFE_CODE.test(code)) {
    return new NextResponse(null, { status: 400 })
  }

  // 1. Surcharge par fichier
  for (const { ext, type } of EXTENSIONS) {
    try {
      const filePath = path.join(
        process.cwd(),
        'public',
        'clients',
        `${code.toLowerCase()}.${ext}`,
      )
      const file = await readFile(filePath)
      return new NextResponse(new Uint8Array(file), {
        headers: {
          'Content-Type': type,
          'Cache-Control': 'private, max-age=3600',
        },
      })
    } catch {
      // Fichier absent : on passe à l'extension suivante.
    }
  }

  // 2. Icône stockée en base
  try {
    const organisation = await getClientOrganisation(code)
    if (!organisation) return new NextResponse(null, { status: 404 })

    const withIcon =
      organisation.instances.find((i) => i.hasIcon && i.env === 'PROD') ??
      organisation.instances.find((i) => i.hasIcon)

    if (!withIcon) return new NextResponse(null, { status: 404 })

    const icon = await getClientIcon(withIcon.id)
    if (!icon) return new NextResponse(null, { status: 404 })

    const contentType = sniffImageType(icon)
    if (!contentType) return new NextResponse(null, { status: 404 })

    return new NextResponse(new Uint8Array(icon), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (error) {
    console.error('[api/clients/logo]', error)
    return new NextResponse(null, { status: 404 })
  }
}
