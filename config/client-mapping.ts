/**
 * =========================================================================
 * MAPPINGS EXPLICITES
 * =========================================================================
 *
 * Ce fichier contient les correspondances qui NE PEUVENT PAS être déduites
 * de façon fiable. Le principe du projet : plutôt qu'un rapprochement
 * approximatif, une configuration explicite et relue.
 *
 * Rien ici n'est deviné par le code. Une entrée ajoutée est une décision.
 */

// ---------------------------------------------------------------------------
// 1. Bases non résolues par NovamapSystemDB
// ---------------------------------------------------------------------------

/**
 * `CLT_LI_DB_CONNECTION` est chiffrée pour environ deux tiers des clients :
 * la vue VW_NOVA_CLIENT_BASE ne peut alors rien extraire. DASHBOARD_CLIENT
 * comble la majorité des trous, mais 39 clients — surtout des bases INT non
 * monitorées — restent sans base résolue.
 *
 * Clé   : NOVA_CLIENT.CLT_ID_CLIENT
 * Valeur: nom exact de la base
 *
 * Les valeurs ci-dessous proviennent de « Fiches Clients.xlsx » et doivent
 * être confirmées avant d'être décommentées. Tant qu'une entrée est absente,
 * l'application affiche « base non résolue » plutôt qu'un chiffre faux.
 *
 * Pour vérifier une base avant de l'ajouter :
 *   python tools/inspect/06_client_db.py INT <nom_base>
 */
export const DB_MAPPING_OVERRIDES: Record<number, string> = {
  // --- Candidats a confirmer ----------------------------------------------
  // Le depot etant public, la liste des correspondances issues du classeur
  // est conservee hors depot, dans « mappings-a-confirmer.local.txt ».
  // Format d'une entree, une fois la base verifiee :
  //   1234: 'nom-de-base-int',   // NOM DU CLIENT (INT)
}

// ---------------------------------------------------------------------------
// 2. Correspondance fiche Excel → trigramme client
// ---------------------------------------------------------------------------

/**
 * Le rapprochement Excel ↔ NOVA_CLIENT se fait normalement sur le trigramme,
 * puis sur le nom de base. Ce tableau ne sert qu'aux cas où ni l'un ni
 * l'autre ne permet de conclure.
 *
 * Clé   : nom exact de la feuille Excel
 * Valeur: AGT_CO_AGENT_PREFIX correspondant
 *
 * Cas traités ici :
 *  - fiches sans trigramme renseigné (12 feuilles) ;
 *  - trigramme de l'Excel différent de celui de NOVA_CLIENT ;
 *  - erreur de saisie dans l'Excel.
 */
export const EXCEL_SHEET_TO_CODE: Record<string, string> = {
  // Fiche sans trigramme exploitable : la cellule « Prefix User SQL »
  // contient « LF-SQL-VIEW » (un login de vue SQL), rejeté à l'extraction.
  // Exemple : 'Nom exact de la feuille Excel': 'TRIGRAMME',

  // Fiches sans trigramme renseigné, rapprochées par le nom de base
  'Est Métropole Habitat': 'EMH', // primrose
  Incité: 'INC', // turing
  "Les résidences de l'Orléanais": 'RO', // lion — l'Excel indique « lyon »
  "Logement Familial de l'Eure": 'LFE', // dozer
  'Logis Cévenols': 'LC', // smith
  // Exemple : 'Nom de la feuille': 'TRIGRAMME',
  'Société Dauphinoise Habitat': 'SDH', // vince
  'Toulouse Métropole Habitat': 'TMH', // athena

  // Trigramme différent entre l'Excel et NOVA_CLIENT
  Assemblia: 'LGD',
  'OFFICE AUXERROIS DE L’HABITAT': 'OAH',
  Ozanam: 'OZM',
  Valophis: 'VL',
  Erilia: 'LGM',
  'Saone et Loire': 'OSL',
  'Toulon Habitat': 'TOU',

  // Fiche au modèle non rempli (trigramme resté à « XXX »)
  // 'Troyes Aube Habitat': '???',
}

/**
 * Feuilles Excel volontairement ignorées : ni clients, ni exploitables.
 * « Mdp Admin » contient des mots de passe en clair et n'est jamais ouverte
 * par l'extracteur.
 */
export const IGNORED_EXCEL_SHEETS = new Set([
  'Mdp Admin',
  'Index',
  'Modèle fiche (nouveau)',
  'Robot IPA',
])
