# Déploiement

Application interne destinée à un usage quotidien : elle doit rester
disponible en permanence. Ce document décrit l'installation sur **Azure App
Service**.

## Pourquoi Azure, et pas un hébergeur gratuit

Les serveurs SQL interrogés n'ont **aucune ouverture vers Internet**. Ils
acceptent les adresses explicitement autorisées et les ressources Azure. Un
hébergeur situé hors d'Azure — Vercel, Netlify, Render, Fly.io — se voit donc
refuser la connexion par le pare-feu, et modifier les règles de pare-feu
n'entre pas dans le périmètre de ce projet.

Azure App Service est déjà du bon côté du pare-feu : aucune règle à ajouter.

## Choix du palier

| | Gratuit (F1) | **Base (B1)** |
|---|---|---|
| Disponibilité continue | ❌ l'app est déchargée après ~20 min d'inactivité | ✅ option « Always On » |
| Quota CPU | 60 min/jour, puis **erreur 403 jusqu'au lendemain** | aucun |
| Démarrage à froid | 20 à 60 s | aucun |
| Mémoire | 1 Go | 1,75 Go |

**Pour un usage quotidien par une équipe, prendre B1.** Le palier gratuit
n'est pas un B1 plus lent : il s'arrête net une fois le quota atteint, et
chaque redémarrage à froid consomme ce quota.

## Installation

### 1. Créer l'App Service

- Runtime **Node 22 LTS**, système **Linux**, région proche des serveurs SQL.
- Palier **B1** ou supérieur.
- Configuration → Général : **Always On = Activé**, commande de démarrage
  `node server.js`.

### 2. Déclarer l'application dans Microsoft Entra ID

Sans cette étape l'application **refuse tout accès en production** — c'est
volontaire : elle expose des données clients et ne doit pas être ouverte.

1. Entra ID → Inscriptions d'applications → Nouvelle inscription.
2. URI de redirection, type Web :
   `https://<nom-de-l-app>.azurewebsites.net/api/auth/callback/microsoft-entra-id`
3. Relever l'**ID d'application** et l'**ID de locataire**.
4. Certificats et secrets → Nouveau secret client → relever la **valeur**
   (elle n'est affichée qu'une fois).

L'authentification sur votre propre locataire n'entraîne pas de coût.

### 3. Renseigner les variables d'environnement

App Service → Paramètres → Variables d'environnement. Voir
[.env.example](.env.example) pour la liste complète.

Points d'attention :

- `NEXTAUTH_URL` doit valoir l'URL publique exacte, en `https`.
- `AUTH_SECRET` se génère avec `npx auth secret`.
- `SQL_USER` : utiliser un compte **`db_datareader`**. L'application
  n'écrit jamais, mais un compte en lecture seule rend l'écriture
  impossible même en cas de défaut.
- `EXCEL_DATA_FILE=/home/data/excel-clients.json` (voir ci-dessous).

### 4. Déposer les fiches issues du classeur

`data/excel-clients.json` contient les coordonnées des contacts clients : il
n'est pas versionné, donc absent du paquet déployé. Il se dépose une fois dans
le stockage persistant de l'App Service, sous `/home`, qui survit aux
redémarrages et aux déploiements.

```bash
npm run excel:extract          # régénère le fichier en local
az webapp deploy --resource-group <groupe> --name <nom-de-l-app> \
  --src-path data/excel-clients.json --type static \
  --target-path /home/data/excel-clients.json
```

À refaire à chaque mise à jour du classeur. **Aucun redéploiement n'est
nécessaire** : l'application relit le fichier.

Si le fichier est absent, l'application fonctionne mais l'onglet « Fiche »
reste vide pour tous les clients, et un avertissement apparaît dans les
journaux.

### 5. Déploiement continu

[.github/workflows/deploy-azure.yml](.github/workflows/deploy-azure.yml)
construit et déploie à chaque push sur `main`. Deux réglages, une seule fois,
dans Settings → Secrets and variables → Actions :

| | Nom | Valeur |
|---|---|---|
| Secret | `AZURE_WEBAPP_PUBLISH_PROFILE` | profil de publication téléchargé depuis le portail |
| Variable | `AZURE_WEBAPP_NAME` | nom de l'App Service |

Le workflow refuse de déployer si `typecheck`, `lint` ou le contrôle de
lecture seule échouent.

## Vérifications après mise en ligne

- [ ] La page de connexion redirige vers Microsoft, et un compte extérieur aux
      domaines autorisés est refusé.
- [ ] Le bandeau « Mode développement » **n'apparaît pas**.
- [ ] Le badge d'environnement affiche bien PROD ou INT.
- [ ] L'onglet « Fiche » d'un client affiche des données (sinon : étape 4).
- [ ] Les journaux ne contiennent ni mot de passe, ni chaîne de connexion.

## Alternative sans coût

Si un serveur interne déjà autorisé par le pare-feu est disponible, il peut
héberger l'application (Node 22, `node server.js` derrière un reverse proxy
avec TLS). Le coût est nul, en échange de l'exploitation à votre charge :
mises à jour système, certificat, supervision, redémarrage automatique.
