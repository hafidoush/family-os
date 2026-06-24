import { useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { pullAll, installDexieHooks, startRealtime, stopRealtime, pushRecord, drainQueue } from './syncService'
import { db } from '../db/database'
import { v4 as uuid } from 'uuid'
import { loadOpenAIKeyFromCloud } from '../ai/openaiService'

// ── Push de TOUTES les données locales vers Supabase ─────────────────────────
// Appelé au démarrage, limité à 1 fois par heure (les hooks couvrent les écritures en temps réel).
// Idempotent : upsert côté Supabase, pas de doublon possible.
const PUSH_ALL_INTERVAL_MS = 60 * 60 * 1000 // 1 heure
const PUSH_ALL_KEY = 'sync.lastPushAllAt'

export async function pushAllLocalData(force = false) {
  if (!force) {
    const row = await db.parametresSync.where('cle').equals(PUSH_ALL_KEY).first()
    if (row) {
      const age = Date.now() - new Date(row.valeur).getTime()
      if (age < PUSH_ALL_INTERVAL_MS) return
    }
  }
  const now = new Date()
  const existing = await db.parametresSync.where('cle').equals(PUSH_ALL_KEY).first()
  if (existing) {
    await db.parametresSync.update(existing.id, { valeur: now.toISOString(), updatedAt: now, derniereModification: now })
  } else {
    await db.parametresSync.add({ id: uuid(), cle: PUSH_ALL_KEY, valeur: now.toISOString(), derniereModification: now, createdAt: now, updatedAt: now })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const push = async (dexieTable: string, records: any[]) => {
    if (!records.length) return
    // Batch by 10 to avoid flooding Supabase with hundreds of parallel requests
    for (let i = 0; i < records.length; i += 10) {
      await Promise.all(records.slice(i, i + 10).map((r: Record<string, unknown>) => pushRecord(dexieTable, r)))
    }
    console.log(`[sync] pushAll ${dexieTable}: ${records.length} enregistrement(s)`)
  }
  const f = (r: { deletedAt?: unknown }) => !r.deletedAt
  // Garde supplémentaire : rejette les tombstones {id} créés par l'ancien bug softDelete
  // Un vrai enregistrement a toujours ses champs métier remplis
  const fRecette    = (r: { deletedAt?: unknown; nom?: unknown }) => !r.deletedAt && !!r.nom
  const fIngredient = (r: { deletedAt?: unknown; recette?: unknown; produit?: unknown }) => !r.deletedAt && !!r.recette && !!r.produit

  try { await push('recettes',            await db.recettes.filter(fRecette).toArray()) } catch(e) { console.warn('[sync] pushAll recettes', e) }
  try { await push('recettesIngredients', await db.recettesIngredients.filter(fIngredient).toArray()) } catch(e) { console.warn('[sync] pushAll recettesIngredients', e) }
  try { await push('menus',               await db.menus.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll menus', e) }
  try { await push('menuSlots',           await db.menuSlots.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll menuSlots', e) }
  try { await push('membres',             await db.membres.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll membres', e) }
  try { await push('enfants',             await db.enfants.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll enfants', e) }
  try { await push('taches',              await db.taches.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll taches', e) }
  try { await push('evenements',          await db.evenements.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll evenements', e) }
  try { await push('pieces',              await db.pieces.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll pieces', e) }
  try { await push('produits',            await db.produits.filter(f).toArray()) } catch(e) { console.warn('[sync] pushAll produits', e) }
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

// Push one-shot de toutes les activités seedées vers Supabase
// Garantit que les IDs stables sont connus de Supabase avant le pull
async function pushInitialActivites() {
  const CLE = 'activites_pushed_v1'
  const already = await db.parametresSync.where('cle').equals(CLE).first()
  if (already) return

  const activites = await db.activites.toArray()
  await Promise.all(activites.map(a => pushRecord('activites', a as unknown as Record<string, unknown>)))

  const now = new Date()
  await db.parametresSync.put({ id: uuid(), cle: CLE, valeur: 'true', derniereModification: now, createdAt: now, updatedAt: now })
}

// Push one-shot de tous les ingrédients locaux — bulkAdd ne déclenchait pas les hooks
// v2 : passe par modify() pour déclencher les vrais hooks Dexie plutôt que pushRecord direct
async function pushInitialRecettesIngredients() {
  const CLE = 'recettes_ingredients_pushed_v2'
  const already = await db.parametresSync.where('cle').equals(CLE).first()
  if (already) return

  // modify() déclenche le hook 'updating' pour chaque enregistrement → pushRecord via le hook
  const now = new Date()
  await db.recettesIngredients
    .filter(i => !i.deletedAt)
    .modify({ updatedAt: now })

  await db.parametresSync.put({ id: uuid(), cle: CLE, valeur: 'true', derniereModification: now, createdAt: now, updatedAt: now })
}

// Push one-shot des produits locaux — table Supabase créée après coup
async function pushInitialProduits() {
  const CLE = 'produits_pushed_v1'
  const already = await db.parametresSync.where('cle').equals(CLE).first()
  if (already) return

  const produits = await db.produits.toArray()
  await Promise.all(produits.map(p => pushRecord('produits', p as unknown as Record<string, unknown>)))

  const now = new Date()
  await db.parametresSync.put({ id: uuid(), cle: CLE, valeur: 'true', derniereModification: now, createdAt: now, updatedAt: now })
}

// Push one-shot des programmes annuels locaux — nécessaire après ajout de la table Supabase
async function pushInitialProgrammesAnnuels() {
  const CLE = 'programmes_annuels_pushed_v1'
  const already = await db.parametresSync.where('cle').equals(CLE).first()
  if (already) return

  const programmes = await db.programmesAnnuels.toArray()
  await Promise.all(programmes.map(p => pushRecord('programmesAnnuels', p as unknown as Record<string, unknown>)))

  const now = new Date()
  await db.parametresSync.put({ id: uuid(), cle: CLE, valeur: 'true', derniereModification: now, createdAt: now, updatedAt: now })
}

// Dédoublonnage des produits — tourne à chaque démarrage (pas en one-shot)
// Problème cross-appareils : le seed génère des UUIDs aléatoires, donc "farine" a
// des IDs différents sur chaque device. Cette fonction fusionne les doublons par nom
// ET re-pointe les ingrédients vers l'ID conservé pour réparer les références cassées.
async function deduplicateProduits() {
  const produits = await db.produits.filter(p => !p.deletedAt && !p.archive && !!p.nom).toArray()

  // Grouper par nom normalisé
  const groupes = new Map<string, typeof produits>()
  for (const p of produits) {
    const cle = (p.nom ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle)!.push(p)
  }

  const now = new Date()
  for (const groupe of groupes.values()) {
    if (groupe.length <= 1) continue
    // Priorité aux IDs stables (seed-prod-*) — sinon garder le plus ancien
    groupe.sort((a, b) => {
      const aStable = a.id.startsWith('seed-prod-') ? 0 : 1
      const bStable = b.id.startsWith('seed-prod-') ? 0 : 1
      if (aStable !== bStable) return aStable - bStable
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
    const keeper = groupe[0]
    const doublons = groupe.slice(1)
    for (const doublon of doublons) {
      // Re-pointer tous les ingrédients qui référencent l'ID supprimé vers l'ID conservé
      await db.recettesIngredients
        .where('produit').equals(doublon.id)
        .modify({ produit: keeper.id, updatedAt: now })
      await db.produits.update(doublon.id, { deletedAt: now, updatedAt: now, archive: true })
    }
  }
}

// Migration : donne des IDs stables aux produits seedés (seed-prod-${nom})
// Problème cross-appareils : le seed générait des UUIDs aléatoires → chaque device avait
// des IDs différents pour "basilic", "farine", etc. → les ingrédients des recettes ne se
// résolvaient pas sur l'autre appareil. Cette migration tourne à chaque démarrage (idempotente).
async function migrateProduitToStableIds() {
  const normStr = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const stableId = (nom: string) => `seed-prod-${normStr(nom)}`

  const seeded = await db.produits.filter(p => (p as { deviceId?: string }).deviceId === 'seed' && !p.deletedAt && !!p.nom).toArray()
  const toMigrate = seeded.filter(p => p.id !== stableId(p.nom))
  if (!toMigrate.length) return

  console.log(`[sync] migrateProduitToStableIds: ${toMigrate.length} produit(s) à migrer`)
  const now = new Date()

  for (const p of toMigrate) {
    const stable = stableId(p.nom)
    // Ajouter le produit avec l'ID stable s'il n'existe pas encore
    const existing = await db.produits.get(stable)
    if (!existing) {
      await db.produits.add({ ...p, id: stable, updatedAt: now } as typeof p)
    }
    // Re-pointer tous les ingrédients qui référencent l'ancien ID
    await db.recettesIngredients
      .where('produit').equals(p.id)
      .modify({ produit: stable, updatedAt: now })
    // Supprimer l'ancien ID (le hook softDeleteRecord marquera l'ancien UUID comme supprimé dans Supabase)
    await db.produits.delete(p.id)
  }
  console.log(`[sync] migrateProduitToStableIds: terminé`)
}

// Purge les tombstones {id} écrits dans Dexie par l'ancien bug softDeleteRecord
// Doit tourner en PREMIER pour éviter tout crash sur .nom dans le reste du démarrage
async function cleanupLocalTombstones() {
  const produitsTombstones = await db.produits.filter(p => !p.nom).toArray()
  if (produitsTombstones.length) {
    await db.produits.bulkDelete(produitsTombstones.map(p => p.id))
    console.log(`[sync] cleanup: ${produitsTombstones.length} produit(s) tombstone supprimés de Dexie`)
  }
  const ingTombstones = await db.recettesIngredients.filter(i => !i.recette || !i.produit).toArray()
  if (ingTombstones.length) {
    await db.recettesIngredients.bulkDelete(ingTombstones.map(i => i.id))
    console.log(`[sync] cleanup: ${ingTombstones.length} ingrédient(s) tombstone supprimés de Dexie`)
  }
}


export function useSyncOnMount() {
  const { session } = useAuth()

  useEffect(() => {
    if (!session) return

    installDexieHooks()
    loadOpenAIKeyFromCloud()

    // Démarrage : push TOUT le local vers Supabase d'abord, puis pull
    // Garantit que rien n'est jamais perdu même si le cache a été vidé entre deux sessions
    const safe = (fn: () => Promise<void>, name: string) =>
      fn().catch(e => console.warn(`[sync] ${name} failed (continuing):`, e))

    safe(cleanupLocalTombstones, 'cleanupLocalTombstones')
      .then(() => safe(migrateProduitToStableIds, 'migrateProduitToStableIds'))
      .then(() => safe(pushAllLocalData, 'pushAllLocalData'))
      .then(() => safe(pushInitialActivites, 'pushInitialActivites'))
      .then(() => safe(pushInitialRecettesIngredients, 'pushInitialRecettesIngredients'))
      .then(() => safe(pushInitialProduits, 'pushInitialProduits'))
      .then(() => safe(pushInitialProgrammesAnnuels, 'pushInitialProgrammesAnnuels'))
      .then(() => safe(deduplicateProduits, 'deduplicateProduits'))
      .then(() => safe(drainQueue, 'drainQueue'))
      .then(() => pullAll())

    startRealtime()

    // Retour en ligne : rejouer la file + pull complet
    function handleOnline() {
      console.log('[sync] retour en ligne — drain + pull')
      drainQueue().then(() => pullAll())
    }
    window.addEventListener('online', handleOnline)

    // Pull périodique toutes les 5 minutes si l'app reste ouverte
    const interval = setInterval(() => {
      if (navigator.onLine) pullAll()
    }, 5 * 60 * 1000)

    return () => {
      stopRealtime()
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [session?.user.id])
}
