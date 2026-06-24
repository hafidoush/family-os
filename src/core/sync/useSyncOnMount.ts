import { useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { pullAll, installDexieHooks, startRealtime, stopRealtime, pushRecord, drainQueue } from './syncService'
import { db } from '../db/database'
import { v4 as uuid } from 'uuid'
import { loadOpenAIKeyFromCloud } from '../ai/openaiService'
import { supabase } from '../supabase/client'

// ── Push de TOUTES les données locales vers Supabase ─────────────────────────
// Appelé à chaque démarrage pour garantir que rien ne reste bloqué en local.
// Idempotent : upsert côté Supabase, pas de doublon possible.
async function pushAllLocalData() {
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

// Dédoublonnage one-shot des produits — garde le plus ancien, supprime les copies
async function deduplicateProduits() {
  const CLE = 'produits_deduplicated_v2'
  const already = await db.parametresSync.where('cle').equals(CLE).first()
  if (already) return

  const produits = await db.produits.filter(p => !p.deletedAt && !p.archive).toArray()

  // Grouper par nom normalisé
  const groupes = new Map<string, typeof produits>()
  for (const p of produits) {
    const cle = p.nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle)!.push(p)
  }

  const now = new Date()
  for (const groupe of groupes.values()) {
    if (groupe.length <= 1) continue
    // Garder le plus ancien (createdAt le plus petit), supprimer les autres
    groupe.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const doublons = groupe.slice(1)
    await Promise.all(doublons.map(d =>
      db.produits.update(d.id, { deletedAt: now, updatedAt: now, archive: true })
    ))
  }

  await db.parametresSync.put({ id: uuid(), cle: CLE, valeur: 'true', derniereModification: now, createdAt: now, updatedAt: now })
}

// Restaure automatiquement produits + ingrédients si la table locale est vide
// mais que Supabase en a avec deleted_at (cas du bug softDelete)
// Restaure systématiquement produits + ingrédients marqués deleted_at dans Supabase
// Idempotent : ne fait rien si aucun enregistrement n'est marqué supprimé
async function autoRestoreIfEmpty() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const [{ count: cp }, { count: ci }] = await Promise.all([
    supabase.from('produits').select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id).not('deleted_at', 'is', null),
    supabase.from('recettes_ingredients').select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id).not('deleted_at', 'is', null),
  ])

  if (cp && cp > 0) {
    await supabase.from('produits').update({ deleted_at: null })
      .eq('user_id', session.user.id).not('deleted_at', 'is', null)
    console.log(`[sync] autoRestore: ${cp} produit(s) restaurés`)
  }
  if (ci && ci > 0) {
    await supabase.from('recettes_ingredients').update({ deleted_at: null })
      .eq('user_id', session.user.id).not('deleted_at', 'is', null)
    console.log(`[sync] autoRestore: ${ci} ingrédient(s) restaurés`)
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
    autoRestoreIfEmpty()
      .then(() => pushAllLocalData())
      .then(() => pushInitialActivites())
      .then(() => pushInitialRecettesIngredients())
      .then(() => pushInitialProduits())
      .then(() => pushInitialProgrammesAnnuels())
      .then(() => deduplicateProduits())
      .then(() => drainQueue())
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
