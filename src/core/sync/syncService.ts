/**
 * SyncService — synchronisation bidirectionnelle Dexie ↔ Supabase
 *
 * Stratégie :
 *   - Pull au démarrage : fetch toutes les lignes Supabase → upsert Dexie
 *   - Push auto : hooks Dexie interceptent chaque écriture → push Supabase
 *   - Realtime : subscription Supabase → applique les changements distants dans Dexie
 *
 * Tables synchronisées (8 prioritaires) :
 *   recettes, recettesIngredients, menus, menuSlots,
 *   coursesItems, membres, evenements, taches, pensees
 */

import { supabase } from '../supabase/client'
import { db } from '../db/database'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { addToQueue, removeFromQueue, getQueue, setLastPullAt, setLastError, clearLastError } from './syncQueue'

// Guard : empêche les hooks Dexie de re-pousser vers Supabase pendant un pullAll
// (sinon bulkDelete déclenche softDeleteRecord qui écrase le champ data avec { id })
let isPulling = false

// Champs Blob non sérialisables en JSON — exclus du push, préservés au pull
// avatar est désormais stocké en base64 (string) et se synchronise normalement
const BLOB_FIELDS: Record<string, string[]> = {}

// Mapping nom de table Dexie → nom de table Supabase
const TABLE_MAP: Record<string, string> = {
  recettes:                 'recettes',
  recettesIngredients:      'recettes_ingredients',
  menus:                    'menus',
  menuSlots:                'menu_slots',
  coursesItems:             'courses_items',
  membres:                  'membres',
  evenements:               'evenements',
  taches:                   'taches',
  pensees:                  'pensees',
  humeurs:                  'humeurs',
  activites:                'activites',
  planificationsActivites:  'planifications_activites',
  pieces:                   'pieces',
  projetsMaison:            'projets_maison',
  souvenirs:                'souvenirs',
  reunionsFamille:          'reunions_famille',
  routines:                 'routines',
  routineItems:             'routine_items',
  enfants:                  'enfants',
  notes:                    'notes',
  selfCareItems:            'self_care_items',
  sportSessions:            'sport_sessions',
  sessionsPreparation:      'sessions_preparation',
  competences:              'competences',
  competencesSuivi:         'competences_suivi',
  elementsReligion:         'elements_religion',
  wishlistItems:            'wishlist_items',
  enveloppes:               'enveloppes',
  transactions:             'transactions',
  programmesPedagogiques:   'programmes_pedagogiques',
  activitesProgramme:       'activites_programme',
  programmesAnnuels:        'programmes_annuels',
  produits:                 'produits',
  categoriesRecettes:       'categories_recettes',
  categoriesActivites:      'categories_activites',
  tags:                     'tags',
  categoriesProduits:       'categories_produits',
  evenementsDetails:        'evenements_details',
  sortiesPersonnelles:      'sorties_personnelles',
}

const DEXIE_TABLES = Object.keys(TABLE_MAP)

// ── Push un enregistrement vers Supabase ──────────────────────────────────────
export async function pushRecord(dexieTable: string, record: Record<string, unknown>) {
  const supaTable = TABLE_MAP[dexieTable]
  if (!supaTable) return

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  // Exclure les champs Blob — non sérialisables en JSON
  const blobFields = BLOB_FIELDS[dexieTable] ?? []
  const data = blobFields.length
    ? Object.fromEntries(Object.entries(record).filter(([k]) => !blobFields.includes(k)))
    : record

  const { error } = await supabase
    .from(supaTable)
    .upsert({
      id:         record.id,
      user_id:    session.user.id,
      data,
      updated_at: new Date().toISOString(),
      deleted_at: record.deletedAt ? new Date(record.deletedAt as string).toISOString() : null,
    }, { onConflict: 'id' })

  if (error) {
    console.warn(`[sync] push ${dexieTable}:`, error.message)
    await addToQueue(dexieTable, record.id as string, error.message)
    await setLastError(`${dexieTable}: ${error.message}`)
  } else {
    await removeFromQueue(dexieTable, record.id as string)
  }
}

// ── Soft-delete sur Supabase ──────────────────────────────────────────────────
// Upsert (pas update) : crée un tombstone même si la ligne n'existait pas encore
// dans Supabase (cas des enregistrements seedés ou créés hors-ligne)
export async function softDeleteRecord(dexieTable: string, id: string) {
  const supaTable = TABLE_MAP[dexieTable]
  if (!supaTable) return

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const now = new Date().toISOString()
  const { error } = await supabase
    .from(supaTable)
    .upsert({
      id,
      user_id: session.user.id,
      data: { id },
      updated_at: now,
      deleted_at: now,
    }, { onConflict: 'id' })

  if (error) console.warn(`[sync] delete ${dexieTable}:`, error.message)
}

