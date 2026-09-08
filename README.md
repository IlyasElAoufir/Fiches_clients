# Novamap Clients

Application web interne réunissant, sur une fiche par client, les informations
métier issues du classeur de suivi, les données de la base système Novamap,
les utilisateurs rattachés et des indicateurs calculés dans la base propre à
chaque client.

> **Dépôt public.** Les noms de serveurs, les noms de bases, les identifiants
> clients et la documentation d'exploitation sont volontairement absents de ce
> dépôt. Ils vivent dans des fichiers locaux non versionnés (voir
> [Configuration](#configuration)).

## Sommaire

- [Principe fondamental : lecture seule](#principe-fondamental--lecture-seule)
- [Stack](#stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Déploiement](#déploiement)

## Principe fondamental : lecture seule

Les bases interrogées sont des bases de production. **L'application ne doit
jamais écrire.** Cette règle n'est pas seulement une convention : elle est
appliquée par le code.

- `readQuery()` ([lib/db.ts](lib/db.ts)) est l'unique voie d'accès aux bases.
- `assertReadOnly()` exige que la requête commence par `SELECT` ou `WITH`, et
  rejette quinze mots-clés d'écriture (`INSERT`, `UPDATE`, `DELETE`, `MERGE`,
  `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `EXEC`, `GRANT`, `REVOKE`, `DENY`,
  `DBCC`, `BACKUP`, `RESTORE`).
- Aucune route d'API n'accepte de SQL, et aucun paramètre client ne désigne
  une base de données.

Toute optimisation qui supposerait un index, une vue ou une table temporaire
doit être **signalée**, jamais appliquée.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 3 · Recharts 3 ·
`mssql` · Auth.js v5 (Microsoft Entra ID) · Lucide.

Interface et code en français.

## Installation

```bash
npm install
cp .env.example .env.local     # puis renseigner les valeurs
npm run excel:extract          # génère data/excel-clients.json (non versionné)
npm run dev                    # http://localhost:3000
```

`npm run excel:extract` lit le classeur de suivi via un extracteur en **liste
blanche** : seuls les champs explicitement autorisés sont retenus, afin
qu'aucun secret présent dans le classeur n'entre dans l'application.

## Configuration

Toutes les valeurs sensibles vivent dans `.env.local`, ignoré par Git. Voir
[.env.example](.env.example) pour la liste complète.

| Variable | Rôle |
|---|---|
| `SQL_PROD_SERVER`, `SQL_INT_SERVER` | Serveurs SQL, un par environnement |
| `SQL_USER`, `SQL_PASSWORD` | Compte SQL — **`db_datareader` recommandé** |
| `SQL_SYSTEM_DATABASE` | Base système commune |
| `AZURE_AD_CLIENT_ID` / `_SECRET` / `_TENANT_ID` | Inscription Entra ID |
| `AUTH_SECRET` | Signature des sessions (`npx auth secret`) |
| `ALLOWED_EMAIL_DOMAINS` | Domaines autorisés à se connecter |

Fichiers locaux attendus mais non versionnés :

| Fichier | Contenu |
|---|---|
| `.env.local` | Secrets ci-dessus |
| `data/excel-clients.json` | Données extraites du classeur (contacts clients) |
| `mappings-a-confirmer.local.txt` | Correspondances client → base à vérifier |
| `tools/known-secrets.local.json` | Motifs recherchés par le test anti-fuite |

### Authentification

Tant que les variables `AZURE_AD_*` sont vides, l'application est **ouverte en
développement local** (un bandeau le signale) et **refuse l'accès en
production**. Une inscription d'application Entra ID est donc obligatoire
avant tout déploiement.

## Architecture

```
app/          clients/ (liste + fiche, 5 onglets) · dashboard/ · login/ · api/
components/   tabs/ · ui/ · cartes, logos, tableaux, graphiques
config/       env · environments (liste blanche) · client-mapping
lib/          db (garde-fou lecture seule) · auth · guard · audit · utils
services/     systemDb · clientDb · client · agent · dashboard · excel
tools/        inspect/ (scripts d'analyse en lecture seule) · tests
```

Toute requête SQL vit dans `services/`. Aucune n'est reçue du client.

### La notion de « client »

La base système contient **une ligne par client et par environnement** : un
même organisme y apparaît en production, en intégration et en formation sous
trois lignes distinctes. L'application les regroupe par trigramme et exclut
les instances techniques, pour présenter un organisme par carte.

### Résolution client → base

La chaîne de connexion stockée en base est chiffrée pour une majorité de
clients. La base réelle est donc résolue par recoupement de deux sources
indépendantes, qui ne se contredisent jamais. Les cas restants passent par un
mapping **explicite** ([config/client-mapping.ts](config/client-mapping.ts)) :
jamais par déduction. À défaut, l'application affiche « base non résolue »
plutôt qu'un chiffre faux.

## Sécurité

- Le frontend ne peut pas envoyer de SQL, ni désigner une base.
- Connexion restreinte au tenant Entra ID et aux domaines de messagerie
  autorisés, vérifiés côté serveur.
- API : `401` sans session, `403` hors domaine autorisé.
- Pages en `force-dynamic` — l'authentification n'est jamais mise en cache.
- Déconnexion en `POST`.
- Mots de passe, hachages et chaînes de connexion ne sont ni affichés, ni
  journalisés, ni renvoyés par une API.

## Tests

```bash
npm run typecheck
npm run lint
npm test           # garde-fou lecture seule + contrôle anti-fuite
npm run test:api   # nécessite « npm run dev » dans un autre terminal
```

`npm test` vérifie que les requêtes d'écriture sont refusées, que les requêtes
de lecture passent, et qu'aucun secret ne se retrouve dans les données
extraites ni dans le bundle client.

## Déploiement

Les serveurs SQL n'ont **aucune ouverture vers Internet** : ils acceptent les
adresses explicitement autorisées et les ressources Azure. C'est la contrainte
qui commande le choix de l'hébergeur.

- **[DEPLOIEMENT-GCP.md](DEPLOIEMENT-GCP.md)** — Cloud Run, avec une adresse de
  sortie fixe à faire autoriser au pare-feu. Voie retenue pour le domaine
  personnalisé.
- **[DEPLOIEMENT.md](DEPLOIEMENT.md)** — Azure App Service, qui ne demande
  aucune modification du pare-feu.

L'application expose `/api/health`, seule route accessible sans
authentification : elle n'ouvre aucune connexion aux bases et ne révèle ni
version ni configuration.

## Licence

Usage interne. Tous droits réservés.
