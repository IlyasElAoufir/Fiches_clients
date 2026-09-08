import type { EnvId } from '@/config/environments'

/** Une ligne NOVA_CLIENT : un client dans un environnement donné. */
export interface ClientInstance {
  /** NOVA_CLIENT.CLT_ID_CLIENT */
  id: number
  /** NOVA_CLIENT.CLT_LI_NOM_CLIENT */
  name: string
  /** NOVA_CLIENT.AGT_CO_AGENT_PREFIX — le trigramme */
  code: string
  /** NOVA_CLIENT.CTL_TYPE_ENVIRONEMENT, normalisé */
  env: EnvId
  /** Base résolue côté serveur, ou null si non résoluble */
  database: string | null
  /** D'où vient la résolution — sert à afficher le niveau de confiance */
  databaseSource: 'view' | 'dashboard' | 'mapping' | null
  organisationId: number | null
  hasIcon: boolean
  userQuota: number | null
  agentCount: number
}

/** Un organisme : regroupe ses instances PROD / INT sous un même trigramme. */
export interface ClientOrganisation {
  /** Trigramme, sert d'identifiant d'URL */
  code: string
  /** Nom d'affichage, dérivé de l'instance de production */
  name: string
  instances: ClientInstance[]
  /** Environnements réellement disponibles pour cet organisme */
  availableEnvs: EnvId[]
  hasIcon: boolean
  totalAgents: number
}

/** Un utilisateur rattaché à un client (NOVA_AGENT ⋈ NOVA_AGENT_CLIENT). */
export interface ClientUser {
  login: string
  lastName: string
  firstName: string
  email: string
  phone: string | null
  mobile: string | null
  /**
   * Dérivé de AGT_DT_FIN, PAS de AGT_ISALLOW.
   * Verifie sur le client pilote : AGT_ISALLOW vaut 0 pour 97 % des agents, y
   * compris pour des utilisateurs connectés la veille — ce n'est donc pas un
   * indicateur d'activité. AGT_DT_FIN utilise 2090-12-31 comme sentinelle
   * « pas de date de fin ».
   */
  isActive: boolean
  /** NOVA_AGENT.AGT_DT_FIN — date de sortie (null ou 2090 ⇒ actif) */
  endDate: string | null
  /** Nombre de droits accordés (NOVA_GROUP_MEMBER.GRP_IS_GRANTED = 1) */
  permissionCount: number
  /** NOVA_AGENT_CLIENT.AGT_DT_LAST_CONNECT */
  lastConnect: string | null
  /** NOVA_AGENT.AGT_IS_NOVA_ACCOUNT — compte interne Novamap */
  isNovaAccount: boolean
  /** NOVA_AGENT.AGT_AD_OBJECTID non nul ⇒ compte fédéré Entra ID */
  isFederated: boolean
}

export interface PagedResult<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

/**
 * Un KPI affiché. `source` documente précisément d'où vient le chiffre : la
 * règle du projet est de n'afficher une métrique que si on peut l'expliquer.
 */
export interface Kpi {
  key: string
  label: string
  value: number | null
  /** Table et filtre qui produisent la valeur, affichés dans l'interface */
  source: string
  /** Précision affichée sous le libellé quand la sémantique mérite une nuance */
  note?: string
}

export interface NamedCount {
  name: string
  value: number
}

/** Point d'historique issu de DASHBOARD_CLIENT. */
export interface DashboardHistoryPoint {
  date: string
  users: number | null
  connections: number | null
  equipment: number | null
  blocks: number | null
  lots: number | null
  tenants: number | null
  claims: number | null
}

export interface ClientDashboard {
  /** KPI calculés en direct dans la base du client */
  kpis: Kpi[]
  equipmentByType: NamedCount[]
  patrimony: NamedCount[]
  history: DashboardHistoryPoint[]
  /** false si la base client était injoignable — la page reste affichable */
  liveDataAvailable: boolean
  liveDataError?: string
}

/** Module activé pour un client (NOVA_MODULE ⋈ NOVA_MODULE_CLIENT). */
export interface ClientModule {
  code: string
  label: string
  /** NOVA_DOMAINE_ACTIVITE.DAC_LI_DOMAINE_ACTIVITE — sert au regroupement */
  domain: string | null
  active: boolean
}

// --- Fiche Excel -----------------------------------------------------------

export interface ExcelContact {
  role: string
  nom?: string
  prenom?: string
  poste?: string
  email?: string
  emailExploitation?: string
  tel?: string
  portable?: string
}

export interface ExcelClientSheet {
  sheet: string
  clientName: string
  aSupprimer: boolean
  format: 'LEGACY' | 'NOUVEAU'
  identite: Record<string, string>
  application: Record<string, string | Record<string, string>>
  environnements: Record<string, string | boolean | Record<string, string>>
  materiel: Record<string, string>
  notes: Record<string, string>
  contacts: ExcelContact[]
  modules: Record<string, boolean>
  resolved: { dbProd: string; dbInt: string }
  _anomalies?: string[]
}
