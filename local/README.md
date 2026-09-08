# Utilisation locale

L'application tourne sur ce poste, sans hébergement ni compte cloud.

## Les raccourcis

| Raccourci | Effet |
|---|---|
| **Novamap Clients** (bureau) | Ouvre l'application. Démarre le serveur s'il ne tourne pas. |
| **Novamap Clients - Arreter** (bureau) | Arrête le serveur. |
| **Novamap Clients (service)** (démarrage) | Lance le serveur à l'ouverture de session, sans ouvrir de navigateur. |

Adresse : <http://127.0.0.1:3000>

## Ce que « tourne en permanence » signifie ici

Le serveur démarre à l'ouverture de session et tourne tant que le poste est
allumé. **Il s'arrête quand le poste s'éteint ou se met en veille.** C'est la
limite d'un hébergement local : pour une disponibilité réelle et indépendante
du poste, il faut un hébergement — voir [DEPLOIEMENT.md](../DEPLOIEMENT.md).

## Accès : ce poste uniquement

Le serveur écoute sur `127.0.0.1`, donc **uniquement depuis cette machine**.
C'est délibéré, et c'est la seule protection qui reste : sans Entra ID
configuré, l'application démarre en mode développement, où l'accès local est
autorisé sans authentification. Il n'y a donc ni page de connexion, ni
déconnexion — elles n'auraient rien à protéger sur un poste. En contrepartie,
le serveur ne sort pas de la machine.

**En production, le comportement est inchangé** : l'authentification Entra ID
est exigée, et une configuration incomplète fait refuser l'accès au lieu de
l'ouvrir.

Conséquence : **vos collègues ne peuvent pas s'y connecter.** Leur donner accès
suppose soit un hébergement, soit la configuration d'Entra ID.

Le mode développement est aussi plus lent qu'un serveur de production : chaque
page est compilée à la première visite.

## Retirer le démarrage automatique

Supprimer le raccourci dans :

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
```

Ou : `Win+R`, puis `shell:startup`.

## Si l'application ne s'ouvre pas

1. Vérifier que le port 3000 est libre :
   `netstat -ano | findstr :3000`
2. Lancer le script en fenêtre visible pour lire l'erreur :
   `powershell -NoProfile -ExecutionPolicy Bypass -File local\demarrer.ps1`
3. Une erreur « Variable d'environnement manquante » signifie que `.env.local`
   est absent ou incomplet — voir [.env.example](../.env.example).