// ── Pull initial : Supabase → Dexie ──────────────────────────────────────────
export async function pullAll() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  isPulling = true
  try {
  for (const dexieTable of DEXIE_TABLES) {
    const supaTable = TABLE_MAP[dexieTable]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (db as any)[dexieTable]
    if (!table) continue

    // 1. Supprimer localement les enregistrements effacés sur Supabase
    const { data: deleted } = await supabase
      .from(supaTable)
      .select('id')
      .eq('user_id', session.user.id)
      .not('deleted_at', 'is', null)

    if (deleted?.length) {
      await table.bulkDelete(deleted.map((r: { id: string }) => r.id))
    }

    // 2. Récupérer et appliquer les enregistrements vivants
    const { data, error } = await supabase
      .from(supaTable)
      .select('id, data, updated_at, deleted_at')
      .eq('user_id', session.user.id)
      .is('deleted_at', null)

    if (error) {
      console.warn(`[sync] pull ${dexieTable}:`, error.message)
      continue
    }
    if (!data?.length) continue

    // Charger les enregistrements locaux + la file d'attente pour la résolution de conflits
    const existing = await table.toArray()
    const localMap = new Map<string, Record<string, unknown>>(
      existing.map((r: Record<string, unknown>) => [r.id as string, r])
    )

    // IDs en attente de push : ne jamais les écraser depuis Supabase
    const pendingQueue = await getQueue()
    const pendingIds = new Set(
      pendingQueue.filter(q => q.table === dexieTable).map(q => q.id)
    )

    let records = data
      .filter((row: { id: string; updated_at: string; data: Record<string, unknown> }) => {
        // Modification locale non encore envoyée — priorité absolue au local
        if (pendingIds.has(row.id)) return false
        const local = localMap.get(row.id)
        if (!local) return true // nouvel enregistrement → accepter
        // Remote gagne seulement s'il est strictement plus récent
        const localUpdatedAt = local.updatedAt instanceof Date
          ? local.updatedAt.toISOString()
          : String(local.updatedAt ?? '')
        return row.updated_at > localUpdatedAt
      })
      .map((row: { data: Record<string, unknown> }) => row.data)

    // Préserver les champs Blob locaux (non synchronisés via Supabase)
    const blobFields = BLOB_FIELDS[dexieTable]
    if (blobFields?.length) {
      records = records.map((r: Record<string, unknown>) => {
        const local = localMap.get(r.id as string)
        if (!local) return r
        const preserved = Object.fromEntries(
          blobFields
            .filter(f => local[f] instanceof Blob)
            .map(f => [f, local[f]])
        )
        return { ...r, ...preserved }
      })
    }

    await table.bulkPut(records)
  }

  await setLastPullAt()
  await clearLastError()
  } finally {
    isPulling = false
  }
}

// ── Hooks Dexie : intercepte toutes les écritures ────────────────────────────
let hooksInstalled = false

export function installDexieHooks() {
  if (hooksInstalled) return
  hooksInstalled = true

  for (const dexieTable of DEXIE_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (db as any)[dexieTable]
    if (!table) continue

    table.hook('creating', (_key: string, obj: Record<string, unknown>) => {
      pushRecord(dexieTable, obj)
    })

    table.hook('updating', (mods: Record<string, unknown>, _key: string, obj: Record<string, unknown>) => {
      pushRecord(dexieTable, { ...obj, ...mods })
    })

    // Soft delete : on ne supprime jamais physiquement côté Supabase
    // Guard isPulling : évite d'écraser les données Supabase pendant un pullAll
    table.hook('deleting', (key: string) => {
      if (isPulling) return
      softDeleteRecord(dexieTable, key as string)
    })
  }
}

// ── Realtime : Supabase → Dexie en temps réel ────────────────────────────────
let realtimeChannel: RealtimeChannel | null = null
let realtimeRetryTimeout: ReturnType<typeof setTimeout> | null = null
let realtimeRetryDelay = 5000 // ms, doublé à chaque échec (max 60s)

function buildRealtimeChannel() {
  const channel = supabase.channel('family-os-sync')

  for (const dexieTable of DEXIE_TABLES) {
    const supaTable = TABLE_MAP[dexieTable]

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: supaTable },
      async (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const table = (db as any)[dexieTable]
        if (!table) return

        if (payload.eventType === 'DELETE') {
          await table.delete(payload.old.id)
          return
        }

        const row = payload.new as { data: Record<string, unknown>; deleted_at: string | null }
        if (!row.data) return

        if (row.deleted_at) {
          await table.delete(row.data.id)
        } else {
          const blobFields = BLOB_FIELDS[dexieTable]
          if (blobFields?.length) {
            const local = await table.get(row.data.id)
            if (local) {
              blobFields.forEach(f => {
                if (local[f] instanceof Blob) row.data[f] = local[f]
              })
            }
          }
          await table.put(row.data)
        }
      }
    )
  }

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('[sync] realtime actif')
      realtimeRetryDelay = 5000 // reset backoff après succès
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      console.warn(`[sync] realtime ${status} — reconnexion dans ${realtimeRetryDelay / 1000}s`)
      realtimeChannel = null
      if (realtimeRetryTimeout) clearTimeout(realtimeRetryTimeout)
      // Defer removeChannel to exit the current subscribe callback stack first (prevents infinite recursion)
      setTimeout(() => {
        supabase.removeChannel(channel)
        realtimeRetryTimeout = setTimeout(() => {
          realtimeRetryDelay = Math.min(realtimeRetryDelay * 2, 60_000)
          startRealtime()
        }, realtimeRetryDelay)
      }, 0)
    }
  })

  return channel
}

export function startRealtime() {
  if (realtimeChannel) return
  realtimeChannel = buildRealtimeChannel()
}

// ── Rejoue les pushes échoués ─────────────────────────────────────────────────
export async function drainQueue(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const queue = await getQueue()
  if (queue.length === 0) return

  console.log(`[sync] drainQueue — ${queue.length} élément(s) en attente`)

  for (const item of queue) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (db as any)[item.table]
    if (!table) continue
    const record = await table.get(item.id)
    if (record) await pushRecord(item.table, record)
  }
}

export function stopRealtime() {
  if (realtimeRetryTimeout) {
    clearTimeout(realtimeRetryTimeout)
    realtimeRetryTimeout = null
  }
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
}
