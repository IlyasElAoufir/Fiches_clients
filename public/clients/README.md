# Logos clients

Ce dossier permet de **surcharger** le logo d'un client.

## Comment ça marche

La route `/api/clients/[code]/logo` résout le logo dans cet ordre :

1. **Un fichier de ce dossier**, nommé `<trigramme en minuscules>.<ext>`
2. **`NOVA_CLIENT.CLT_BIN_ICON_CLIENT`** — l'icône déjà stockée en base
   (présente pour 112 clients sur 131 en production)
3. **Les initiales** du client, sur une pastille de couleur stable

Vous n'avez donc **rien à faire** pour la plupart des clients : leur logo vient
déjà de la base. Ce dossier ne sert qu'à corriger un logo de mauvaise qualité,
ou à en fournir un pour un client qui n'en a pas en base.

## Ajouter ou remplacer un logo

Déposez le fichier ici, nommé d'après le trigramme du client **en minuscules** :

```
public/clients/abc.png     → client de trigramme ABC
public/clients/sth.png     → Sarthe Habitat
public/clients/msl.svg     → Mésolia
```

Le trigramme est celui affiché sur la card et dans l'onglet Technique
(`AGT_CO_AGENT_PREFIX`).

Extensions acceptées, dans cet ordre de priorité :
`.png` · `.svg` · `.jpg` · `.jpeg` · `.webp`

## Recommandations

- **Format** : PNG ou SVG à fond transparent
- **Taille** : environ 256 × 256 px, le logo étant affiché dans un carré
- **Cadrage** : le logo est contenu (`object-contain`) et centré, sans
  déformation — pas besoin de le recadrer au pixel près

Aucune image cassée ne s'affiche jamais : si le fichier est illisible ou absent,
l'interface bascule automatiquement sur les initiales.
