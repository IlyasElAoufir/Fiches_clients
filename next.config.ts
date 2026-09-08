import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Sortie autonome : `next build` produit .next/standalone/server.js, qui
  // embarque les seules dependances necessaires. C'est ce qui est deploye sur
  // Azure App Service (commande de demarrage : `node server.js`).
  output: 'standalone',

  // `mssql` est un module Node natif : il ne doit jamais être bundlé côté client
  // ni transformé pour l'edge runtime.
  serverExternalPackages: ['mssql', 'tedious'],

  // En-têtes de sécurité. L'application est interne et lit la production :
  // on interdit l'indexation, l'iframe, et on limite le referrer.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
