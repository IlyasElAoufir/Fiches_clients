# Déploiement sur Google Cloud Run

L'application est jointe sur l'adresse fournie par Cloud Run :
**`https://novaclients-<identifiant>.<région>.run.app`**, avec HTTPS. Le nom du
service détermine le début de l'adresse — d'où `novaclients`. Rien à acheter,
rien à enregistrer.

## À lire avant de commencer

### Le pare-feu est le seul vrai obstacle

Les serveurs SQL n'ont aucune ouverture vers Internet. Ils acceptent les
adresses explicitement autorisées et les ressources Azure. Cloud Run sort avec
des adresses Google, **et ces adresses changent** : aucune règle de pare-feu ne
peut les couvrir telles quelles.

La seule solution propre est de forcer tout le trafic sortant à passer par une
**adresse fixe** (Cloud NAT), puis de faire **ajouter cette unique adresse au
pare-feu de PROD et d'INT**.

> Cette règle doit être ajoutée par la personne responsable des bases. Elle
> ouvre la production à une adresse hors d'Azure : c'est une décision de
> sécurité. **Rien ne fonctionnera tant qu'elle n'est pas en place** —
> l'application démarrera normalement, affichera la page de connexion, et
> échouera silencieusement au premier appel SQL.

Il n'existe pas de contournement : autoriser les plages d'adresses de Google
reviendrait à ouvrir la base à l'ensemble de leurs clients.

### Ce que cela coûte

L'essai Google Cloud (300 $ sur 90 jours) couvre tout. Au-delà :

| Poste | Ordre de grandeur |
|---|---|
| **Cloud NAT** — l'adresse fixe | **~30 $/mois**, facturé à l'heure |
| Adresse IP réservée | ~3 $/mois |
| Cloud Run, sans instance permanente | dans le palier gratuit, à ce volume |

Cloud NAT domine, et existe **uniquement à cause de la contrainte de
pare-feu**. Vérifiez les tarifs à jour sur le simulateur Google Cloud.

## 0. Prérequis

`gcloud` installé, puis `gcloud auth login`. **Docker n'est pas nécessaire en
local** : l'image est construite par Cloud Build.

```bash
PROJET=novamap-clients
REGION=europe-west1
SERVICE=novaclients

gcloud config set project "$PROJET"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com compute.googleapis.com secretmanager.googleapis.com storage.googleapis.com
```

## 1. Le réseau et l'adresse fixe

C'est l'étape qui conditionne tout le reste.

```bash
gcloud compute networks create vpc-novaclients --subnet-mode=custom
gcloud compute networks subnets create sn-novaclients --network=vpc-novaclients --region="$REGION" --range=10.10.0.0/24

gcloud compute addresses create ip-sortie --region="$REGION"

gcloud compute routers create routeur-novaclients --network=vpc-novaclients --region="$REGION"
gcloud compute routers nats create nat-novaclients --router=routeur-novaclients --region="$REGION" --nat-external-ip-pool=ip-sortie --nat-all-subnet-ip-ranges
```

Relevez l'adresse — c'est elle, et elle seule, qui devra être autorisée :

```bash
gcloud compute addresses describe ip-sortie --region="$REGION" --format='value(address)'
```

**Transmettez-la au responsable des bases**, pour ajout au pare-feu de **PROD
et d'INT**. Vous pouvez continuer le déploiement sans attendre, mais
l'application ne lira aucune donnée tant que ce n'est pas fait.

## 2. Les secrets

Secret Manager les chiffre et journalise les accès.

```bash
for nom in SQL_PASSWORD AUTH_SECRET AZURE_AD_CLIENT_SECRET; do
  gcloud secrets create "$nom" --replication-policy=automatic
done
```

Puis, pour chacun, sans laisser la valeur dans l'historique du shell :

```bash
read -rs valeur && printf '%s' "$valeur" | gcloud secrets versions add SQL_PASSWORD --data-file=-
```

`AUTH_SECRET` se génère avec `npx auth secret`.

## 3. Les fiches issues du classeur

`data/excel-clients.json` contient les coordonnées des contacts clients. Il
n'est ni versionné, ni inclus dans l'image (voir `.dockerignore`) : il est monté
à l'exécution depuis un bucket.

```bash
gcloud storage buckets create "gs://$PROJET-donnees" --location="$REGION" --uniform-bucket-level-access

npm run excel:extract
gcloud storage cp data/excel-clients.json "gs://$PROJET-donnees/"
```

À refaire à chaque mise à jour du classeur — **sans redéployer**.

## 4. Premier déploiement, pour obtenir l'adresse

