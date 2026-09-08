# Déploiement sur Google Cloud

Cible : **Cloud Run**, domaine **novaclients.fr**.

## À lire avant de commencer

### Le pare-feu est le point dur

Les serveurs SQL n'ont aucune ouverture vers Internet. Ils acceptent les
adresses explicitement autorisées et les ressources Azure. Cloud Run sort avec
des adresses Google, **et par défaut ces adresses changent** : aucune règle de
pare-feu ne peut donc les couvrir.

La solution est de forcer tout le trafic sortant à passer par une **adresse
fixe** (Cloud NAT), puis de faire **ajouter cette seule adresse au pare-feu de
PROD et d'INT**.

> Cette règle doit être ajoutée par la personne responsable des bases. Elle
> ouvre la production à une adresse située hors d'Azure : c'est une décision de
> sécurité, à prendre en connaissance de cause. **Rien ne fonctionnera tant
> qu'elle n'est pas en place** — l'application démarrera normalement mais
> échouera à joindre les bases.

### Ce que cela coûte réellement

L'essai Google Cloud (300 $ sur 90 jours) couvre tout ce qui suit. Au-delà :

| Poste | Ordre de grandeur |
|---|---|
| Cloud NAT (l'adresse fixe) | ~30 $/mois, facturé à l'heure |
| Cloud Run, 1 instance permanente | ~10 à 15 $/mois |
| Adresse IP réservée | ~3 $/mois |
| Domaine novaclients.fr | ~12 €/an |

Le poste dominant, Cloud NAT, existe **uniquement à cause de la contrainte de
pare-feu**. Vérifiez les tarifs à jour sur le simulateur Google Cloud.

## 0. Prérequis

- Le domaine **novaclients.fr doit être acheté** — il n'est pas enregistré à ce
  jour. N'importe quel bureau d'enregistrement convient.
- `gcloud` installé, puis `gcloud auth login`

```bash
PROJET=novamap-clients
REGION=europe-west1          # Belgique : proche, et gère le mappage de domaine
SERVICE=novaclients

gcloud config set project "$PROJET"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com compute.googleapis.com secretmanager.googleapis.com storage.googleapis.com
```

## 1. Le réseau et l'adresse fixe

C'est l'étape qui conditionne tout le reste.

```bash
# Réseau privé
gcloud compute networks create vpc-novaclients --subnet-mode=custom
gcloud compute networks subnets create sn-novaclients --network=vpc-novaclients --region="$REGION" --range=10.10.0.0/24

# Adresse de sortie fixe
gcloud compute addresses create ip-sortie --region="$REGION"

# Routeur + Cloud NAT : tout le trafic sortant passera par cette adresse
gcloud compute routers create routeur-novaclients --network=vpc-novaclients --region="$REGION"
gcloud compute routers nats create nat-novaclients --router=routeur-novaclients --region="$REGION" --nat-external-ip-pool=ip-sortie --nat-all-subnet-ip-ranges
```

Relevez l'adresse — c'est elle qui devra être autorisée :

```bash
gcloud compute addresses describe ip-sortie --region="$REGION" --format='value(address)'
```

**Transmettez cette adresse au responsable des bases**, pour ajout au pare-feu
de **PROD et d'INT**. Sans cela, arrêtez-vous ici : la suite se déploiera mais
ne pourra rien lire.

## 2. Les secrets

Secret Manager les chiffre et journalise les accès. Ne jamais les passer en
variable d'environnement en clair.

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
n'est ni versionné, ni inclus dans l'image (voir `.dockerignore`) : il est
monté à l'exécution depuis un bucket.

```bash
gcloud storage buckets create "gs://$PROJET-donnees" --location="$REGION" --uniform-bucket-level-access

npm run excel:extract
gcloud storage cp data/excel-clients.json "gs://$PROJET-donnees/"
```

À refaire à chaque mise à jour du classeur — **sans redéployer**, l'application
relit le fichier.

## 4. Déploiement

Remplacez les `...` par vos valeurs, puis lancez depuis la racine du dépôt :

```bash
gcloud run deploy "$SERVICE" --source . --region="$REGION" --port=8080 --memory=1Gi --cpu=1 --min-instances=1 --max-instances=3 --network=vpc-novaclients --subnet=sn-novaclients --vpc-egress=all-traffic --add-volume=name=donnees,type=cloud-storage,bucket="$PROJET-donnees" --add-volume-mount=volume=donnees,mount-path=/mnt/donnees --allow-unauthenticated --set-env-vars=SQL_PROD_SERVER=...,SQL_INT_SERVER=...,SQL_USER=...,SQL_SYSTEM_DATABASE=...,ALLOWED_EMAIL_DOMAINS=...,AZURE_AD_CLIENT_ID=...,AZURE_AD_TENANT_ID=...,NEXTAUTH_URL=https://novaclients.fr,EXCEL_DATA_FILE=/mnt/donnees/excel-clients.json --set-secrets=SQL_PASSWORD=SQL_PASSWORD:latest,AUTH_SECRET=AUTH_SECRET:latest,AZURE_AD_CLIENT_SECRET=AZURE_AD_CLIENT_SECRET:latest
```

Trois choix méritent une explication :

- `--vpc-egress=all-traffic` est **indispensable**. Sans lui, seul le trafic
  interne emprunte le réseau privé : les connexions SQL repartent avec des
  adresses quelconques, donc refusées par le pare-feu. C'est l'oubli le plus
  fréquent, et il se manifeste par un simple délai d'attente.
- `--min-instances=1` garde une instance chaude en permanence. C'est ce qui
  donne le 24/7 sans démarrage à froid — et c'est aussi ce qui coûte. À `0`,
  c'est presque gratuit, mais chaque première visite attend quelques secondes.
- `--allow-unauthenticated` est nécessaire : l'authentification est assurée par
  l'application via Entra ID. Le contrôle d'accès de Cloud Run bloquerait les
  navigateurs avant même d'atteindre la page de connexion.

## 5. Entra ID

1. Entra ID → Inscriptions d'applications → Nouvelle inscription.
2. URI de redirection, type **Web** :
   `https://novaclients.fr/api/auth/callback/microsoft-entra-id`
3. Relever l'ID d'application et l'ID de locataire.
4. Certificats et secrets → nouveau secret client → la valeur alimente
   `AZURE_AD_CLIENT_SECRET` (étape 2). Elle n'est affichée qu'une fois.

Sans cette étape l'application **refuse tout accès en production** : c'est
volontaire, une configuration incomplète ne doit jamais dégrader en accès
libre. L'authentification sur votre propre locataire n'entraîne aucun coût.

## 6. Le domaine

```bash
gcloud beta run domain-mappings create --service="$SERVICE" --domain=novaclients.fr --region="$REGION"
```

Google demande d'abord de prouver que le domaine vous appartient, puis affiche
les enregistrements DNS à créer chez le bureau d'enregistrement. Le certificat
TLS est ensuite émis et renouvelé automatiquement.

Si le mappage n'est pas proposé dans la région retenue, l'alternative est un
équilibreur de charge global avec un NEG sans serveur : plus souple, environ
18 $/mois de plus.

## Vérifications

- [ ] `curl https://novaclients.fr/api/health` renvoie `{"status":"ok"}`
- [ ] La connexion redirige vers Microsoft ; un compte hors domaine autorisé
      est refusé
- [ ] Le bandeau « Mode développement » n'apparaît pas
- [ ] Une fiche client affiche des indicateurs — sinon le pare-feu n'est pas
      ouvert, ou `--vpc-egress=all-traffic` a été oublié
- [ ] L'onglet « Fiche » affiche des données — sinon, revoir l'étape 3
- [ ] Les journaux ne contiennent ni mot de passe, ni chaîne de connexion

## En cas de blocage

**« Cannot open server … requested by the login »**, ou délai d'attente : le
pare-feu ne connaît pas l'adresse de sortie. Vérifier qu'elle correspond bien à
`ip-sortie`, et que la sortie VPC est bien active :

```bash
gcloud run services describe "$SERVICE" --region="$REGION" --format=yaml | grep -i egress
```

**L'onglet Fiche est vide** : le bucket n'est pas monté, ou `EXCEL_DATA_FILE`
ne pointe pas sur `/mnt/donnees/excel-clients.json`.

## Rappel

Le déploiement sur Azure App Service — décrit dans [DEPLOIEMENT.md](DEPLOIEMENT.md) —
ne demande **aucune modification du pare-feu**, les ressources Azure étant déjà
autorisées. C'est la seule différence de fond entre les deux voies, mais elle
est structurante.
