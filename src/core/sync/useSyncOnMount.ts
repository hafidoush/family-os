import { useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { pullAll, installDexieHooks, startRealtime, stopRealtime, pushRecord, drainQueue } from './syncService'
import { db } from '../db/database'
import { v4 as uuid } from 'uuid'

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

export function useSyncOnMount() {
  const { session } = useAuth()

  useEffect(() => {
    if (!session) return

    installDexieHooks()

    // Démarrage : rejouer les pushes en attente puis faire un pull complet
    pushInitialActivites()
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
