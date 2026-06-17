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
  croissanceMesures:        'croissance_mesures',
  sessionsPreparation:      'sessions_preparation',
  competences:              'competences',
  competencesSuivi:         'competences_suivi',
  elementsReligion:         'elements_religion',
  wishlistItems:            'wishlist_items',
  enveloppes:               'enveloppes',
  transactions:             'transactions',
  programmesPedagogiques:   'programmes_pedagogiques',
  activitesProgramme:       'activites_programme',
}

const DEXIE_TABLES = Object.keys(TABLE_MAP)

// ── Push un enregistrement vers Supabase ──────────────────────────────────────
export async function pushRecord(dexieTable: string, record: Record<string, unknown>) {
  const supaTable = TABLE_MAP[dexieTable]
  if (!supaTable) return

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const { error } = await supabase
    .from(supaTable)
    .upsert({
      id:         record.id,
      user_id:    session.user.id,
      data:       record,
      updated_at: new Date().toISOString(),
      deleted_at: record.deletedAt ? new Date(record.deletedAt as string).toISOString() : null,
    }, { onConflict: 'id' })

  if (error) console.warn(`[sync] push ${dexieTable}:`, error.message)
}

// ── Soft-delete sur Supabase ──────────────────────────────────────────────────
export async function softDeleteRecord(dexieTable: string, id: string) {
  const supaTable = TABLE_MAP[dexieTable]
  if (!supaTable) return

  const { error } = await supabase
    .from(supaTable)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) console.warn(`[sync] delete ${dexieTable}:`, error.message)
}

// ── Pull initial : Supabase → Dexie ──────────────────────────────────────────
export async function pullAll() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  for (const dexieTable of DEXIE_TABLES) {
    const supaTable = TABLE_MAP[dexieTable]

    const { data, error } = await supabase
      .from(supaTable)
      .select('id, data, deleted_at')
      .eq('user_id', session.user.id)
      .is('deleted_at', null)

    if (error) {
      console.warn(`[sync] pull ${dexieTable}:`, error.message)
      continue
    }
    if (!data?.length) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (db as any)[dexieTable]
    if (!table) continue

    const records = data.map((row: { data: Record<string, unknown> }) => row.data)
    await table.bulkPut(records)
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
    table.hook('deleting', (key: string) => {
      softDeleteRecord(dexieTable, key as string)
    })
  }
}

// ── Realtime : Supabase → Dexie en temps réel ────────────────────────────────
let realtimeChannel: RealtimeChannel | null = null

export function startRealtime() {
  if (realtimeChannel) return

  realtimeChannel = supabase.channel('family-os-sync')

  for (const dexieTable of DEXIE_TABLES) {
    const supaTable = TABLE_MAP[dexieTable]

    realtimeChannel.on(
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
          await table.put(row.data)
        }
      }
    )
  }

  realtimeChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') console.log('[sync] realtime actif')
  })
}

export function stopRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
}
