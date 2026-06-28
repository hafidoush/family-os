import { useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { pullAll, installDexieHooks, startRealtime, stopRealtime, pushRecord, drainQueue, setHooksSuppressed, softDeleteRecord } from './syncService'
import { db } from '../db/database'
import { v4 as uuid } from 'uuid'
import { loadOpenAIKeyFromCloud } from '../ai/openaiService'
import { repairCatalogueProduits } from '../db/seed'

// ── Push de TOUTES les données locales vers Supabase ─────────────────────────
// Filet de sécurité : tourne 1 fois par heure max (les hooks couvrent les écritures en temps réel).
// Idempotent — upsert côté Supabase, jamais de doublon.
const PUSH_ALL_INTERVAL_MS = 60 * 60 * 1000
const PUSH_ALL_KEY = 'sync.lastPushAllAt'

export async function pushAllLocalData(force = false) {
  if (!force) {
    const row = await db.parametresSync.where('cle').equals(PUSH_ALL_KEY).first()
    if (row && Date.now() - new Date(row.valeur).getTime() < PUSH_ALL_INTERVAL_MS) return
  }

  const now = new Date()
  const existing = await db.parametresSync.where('cle').equals(PUSH_ALL_KEY).first()
  if (existing) {
    await db.parametresSync.update(existing.id, { valeur: now.toISOString(), updatedAt: now, derniereModification: now })
  } else {
    await db.parametresSync.add({ id: uuid(), cle: PUSH_ALL_KEY, valeur: now.toISOString(), derniereModification: now, createdAt: now, updatedAt: now })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const push = async (table: string, records: any[]) => {
    if (!records.length) return
    for (let i = 0; i < records.length; i += 10) {
      await Promise.all(records.slice(i, i + 10).map((r: Record<string, unknown>) => pushRecord(table, r)))
    }
  }

  const f  = (r: { deletedAt?: unknown }) => !r.deletedAt
  const fR = (r: { deletedAt?: unknown; nom?: unknown }) => !r.deletedAt && !!r.nom
  const fI = (r: { deletedAt?: unknown; recette?: unknown; produit?: unknown }) => !r.deletedAt && !!r.recette && !!r.produit

  try { await push('recettes',            await db.recettes.filter(fR).toArray()) } catch(e) { console.warn('[sync] pushAll recettes', e) }
  try { await push('recettesIngredients', await db.recettesIngredients.filter(fI).toArray()) } catch(e) { console.warn('[sync] pushAll recettesIngredients', e) }
  try { await push('produits',            await db.produits.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll produits', e) }
  try { await push('categoriesProduits', await db.categoriesProduits.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll categoriesProduits', e) }
  try { await push('menus',               await db.menus.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll menus', e) }
  try { await push('menuSlots',           await db.menuSlots.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll menuSlots', e) }
  try { await push('membres',             await db.membres.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll membres', e) }
  try { await push('enfants',             await db.enfants.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll enfants', e) }
  try { await push('taches',              await db.taches.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll taches', e) }
  try { await push('evenements',          await db.evenements.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll evenements', e) }
  try { await push('pieces',              await db.pieces.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll pieces', e) }
  try { await push('coursesItems',        await db.coursesItems.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll coursesItems', e) }
  try { await push('activites',           await db.activites.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll activites', e) }
  try { await push('competences',         await db.competences.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll competences', e) }
  try { await push('competencesSuivi',    await db.competencesSuivi.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll competencesSuivi', e) }
  try { await push('routines',            await db.routines.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll routines', e) }
  try { await push('routineItems',        await db.routineItems.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll routineItems', e) }
  try { await push('projetsMaison',       await db.projetsMaison.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll projetsMaison', e) }
  try { await push('notes',               await db.notes.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll notes', e) }
  try { await push('humeurs',             await db.humeurs.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll humeurs', e) }
  try { await push('pensees',             await db.pensees.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll pensees', e) }
  try { await push('programmesAnnuels',   await db.programmesAnnuels.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll programmesAnnuels', e) }
  try { await push('activitesProgramme',  await db.activitesProgramme.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll activitesProgramme', e) }
}

// Supprime de Supabase les catégories produits avec vieux IDs UUID (non stables)
// Doit tourner APRÈS pushAllLocalData pour garantir que les produits réparés sont déjà sur Supabase
async function purgeUUIDCategoriesProduits() {
  const toutes = await db.categoriesProduits.toArray()
  const uuids = toutes.filter(c => !c.id.startsWith('cat-prod-'))
  for (const c of uuids) {
    await softDeleteRecord('categoriesProduits', c.id)
  }
  if (uuids.length > 0) console.log(`[sync] purgeUUIDCategoriesProduits: ${uuids.length} catégorie(s) UUID supprimées de Supabase`)
}

// Purge les tombstones écrits par l'ancien bug softDeleteRecord (data = {id} seulement)
// setHooksSuppressed(true) : ces suppressions sont LOCALES uniquement — on ne veut PAS
// déclencher softDeleteRecord sur Supabase, sinon des ingrédients valides seraient détruits.
async function cleanupLocalTombstones() {
  // Suppression locale uniquement — ne pas déclencher softDeleteRecord sur Supabase
  // On sauvegarde l'état précédent pour ne pas écraser un isPulling déjà actif
  const prev = false // isPulling est false ici (hooks pas encore en cours d'opération)
  setHooksSuppressed(true)
  try {
    const produitsTombstones = await db.produits.filter(p => !p.nom).toArray()
    if (produitsTombstones.length) await db.produits.bulkDelete(produitsTombstones.map(p => p.id))

    const ingTombstones = await db.recettesIngredients.filter(i => !i.recette || !i.produit).toArray()
    if (ingTombstones.length) await db.recettesIngredients.bulkDelete(ingTombstones.map(i => i.id))
  } finally {
    setHooksSuppressed(prev)
  }
}

export function useSyncOnMount() {
  const { session } = useAuth()

  useEffect(() => {
    if (!session) return

    installDexieHooks()
    loadOpenAIKeyFromCloud()

    const safe = (fn: () => Promise<void>, name: string) =>
      fn().catch(e => console.warn(`[sync] ${name} failed:`, e))

    // pullAll EN PREMIER : récupère les dernières versions distantes avant de pousser le local.
    // Évite qu'un device pousse ses vieilles données par-dessus une version plus récente sur Supabase.
    safe(cleanupLocalTombstones, 'cleanupLocalTombstones')
      .then(() => pullAll())
      .then(() => repairCatalogueProduits().catch(e => console.warn('[sync] repairCatalogueProduits non-fatal:', e)))
      .then(() => safe(drainQueue, 'drainQueue'))
      .then(() => safe(pushAllLocalData, 'pushAllLocalData'))
      .then(() => purgeUUIDCategoriesProduits().catch(e => console.warn('[sync] purgeUUIDCategoriesProduits non-fatal:', e)))

    startRealtime()

    function handleOnline() {
      drainQueue().then(() => pullAll())
    }
    window.addEventListener('online', handleOnline)

    const interval = setInterval(() => {
      if (navigator.onLine) drainQueue().then(() => pullAll())
    }, 5 * 60 * 1000)

    return () => {
      stopRealtime()
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [session?.user.id])
}
