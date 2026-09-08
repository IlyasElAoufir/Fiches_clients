# syntax=docker/dockerfile:1
#
# Image de l'application, destinee a Cloud Run.
#
# Trois etapes : dependances, construction, execution. Seule la derniere est
# publiee, ce qui evite d'embarquer les sources et les outils de build.

# --- Dependances -------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Construction ------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# `config/env.ts` valide les variables des l'import : sans elles, la collecte
# des routes echoue. Le build n'ouvre aucune connexion — toutes les pages sont
# dynamiques — donc des valeurs factices suffisent. Les vraies valeurs sont
# injectees a l'execution par Cloud Run, jamais ici.
ENV SQL_PROD_SERVER=build.invalid \
    SQL_INT_SERVER=build.invalid \
    SQL_USER=build \
    SQL_PASSWORD=build
RUN npm run build

# --- Execution ---------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# L'application ne s'execute pas en root.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# `output: 'standalone'` produit un serveur autonome, mais n'y recopie ni les
# fichiers statiques ni public/ : c'est documente et volontaire cote Next.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
