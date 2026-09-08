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

Le déploiement décrit ici vise le **palier gratuit F1**, choisi
délibérément. Il faut en connaître les contraintes, car aucune ne se
contourne :

| | Gratuit (F1) | Base (B1) |
|---|---|---|
| Coût | 0 € | ~13 €/mois |
| « Always On » | ❌ indisponible | ✅ |
| Quota processeur | **60 min/jour**, puis erreur 403 jusqu'au lendemain | aucun |
| Trafic sortant | plafonné (de l'ordre de 165 Mo/jour) | non plafonné |
| Mémoire | 1 Go | 1,75 Go |

Deux conséquences pratiques :

1. **Sans « Always On », l'application est déchargée après une vingtaine de
   minutes sans requête.** La visite suivante paie 20 à 60 secondes de
   démarrage, et ce démarrage consomme du quota. C'est le poste de dépense
   principal — d'où l'étape 5, qui maintient l'application éveillée.
2. **Le quota est journalier et sans préavis.** Une fois les 60 minutes
   atteintes, App Service renvoie une erreur 403 à tout le monde jusqu'à
   minuit UTC.

Pour une quinzaine de personnes consultant des fiches dans la journée, la
consommation réelle reste très en dessous du quota **à condition que
l'application ne redémarre pas en permanence**. C'est jouable, et le risque
est faible : si le quota est atteint, le passage en B1 se fait **depuis le
portail, en un bouton — même application, même URL, aucun redéploiement**.

Surveiller la consommation les premiers jours : App Service → Quotas.

## Installation

### 1. Créer l'App Service

- Runtime **Node 22 LTS**, système **Linux**, région proche des serveurs SQL.
- Palier **F1 (Gratuit)**.
- Le nom choisi devient l'adresse publique : `<nom>.azurewebsites.net`,
  avec certificat TLS fourni. Un domaine personnalise n'est pas
  disponible sur F1 — il exige un palier payant.
- Configuration → Général : commande de démarrage `node server.js`.
  (« Always On » n'existe pas sur F1 — voir l'étape 5.)

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

### 5. Maintenir l'application éveillée

Indispensable sur F1, où « Always On » n'existe pas. L'application expose
`/api/health` : la seule route accessible sans authentification. Elle n'ouvre
aucune connexion aux bases et ne révèle rien — ni version, ni environnement.
L'appeler régulièrement empêche le déchargement, donc les démarrages à froid,
donc l'essentiel de la consommation de quota.

Deux moyens, cumulables :

- **Service de supervision externe** — le plus fiable. UptimeRobot et
  équivalents surveillent une URL toutes les 5 minutes gratuitement. Pointer
  sur `https://<nom-de-l-app>.azurewebsites.net/api/health`. Bénéfice
  secondaire : vous êtes prévenu si l'application tombe.
- **[.github/workflows/maintien-eveille.yml](.github/workflows/maintien-eveille.yml)**
  — déjà dans le dépôt, appelle la même route toutes les 10 minutes. Il suffit
  de renseigner la variable `AZURE_WEBAPP_URL`. Gratuit sur un dépôt public,
  mais GitHub n'exécute les tâches planifiées qu'« au mieux » et les suspend
  après 60 jours sans activité sur le dépôt : à considérer comme un filet, pas
  comme la solution principale.

### 6. Déploiement continu

[.github/workflows/deploy-azure.yml](.github/workflows/deploy-azure.yml)
construit et déploie à chaque push sur `main`. Deux réglages, une seule fois,
dans Settings → Secrets and variables → Actions :

| | Nom | Valeur |
|---|---|---|
| Secret | `AZURE_WEBAPP_PUBLISH_PROFILE` | profil de publication téléchargé depuis le portail |
| Variable | `AZURE_WEBAPP_NAME` | nom de l'App Service |
| Variable | `AZURE_WEBAPP_URL` | URL publique, pour le maintien en éveil |

Le workflow refuse de déployer si `typecheck`, `lint` ou le contrôle de
lecture seule échouent.

## Vérifications après mise en ligne

- [ ] La page de connexion redirige vers Microsoft, et un compte extérieur aux
      domaines autorisés est refusé.
- [ ] Le bandeau « Mode développement » **n'apparaît pas**.
- [ ] Le badge d'environnement affiche bien PROD ou INT.
- [ ] L'onglet « Fiche » d'un client affiche des données (sinon : étape 4).
- [ ] Les journaux ne contiennent ni mot de passe, ni chaîne de connexion.
- [ ] `/api/health` répond `200` et ne renvoie que `{"status":"ok"}`.
- [ ] Après 24 h : App Service → Quotas, vérifier la consommation
      processeur. Si elle frôle les 60 minutes, passer en B1.

## Si le quota devient contraignant

Deux issues. La première :
**passer en B1** depuis le portail (App Service → Scale up), pour
environ 13 €/mois. Même application, même URL, aucun redéploiement, et
« Always On » devient disponible — le maintien en éveil de l'étape 5
peut alors être désactivé.

La seconde, sans coût : si un serveur interne déjà autorisé par le pare-feu est disponible, il peut
héberger l'application (Node 22, `node server.js` derrière un reverse proxy
avec TLS). Le coût est nul, en échange de l'exploitation à votre charge :
mises à jour système, certificat, supervision, redémarrage automatique.