L'adresse n'est connue qu'une fois le service créé, et `NEXTAUTH_URL` doit la
contenir : on déploie donc une première fois, on relève l'adresse, puis on
complète. C'est normal, et ce n'est à faire qu'une fois.

```bash
gcloud run deploy "$SERVICE" --source . --region="$REGION" --port=8080 --memory=1Gi --cpu=1 --min-instances=0 --max-instances=3 --network=vpc-novaclients --subnet=sn-novaclients --vpc-egress=all-traffic --add-volume=name=donnees,type=cloud-storage,bucket="$PROJET-donnees" --add-volume-mount=volume=donnees,mount-path=/mnt/donnees --allow-unauthenticated --set-env-vars=SQL_PROD_SERVER=...,SQL_INT_SERVER=...,SQL_USER=...,SQL_SYSTEM_DATABASE=...,ALLOWED_EMAIL_DOMAINS=...,EXCEL_DATA_FILE=/mnt/donnees/excel-clients.json --set-secrets=SQL_PASSWORD=SQL_PASSWORD:latest
```

Relevez l'adresse publique :

```bash
URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')
echo "$URL"
```

Trois choix méritent une explication :

- `--vpc-egress=all-traffic` est **indispensable**. Sans lui, seul le trafic
  interne emprunte le réseau privé : les connexions SQL repartent avec des
  adresses quelconques, donc refusées. C'est l'oubli le plus fréquent, et il se
  manifeste par un simple délai d'attente, sans message clair.
- `--min-instances=0` laisse le service redescendre à zéro : c'est ce qui le
  maintient dans le palier gratuit. En contrepartie, la première visite après
  une période creuse attend quelques secondes le temps du démarrage. Passer à
  `1` supprime cette attente, contre une dizaine de dollars par mois.
- `--allow-unauthenticated` est nécessaire : l'authentification est assurée par
  l'application via Entra ID. Le contrôle d'accès de Cloud Run bloquerait les
  navigateurs avant même la page de connexion.

## 5. Entra ID

1. Entra ID → Inscriptions d'applications → Nouvelle inscription.
2. URI de redirection, type **Web** : l'adresse relevée ci-dessus suivie de
   `/api/auth/callback/microsoft-entra-id`
3. Relever l'ID d'application et l'ID de locataire.
4. Certificats et secrets → nouveau secret client → sa valeur alimente
   `AZURE_AD_CLIENT_SECRET`. Elle n'est affichée qu'une fois.

Sans cette étape l'application **refuse tout accès en production** : c'est
volontaire, une configuration incomplète ne doit jamais dégrader en accès
libre. L'authentification sur votre propre locataire n'entraîne aucun coût.

## 6. Second déploiement, avec l'authentification

```bash
gcloud run services update "$SERVICE" --region="$REGION" --update-env-vars=NEXTAUTH_URL="$URL",AZURE_AD_CLIENT_ID=...,AZURE_AD_TENANT_ID=... --update-secrets=AUTH_SECRET=AUTH_SECRET:latest,AZURE_AD_CLIENT_SECRET=AZURE_AD_CLIENT_SECRET:latest
```

## Vérifications

- [ ] `curl "$URL/api/health"` renvoie `{"status":"ok"}`
- [ ] La connexion redirige vers Microsoft ; un compte hors domaine autorisé
      est refusé
- [ ] Le bandeau « Mode développement » n'apparaît pas
- [ ] Une fiche client affiche des indicateurs — sinon le pare-feu n'est pas
      ouvert, ou `--vpc-egress=all-traffic` a été oublié
- [ ] L'onglet « Fiche » affiche des données — sinon, revoir l'étape 3
- [ ] Les journaux ne contiennent ni mot de passe, ni chaîne de connexion

## En cas de blocage

**Délai d'attente, ou « Cannot open server … requested by the login »** : le
pare-feu ne connaît pas l'adresse de sortie. Vérifier qu'elle correspond bien à
`ip-sortie`, et que la sortie VPC est active :

```bash
gcloud run services describe "$SERVICE" --region="$REGION" --format=yaml | grep -i egress
```

**L'onglet Fiche est vide** : le bucket n'est pas monté, ou `EXCEL_DATA_FILE`
ne pointe pas sur `/mnt/donnees/excel-clients.json`.

**Un nom de domaine plus tard ?** Cloud Run sait mapper un domaine acheté
(`gcloud beta run domain-mappings create`), avec certificat TLS automatique.
Ce n'est pas nécessaire pour fonctionner.

## Rappel

Le déploiement sur Azure App Service — [DEPLOIEMENT.md](DEPLOIEMENT.md) — ne
demande **aucune modification du pare-feu** et reste gratuit, les ressources
Azure étant déjà autorisées. C'est la seule différence de fond entre les deux
voies, mais elle est structurante.
