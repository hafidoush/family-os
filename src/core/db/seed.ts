import { v4 as uuid } from 'uuid'
import { db, withAudit } from './database'
import { supabase } from '../supabase/client'
import { getNocesLabel } from '../../shared/utils/noces'
import type {
  CategorieRecette, CategorieActivite,
  Membre, Enfant, Piece, Competence, Activite, CompetenceSuivi, Produit, Evenement,
} from '@shared/types'

// Normalisation nom pour recherche floue
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Incrémenter à chaque fois que le catalogue produits est mis à jour
// → force tous les appareils existants à recevoir les nouveaux produits
const CATALOG_VERSION = '4'
const CATALOG_VERSION_KEY = 'family_os_catalog_version'

// ID stable déterministe pour les activités seedées — identique sur tous les appareils
function stableActivityId(nom: string): string {
  const slug = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60)
  return `seed-act-${slug}`
}

// Mutex pour éviter les appels concurrents (React StrictMode double-fires useEffect en dev)
let _seedPromise: Promise<void> | null = null

export function seedDatabase(): Promise<void> {
  if (_seedPromise) return _seedPromise
  _seedPromise = _seedDatabase().finally(() => { _seedPromise = null })
  return _seedPromise
}

async function _seedDatabase(): Promise<void> {
  const membresCount = await db.membres.count()
  const activitesCount = await db.activites.count()
  const competencesCount = await db.competences.count()

  // Déduplication inconditionnelle — tourne à chaque démarrage
  await dedupCategoriesRecettes()
  await dedupCategoriesProduits()
  await dedupPieces()
  // Répare les catégories produits si elles ont été effacées (ex: sync Supabase)
  await repairerCatalogueCategories()
  // Nettoie les activités programme : reporter les non-réalisées passées, sauter les trop anciennes
  await nettoyerActivitesProgramme()
  // Migration catégories produits — tourne à chaque démarrage
  await migrerCategoriesProduits()
  // Renommage "Végétarien" → "Accompagnement"
  await migrerCategorieVegetarienVersAccompagnement()
  // Renommage "Accompagnement" → "Légumes & Accompagnement"
  await migrerCategorieAccompagnementVersLegumes()
  // Standardise les IDs de catégories recettes (fix sync cross-appareils)
  await migrerCategoriesRecettesVersIDsStables()
  // Supprime la catégorie "Petit-déjeuner" (recettes déplacées vers Goûter)
  await supprimerCategoriePetitDejeuner()
  // Renommage "Entrée" → "Entrées & Salades"
  await migrerEntreeVersEntreesSalades()
  // Renommage "Légumes & Accompagnement" → "Accompagnement"
  await migrerLegumesAccompagnementVersAccompagnement()
  // Passage au pluriel de toutes les catégories singulières
  await migrerCategoriesVersPluriels()
  // Ajout catégorie "Petits déjeuners" si absente
  await ajouterCategoriePetitDejeuner()

  if (membresCount === 0) {
    console.log('[FamilyOS] Premier lancement — initialisation de la base...')
    await Promise.all([
      seedCategoriesProduits(),
      seedCategoriesRecettes(),
      seedCategoriesActivites(),
      seedPieces(),
      seedMembres(),
    ])
    console.log('[FamilyOS] Base initialisée.')
  }

  // Garantit que les catégories de recettes existent toujours
  await seedCategoriesRecettes()

  // Purge one-shot des recettes pré-enregistrées (deviceId === 'seed')
  await purgeSeededRecettes()

  // Seed activités uniquement si la table est vide — jamais d'effacement automatique
  // Ancienne logique "needsReseed sur objectifPedagogique" supprimée : trop dangereuse
  // (une seule entrée sans le champ effaçait toute la table)
  if (activitesCount === 0) {
    await seedCategoriesActivites()
    await seedActivites()
    console.log('[FamilyOS] Activités initialisées (premier lancement).')
  }

  // Migration IDs stables pour activités (corrige sync entre appareils)
  await migrateActivitesToStableIds()

  // Seed catalogue produits si absent OU si des produits seedés ont encore des UUIDs aléatoires
  // OU si le catalogue a été mis à jour depuis le dernier seed (CATALOG_VERSION)
  // Les hooks ne sont pas encore installés ici → bulkDelete ne flood pas Supabase
  const produitsCount = await db.produits.count()
  const hasUnstableIds = produitsCount > 0 &&
    !!(await db.produits.filter(p => (p as { deviceId?: string }).deviceId === 'seed' && !!p.nom && !p.id.startsWith('seed-prod-')).first())
  const storedCatalogVersion = localStorage.getItem(CATALOG_VERSION_KEY)
  const catalogOutdated = storedCatalogVersion !== CATALOG_VERSION

  if (produitsCount === 0 || hasUnstableIds) {
    if (hasUnstableIds) {
      const old = await db.produits.filter(p => (p as { deviceId?: string }).deviceId === 'seed').toArray()
      await db.produits.bulkDelete(old.map(p => p.id))
    }
    await db.categoriesProduits.clear()
    await seedCategoriesProduits()
    await seedProduitsCatalog()
    localStorage.setItem(CATALOG_VERSION_KEY, CATALOG_VERSION)
    console.log('[FamilyOS] Catalogue produits initialisé avec IDs stables.')
  } else if (catalogOutdated) {
    // Catalogue mis à jour — ajoute les nouveaux produits sans effacer les données utilisateur
    await migrerCategoriesProduits()
    await seedProduitsCatalog()
    localStorage.setItem(CATALOG_VERSION_KEY, CATALOG_VERSION)
    console.log('[FamilyOS] Catalogue produits mis à jour (v' + CATALOG_VERSION + ').')
  }

  // Purge les tâches grand ménage dupliquées (UUID aléatoires seedés sur chaque appareil)
  await dedupGrandMenageTaches()
  // Seed tâches grand ménage par pièce (idempotent via clé parametresSync)
  await seedGrandMenageTaches()

  // Seed anniversaires famille (idempotent via clé SEED_KEY)
  await seedAnniversaires()

  // Seed compétences uniquement si la table est vide — jamais d'effacement automatique
  // Ancienne logique "needsReseed sur domaine/count" supprimée : trop dangereuse
  // (effaçait les compétences ET les suivis de progression de l'enfant)
  if (competencesCount === 0) {
    await seedCompetences()
    await seedSuiviManel()
    console.log('[FamilyOS] Compétences initialisées (premier lancement).')
  }
}

async function seedCategoriesProduits(): Promise<void> {
  const existing = await db.categoriesProduits.count()
  if (existing > 0) return
  const cats: { nom: string; icone: string }[] = [
    { nom: 'Fruits & Légumes',     icone: '🥬' },
    { nom: 'Viande & Charcuterie', icone: '🥩' },
    { nom: 'Poissons',             icone: '🐟' },
    { nom: 'Épicerie salée',       icone: '🫙' },
    { nom: 'Épicerie sucrée',      icone: '🍫' },
    { nom: 'Conserves',            icone: '🥫' },
    { nom: 'Surgelés',             icone: '🧊' },
    { nom: 'Épices',               icone: '🌿' },
    { nom: 'Asiatique',            icone: '🥢' },
    { nom: 'Bio',                  icone: '🌱' },
    { nom: 'Hygiène',              icone: '🧼' },
    { nom: 'Entretien',            icone: '🧹' },
  ]
  await db.categoriesProduits.bulkAdd(
    cats.map((c, i) => ({
      id: uuid(), nom: c.nom, icone: c.icone,
      typeProduit: 'consommable' as const, ordre: i + 1, personnalisee: false,
      ...withAudit({}),
    }))
  )
}

// ─── Migration catégories produits ────────────────────────────────────────────
// Tourne à chaque démarrage. Idempotente.
async function migrerCategoriesProduits(): Promise<void> {
  const now = new Date()
  const cats = await db.categoriesProduits.toArray()
  const byNom = new Map(cats.map(c => [c.nom, c]))

  // ── 1. Séparer "Fruits & Légumes" en "Fruits" + "Légumes" ──
  const ancienne = byNom.get('Fruits & Légumes')
  if (ancienne) {
    // Légumes en premier — priorité sur les fruits pour éviter les faux positifs (poireau, pomme de terre)
    const LEGUMES_EXACTS = ['tomate','courgette','poivron','carotte','salade','epinard','brocoli','pomme de terre','patate','oignon','ail','poireau','poireaux','champignon','concombre','aubergine','radis','celeri','persil','menthe','coriandre','basilic','fenouil','navet','artichaut','asperge','endive','mache','roquette','betterave','mais','petit pois','haricot vert','chou','chou-fleur','courge','potiron','butternut','echalote','legume','courgettes','carottes','tomates','oignons','champignons','epinards','aubergines']
    const FRUITS_EXACTS  = ['banane','orange','citron','fraise','framboise','myrtille','raisin','melon','pasteque','mangue','kiwi','ananas','peche','abricot','prune','cerise','avocat','clementine','mandarine','pamplemousse','figue','grenade','litchi','noix','amande','noisette','datte','pruneaux','pommes','pomme grenadille','pomme gala','pomme golden','pomme fuji','poires','bananes','oranges','citrons','fraises']
    const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

    let fruitsId = byNom.get('Fruits')?.id
    let legumesId = byNom.get('Légumes')?.id

    if (!fruitsId) {
      fruitsId = uuid()
      await db.categoriesProduits.add({ id: fruitsId, nom: 'Fruits', icone: '🍎', typeProduit: 'consommable', ordre: 0.5, personnalisee: false, ...withAudit({}) })
    }
    if (!legumesId) {
      legumesId = uuid()
      await db.categoriesProduits.add({ id: legumesId, nom: 'Légumes', icone: '🥦', typeProduit: 'consommable', ordre: 0.7, personnalisee: false, ...withAudit({}) })
    }

    // Réaffecter les produits
    const produits = await db.produits.filter(p => !p.archive && (p.categorie === ancienne.id || (p.categorieIds ?? []).includes(ancienne.id))).toArray()
    for (const p of produits) {
      const t = n(p.nom)
      // Légumes d'abord pour éviter les faux positifs
      const isLegume = LEGUMES_EXACTS.some(m => t === n(m) || t.startsWith(n(m) + ' '))
      const isFruit  = !isLegume && FRUITS_EXACTS.some(m => t === n(m) || t.startsWith(n(m) + ' '))
      const newId = isLegume ? legumesId : isFruit ? fruitsId : legumesId
      await db.produits.update(p.id, { categorie: newId, categorieIds: [newId], updatedAt: now })
    }

    // Supprimer l'ancienne catégorie
    await db.categoriesProduits.delete(ancienne.id)
  }

  // ── 2. Ajouter les catégories manquantes ──
  const catsActuelles = await db.categoriesProduits.toArray()
  const nomsExistants = new Set(catsActuelles.map(c => c.nom))
  const maxOrdre = Math.max(...catsActuelles.map(c => c.ordre ?? 0), 12)

  const nouvelles: Array<{ nom: string; icone: string }> = [
    { nom: 'Produits Laitiers',  icone: '🥛' },
    { nom: 'Fromages',           icone: '🧀' },
    { nom: 'Herbes & Aromates',  icone: '🌿' },
    { nom: 'Boulangerie',        icone: '🍞' },
    { nom: 'Boissons',           icone: '🧃' },
    { nom: 'Entretien',          icone: '🧹' },
  ]
  let offset = 1
  for (const cat of nouvelles) {
    if (!nomsExistants.has(cat.nom)) {
      await db.categoriesProduits.add({ id: uuid(), nom: cat.nom, icone: cat.icone, typeProduit: 'consommable', ordre: maxOrdre + offset, personnalisee: false, ...withAudit({}) })
      offset++
    }
  }

  // ── 3. Seeder les produits laitiers ──
  const catsFinales = await db.categoriesProduits.toArray()
  const laitierCat = catsFinales.find(c => c.nom === 'Produits Laitiers')
  if (laitierCat) {
    const existing = await db.produits.filter(p => !p.archive && !!p.nom).toArray()
    const existingNoms = new Set(existing.map(p => p.nom.toLowerCase()))
    const produits = [
      'Lait entier','Lait demi-écrémé','Beurre salé','Beurre doux',
      'Crème fraîche épaisse','Crème liquide entière',
      'Fromage râpé','Emmental','Parmesan','Comté','Feta','Camembert',
      'Brie','Roquefort','Mozzarella fraîche','Mozzarella râpée',
      'Burrata','Ricotta','Mascarpone','Fromage blanc','Fromage en tranches',
      'Babybel','Saint-Maure de Touraine','Yaourt nature','Yaourt grec',
      'Petit-suisse','Kéfir','Œufs',
    ]
    for (const nom of produits) {
      if (existingNoms.has(nom.toLowerCase())) continue
      await db.produits.add({
        id: uuid(), nom,
        nomNormalise: nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
        type: 'consommable', categorie: laitierCat.id, categorieIds: [laitierCat.id],
        archive: false, deviceId: 'seed', ...withAudit({}),
      })
    }
  }
}

async function dedupCategoriesRecettes(): Promise<void> {
  const all = await db.categoriesRecettes.toArray()
  if (all.length === 0) return

  // Compte les recettes par catégorie
  const recettes = await db.recettes.toArray()
  const countByCat = new Map<string, number>()
  for (const r of recettes) {
    if (r.categorie) countByCat.set(r.categorie, (countByCat.get(r.categorie) ?? 0) + 1)
  }

  // Groupe par nom
  const byNom = new Map<string, typeof all>()
  for (const cat of all) {
    const groupe = byNom.get(cat.nom) ?? []
    groupe.push(cat)
    byNom.set(cat.nom, groupe)
  }

  const toDelete: string[] = []
  for (const [, groupe] of byNom) {
    if (groupe.length <= 1) continue
    // Garde celle qui a le plus de recettes ; en cas d'égalité, la plus ancienne
    groupe.sort((a, b) => {
      const countA = countByCat.get(a.id) ?? 0
      const countB = countByCat.get(b.id) ?? 0
      if (countB !== countA) return countB - countA // plus de recettes en premier
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
    // Le premier est celui à garder, tous les autres sont supprimés
    const [keepCat, ...dupCats] = groupe
    // Réassigne les recettes qui pointaient vers les doublons → catégorie gardée
    for (const dup of dupCats) {
      const orphelines = recettes.filter((r) => r.categorie === dup.id)
      if (orphelines.length > 0) {
        await Promise.all(
          orphelines.map((r) =>
            db.recettes.update(r.id, { categorie: keepCat.id, updatedAt: new Date() })
          )
        )
      }
      toDelete.push(dup.id)
    }
  }

  if (toDelete.length > 0) await db.categoriesRecettes.bulkDelete(toDelete)
}

// ─── Réparation catalogue produits ────────────────────────────────────────────
// Si les catégories principales ont disparu (sync Supabase écrasant la base locale),
// on les recrée sans toucher aux catégories et produits déjà présents.
async function nettoyerActivitesProgramme(): Promise<void> {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString().split('T')[0]

  const programmes = await db.programmesPedagogiques
    .where('statut').equals('actif')
    .filter(p => !p.archive && !p.deletedAt)
    .toArray()

  for (const prog of programmes) {
    const debut = new Date(prog.dateDebut)
    const semaineCourante = Math.max(1, Math.floor((today.getTime() - debut.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1)

    const activites = await db.activitesProgramme
      .where('programmeId').equals(prog.id)
      .filter(a => !a.archive && !a.deletedAt && a.statutRealisation !== 'realise' && a.statutRealisation !== 'saute')
      .toArray()

    for (const a of activites) {
      // Activité placée sur un jour passé mais non réalisée → reporter (effacer la date)
      if (a.datePlanifiee && a.datePlanifiee < todayISO) {
        await db.activitesProgramme.update(a.id, { datePlanifiee: undefined, statutRealisation: 'a_faire', updatedAt: new Date() })
      }
      // Activité de semaine trop ancienne (> 3 semaines de retard) → sauter silencieusement
      else if (!a.datePlanifiee && a.semaineNumero < semaineCourante - 2) {
        await db.activitesProgramme.update(a.id, { statutRealisation: 'saute', updatedAt: new Date() })
      }
    }
  }
}

async function repairerCatalogueCategories(): Promise<void> {
  const cats = await db.categoriesProduits.toArray()
  const noms = new Set(cats.map(c => c.nom))

  const categoriesPrincipales = [
    'Viande & Charcuterie', 'Poissons', 'Épicerie salée',
    'Épicerie sucrée', 'Conserves', 'Surgelés', 'Épices',
  ]
  const aucunePrincipale = categoriesPrincipales.every(n => !noms.has(n))

  // On a aussi le cas "split déjà effectué" : Fruits + Légumes sans Fruits & Légumes
  const splitFait = noms.has('Fruits') || noms.has('Légumes')
  const fruitsLegumesMissing = !noms.has('Fruits & Légumes') && !splitFait

  if (!aucunePrincipale && !fruitsLegumesMissing) return

  console.log('[FamilyOS] Catégories produits incomplètes — restauration en cours...')

  // Catégories à ajouter si absentes (seedCategoriesProduits a une guard "if existing > 0"
  // donc on insère manuellement les manquantes)
  const maxOrdre = Math.max(...cats.map(c => c.ordre ?? 0), 0)
  const aAjouter: Array<{ nom: string; icone: string }> = [
    { nom: 'Fruits & Légumes',     icone: '🥬' },
    { nom: 'Viande & Charcuterie', icone: '🥩' },
    { nom: 'Poissons',             icone: '🐟' },
    { nom: 'Épicerie salée',       icone: '🫙' },
    { nom: 'Épicerie sucrée',      icone: '🍫' },
    { nom: 'Conserves',            icone: '🥫' },
    { nom: 'Surgelés',             icone: '🧊' },
    { nom: 'Épices',               icone: '🌿' },
    { nom: 'Asiatique',            icone: '🥢' },
    { nom: 'Bio',                  icone: '🌱' },
    { nom: 'Hygiène',              icone: '🧼' },
    { nom: 'Entretien',            icone: '🧹' },
  ]

  let offset = 1
  for (const cat of aAjouter) {
    if (!noms.has(cat.nom)) {
      await db.categoriesProduits.add({
        id: uuid(), nom: cat.nom, icone: cat.icone,
        typeProduit: 'consommable' as const,
        ordre: maxOrdre + offset,
        personnalisee: false,
        ...withAudit({}),
      })
      offset++
    }
  }

  // Re-seeder les produits si la base est presque vide
  const produitsCount = await db.produits.filter(p => !p.archive && !p.deletedAt).count()
  if (produitsCount < 30) {
    await seedProduitsCatalog()
    console.log('[FamilyOS] Produits restaurés.')
  }
}

async function dedupCategoriesProduits(): Promise<void> {
  const all = await db.categoriesProduits.toArray()
  if (all.length === 0) return

  const byNom = new Map<string, typeof all>()
  for (const cat of all) {
    const groupe = byNom.get(cat.nom) ?? []
    groupe.push(cat)
    byNom.set(cat.nom, groupe)
  }

  const toDelete: string[] = []
  for (const [, groupe] of byNom) {
    if (groupe.length <= 1) continue
    // Garde la plus ancienne (produits n'ont pas de recettes à réassigner)
    groupe.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const [, ...dups] = groupe
    toDelete.push(...dups.map((c) => c.id))
  }

  if (toDelete.length > 0) await db.categoriesProduits.bulkDelete(toDelete)
}

async function dedupPieces(): Promise<void> {
  const all = await db.pieces.filter(p => p.actif && !p.deletedAt && !!p.nom).toArray()
  if (all.length === 0) return

  const byNom = new Map<string, typeof all>()
  for (const piece of all) {
    const key = piece.nom.toLowerCase().trim()
    const groupe = byNom.get(key) ?? []
    groupe.push(piece)
    byNom.set(key, groupe)
  }

  for (const [, groupe] of byNom) {
    if (groupe.length <= 1) continue
    // Garde la plus ancienne, désactive les doublons
    groupe.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const [, ...dups] = groupe
    await Promise.all(dups.map(p => db.pieces.update(p.id, { actif: false, updatedAt: new Date() })))
    console.log(`[FamilyOS] Doublons pièce "${groupe[0].nom}" : ${dups.length} supprimé(s)`)
  }
}

async function repairRecettesOrphelines(): Promise<void> {
  const categories = await db.categoriesRecettes.toArray()
  if (categories.length === 0) return

  const validIds = new Set(categories.map(c => c.id))
  const toutes = await db.recettes.toArray()
  const orphelines = toutes.filter(r => r.categorie && !validIds.has(r.categorie))
  if (orphelines.length === 0) return

  // Catégorie de secours : "Plats principaux" ou la première disponible
  const fallback = categories.find(c => c.nom === 'Plats principaux') ?? categories.find(c => c.nom === 'Plat principal') ?? categories[0]
  await Promise.all(
    orphelines.map(r =>
      db.recettes.update(r.id, { categorie: fallback.id, updatedAt: new Date() })
    )
  )
  console.log(`[FamilyOS] ${orphelines.length} recette(s) orpheline(s) réparée(s) → "${fallback.nom}"`)
}

async function migrerCategorieVegetarienVersAccompagnement(): Promise<void> {
  const cat = await db.categoriesRecettes.filter(c => c.nom === 'Végétarien').first()
  if (cat) {
    await db.categoriesRecettes.update(cat.id, { nom: 'Accompagnement', icone: '🥗', updatedAt: new Date() })
  }
}

async function migrerCategorieAccompagnementVersLegumes(): Promise<void> {
  const cat = await db.categoriesRecettes.filter(c => c.nom === 'Accompagnement').first()
  if (cat) {
    await db.categoriesRecettes.update(cat.id, { nom: 'Légumes & Accompagnement', icone: '🥦', updatedAt: new Date() })
  }
}

async function seedCategoriesRecettes(): Promise<void> {
  const requises: CategorieRecette[] = [
    { id: 'cat-recette-petit-dejeuner',         nom: 'Petits déjeuners',         icone: '🥐', ordre: 0, ...withAudit({}) },
    { id: 'cat-recette-plat-principal',         nom: 'Plats principaux',         icone: '🍽️', ordre: 1, ...withAudit({}) },
    { id: 'cat-recette-entree',                 nom: 'Entrées & Salades',        icone: '🥗', ordre: 2, ...withAudit({}) },
    { id: 'cat-recette-dessert',                nom: 'Desserts',                 icone: '🍰', ordre: 3, ...withAudit({}) },
    { id: 'cat-recette-gouter',                 nom: 'Goûters',                  icone: '🧁', ordre: 4, ...withAudit({}) },
    { id: 'cat-recette-soupe',                  nom: 'Soupes',                   icone: '🍲', ordre: 5, ...withAudit({}) },
    { id: 'cat-recette-sauce',                  nom: 'Sauces',                   icone: '🫕', ordre: 6, ...withAudit({}) },
    { id: 'cat-recette-legumes-accompagnement', nom: 'Accompagnements',          icone: '🥦', ordre: 7, ...withAudit({}) },
    { id: 'cat-recette-boissons',               nom: 'Boissons',                 icone: '🥤', ordre: 8, ...withAudit({}) },
  ]

  // Ajoute uniquement les catégories manquantes par ID — ne touche pas aux existantes
  for (const cat of requises) {
    const existe = await db.categoriesRecettes.get(cat.id)
    if (!existe) {
      await db.categoriesRecettes.add(cat)
    }
  }
}

// IDs stables pour toutes les catégories recettes par défaut
const STABLE_CATS_RECETTES: Record<string, { id: string; icone: string; ordre: number }> = {
  'Petits déjeuners':        { id: 'cat-recette-petit-dejeuner',         icone: '🥐', ordre: 0 },
  'Petit déjeuner':          { id: 'cat-recette-petit-dejeuner',         icone: '🥐', ordre: 0 },
  'Plats principaux':        { id: 'cat-recette-plat-principal',         icone: '🍽️', ordre: 1 },
  'Plat principal':          { id: 'cat-recette-plat-principal',         icone: '🍽️', ordre: 1 },
  'Entrées & Salades':       { id: 'cat-recette-entree',                 icone: '🥗', ordre: 2 },
  'Entrée':                  { id: 'cat-recette-entree',                 icone: '🥗', ordre: 2 },
  'Desserts':                { id: 'cat-recette-dessert',                icone: '🍰', ordre: 3 },
  'Dessert':                 { id: 'cat-recette-dessert',                icone: '🍰', ordre: 3 },
  'Goûters':                 { id: 'cat-recette-gouter',                 icone: '🧁', ordre: 4 },
  'Goûter':                  { id: 'cat-recette-gouter',                 icone: '🧁', ordre: 4 },
  'Soupes':                  { id: 'cat-recette-soupe',                  icone: '🍲', ordre: 5 },
  'Soupe':                   { id: 'cat-recette-soupe',                  icone: '🍲', ordre: 5 },
  'Sauces':                  { id: 'cat-recette-sauce',                  icone: '🫕', ordre: 6 },
  'Sauce':                   { id: 'cat-recette-sauce',                  icone: '🫕', ordre: 6 },
  'Accompagnements':         { id: 'cat-recette-legumes-accompagnement', icone: '🥦', ordre: 7 },
  'Accompagnement':          { id: 'cat-recette-legumes-accompagnement', icone: '🥦', ordre: 7 },
  'Légumes & Accompagnement':{ id: 'cat-recette-legumes-accompagnement', icone: '🥦', ordre: 7 },
  'Boissons':                { id: 'cat-recette-boissons',               icone: '🥤', ordre: 8 },
}

async function migrerCategoriesRecettesVersIDsStables(): Promise<void> {
  const now = new Date()
  const allCats = await db.categoriesRecettes.toArray()
  if (allCats.length === 0) return

  for (const [nom, { id: stableId, icone, ordre }] of Object.entries(STABLE_CATS_RECETTES)) {
    const matching = allCats.filter(c => c.nom === nom)
    if (matching.length === 0) continue

    const nonStable = matching.filter(c => c.id !== stableId)
    if (nonStable.length === 0) continue

    const alreadyStable = matching.find(c => c.id === stableId)
    if (!alreadyStable) {
      const source = matching[0]
      try {
        await db.categoriesRecettes.add({ ...source, id: stableId, icone, ordre, updatedAt: now })
      } catch { /* déjà présent */ }
    }

    for (const old of nonStable) {
      const affected = await db.recettes.where('categorie').equals(old.id).toArray()
      if (affected.length > 0) {
        await Promise.all(
          affected.map(r => db.recettes.update(r.id, { categorie: stableId, updatedAt: now }))
        )
      }
      await db.categoriesRecettes.delete(old.id)
    }
  }

  // Garantit que Boissons existe sur les appareils anciens
  const boissons = await db.categoriesRecettes.get('cat-recette-boissons')
  if (!boissons) {
    await db.categoriesRecettes.add({
      id: 'cat-recette-boissons', nom: 'Boissons', icone: '🥤', ordre: 8, ...withAudit({}),
    })
  }
}

async function supprimerCategoriePetitDejeuner(): Promise<void> {
  const cat = await db.categoriesRecettes.filter(c => c.nom === 'Petit-déjeuner').first()
  if (!cat) return
  const now = new Date()
  const gouter = await db.categoriesRecettes.get('cat-recette-gouter')
    ?? await db.categoriesRecettes.filter(c => c.nom === 'Goûters').first()
    ?? await db.categoriesRecettes.filter(c => c.nom === 'Goûter').first()
    ?? await db.categoriesRecettes.filter(c => c.nom === 'Plats principaux').first()
    ?? await db.categoriesRecettes.filter(c => c.nom === 'Plat principal').first()
  if (gouter) {
    const recettes = await db.recettes.where('categorie').equals(cat.id).toArray()
    if (recettes.length > 0) {
      await Promise.all(recettes.map(r => db.recettes.update(r.id, { categorie: gouter.id, updatedAt: now })))
    }
  }
  await db.categoriesRecettes.delete(cat.id)
}

async function migrerEntreeVersEntreesSalades(): Promise<void> {
  const cat = await db.categoriesRecettes.get('cat-recette-entree')
    ?? await db.categoriesRecettes.filter(c => c.nom === 'Entrée').first()
  if (cat && cat.nom === 'Entrée') {
    await db.categoriesRecettes.update(cat.id, { nom: 'Entrées & Salades', updatedAt: new Date() })
  }
}

async function migrerLegumesAccompagnementVersAccompagnement(): Promise<void> {
  const cat = await db.categoriesRecettes.get('cat-recette-legumes-accompagnement')
    ?? await db.categoriesRecettes.filter(c => c.nom === 'Légumes & Accompagnement').first()
  if (cat && cat.nom === 'Légumes & Accompagnement') {
    await db.categoriesRecettes.update(cat.id, { nom: 'Accompagnement', icone: '🥦', updatedAt: new Date() })
  }
}

async function migrerCategoriesVersPluriels(): Promise<void> {
  const renames: Array<{ ancien: string; nouveau: string }> = [
    { ancien: 'Plat principal',          nouveau: 'Plats principaux' },
    { ancien: 'Dessert',                 nouveau: 'Desserts' },
    { ancien: 'Goûter',                  nouveau: 'Goûters' },
    { ancien: 'Soupe',                   nouveau: 'Soupes' },
    { ancien: 'Sauce',                   nouveau: 'Sauces' },
    { ancien: 'Accompagnement',          nouveau: 'Accompagnements' },
    { ancien: 'Petit déjeuner',          nouveau: 'Petits déjeuners' },
  ]
  const now = new Date()
  for (const { ancien, nouveau } of renames) {
    const cat = await db.categoriesRecettes.filter(c => c.nom === ancien).first()
    if (cat) {
      await db.categoriesRecettes.update(cat.id, { nom: nouveau, updatedAt: now })
    }
  }
}

async function ajouterCategoriePetitDejeuner(): Promise<void> {
  const existing = await db.categoriesRecettes.get('cat-recette-petit-dejeuner')
  if (existing) return
  await db.categoriesRecettes.add({
    id: 'cat-recette-petit-dejeuner',
    nom: 'Petits déjeuners',
    icone: '🥐',
    ordre: 0,
    ...withAudit({}),
  })
}

// repairRecipeCategoriesSync supprimée — effaçait toutes les recettes sur heuristique fausse

async function seedCategoriesActivites(): Promise<void> {
  const existing = await db.categoriesActivites.count()
  if (existing > 0) return
  const categories: CategorieActivite[] = [
    { id: uuid(), nom: 'Sensoriel', icone: '🪣', ordre: 1, ...withAudit({}) },
    { id: uuid(), nom: 'Motricité fine', icone: '✂️', ordre: 2, ...withAudit({}) },
    { id: uuid(), nom: 'Pré-écriture', icone: '✏️', ordre: 3, ...withAudit({}) },
    { id: uuid(), nom: 'Construction et logique', icone: '🧱', ordre: 4, ...withAudit({}) },
    { id: uuid(), nom: 'Mathématiques', icone: '🔢', ordre: 5, ...withAudit({}) },
    { id: uuid(), nom: 'Langage et prélecture', icone: '📖', ordre: 6, ...withAudit({}) },
    { id: uuid(), nom: 'Motricité globale', icone: '🤸', ordre: 7, ...withAudit({}) },
    { id: uuid(), nom: 'Nature et découverte', icone: '🌿', ordre: 8, ...withAudit({}) },
    { id: uuid(), nom: 'Vie pratique', icone: '🏠', ordre: 9, ...withAudit({}) },
    { id: uuid(), nom: 'Créativité', icone: '🎨', ordre: 10, ...withAudit({}) },
  ]
  await db.categoriesActivites.bulkAdd(categories)
}

async function seedPieces(): Promise<void> {
  const pieces: Piece[] = [
    { id: uuid(), nom: 'Cuisine', icone: '🍳', scoreProprety: 100, tauxDegradation: 5, actif: true, ...withAudit({}), deviceId: '' },
    { id: uuid(), nom: 'Salon', icone: '🛋️', scoreProprety: 100, tauxDegradation: 3, actif: true, ...withAudit({}), deviceId: '' },
    { id: uuid(), nom: 'Salle de bain', icone: '🛁', scoreProprety: 100, tauxDegradation: 6, actif: true, ...withAudit({}), deviceId: '' },
    { id: uuid(), nom: 'Chambre parentale', icone: '🛏️', scoreProprety: 100, tauxDegradation: 2, actif: true, ...withAudit({}), deviceId: '' },
    { id: uuid(), nom: 'Chambre enfants', icone: '🧸', scoreProprety: 100, tauxDegradation: 8, actif: true, ...withAudit({}), deviceId: '' },
    { id: uuid(), nom: 'Bureau', icone: '💻', scoreProprety: 100, tauxDegradation: 2, actif: true, ...withAudit({}), deviceId: '' },
    { id: uuid(), nom: 'Garage', icone: '🚗', scoreProprety: 100, tauxDegradation: 1, actif: true, ...withAudit({}), deviceId: '' },
    { id: uuid(), nom: 'Jardin', icone: '🌱', scoreProprety: 100, tauxDegradation: 2, actif: true, ...withAudit({}), deviceId: '' },
    { id: uuid(), nom: 'Buanderie', icone: '🧺', scoreProprety: 100, tauxDegradation: 3, actif: true, ...withAudit({}), deviceId: '' },
    { id: uuid(), nom: 'Cellier', icone: '📦', scoreProprety: 100, tauxDegradation: 1, actif: true, ...withAudit({}), deviceId: '' },
    { id: uuid(), nom: 'Toilettes', icone: '🚽', scoreProprety: 100, tauxDegradation: 7, actif: true, ...withAudit({}), deviceId: '' },
  ]
  await db.pieces.bulkAdd(pieces)
}

async function seedMembres(): Promise<void> {
  const now = new Date()
  const membres: Membre[] = [
    { id: 'membre-maman', prenom: 'Maman', role: 'parent', couleur: '#A78BFA', actif: true, createdAt: now, updatedAt: now, deviceId: '' },
    { id: 'membre-papa',  prenom: 'Papa',  role: 'parent', couleur: '#60A5FA', actif: true, createdAt: now, updatedAt: now, deviceId: '' },
    { id: 'membre-manel', prenom: 'Manel', role: 'enfant', couleur: '#F9A8D4', actif: true, createdAt: now, updatedAt: now, deviceId: '' },
    { id: 'membre-nawfel',prenom: 'Nawfel',role: 'enfant', couleur: '#86EFAC', actif: true, createdAt: now, updatedAt: now, deviceId: '' },
  ]
  const enfants: Enfant[] = [
    { id: 'membre-manel',  dateNaissance: '2022-10-01', createdAt: now, updatedAt: now, deviceId: '' },
    { id: 'membre-nawfel', dateNaissance: '2023-03-01', createdAt: now, updatedAt: now, deviceId: '' },
  ]
  await db.membres.bulkAdd(membres)
  await db.enfants.bulkAdd(enfants)
}

async function seedCompetences(): Promise<void> {
  const now = new Date()
  function comp(domaine: string, nom: string, ordre: number): Competence {
    return { id: uuid(), domaine: domaine as any, nom, ordreSuggere: ordre, createdAt: now, updatedAt: now }
  }
  const competences: Competence[] = [
    // 📚 Langage & Lecture
    comp('langage', 'Reconnaît les voyelles', 1),
    comp('langage', 'Reconnaît consonnes longues (f, l, m, n, r, s…)', 2),
    comp('langage', 'Reconnaît consonnes courtes (b, p, t, d, g, k)', 3),
    comp('langage', 'Fait correctement le son des lettres', 4),
    comp('langage', 'Lit syllabes CV (ma, sa, la…)', 5),
    comp('langage', 'Lit syllabes VC (am, as…)', 6),
    comp('langage', 'Lit syllabes CVC', 7),
    comp('langage', 'Lit ses premiers mots simples', 8),
    comp('langage', 'Reformule une phrase courte', 9),
    comp('langage', 'Comprend des consignes simples', 10),
    // ✍️ Pré-écriture
    comp('pre_ecriture', 'Lignes verticales', 1),
    comp('pre_ecriture', 'Lignes horizontales', 2),
    comp('pre_ecriture', 'Ponts', 3),
    comp('pre_ecriture', 'Boucles', 4),
    comp('pre_ecriture', 'Écailles', 5),
    comp('pre_ecriture', 'Suivi de pointillés', 6),
    comp('pre_ecriture', 'Colorie sans dépasser', 7),
    comp('pre_ecriture', 'Reproduit un cercle / carré', 8),
    comp('pre_ecriture', 'Découpe ligne droite', 9),
    comp('pre_ecriture', 'Découpe forme simple', 10),
    // 🔢 Mathématiques
    comp('mathematiques', 'Compte jusqu\'à 10', 1),
    comp('mathematiques', 'Compte jusqu\'à 20', 2),
    comp('mathematiques', 'Reconnaît chiffres 1–3', 3),
    comp('mathematiques', 'Reconnaît chiffres 4–6', 4),
    comp('mathematiques', 'Associe chiffre ↔ quantité', 5),
    comp('mathematiques', 'Comprend "1 de plus / 1 de moins"', 6),
    comp('mathematiques', 'Classe par taille', 7),
    comp('mathematiques', 'Classe par couleur', 8),
    comp('mathematiques', 'Classe par forme', 9),
    comp('mathematiques', 'Reproduit un algorithme', 10),
    comp('mathematiques', 'Trouve l\'intrus', 11),
    comp('mathematiques', 'Reconnaît formes 2D', 12),
    comp('mathematiques', 'Se repère : dessus/dessous', 13),
    // 🌍 Découverte du monde
    comp('decouverte_monde', 'Connaît les saisons', 1),
    comp('decouverte_monde', 'Connaît animaux de la ferme', 2),
    comp('decouverte_monde', 'Connaît animaux sauvages', 3),
    comp('decouverte_monde', 'Connaît moyens de transport', 4),
    comp('decouverte_monde', 'Connaît les planètes (simple)', 5),
    comp('decouverte_monde', 'Distingue ville / campagne', 6),
    // 🧠 Cognitif
    comp('cognitif', 'Se concentre 5 min', 1),
    comp('cognitif', 'Termine une activité', 2),
    comp('cognitif', 'Suit 2 consignes', 3),
    comp('cognitif', 'Anticipe "d\'abord / ensuite"', 4),
    comp('cognitif', 'Puzzle 6 pièces', 5),
    comp('cognitif', 'Puzzle 12 pièces', 6),
    comp('cognitif', 'Cherche une solution seul', 7),
    // 🫶 Social & Émotionnel
    comp('social_emotionnel', 'Reconnaît ses émotions', 1),
    comp('social_emotionnel', 'Exprime ses besoins verbalement', 2),
    comp('social_emotionnel', 'Gère une frustration', 3),
    comp('social_emotionnel', 'Partage un jouet 1–2 minutes', 4),
    comp('social_emotionnel', 'Joue avec un pair sans conflit', 5),
    comp('social_emotionnel', 'Attend son tour', 6),
    // 🧽 Vie pratique
    comp('vie_pratique', 'Se lave les mains seul', 1),
    comp('vie_pratique', 'S\'habille (bas)', 2),
    comp('vie_pratique', 'Retire manteau', 3),
    comp('vie_pratique', 'Utilise cuillère proprement', 4),
    comp('vie_pratique', 'Range ses affaires', 5),
    comp('vie_pratique', 'Participe à petites missions', 6),
    // 🎨 Créativité
    comp('creativite', 'Choisit des couleurs adaptées', 1),
    comp('creativite', 'Colle avec précision', 2),
    comp('creativite', 'Fait une création libre', 3),
    comp('creativite', 'Reconnaît 3 instruments', 4),
    comp('creativite', 'Reproduit un rythme simple', 5),
  ]
  await db.competences.bulkAdd(competences)
}

// ── Statuts initiaux de Manel (évaluation du tableau) ─────────────────────────
async function seedSuiviManel(): Promise<void> {
  const now = new Date()
  const MANEL_ID = 'membre-manel'

  // Récupérer toutes les compétences par nom pour retrouver leurs IDs
  const allComps = await db.competences.toArray()
  const byNom = new Map(allComps.map(c => [c.nom, c.id]))

  function suivi(nom: string, statut: 'acquis' | 'en_cours' | 'a_travailler'): CompetenceSuivi | null {
    const competenceId = byNom.get(nom)
    if (!competenceId) return null
    return {
      id: uuid(),
      enfant: MANEL_ID,
      competence: competenceId,
      statut,
      archive: false,
      createdAt: now,
      updatedAt: now,
      deviceId: 'seed',
    }
  }

  const suivis: CompetenceSuivi[] = [
    // 📚 Langage & Lecture
    suivi('Reconnaît les voyelles',                    'en_cours'),
    suivi('Reconnaît consonnes longues (f, l, m, n, r, s…)', 'acquis'),
    suivi('Reconnaît consonnes courtes (b, p, t, d, g, k)',   'acquis'),
    suivi('Fait correctement le son des lettres',      'en_cours'),
    suivi('Lit syllabes CV (ma, sa, la…)',             'en_cours'),
    suivi('Lit syllabes VC (am, as…)',                 'en_cours'),
    suivi('Lit syllabes CVC',                          'a_travailler'),
    suivi('Lit ses premiers mots simples',             'a_travailler'),
    suivi('Reformule une phrase courte',               'acquis'),
    suivi('Comprend des consignes simples',            'acquis'),
    // ✍️ Pré-écriture
    suivi('Lignes verticales',                         'acquis'),
    suivi('Lignes horizontales',                       'acquis'),
    suivi('Ponts',                                     'en_cours'),
    suivi('Boucles',                                   'a_travailler'),
    suivi('Écailles',                                  'a_travailler'),
    suivi('Suivi de pointillés',                       'en_cours'),
    suivi('Colorie sans dépasser',                     'en_cours'),
    suivi('Reproduit un cercle / carré',               'en_cours'),
    suivi('Découpe ligne droite',                      'en_cours'),
    suivi('Découpe forme simple',                      'en_cours'),
    // 🧽 Vie pratique
    suivi('Se lave les mains seul',                    'acquis'),
    suivi('S\'habille (bas)',                           'en_cours'),
    suivi('Retire manteau',                            'acquis'),
    suivi('Utilise cuillère proprement',               'acquis'),
    suivi('Range ses affaires',                        'en_cours'),
    suivi('Participe à petites missions',              'en_cours'),
  ].filter((s): s is CompetenceSuivi => s !== null)

  if (suivis.length > 0) {
    await db.competencesSuivi.bulkAdd(suivis)
  }
}

// (seedCategoriesSupplementaires supprimée — intégrée dans seedCategoriesProduits)

// ── Catalogue produits complet ────────────────────────────────────────────────
async function seedProduitsCatalog(): Promise<void> {
  const categories = await db.categoriesProduits.toArray()
  const cat = (nom: string): string => categories.find(c => c.nom === nom)?.id ?? ''

  type P = { nom: string; unite?: string }
  const PAR_CAT: Array<{ cat: string; produits: P[] }> = [
    {
      cat: 'Fruits',
      produits: [
        // — Pomacées & poires —
        { nom: 'Pomme',                      unite: 'pièce(s)' },
        { nom: 'Pommes',                     unite: 'kg' },
        { nom: 'Poire',                      unite: 'pièce(s)' },
        { nom: 'Poires',                     unite: 'kg' },
        { nom: 'Coing',                      unite: 'pièce(s)' },
        // — Agrumes —
        { nom: 'Orange',                     unite: 'pièce(s)' },
        { nom: 'Oranges',                    unite: 'kg' },
        { nom: 'Orange sanguine',            unite: 'pièce(s)' },
        { nom: 'Mandarine',                  unite: 'pièce(s)' },
        { nom: 'Clémentine',                 unite: 'pièce(s)' },
        { nom: 'Citron',                     unite: 'pièce(s)' },
        { nom: 'Citron jaune',               unite: 'pièce(s)' },
        { nom: 'Citron vert',                unite: 'pièce(s)' },
        { nom: 'Citrons verts',              unite: 'pièce(s)' },
        { nom: 'Pamplemousse',               unite: 'pièce(s)' },
        { nom: 'Pomelo',                     unite: 'pièce(s)' },
        { nom: 'Kumquat',                    unite: 'g' },
        { nom: 'Yuzu',                       unite: 'pièce(s)' },
        // — Tropicaux —
        { nom: 'Banane',                     unite: 'pièce(s)' },
        { nom: 'Bananes',                    unite: 'kg' },
        { nom: 'Plantain',                   unite: 'pièce(s)' },
        { nom: 'Ananas',                     unite: 'pièce(s)' },
        { nom: 'Mangue',                     unite: 'pièce(s)' },
        { nom: 'Papaye',                     unite: 'pièce(s)' },
        { nom: 'Fruit de la passion',        unite: 'pièce(s)' },
        { nom: 'Goyave',                     unite: 'pièce(s)' },
        { nom: 'Litchi',                     unite: 'kg' },
        { nom: 'Avocat',                     unite: 'pièce(s)' },
        { nom: 'Noix de coco',               unite: 'pièce(s)' },
        { nom: 'Chair de coco',              unite: 'g' },
        { nom: 'Coco râpée',                 unite: 'g' },
        { nom: 'Fruit du dragon',            unite: 'pièce(s)' },
        { nom: 'Carambole',                  unite: 'pièce(s)' },
        // — Melon & courge sucrée —
        { nom: 'Melon',                      unite: 'pièce(s)' },
        { nom: 'Melon charentais',           unite: 'pièce(s)' },
        { nom: 'Melon miel',                 unite: 'pièce(s)' },
        { nom: 'Pastèque',                   unite: 'pièce(s)' },
        { nom: 'Kiwi',                       unite: 'pièce(s)' },
        { nom: 'Kiwis',                      unite: 'kg' },
        { nom: 'Kiwi jaune',                 unite: 'pièce(s)' },
        { nom: 'Raisin blanc',               unite: 'kg' },
        { nom: 'Raisin noir',                unite: 'kg' },
        { nom: 'Raisins',                    unite: 'kg' },
        // — Drupes —
        { nom: 'Pêche',                      unite: 'pièce(s)' },
        { nom: 'Nectarine',                  unite: 'pièce(s)' },
        { nom: 'Abricot',                    unite: 'pièce(s)' },
        { nom: 'Prune',                      unite: 'pièce(s)' },
        { nom: 'Mirabelle',                  unite: 'kg' },
        { nom: 'Reine-claude',               unite: 'kg' },
        { nom: 'Cerise',                     unite: 'kg' },
        { nom: 'Griotte',                    unite: 'kg' },
        { nom: 'Figue',                      unite: 'pièce(s)' },
        { nom: 'Grenade',                    unite: 'pièce(s)' },
        { nom: 'Kaki',                       unite: 'pièce(s)' },
        { nom: 'Rhubarbe',                   unite: 'kg' },
        // — Baies —
        { nom: 'Fraise',                     unite: 'barquette' },
        { nom: 'Fraises',                    unite: 'barquette' },
        { nom: 'Framboise',                  unite: 'barquette' },
        { nom: 'Mûre',                       unite: 'barquette' },
        { nom: 'Myrtille',                   unite: 'barquette' },
        { nom: 'Airelle',                    unite: 'g' },
        { nom: 'Canneberge',                 unite: 'g' },
        { nom: 'Groseille rouge',            unite: 'barquette' },
        { nom: 'Cassis',                     unite: 'barquette' },
        { nom: 'Baie de goji',               unite: 'g' },
        { nom: 'Fruits rouges',              unite: 'g' },
        { nom: 'Mélange de fruits rouges',   unite: 'g' },
        // — Secs & confits —
        { nom: 'Raisin sec',                 unite: 'g' },
        { nom: 'Datte',                      unite: 'g' },
        { nom: 'Datte medjool',              unite: 'g' },
        { nom: 'Figue sèche',                unite: 'g' },
        { nom: 'Abricot sec',                unite: 'g' },
        { nom: 'Pruneau',                    unite: 'g' },
        { nom: 'Châtaigne',                  unite: 'g' },
        { nom: 'Marron',                     unite: 'g' },
        { nom: 'Fruits confits',             unite: 'g' },
        { nom: 'Écorce d\'orange confite',   unite: 'g' },
        { nom: 'Écorce de citron confite',   unite: 'g' },
        { nom: 'Cerise confite',             unite: 'g' },
        { nom: 'Citron confit sucré',        unite: 'g' },
        { nom: 'Gingembre confit',           unite: 'g' },
        // — Olives —
        { nom: 'Olive verte',                unite: 'g' },
        { nom: 'Olive noire',                unite: 'g' },
        { nom: 'Olive kalamata',             unite: 'g' },
        { nom: 'Olives vertes',              unite: 'bocal' },
      ],
    },
    {
      cat: 'Légumes',
      produits: [
        // — Racines & tubercules —
        { nom: 'Carotte',              unite: 'kg' },
        { nom: 'Carottes',             unite: 'kg' },
        { nom: 'Carotte fanes',        unite: 'bouquet' },
        { nom: 'Pomme de terre',       unite: 'kg' },
        { nom: 'Pommes grenailles',    unite: 'kg' },
        { nom: 'Patate douce',         unite: 'kg' },
        { nom: 'Patates douces',       unite: 'kg' },
        { nom: 'Igname',               unite: 'kg' },
        { nom: 'Manioc',               unite: 'kg' },
        { nom: 'Topinambour',          unite: 'kg' },
        { nom: 'Panais',               unite: 'kg' },
        { nom: 'Navet',                unite: 'kg' },
        { nom: 'Navets',               unite: 'kg' },
        { nom: 'Rutabaga',             unite: 'kg' },
        { nom: 'Radis',                unite: 'bouquet' },
        { nom: 'Radis noir',           unite: 'pièce(s)' },
        { nom: 'Daikon',               unite: 'pièce(s)' },
        { nom: 'Betterave rouge',      unite: 'kg' },
        { nom: 'Betterave jaune',      unite: 'kg' },
        { nom: 'Céleri-rave',          unite: 'pièce(s)' },
        // — Bulbes & alliacés —
        { nom: 'Oignon jaune',         unite: 'kg' },
        { nom: 'Oignon rouge',         unite: 'kg' },
        { nom: 'Oignon blanc',         unite: 'kg' },
        { nom: 'Oignon nouveau',       unite: 'bouquet' },
        { nom: 'Oignons',              unite: 'kg' },
        { nom: 'Oignons rouges',       unite: 'kg' },
        { nom: 'Échalote',             unite: 'pièce(s)' },
        { nom: 'Echalotes',            unite: 'pièce(s)' },
        { nom: 'Ail',                  unite: 'tête(s)' },
        { nom: 'Ail noir',             unite: 'tête(s)' },
        { nom: 'Aillet',               unite: 'bouquet' },
        { nom: 'Ciboule',              unite: 'bouquet' },
        { nom: 'Poireau',              unite: 'pièce(s)' },
        { nom: 'Poireaux',             unite: 'kg' },
        { nom: 'Fenouil',              unite: 'pièce(s)' },
        // — Tiges & feuilles —
        { nom: 'Céleri branche',       unite: 'pièce(s)' },
        { nom: 'Asperge verte',        unite: 'botte(s)' },
        { nom: 'Asperge blanche',      unite: 'botte(s)' },
        { nom: 'Artichaut',            unite: 'pièce(s)' },
        { nom: 'Blette',               unite: 'botte(s)' },
        { nom: 'Bette à carde',        unite: 'botte(s)' },
        { nom: 'Épinard',              unite: 'g' },
        { nom: 'Épinards frais',       unite: 'sachet(s)' },
        { nom: 'Oseille',              unite: 'bouquet' },
        // — Salades & feuilles —
        { nom: 'Laitue',               unite: 'pièce(s)' },
        { nom: 'Romaine',              unite: 'pièce(s)' },
        { nom: 'Iceberg',              unite: 'pièce(s)' },
        { nom: 'Salades',              unite: 'pièce(s)' },
        { nom: 'Roquette',             unite: 'sachet(s)' },
        { nom: 'Mâche',                unite: 'sachet(s)' },
        { nom: 'Cresson',              unite: 'bouquet' },
        { nom: 'Endive',               unite: 'pièce(s)' },
        { nom: 'Frisée',               unite: 'pièce(s)' },
        { nom: 'Chicorée',             unite: 'pièce(s)' },
        { nom: 'Pak choï',             unite: 'pièce(s)' },
        { nom: 'Kale',                 unite: 'bouquet' },
        { nom: 'Chou kale',            unite: 'kg' },
        // — Choux —
        { nom: 'Chou vert',            unite: 'pièce(s)' },
        { nom: 'Chou blanc',           unite: 'pièce(s)' },
        { nom: 'Chou rouge',           unite: 'pièce(s)' },
        { nom: 'Chou frisé',           unite: 'pièce(s)' },
        { nom: 'Chou chinois',         unite: 'pièce(s)' },
        { nom: 'Chou de Bruxelles',    unite: 'kg' },
        { nom: 'Chou-fleur',           unite: 'pièce(s)' },
        { nom: 'Brocoli',              unite: 'pièce(s)' },
        { nom: 'Broccolini',           unite: 'botte(s)' },
        { nom: 'Romanesco',            unite: 'pièce(s)' },
        // — Courges & solanacées —
        { nom: 'Courgette',            unite: 'pièce(s)' },
        { nom: 'Courgette jaune',      unite: 'pièce(s)' },
        { nom: 'Fèves fraîches',       unite: 'g' },
        { nom: 'Fèves surgelées',      unite: 'g' },
        { nom: 'Mini-poivrons',        unite: 'pièce(s)' },
        { nom: 'Courgettes',           unite: 'pièce(s)' },
        { nom: 'Courge butternut',     unite: 'pièce(s)' },
        { nom: 'Courge de Butternut',  unite: 'pièce(s)' },
        { nom: 'Potiron',              unite: 'pièce(s)' },
        { nom: 'Citrouille',           unite: 'pièce(s)' },
        { nom: 'Potimarron',           unite: 'pièce(s)' },
        { nom: 'Courge spaghetti',     unite: 'pièce(s)' },
        { nom: 'Aubergine',            unite: 'pièce(s)' },
        { nom: 'Aubergines',           unite: 'pièce(s)' },
        { nom: 'Tomate',               unite: 'kg' },
        { nom: 'Tomates',              unite: 'kg' },
        { nom: 'Tomate cerise',        unite: 'barquette' },
        { nom: 'Tomates cerises',      unite: 'barquette' },
        { nom: 'Tomate séchée',        unite: 'g' },
        { nom: 'Poivron vert',         unite: 'pièce(s)' },
        { nom: 'Poivron rouge',        unite: 'pièce(s)' },
        { nom: 'Poivron jaune',        unite: 'pièce(s)' },
        { nom: 'Poivron orange',       unite: 'pièce(s)' },
        { nom: 'Poivrons',             unite: 'pièce(s)' },
        { nom: 'Piment vert',          unite: 'pièce(s)' },
        { nom: 'Piment rouge',         unite: 'pièce(s)' },
        { nom: 'Jalapeño',             unite: 'pièce(s)' },
        { nom: 'Piment oiseau',        unite: 'pièce(s)' },
        { nom: 'Concombre',            unite: 'pièce(s)' },
        { nom: 'Cornichon',            unite: 'bocal' },
        { nom: 'Maïs doux',            unite: 'pièce(s)' },
        { nom: 'Épi de maïs',          unite: 'pièce(s)' },
        // — Légumineuses fraîches —
        { nom: 'Petit pois',           unite: 'kg' },
        { nom: 'Pois gourmand',        unite: 'kg' },
        { nom: 'Pois mange-tout',      unite: 'kg' },
        { nom: 'Haricot vert',         unite: 'kg' },
        { nom: 'Haricots verts frais', unite: 'kg' },
        { nom: 'Haricot beurre',       unite: 'kg' },
        { nom: 'Fève',                 unite: 'kg' },
        { nom: 'Edamame',              unite: 'g' },
        { nom: 'Gombo',                unite: 'kg' },
        // — Champignons —
        { nom: 'Champignon de Paris',  unite: 'barquette' },
        { nom: 'Champignons',          unite: 'barquette' },
        { nom: 'Champignons de paris', unite: 'barquette' },
        { nom: 'Champignon brun',      unite: 'barquette' },
        { nom: 'Pleurote',             unite: 'g' },
        { nom: 'Shiitaké',             unite: 'g' },
        { nom: 'Girolle',              unite: 'g' },
        { nom: 'Cèpe',                 unite: 'g' },
        { nom: 'Morille',              unite: 'g' },
        { nom: 'Chanterelle',          unite: 'g' },
        { nom: 'Portobello',           unite: 'pièce(s)' },
        { nom: 'Truffe noire',         unite: 'g' },
        // — Herbes fraîches —
        { nom: 'Basilic',              unite: 'bouquet' },
        { nom: 'Persil',               unite: 'bouquet' },
        { nom: 'Coriandre',            unite: 'bouquet' },
        { nom: 'Menthe',               unite: 'bouquet' },
        { nom: 'Ciboulette',           unite: 'bouquet' },
        { nom: 'Thym',                 unite: 'bouquet' },
        { nom: 'Romarin',              unite: 'bouquet' },
        { nom: 'Laurier',              unite: 'feuille(s)' },
        { nom: 'Estragon',             unite: 'bouquet' },
        { nom: 'Sauge',                unite: 'bouquet' },
        { nom: 'Origan frais',         unite: 'bouquet' },
        // — Pousses & divers —
        { nom: 'Pousses de soja',      unite: 'g' },
        { nom: 'Germes de haricot',    unite: 'g' },
        { nom: 'Jeunes pousses',       unite: 'sachet(s)' },
        { nom: 'Micro pousses',        unite: 'barquette' },
        { nom: 'Micro-pousses',        unite: 'barquette' },
      ],
    },
    {
      cat: 'Viande & Charcuterie',
      produits: [
        // — Boeuf —
        { nom: 'Boeuf',                   unite: 'kg' },
        { nom: 'Boeuf entier',             unite: 'kg' },
        { nom: 'Boeuf haché',              unite: 'kg' },
        { nom: 'Steak haché',              unite: 'kg' },
        { nom: 'Boeuf à mijoter',          unite: 'kg' },
        { nom: 'Boeuf bourguignon',        unite: 'kg' },
        { nom: 'Boeuf braisé',             unite: 'kg' },
        { nom: 'Boeuf sauté',              unite: 'kg' },
        { nom: 'Boeuf émincé',             unite: 'kg' },
        { nom: 'Boeuf en lamelles',        unite: 'kg' },
        { nom: 'Boeuf mariné',             unite: 'kg' },
        { nom: 'Filet de boeuf',           unite: 'kg' },
        { nom: 'Filet mignon de boeuf',    unite: 'kg' },
        { nom: 'Tournedos',                unite: 'pièce(s)' },
        { nom: 'Chateaubriand',            unite: 'kg' },
        { nom: 'Côte de boeuf',            unite: 'pièce(s)' },
        { nom: 'Entrecôte',                unite: 'pièce(s)' },
        { nom: 'Faux filet',               unite: 'kg' },
        { nom: 'Rumsteck',                 unite: 'kg' },
        { nom: 'Bavette d\'aloyau',        unite: 'kg' },
        { nom: 'Bavette de flanchet',      unite: 'kg' },
        { nom: 'Onglet',                   unite: 'kg' },
        { nom: 'Hampe',                    unite: 'kg' },
        { nom: 'Macreuse',                 unite: 'kg' },
        { nom: 'Paleron',                  unite: 'kg' },
        { nom: 'Paleron de boeuf',         unite: 'kg' },
        { nom: 'Jumeau de boeuf',          unite: 'kg' },
        { nom: 'Collier de boeuf',         unite: 'kg' },
        { nom: 'Plat de côte',             unite: 'kg' },
        { nom: 'Jarret de boeuf',          unite: 'kg' },
        { nom: 'Queue de boeuf',           unite: 'kg' },
        { nom: 'Joue de boeuf',            unite: 'kg' },
        { nom: 'Langue de boeuf',          unite: 'kg' },
        { nom: 'Foie de boeuf',            unite: 'kg' },
        { nom: 'Rognon de boeuf',          unite: 'kg' },
        { nom: 'Tripes de boeuf',          unite: 'kg' },
        { nom: 'Os à moelle',              unite: 'pièce(s)' },
        { nom: 'Carpaccio de boeuf',       unite: 'g' },
        { nom: 'Viande des grisons',       unite: 'g' },
        { nom: 'Bresaola',                 unite: 'g' },
        { nom: 'Pastrami',                 unite: 'g' },
        { nom: 'Corned beef',              unite: 'g' },
        // — Porc & charcuterie —
        { nom: 'Lardon nature',            unite: 'g' },
        { nom: 'Lardon fumé',              unite: 'g' },
        { nom: 'Lardons',                  unite: 'g' },
        { nom: 'Lard fumé',                unite: 'g' },
        { nom: 'Bacon',                    unite: 'g' },
        // — Poulet —
        { nom: 'Poulet',                   unite: 'kg' },
        { nom: 'Poulet entier',            unite: 'pièce(s)' },
        { nom: 'Poulet fermier',           unite: 'pièce(s)' },
        { nom: 'Poulet jaune',             unite: 'pièce(s)' },
        { nom: 'Poulet rôti',              unite: 'pièce(s)' },
        { nom: 'Blanc de poulet',          unite: 'kg' },
        { nom: 'Poulet (Blanc)',           unite: 'kg' },
        { nom: 'Filet de poulet',          unite: 'kg' },
        { nom: 'Suprême de poulet',        unite: 'pièce(s)' },
        { nom: 'Escalope de poulet',       unite: 'pièce(s)' },
        { nom: 'Aiguillette de poulet',    unite: 'kg' },
        { nom: 'Émincé de poulet',         unite: 'kg' },
        { nom: 'Poulet haché',             unite: 'kg' },
        { nom: 'Cuisse de poulet',         unite: 'pièce(s)' },
        { nom: 'Cuisses de poulet',        unite: 'kg' },
        { nom: 'Haut de cuisse de poulet', unite: 'pièce(s)' },
        { nom: 'Pilon de poulet',          unite: 'pièce(s)' },
        { nom: 'Aile de poulet',           unite: 'pièce(s)' },
        { nom: 'Poulet fumé',              unite: 'kg' },
        { nom: 'Poulet mariné',            unite: 'kg' },
        { nom: 'Poulet effiloché',         unite: 'kg' },
        // — Dinde —
        { nom: 'Dinde',                    unite: 'kg' },
        { nom: 'Blanc de dinde',           unite: 'kg' },
        { nom: 'Filet de dinde',           unite: 'kg' },
        { nom: 'Escalope de dinde',        unite: 'pièce(s)' },
        { nom: 'Cuisse de dinde',          unite: 'pièce(s)' },
        { nom: 'Dinde hachée',             unite: 'kg' },
        // — Agneau —
        { nom: 'Agneau',                   unite: 'kg' },
        { nom: 'Agneau haché',             unite: 'kg' },
        { nom: 'Gigot d\'agneau',          unite: 'kg' },
        { nom: 'Épaule d\'agneau',         unite: 'kg' },
        { nom: 'Souris d\'agneau',         unite: 'pièce(s)' },
        { nom: 'Carré d\'agneau',          unite: 'kg' },
        { nom: 'Côtelette d\'agneau',      unite: 'pièce(s)' },
        { nom: 'Collier d\'agneau',        unite: 'kg' },
        { nom: 'Poitrine d\'agneau',       unite: 'kg' },
        // — Veau —
        { nom: 'Veau',                     unite: 'kg' },
        { nom: 'Escalope de veau',         unite: 'pièce(s)' },
        { nom: 'Côte de veau',             unite: 'pièce(s)' },
        { nom: 'Jarret de veau',           unite: 'kg' },
        { nom: 'Blanquette de veau',       unite: 'kg' },
        { nom: 'Épaule de veau',           unite: 'kg' },
        { nom: 'Foie de veau',             unite: 'kg' },
        { nom: 'Ris de veau',              unite: 'kg' },
        { nom: 'Steak de veau',            unite: 'kg' },
        // — Générique —
        { nom: 'Viande hachée',            unite: 'kg' },
      ],
    },
    {
      cat: 'Poissons',
      produits: [
        // — Poissons frais —
        { nom: 'Saumon',                        unite: 'kg' },
        { nom: 'Filet de saumon',               unite: 'kg' },
        { nom: 'Pavé de saumon',                unite: 'pièce(s)' },
        { nom: 'Saumon fumé',                   unite: 'g' },
        { nom: 'Thon frais',                    unite: 'kg' },
        { nom: 'Filet de thon',                 unite: 'kg' },
        { nom: 'Cabillaud',                     unite: 'kg' },
        { nom: 'Filet de cabillaud',             unite: 'kg' },
        { nom: 'Morue',                         unite: 'kg' },
        { nom: 'Morue salée',                   unite: 'kg' },
        { nom: 'Lieu noir',                     unite: 'kg' },
        { nom: 'Lieu jaune',                    unite: 'kg' },
        { nom: 'Colin',                         unite: 'kg' },
        { nom: 'Filet de colin',                unite: 'kg' },
        { nom: 'Haddock',                       unite: 'kg' },
        { nom: 'Merlu',                         unite: 'kg' },
        { nom: 'Filet de merlu',                unite: 'kg' },
        { nom: 'Merlan',                        unite: 'kg' },
        { nom: 'Sole',                          unite: 'kg' },
        { nom: 'Filet de sole',                 unite: 'kg' },
        { nom: 'Bar',                           unite: 'kg' },
        { nom: 'Filet de bar',                  unite: 'kg' },
        { nom: 'Daurade',                       unite: 'pièce(s)' },
        { nom: 'Filet de daurade',              unite: 'kg' },
        { nom: 'Maquereau',                     unite: 'kg' },
        { nom: 'Maquereau fumé',                unite: 'kg' },
        { nom: 'Sardine',                       unite: 'kg' },
        { nom: 'Sardine fumée',                 unite: 'kg' },
        { nom: 'Hareng',                        unite: 'kg' },
        { nom: 'Hareng fumé',                   unite: 'kg' },
        { nom: 'Hareng mariné',                 unite: 'kg' },
        { nom: 'Truite',                        unite: 'kg' },
        { nom: 'Filet de truite',               unite: 'kg' },
        { nom: 'Truite fumée',                  unite: 'g' },
        { nom: 'Flétan',                        unite: 'kg' },
        { nom: 'Turbot',                        unite: 'kg' },
        { nom: 'Lotte',                         unite: 'kg' },
        { nom: 'Raie',                          unite: 'kg' },
        { nom: 'Rouget',                        unite: 'kg' },
        { nom: 'Tilapia',                       unite: 'kg' },
        { nom: 'Espadon',                       unite: 'kg' },
        { nom: 'Anchois',                       unite: 'kg' },
        // — Crustacés & coquillages —
        { nom: 'Crabe',                         unite: 'kg' },
        { nom: 'Homard',                        unite: 'pièce(s)' },
        { nom: 'Langouste',                     unite: 'pièce(s)' },
        { nom: 'Langoustine',                   unite: 'kg' },
        { nom: 'Crevette',                      unite: 'kg' },
        { nom: 'Crevette grise',                unite: 'kg' },
        { nom: 'Crevette rose',                 unite: 'kg' },
        { nom: 'Gambas',                        unite: 'kg' },
        { nom: 'Huître',                        unite: 'douzaine(s)' },
        { nom: 'Moule',                         unite: 'kg' },
        { nom: 'Palourde',                      unite: 'kg' },
        { nom: 'Coque',                         unite: 'kg' },
        { nom: 'Noix de Saint-Jacques',         unite: 'pièce(s)' },
        { nom: 'Coquille Saint-Jacques',        unite: 'pièce(s)' },
        { nom: 'Pétoncle',                      unite: 'kg' },
        { nom: 'Bulot',                         unite: 'kg' },
        // — Céphalopodes —
        { nom: 'Calamar',                       unite: 'kg' },
        { nom: 'Encornet',                      unite: 'kg' },
        { nom: 'Seiche',                        unite: 'kg' },
        { nom: 'Poulpe',                        unite: 'kg' },
        // — Conserves & fumés —
        { nom: 'Thon en conserve',              unite: 'boîte(s)' },
        { nom: 'Thon en conserve à l\'huile',   unite: 'boîte(s)' },
        { nom: 'Thon en conserve au naturel',   unite: 'boîte(s)' },
        { nom: 'Sardine en conserve',           unite: 'boîte(s)' },
        { nom: 'Maquereau en conserve',         unite: 'boîte(s)' },
        { nom: 'Anchois en conserve',           unite: 'boîte(s)' },
        { nom: 'Anchois à l\'huile',            unite: 'boîte(s)' },
        { nom: 'Surimi',                        unite: 'g' },
        { nom: 'Œufs de saumon',               unite: 'g' },
        { nom: 'Caviar',                        unite: 'g' },
        // — Algues —
        { nom: 'Nori',                          unite: 'feuille(s)' },
        { nom: 'Kombu',                         unite: 'g' },
        { nom: 'Wakamé',                        unite: 'g' },
        { nom: 'Agar-agar',                     unite: 'g' },
      ],
    },
    {
      cat: 'Produits Laitiers',
      produits: [
        { nom: 'Lait entier',                    unite: 'L' },
        { nom: 'Lait demi-écrémé',               unite: 'L' },
        { nom: 'Lait écrémé',                    unite: 'L' },
        { nom: 'Lait concentré non sucré',        unite: 'ml' },
        { nom: 'Lait concentré sucré',            unite: 'ml' },
        { nom: 'Lait en poudre',                 unite: 'g' },
        { nom: 'Babeurre',                       unite: 'ml' },
        { nom: 'Kéfir',                          unite: 'ml' },
        { nom: 'Crème liquide entière',          unite: 'ml' },
        { nom: 'Crème liquide légère',           unite: 'ml' },
        { nom: 'Crème épaisse',                  unite: 'ml' },
        { nom: 'Crème fraîche',                  unite: 'ml' },
        { nom: 'Crème double',                   unite: 'ml' },
        { nom: 'Crème de coco',                  unite: 'ml' },
        { nom: 'Yaourt nature',                  unite: 'pièce(s)' },
        { nom: 'Yaourt grec',                    unite: 'pièce(s)' },
        { nom: 'Yaourt brassé',                  unite: 'pièce(s)' },
        { nom: 'Skyr',                           unite: 'g' },
        { nom: 'Labneh',                         unite: 'g' },
        { nom: 'Fromage blanc',                  unite: 'g' },
        { nom: 'Petit-suisse',                   unite: 'pièce(s)' },
        { nom: 'Faisselle',                      unite: 'g' },
        { nom: 'Beurre doux',                    unite: 'g' },
        { nom: 'Beurre demi-sel',                unite: 'g' },
        { nom: 'Beurre salé',                    unite: 'g' },
        { nom: 'Beurre clarifié',                unite: 'g' },
        { nom: 'Ghee',                           unite: 'g' },
      ],
    },
    {
      cat: 'Fromages',
      produits: [
        // — Frais & à tartiner —
        { nom: 'Ricotta',                        unite: 'g' },
        { nom: 'Cottage cheese',                 unite: 'g' },
        { nom: 'Cream cheese',                   unite: 'g' },
        { nom: 'Fromage frais',                  unite: 'g' },
        { nom: 'Fromage frais ail et fines herbes', unite: 'g' },
        { nom: 'Fromage fondu à tartiner',       unite: 'g' },
        { nom: 'Fromage fondu en tranche',       unite: 'pièce(s)' },
        { nom: 'Fromage fondu',                  unite: 'g' },
        { nom: 'Fromage à raclette',             unite: 'g' },
        { nom: 'Fromage râpé',                   unite: 'g' },
        // — Marques (ingrédients de fait dans les recettes) —
        { nom: 'Boursin',                        unite: 'pièce(s)' },
        { nom: 'Boursin au poivre',              unite: 'pièce(s)' },
        { nom: 'Philadelphia',                   unite: 'g' },
        { nom: 'Saint-Môret',                    unite: 'g' },
        { nom: 'La Vache qui Rit',               unite: 'pièce(s)' },
        { nom: 'Kiri',                           unite: 'pièce(s)' },
        { nom: 'Cancoillotte',                   unite: 'g' },
        { nom: 'Caprice des Dieux',              unite: 'pièce(s)' },
        { nom: 'Tartare',                        unite: 'g' },
        { nom: 'Madame Loïk',                    unite: 'g' },
        // — À pâte molle & croûte fleurie —
        { nom: 'Mozzarella',                     unite: 'pièce(s)' },
        { nom: 'Mozzarella di bufala',           unite: 'pièce(s)' },
        { nom: 'Burrata',                        unite: 'pièce(s)' },
        { nom: 'Stracciatella',                  unite: 'g' },
        { nom: 'Feta',                           unite: 'g' },
        { nom: 'Halloumi',                       unite: 'g' },
        { nom: 'Brie',                           unite: 'pièce(s)' },
        { nom: 'Camembert',                      unite: 'pièce(s)' },
        { nom: 'Coulommiers',                    unite: 'pièce(s)' },
        { nom: 'Neufchâtel',                     unite: 'pièce(s)' },
        { nom: 'Saint-Félicien',                 unite: 'pièce(s)' },
        { nom: 'Saint-Marcellin',                unite: 'pièce(s)' },
        { nom: 'Mont d\'or',                     unite: 'pièce(s)' },
        { nom: 'Reblochon',                      unite: 'pièce(s)' },
        { nom: 'Chaumes',                        unite: 'pièce(s)' },
        { nom: 'Munster',                        unite: 'pièce(s)' },
        { nom: 'Maroilles',                      unite: 'pièce(s)' },
        { nom: 'Livarot',                        unite: 'pièce(s)' },
        { nom: 'Époisses',                       unite: 'pièce(s)' },
        { nom: 'Brillat-Savarin',                unite: 'pièce(s)' },
        // — À pâte pressée cuite —
        { nom: 'Emmental',                       unite: 'g' },
        { nom: 'Emmental râpé',                  unite: 'g' },
        { nom: 'Gruyère',                        unite: 'g' },
        { nom: 'Comté',                          unite: 'g' },
        { nom: 'Beaufort',                       unite: 'g' },
        { nom: 'Parmesan',                       unite: 'g' },
        { nom: 'Parmesan râpé',                  unite: 'g' },
        { nom: 'Bloc de Parmesan',               unite: 'g' },
        { nom: 'Pecorino',                       unite: 'g' },
        { nom: 'Grana Padano',                   unite: 'g' },
        { nom: 'Mascarpone',                     unite: 'g' },
        // — À pâte pressée non cuite —
        { nom: 'Cantal',                         unite: 'g' },
        { nom: 'Tomme',                          unite: 'g' },
        { nom: 'Raclette',                       unite: 'g' },
        { nom: 'Raclette râpée',                 unite: 'g' },
        { nom: 'Morbier',                        unite: 'g' },
        { nom: 'Saint-Nectaire',                 unite: 'g' },
        { nom: 'Mimolette',                      unite: 'g' },
        { nom: 'Edam',                           unite: 'g' },
        { nom: 'Gouda',                          unite: 'g' },
        { nom: 'Cheddar',                        unite: 'g' },
        { nom: 'Cheddar râpé',                   unite: 'g' },
        // — Bleus —
        { nom: 'Roquefort',                      unite: 'g' },
        { nom: 'Bleu d\'Auvergne',               unite: 'g' },
        { nom: 'Fourme d\'Ambert',               unite: 'g' },
        { nom: 'Gorgonzola',                     unite: 'g' },
        { nom: 'Bleu',                           unite: 'g' },
        { nom: 'Bleu des Causses',               unite: 'g' },
        { nom: 'Bleu de Bresse',                 unite: 'g' },
        // — Chèvre —
        { nom: 'Chèvre frais',                   unite: 'g' },
        { nom: 'Fromage de chèvre frais',        unite: 'g' },
        { nom: 'Crottin de chèvre',              unite: 'pièce(s)' },
        { nom: 'Bûche de chèvre',                unite: 'pièce(s)' },
        { nom: 'Chèvre cendré',                  unite: 'g' },
        // — Brebis —
        { nom: 'Fromage de brebis frais',        unite: 'g' },
        { nom: 'Ossau-Iraty',                    unite: 'g' },
        { nom: 'Manchego',                       unite: 'g' },
        // — Autres —
        { nom: 'Provolone',                      unite: 'g' },
        { nom: 'Scamorza',                       unite: 'g' },
        { nom: 'Taleggio',                       unite: 'g' },
      ],
    },
    {
      cat: 'Épicerie salée',
      produits: [
        // Crémerie / Frais
        { nom: 'Beurre',           unite: 'g' },
        { nom: 'Crème',            unite: 'ml' },
        { nom: 'Crème fraîche',    unite: 'ml' },
        { nom: 'Crème liquide',    unite: 'ml' },
        { nom: 'Hummus',           unite: 'barquette' },
        { nom: 'Lait',             unite: 'L' },
        { nom: 'Mascarpone',       unite: 'g' },
        { nom: 'Mozzarella',       unite: 'pièce(s)' },
        { nom: 'Oeufs',            unite: 'pièce(s)' },
        { nom: 'Pâte feuilletée',  unite: 'pièce(s)' },
        { nom: 'Ricotta',          unite: 'g' },
        { nom: 'St Moret',         unite: 'g' },
        { nom: 'Yaourt grec',      unite: 'pièce(s)' },
        { nom: 'Yaourt nature épais',  unite: 'pièce(s)' },
        { nom: 'Lben',                 unite: 'L' },
        // Fromages
        { nom: 'Bloc de Parmesan', unite: 'g' },
        { nom: 'Boursin',          unite: 'pièce(s)' },
        { nom: 'Boursin au poivre',unite: 'pièce(s)' },
        { nom: 'Burrata',          unite: 'pièce(s)' },
        { nom: 'Cheddar râpé',     unite: 'g' },
        { nom: 'Comté',            unite: 'g' },
        { nom: 'Feta',             unite: 'g' },
        { nom: 'Gorgonzola',       unite: 'g' },
        { nom: 'Gruyère',          unite: 'g' },
        { nom: 'Halloumi',         unite: 'g' },
        { nom: 'Parmesan râpé',    unite: 'g' },
        // Épicerie sèche salée
        { nom: 'Bouillon de boeuf',    unite: 'L' },
        { nom: 'Bouillon de légumes',  unite: 'L' },
        { nom: 'Bouillon de poisson',  unite: 'L' },
        { nom: 'Bouillon de volaille', unite: 'L' },
        { nom: 'Bouquet garni',        unite: 'pièce(s)' },
        { nom: 'Câpres',               unite: 'bocal' },
        { nom: 'Chapelure',            unite: 'g' },
        { nom: 'Chapelure panko',      unite: 'g' },
        { nom: 'Citron confit',        unite: 'bocal' },
        { nom: 'Concentré de tomate',  unite: 'g' },
        { nom: 'Corn-flakes nature',   unite: 'g' },
        { nom: 'Dukkah de Noix',       unite: 'g' },
        { nom: 'Farine',               unite: 'g' },
        { nom: 'Feuilles de brick',    unite: 'pièce(s)' },
        { nom: 'Galette à burritos',   unite: 'pièce(s)' },
        { nom: 'Graines de sésame',    unite: 'g' },
        { nom: 'Graines de tournesol', unite: 'g' },
        { nom: 'Graines de courge',    unite: 'g' },
        { nom: 'Graines d\'anis vert', unite: 'g' },
        { nom: 'Graines mélangées',    unite: 'g' },
        { nom: 'Huile végétale',       unite: 'L' },
        { nom: 'Harissa',              unite: 'boîte(s)' },
        { nom: 'Huile',                unite: 'L' },
        { nom: 'Huile d\'olive',       unite: 'L' },
        { nom: 'Huile de tournesol',   unite: 'L' },
        { nom: 'Maïzena',              unite: 'g' },
        { nom: 'Moutarde',             unite: 'bocal' },
        { nom: 'Noisettes',            unite: 'g' },
        { nom: 'Noix de cajou',        unite: 'g' },
        { nom: 'Olives vertes',        unite: 'bocal' },
        { nom: 'Olives dénoyautées',   unite: 'bocal' },
        { nom: 'Orzo',                 unite: 'g' },
        { nom: 'Pain',                 unite: 'pièce(s)' },
        { nom: 'Pain à Burger',        unite: 'pièce(s)' },
        { nom: 'Pâtes',                unite: 'g' },
        { nom: 'Gnocchis',             unite: 'g' },
        { nom: 'Conchiglionis',        unite: 'g' },
        { nom: 'Pâte brisée',          unite: 'pièce(s)' },
        { nom: 'Oignons frits',        unite: 'g' },
        { nom: 'Pignons de pin',       unite: 'g' },
        { nom: 'Pistaches',            unite: 'g' },
        { nom: 'Quinoa',               unite: 'g' },
        { nom: 'Riz',                  unite: 'g' },
        { nom: 'Riz à risotto',        unite: 'g' },
        { nom: 'Semoule',              unite: 'g' },
        { nom: 'Semoule fine',         unite: 'g' },
        { nom: 'Semoule extra-fine',   unite: 'g' },
        { nom: 'Semoule de maïs',      unite: 'g' },
        { nom: 'Spaghetti',            unite: 'g' },
        { nom: 'Vinaigre balsamique',        unite: 'ml' },
        { nom: 'Vinaigre balsamique blanc',  unite: 'ml' },
        { nom: 'Vinaigre blanc',             unite: 'ml' },
        { nom: 'Vinaigre de cidre',          unite: 'ml' },
        { nom: 'Vinaigre de riz',            unite: 'ml' },
        { nom: 'Vinaigre de vin',            unite: 'ml' },
        { nom: 'Vinaigre d\'alcool',         unite: 'ml' },
        // Jus d'agrumes
        { nom: 'Jus de citron',              unite: 'ml' },
        { nom: 'Jus de citron vert',         unite: 'ml' },
        // Huiles spéciales
        { nom: 'Huile d\'argan',             unite: 'ml' },
        { nom: 'Huile de friture',           unite: 'L' },
        { nom: 'Huile de noix',              unite: 'ml' },
        { nom: 'Huile de noisette',          unite: 'ml' },
        { nom: 'Huile de colza',             unite: 'ml' },
        // Fonds & bouillons liquides
        { nom: 'Fond de veau',               unite: 'ml' },
        { nom: 'Fond de volaille',           unite: 'ml' },
        { nom: 'Court-bouillon',             unite: 'sachet(s)' },
        // Farines & féculents
        { nom: 'Farine T45',                 unite: 'g' },
        { nom: 'Farine T55',                 unite: 'g' },
        { nom: 'Farine T65',                 unite: 'g' },
        { nom: 'Farine complète',            unite: 'g' },
        { nom: 'Farine de riz',              unite: 'g' },
        { nom: 'Fécule de pomme de terre',   unite: 'g' },
        { nom: 'Fécule de maïs',             unite: 'g' },
        // Pâtes variées
        { nom: 'Penne',                      unite: 'g' },
        { nom: 'Fusilli',                    unite: 'g' },
        { nom: 'Tagliatelles',               unite: 'g' },
        { nom: 'Lasagnes',                   unite: 'g' },
        { nom: 'Linguine',                   unite: 'g' },
        { nom: 'Pappardelle',                unite: 'g' },
        { nom: 'Coquillettes',               unite: 'g' },
        // Céréales & légumineuses sèches
        { nom: 'Boulghour',                  unite: 'g' },
        { nom: 'Polenta',                    unite: 'g' },
        { nom: 'Boulgour',                   unite: 'g' },
        { nom: 'Lentilles vertes',           unite: 'g' },
        { nom: 'Lentilles corail',           unite: 'g' },
        { nom: 'Lentilles beluga',           unite: 'g' },
        { nom: 'Pois chiches secs',          unite: 'g' },
        { nom: 'Haricots blancs secs',       unite: 'g' },
        { nom: 'Haricots rouges secs',       unite: 'g' },
        { nom: 'Riz basmati',                unite: 'g' },
        { nom: 'Riz complet',                unite: 'g' },
        { nom: 'Riz thaï',                   unite: 'g' },
        // Noix & graines
        { nom: 'Amandes',                    unite: 'g' },
        { nom: 'Amandes effilées',           unite: 'g' },
        { nom: 'Amandes en poudre',          unite: 'g' },
        { nom: 'Noix',                       unite: 'g' },
        { nom: 'Noix de coco râpée',         unite: 'g' },
        { nom: 'Noix de pécan',              unite: 'g' },
        // Condiments & sauces
        { nom: 'Ketchup',                    unite: 'g' },
        { nom: 'Ketchup épicé',              unite: 'g' },
        { nom: 'Mayonnaise',                 unite: 'g' },
        { nom: 'Sauce Worcestershire',       unite: 'ml' },
        { nom: 'Sauce piquante',             unite: 'ml' },
        { nom: 'Sauce barbecue',             unite: 'g' },
        { nom: 'Charmoula',                  unite: 'g' },
        { nom: 'Tapenade',                   unite: 'g' },
        { nom: 'Tapenade de figues',         unite: 'g' },
        { nom: 'Câpres au sel',              unite: 'bocal' },
        { nom: 'Anchois au sel',             unite: 'bocal' },
        { nom: 'Confiture de lait',          unite: 'bocal' },
        { nom: 'Dulce de leche',             unite: 'bocal' },
        { nom: 'Sirop de sucre de canne',    unite: 'ml' },
        { nom: 'Pâte d\'amande',             unite: 'g' },
        // Arômes & levures
        { nom: 'Levure boulangère',          unite: 'sachet(s)' },
        { nom: 'Bicarbonate de soude',       unite: 'g' },
        { nom: 'Extrait de vanille',         unite: 'ml' },
        // Sauces & arômes asiatiques salés (dans épicerie salée)
        { nom: 'Échalotes déshydratées',     unite: 'g' },
        { nom: 'Flocons d\'échalote',        unite: 'g' },
        { nom: 'Ail en semoule',             unite: 'g' },
        // Pains & pâtes à tartiner
        { nom: 'Pain de mie',                unite: 'pièce(s)' },
        { nom: 'Pain au lait',               unite: 'pièce(s)' },
        { nom: 'Carré frais',                unite: 'pièce(s)' },
        { nom: 'Tortillas de blé',           unite: 'pièce(s)' },
        { nom: 'Tortillas de maïs',          unite: 'pièce(s)' },
        { nom: 'Pain pita',                  unite: 'pièce(s)' },
        { nom: 'Pain naan',                  unite: 'pièce(s)' },
        { nom: 'Crackers',                   unite: 'pièce(s)' },
        { nom: 'Biscottes',                  unite: 'pièce(s)' },
        { nom: 'Wraps',                      unite: 'pièce(s)' },
        // Pâtes farcies & nouilles
        { nom: 'Raviolis frais',             unite: 'paquet(s)' },
        { nom: 'Tortellinis frais',          unite: 'paquet(s)' },
        { nom: 'Tortellonis frais',          unite: 'paquet(s)' },
        { nom: 'Cannellonis',                unite: 'paquet(s)' },
        { nom: 'Nouilles chinoises',         unite: 'paquet(s)' },
        { nom: 'Nouilles udon',              unite: 'paquet(s)' },
        { nom: 'Nouilles soba',              unite: 'paquet(s)' },
        { nom: 'Vermicelles de riz',         unite: 'paquet(s)' },
        { nom: 'Vermicelles de soja',        unite: 'paquet(s)' },
        { nom: 'Perles de couscous',         unite: 'paquet(s)' },
        // Céréales & graines alternatives
        { nom: 'Épeautre',                   unite: 'g' },
        { nom: 'Petit épeautre',             unite: 'g' },
        { nom: 'Orge perlé',                 unite: 'g' },
        { nom: 'Blé précuit',                unite: 'g' },
        { nom: 'Millet',                     unite: 'g' },
        { nom: 'Sarrasin décortiqué',        unite: 'g' },
        { nom: 'Pois cassés',                unite: 'g' },
        { nom: 'Fèves sèches',               unite: 'g' },
        // Sauces en bocal
        { nom: 'Purée de tomates',           unite: 'bocal' },
        { nom: 'Passata',                    unite: 'bocal' },
        { nom: 'Pesto vert',                 unite: 'bocal' },
        { nom: 'Pesto rosso',                unite: 'bocal' },
        { nom: 'Sauce bolognaise',           unite: 'bocal' },
        { nom: 'Sauce carbonara',            unite: 'bocal' },
        { nom: 'Sauce curry',                unite: 'bocal' },
        { nom: 'Sauce teriyaki',             unite: 'bocal' },
        { nom: 'Sauce ponzu',                unite: 'bocal' },
        { nom: 'Sauce burger',               unite: 'bocal' },
        { nom: 'Sauce tartare',              unite: 'bocal' },
        { nom: 'Sauce samouraï',             unite: 'bocal' },
        { nom: 'Sauce andalouse',            unite: 'bocal' },
        { nom: 'Sauce aigre-douce',          unite: 'bocal' },
        { nom: 'Purée de piment',            unite: 'bocal' },
        // Bocaux & conserves salées
        { nom: 'Cornichons',                 unite: 'bocal' },
        { nom: 'Oignons grelots au vinaigre',unite: 'bocal' },
        { nom: 'Cœurs de palmier',           unite: 'boîte(s)' },
        { nom: 'Asperges blanches en bocal', unite: 'bocal' },
        { nom: 'Betteraves cuites',          unite: 'barquette' },
        { nom: 'Champignons émincés en conserve', unite: 'boîte(s)' },
        { nom: 'Raifort',                    unite: 'bocal' },
        { nom: 'Miel à la truffe',           unite: 'bocal' },
        // Vinaigres supplémentaires
        { nom: 'Vinaigre de framboise',      unite: 'ml' },
        { nom: 'Vinaigre de xérès',          unite: 'ml' },
        { nom: 'Crème de vinaigre balsamique', unite: 'ml' },
        // Céréales & encas petit-déjeuner
        { nom: 'Muesli',                     unite: 'paquet(s)' },
        { nom: 'Granola',                    unite: 'paquet(s)' },
        { nom: 'Flocons d\'avoine',          unite: 'paquet(s)' },
        { nom: 'Pain grillé',                unite: 'paquet(s)' },
        { nom: 'Pain suédois',               unite: 'paquet(s)' },
        { nom: 'Crackers salés',             unite: 'paquet(s)' },
        { nom: 'Gressins',                   unite: 'paquet(s)' },
        { nom: 'Galettes de riz',            unite: 'paquet(s)' },
        { nom: 'Galettes de maïs',           unite: 'paquet(s)' },
        // Pâtes à pizza & préparations
        { nom: 'Pâte à pizza',               unite: 'rouleau(x)' },
        { nom: 'Préparation pour falafels',  unite: 'sachet(s)' },
        { nom: 'Préparation pour purée',     unite: 'sachet(s)' },
        { nom: 'Croûtons',                   unite: 'paquet(s)' },
        // Charcuterie en conserve
        { nom: 'Rillettes de porc',          unite: 'bocal' },
        { nom: 'Terrine de campagne',        unite: 'bocal' },
        // Boissons culinaires
        { nom: 'Vin blanc',                  unite: 'ml' },
        { nom: 'Vin rouge',                  unite: 'ml' },
        { nom: 'Vin blanc sec',              unite: 'ml' },
        { nom: 'Bière',                      unite: 'ml' },
      ],
    },
    {
      cat: 'Épicerie sucrée',
      produits: [
        { nom: 'Beurre de cacahuète',        unite: 'g' },
        { nom: 'Cacao',                      unite: 'g' },
        { nom: 'Cacao en poudre non sucré',  unite: 'g' },
        { nom: 'Chocolat',                   unite: 'g' },
        { nom: 'Chocolat noir',              unite: 'g' },
        { nom: 'Chocolat au lait',           unite: 'g' },
        { nom: 'Chocolat blanc',             unite: 'g' },
        { nom: 'Pépites de chocolat',        unite: 'g' },
        { nom: 'Levure chimique',            unite: 'sachet(s)' },
        { nom: 'Miel',                       unite: 'g' },
        { nom: 'Sirop d\'agave',             unite: 'ml' },
        { nom: 'Sirop d\'érable',            unite: 'ml' },
        { nom: 'Sucre',                      unite: 'g' },
        { nom: 'Sucre roux',                 unite: 'g' },
        { nom: 'Sucre glace',                unite: 'g' },
        { nom: 'Cassonade',                  unite: 'g' },
        { nom: 'Vergeoise brune',            unite: 'g' },
        { nom: 'Vergeoise blonde',           unite: 'g' },
        { nom: 'Confiture',                  unite: 'bocal' },
        { nom: 'Confiture de fraises',       unite: 'bocal' },
        { nom: 'Confiture d\'abricot',       unite: 'bocal' },
        { nom: 'Marmelade d\'orange',        unite: 'bocal' },
        { nom: 'Pâte à tartiner',            unite: 'bocal' },
        { nom: 'Crème de marron',            unite: 'bocal' },
        { nom: 'Compote de pommes',          unite: 'g' },
        { nom: 'Compote',                    unite: 'g' },
        { nom: 'Pâte de pistache',           unite: 'g' },
        { nom: 'Noisettes en poudre',        unite: 'g' },
        { nom: 'Pralin',                     unite: 'g' },
        { nom: 'Gélatine',                   unite: 'feuille(s)' },
        { nom: 'Agar-agar',                  unite: 'g' },
        { nom: 'Fleur d\'oranger',           unite: 'ml' },
        // Farines spéciales pâtisserie
        { nom: 'Farine de châtaigne',        unite: 'g' },
        { nom: 'Farine de sarrasin',         unite: 'g' },
        { nom: 'Farine de maïs',             unite: 'g' },
        { nom: 'Farine de pois chiche',      unite: 'g' },
        { nom: 'Farine d\'amande',           unite: 'g' },
        { nom: 'Farine de coco',             unite: 'g' },
        // Sucres spéciaux
        { nom: 'Sucre muscovado',            unite: 'g' },
        { nom: 'Sucre vanillé',              unite: 'sachet(s)' },
        { nom: 'Édulcorant en poudre',       unite: 'g' },
        { nom: 'Stevia',                     unite: 'g' },
        { nom: 'Mélasse',                    unite: 'ml' },
        // Pâtes & préparations pâtisserie
        { nom: 'Pâte de dattes',             unite: 'g' },
        { nom: 'Massepain',                  unite: 'g' },
        { nom: 'Crème pâtissière en préparation', unite: 'sachet(s)' },
        { nom: 'Préparation flan pâtissier', unite: 'sachet(s)' },
        { nom: 'Nappage pâtissier',          unite: 'sachet(s)' },
        { nom: 'Pâte filo',                  unite: 'paquet(s)' },
        // Biscuits & céréales
        { nom: 'Spéculoos',                  unite: 'paquet(s)' },
        { nom: 'Biscuits sablés',            unite: 'paquet(s)' },
        { nom: 'Boudoirs',                   unite: 'paquet(s)' },
        { nom: 'Gaufrettes',                 unite: 'paquet(s)' },
        { nom: 'Céréales chocolatées',       unite: 'paquet(s)' },
        { nom: 'Céréales miel',              unite: 'paquet(s)' },
        { nom: 'Riz soufflé',                unite: 'paquet(s)' },
        // Fruits secs séchés (usage pâtisserie)
        { nom: 'Canneberges séchées',        unite: 'g' },
        { nom: 'Bananes séchées',            unite: 'g' },
        { nom: 'Mangues séchées',            unite: 'g' },
        { nom: 'Écorces d\'orange confites', unite: 'g' },
        // Confiseries & déco
        { nom: 'Marshmallows',               unite: 'paquet(s)' },
        { nom: 'Bonbons gélifiés',           unite: 'paquet(s)' },
        { nom: 'Sucettes',                   unite: 'paquet(s)' },
        { nom: 'Caramels',                   unite: 'paquet(s)' },
        { nom: 'Dragées chocolat',           unite: 'paquet(s)' },
        { nom: 'Perles de sucre',            unite: 'sachet(s)' },
        { nom: 'Vermicelles décoratifs',     unite: 'sachet(s)' },
      ],
    },
    {
      cat: 'Conserves',
      produits: [
        { nom: 'Anchois',                    unite: 'boîte(s)' },
        { nom: 'Filet de sardine',           unite: 'boîte(s)' },
        { nom: 'Maquereau en boîte',         unite: 'boîte(s)' },
        { nom: 'Saumon en boîte',            unite: 'boîte(s)' },
        { nom: 'Rillettes de thon',          unite: 'boîte(s)' },
        { nom: 'Thon en boîte',              unite: 'boîte(s)' },
        { nom: 'Sauce tomate',               unite: 'g' },
        { nom: 'Tomates concassées',         unite: 'g' },
        { nom: 'Tomates pelées en boîte',    unite: 'g' },
        { nom: 'Pois chiches en boîte',      unite: 'g' },
        { nom: 'Lentilles en boîte',         unite: 'g' },
        { nom: 'Haricots rouges en boîte',   unite: 'g' },
        { nom: 'Haricots blancs en boîte',   unite: 'g' },
        { nom: 'Maïs doux en boîte',         unite: 'g' },
        { nom: 'Poivrons grillés en boîte',  unite: 'g' },
        { nom: 'Artichauts en boîte',        unite: 'g' },
        { nom: 'Olives noires en boîte',     unite: 'g' },
        { nom: 'Tapenade noire',             unite: 'g' },
        { nom: 'Tapenade verte',             unite: 'g' },
        { nom: 'Lait de coco en boîte',      unite: 'ml' },
        { nom: 'Crème de coco',              unite: 'ml' },
        { nom: 'Bouillon cube boeuf',        unite: 'pièce(s)' },
        { nom: 'Bouillon cube légumes',      unite: 'pièce(s)' },
        { nom: 'Bouillon cube volaille',     unite: 'pièce(s)' },
      ],
    },
    {
      cat: 'Surgelés',
      produits: [
        // — Légumes surgelés (usage recette différent du frais) —
        { nom: 'Épinards surgelés',           unite: 'g' },
        { nom: 'Petits pois surgelés',        unite: 'g' },
        { nom: 'Haricots verts surgelés',     unite: 'g' },
        { nom: 'Brocoli surgelé',             unite: 'g' },
        { nom: 'Poêlée de légumes surgelée',  unite: 'g' },
        { nom: 'Mélange de légumes surgelé',  unite: 'g' },
        { nom: 'Oignon émincé surgelé',       unite: 'g' },
        // — Fruits surgelés —
        { nom: 'Fruits rouges surgelés',      unite: 'g' },
        { nom: 'Framboises surgelées',        unite: 'g' },
        { nom: 'Myrtilles surgelées',         unite: 'g' },
        { nom: 'Mangue surgelée',             unite: 'g' },
        { nom: 'Purée de fruits surgelée',    unite: 'g' },
        // — Pâtes & bases —
        { nom: 'Pâte feuilletée surgelée',    unite: 'pièce(s)' },
        { nom: 'Pâte brisée surgelée',        unite: 'pièce(s)' },
        { nom: 'Pâte à pizza surgelée',       unite: 'pièce(s)' },
        // — Pommes de terre —
        { nom: 'Frites surgelées',            unite: 'g' },
        { nom: 'Pommes noisettes surgelées',  unite: 'g' },
        { nom: 'Hash browns',                 unite: 'g' },
        // — Protéines —
        { nom: 'Nuggets de poulet surgelés',  unite: 'g' },
        { nom: 'Cordon bleu surgelé',         unite: 'pièce(s)' },
        { nom: 'Filet de poisson surgelé',    unite: 'g' },
        { nom: 'Poisson pané',                unite: 'g' },
        { nom: 'Crevettes surgelées',         unite: 'g' },
        { nom: 'Mélange de fruits de mer surgelé', unite: 'g' },
        { nom: 'Noix de Saint-Jacques surgelées',  unite: 'g' },
        // — Herbes surgelées —
        { nom: 'Basilic surgelé',             unite: 'g' },
        { nom: 'Persil surgelé',              unite: 'g' },
        { nom: 'Coriandre surgelée',          unite: 'g' },
        { nom: 'Ail surgelé',                 unite: 'g' },
        // — Légumes surgelés supplémentaires —
        { nom: 'Chou-fleur surgelé',          unite: 'paquet(s)' },
        { nom: 'Maïs surgelé',                unite: 'paquet(s)' },
        { nom: 'Carottes en dés surgelées',   unite: 'paquet(s)' },
        { nom: 'Poêlée campagnarde',          unite: 'paquet(s)' },
        { nom: 'Poêlée asiatique',            unite: 'paquet(s)' },
        { nom: 'Poêlée méditerranéenne',      unite: 'paquet(s)' },
        { nom: 'Épinards hachés surgelés',    unite: 'paquet(s)' },
        // — Fruits surgelés supplémentaires —
        { nom: 'Fraises surgelées',           unite: 'paquet(s)' },
        { nom: 'Cerises surgelées',           unite: 'paquet(s)' },
        { nom: 'Ananas surgelé',              unite: 'paquet(s)' },
        // — Poissons & viandes surgelés supplémentaires —
        { nom: 'Filets de cabillaud surgelés',unite: 'paquet(s)' },
        { nom: 'Moules surgelées',            unite: 'paquet(s)' },
        { nom: 'Steaks hachés surgelés',      unite: 'paquet(s)' },
        { nom: 'Escalopes de poulet surgelées', unite: 'paquet(s)' },
        // — Plats préparés surgelés —
        { nom: 'Lasagnes surgelées',          unite: 'paquet(s)' },
        { nom: 'Pizza surgelée',              unite: 'paquet(s)' },
        { nom: 'Quiche lorraine surgelée',    unite: 'paquet(s)' },
        { nom: 'Hachis parmentier surgelé',   unite: 'paquet(s)' },
        { nom: 'Gratin dauphinois surgelé',   unite: 'paquet(s)' },
        // — Desserts surgelés —
        { nom: 'Glace vanille',               unite: 'pièce(s)' },
        { nom: 'Glace chocolat',              unite: 'pièce(s)' },
        { nom: 'Sorbet citron',               unite: 'pièce(s)' },
        { nom: 'Sorbet framboise',            unite: 'pièce(s)' },
      ],
    },
    {
      cat: 'Herbes & Aromates',
      produits: [
        // — Herbes fraîches & séchées —
        { nom: 'Persil',                    unite: 'bouquet' },
        { nom: 'Persil plat',               unite: 'bouquet' },
        { nom: 'Persil frisé',              unite: 'bouquet' },
        { nom: 'Coriandre',                 unite: 'bouquet' },
        { nom: 'Ciboulette',                unite: 'bouquet' },
        { nom: 'Basilic',                   unite: 'bouquet' },
        { nom: 'Basilic thaï',              unite: 'bouquet' },
        { nom: 'Menthe',                    unite: 'bouquet' },
        { nom: 'Menthe poivrée',            unite: 'bouquet' },
        { nom: 'Aneth',                     unite: 'bouquet' },
        { nom: 'Aneth frais',               unite: 'bouquet' },
        { nom: 'Estragon',                  unite: 'bouquet' },
        { nom: 'Cerfeuil',                  unite: 'bouquet' },
        { nom: 'Oseille',                   unite: 'bouquet' },
        { nom: 'Origan',                    unite: 'g' },
        { nom: 'Origan séché',              unite: 'g' },
        { nom: 'Marjolaine',                unite: 'g' },
        { nom: 'Thym',                      unite: 'bouquet' },
        { nom: 'Thym séché',                unite: 'g' },
        { nom: 'Thym citron',               unite: 'bouquet' },
        { nom: 'Romarin',                   unite: 'bouquet' },
        { nom: 'Sarriette',                 unite: 'g' },
        { nom: 'Sauge',                     unite: 'bouquet' },
        { nom: 'Laurier',                   unite: 'feuille(s)' },
        { nom: 'Laurier sauce',             unite: 'feuille(s)' },
        { nom: 'Mélisse',                   unite: 'bouquet' },
        { nom: 'Fines herbes',              unite: 'g' },
        { nom: 'Herbes de Provence',        unite: 'g' },
        { nom: 'Bouquet garni',             unite: 'pièce(s)' },
        { nom: 'Persillade',                unite: 'g' },
        // — Alliacés aromatiques —
        { nom: 'Ail',                       unite: 'tête(s)' },
        { nom: 'Ail noir',                  unite: 'tête(s)' },
        { nom: 'Aillet',                    unite: 'bouquet' },
        { nom: 'Oignon jaune',              unite: 'pièce(s)' },
        { nom: 'Oignon rouge',              unite: 'pièce(s)' },
        { nom: 'Oignon nouveau',            unite: 'bouquet' },
        { nom: 'Échalote',                  unite: 'pièce(s)' },
        { nom: 'Ciboule',                   unite: 'bouquet' },
        { nom: 'Cébettes',                  unite: 'bouquet' },
        { nom: 'Poireau',                   unite: 'pièce(s)' },
        // — Aromates frais exotiques —
        { nom: 'Gingembre frais',           unite: 'g' },
        { nom: 'Galanga',                   unite: 'g' },
        { nom: 'Curcuma frais',             unite: 'g' },
        { nom: 'Citronnelle',               unite: 'tige(s)' },
        { nom: 'Feuille de citron kaffir',  unite: 'pièce(s)' },
        { nom: 'Zeste de citron',           unite: 'g' },
        { nom: 'Zeste de citron vert',      unite: 'g' },
        { nom: 'Zeste d\'orange',           unite: 'g' },
        { nom: 'Eau de rose',               unite: 'ml' },
      ],
    },
    {
      cat: 'Épices',
      produits: [
        // — Poivres & sel —
        { nom: 'Poivre noir',               unite: 'g' },
        { nom: 'Poivre blanc',              unite: 'g' },
        { nom: 'Poivre',                    unite: 'g' },
        { nom: 'Poivre de Sichuan',         unite: 'g' },
        { nom: 'Baies roses',               unite: 'g' },
        { nom: 'Sel fin',                   unite: 'g' },
        { nom: 'Sel',                       unite: 'g' },
        { nom: 'Gros sel',                  unite: 'g' },
        { nom: 'Fleur de sel',              unite: 'g' },
        // — Épices douces —
        { nom: 'Cannelle',                  unite: 'g' },
        { nom: 'Cannelle moulue',           unite: 'g' },
        { nom: 'Bâton de cannelle',         unite: 'pièce(s)' },
        { nom: 'Muscade',                   unite: 'g' },
        { nom: 'Noix de muscade',           unite: 'pièce(s)' },
        { nom: 'Clou de girofle',           unite: 'g' },
        { nom: 'Cardamome verte',           unite: 'g' },
        { nom: 'Anis étoilé',               unite: 'g' },
        { nom: 'Badiane',                   unite: 'g' },
        { nom: 'Fenouil en graines',        unite: 'g' },
        { nom: 'Cumin',                     unite: 'g' },
        { nom: 'Cumin moulu',               unite: 'g' },
        { nom: 'Carvi',                     unite: 'g' },
        { nom: 'Coriandre en graines',      unite: 'g' },
        { nom: 'Coriandre moulue',          unite: 'g' },
        { nom: 'Curcuma',                   unite: 'g' },
        { nom: 'Curcuma moulu',             unite: 'g' },
        { nom: 'Gingembre moulu',           unite: 'g' },
        // — Paprika & piments —
        { nom: 'Paprika',                   unite: 'g' },
        { nom: 'Paprika doux',              unite: 'g' },
        { nom: 'Paprika fumé',              unite: 'g' },
        { nom: 'Paprika fort',              unite: 'g' },
        { nom: 'Piment de Cayenne',         unite: 'g' },
        { nom: 'Piment en poudre',          unite: 'g' },
        { nom: 'Flocons de piment',         unite: 'g' },
        { nom: 'Piment d\'Espelette',       unite: 'g' },
        { nom: 'Piment',                    unite: 'g' },
        // — Épices spéciales —
        { nom: 'Sumac',                     unite: 'g' },
        { nom: 'Zaatar',                    unite: 'g' },
        { nom: 'Safran',                    unite: 'g' },
        { nom: 'Vanille',                   unite: 'g' },
        { nom: 'Gousse de vanille',         unite: 'pièce(s)' },
        { nom: 'Poudre de vanille',         unite: 'g' },
        { nom: 'Graines de moutarde',       unite: 'g' },
        { nom: 'Moutarde en poudre',        unite: 'g' },
        { nom: 'Nigelle',                   unite: 'g' },
        { nom: 'Sésame noir',               unite: 'g' },
        { nom: 'Sésame blanc',              unite: 'g' },
        { nom: 'Graines de sésame',         unite: 'g' },
        { nom: 'Fenugrec',                  unite: 'g' },
        { nom: 'Sel de Guérande',           unite: 'g' },
        { nom: 'Sel de céleri',             unite: 'g' },
        { nom: 'Poivre long',               unite: 'g' },
        { nom: 'Poivre de la Jamaïque',     unite: 'g' },
        { nom: 'Piment ancho',              unite: 'g' },
        { nom: 'Chipotle',                  unite: 'g' },
        { nom: 'Levure de bière',           unite: 'g' },
        { nom: 'Gomashio',                  unite: 'g' },
        // — Poudres aromatiques —
        { nom: 'Ail en poudre',             unite: 'g' },
        { nom: 'Oignon en poudre',          unite: 'g' },
        // — Mélanges d\'épices —
        { nom: 'Cinq-épices chinois',       unite: 'g' },
        { nom: 'Quatre-épices',             unite: 'g' },
        { nom: 'Ras el hanout',             unite: 'g' },
        { nom: 'Garam masala',              unite: 'g' },
        { nom: 'Curry doux',                unite: 'g' },
        { nom: 'Curry fort',                unite: 'g' },
        { nom: 'Curry madras',              unite: 'g' },
        { nom: 'Curry jaune',               unite: 'g' },
        { nom: 'Curry rouge',               unite: 'g' },
        { nom: 'Tandoori',                  unite: 'g' },
        { nom: 'Colombo',                   unite: 'g' },
        { nom: 'Baharat',                   unite: 'g' },
        { nom: 'Chili en poudre',           unite: 'g' },
        { nom: 'Épices à couscous',         unite: 'g' },
        { nom: 'Mélange cajun',             unite: 'g' },
        { nom: 'Mélange tex-mex',           unite: 'g' },
        { nom: 'Mélange shawarma',          unite: 'g' },
        { nom: 'Mélange kebab',             unite: 'g' },
        { nom: 'Furikake',                  unite: 'g' },
        { nom: 'Togarashi',                 unite: 'g' },
      ],
    },
    {
      cat: 'Asiatique',
      produits: [
        { nom: 'Feuille de nori',            unite: 'pièce(s)' },
        { nom: 'Feuille de riz',             unite: 'pièce(s)' },
        { nom: 'Gochujang',                  unite: 'g' },
        { nom: 'Huile de sésame toasté',     unite: 'ml' },
        { nom: 'Huile pimentée Lao Gan Ma',  unite: 'g' },
        { nom: 'Lait de coco',               unite: 'ml' },
        { nom: 'Miso mixte',                 unite: 'g' },
        { nom: 'Pâte d\'ail',               unite: 'g' },
        { nom: 'Pâte de gingembre',          unite: 'g' },
        { nom: 'Sauce hoisin',               unite: 'ml' },
        { nom: 'Sauce huître',               unite: 'ml' },
        { nom: 'Sauce Nuoc-mâm',             unite: 'ml' },
        { nom: 'Sauce soja salée',           unite: 'ml' },
        { nom: 'Sauce soja sucrée',          unite: 'ml' },
        { nom: 'Sauce sweet chili Thai',     unite: 'ml' },
        { nom: 'Sauce thaïe épicée',         unite: 'ml' },
        { nom: 'Sauce yakitori',             unite: 'ml' },
        { nom: 'Sauce tamari',               unite: 'ml' },
        { nom: 'Sambal oelek',               unite: 'g' },
        { nom: 'Wasabi',                     unite: 'g' },
        { nom: 'Pâte de curry rouge',        unite: 'g' },
        { nom: 'Pâte de curry vert',         unite: 'g' },
        { nom: 'Pâte de curry jaune',        unite: 'g' },
        { nom: 'Pâte miso blanc',            unite: 'g' },
        { nom: 'Dashi',                      unite: 'g' },
        { nom: 'Sriracha',                   unite: 'ml' },
        { nom: 'Tahini',                     unite: 'g' },
      ],
    },
    {
      cat: 'Bio',
      produits: [
        { nom: 'Bicarbonate de sodium', unite: 'g' },
        { nom: 'Farine d\'épeautre',    unite: 'g' },
        { nom: 'Huile quintessences',   unite: 'ml' },
        { nom: 'Sucre complet',         unite: 'g' },
        { nom: 'Sucre de coco',         unite: 'g' },
        { nom: 'Sucre de dattes',       unite: 'g' },
        { nom: 'Tofu nature bio',       unite: 'g' },
        { nom: 'Tofu fumé bio',         unite: 'g' },
        { nom: 'Tempeh bio',            unite: 'g' },
        { nom: 'Seitan bio',            unite: 'g' },
        { nom: 'Spiruline en poudre',   unite: 'g' },
        { nom: 'Maca en poudre',        unite: 'g' },
        { nom: 'Graines de chia',       unite: 'g' },
        { nom: 'Graines de lin',        unite: 'g' },
        { nom: 'Psyllium',              unite: 'g' },
        { nom: 'Huile de coco vierge',  unite: 'ml' },
        { nom: 'Huile de lin',          unite: 'ml' },
        { nom: 'Huile de colza vierge', unite: 'ml' },
        { nom: 'Vinaigre de cidre brut',unite: 'ml' },
        { nom: 'Purée d\'amande',       unite: 'g' },
        { nom: 'Purée de noisette',     unite: 'g' },
        { nom: 'Boisson coco',          unite: 'L' },
        { nom: 'Boisson noisette',      unite: 'L' },
        { nom: 'Levure maltée',         unite: 'g' },
      ],
    },
    {
      cat: 'Hygiène',
      produits: [
        { nom: 'Carré de coton enfant',               unite: 'pièce(s)' },
        { nom: 'Coton-tige',                          unite: 'boîte(s)' },
        { nom: 'Crème hydratante bébé corps & visage',unite: 'pièce(s)' },
        { nom: 'Crème solaire enfants',               unite: 'pièce(s)' },
        { nom: 'Dentifrice',                          unite: 'pièce(s)' },
        { nom: 'Déodorant',                           unite: 'pièce(s)' },
        { nom: 'Disque coton démaquillant',           unite: 'pièce(s)' },
        { nom: 'Gel douche',                          unite: 'pièce(s)' },
        { nom: 'Gel nettoyant mains',                 unite: 'pièce(s)' },
        { nom: 'Gel nettoyant visage & corps enfants',unite: 'pièce(s)' },
        { nom: 'Shampoing',                           unite: 'pièce(s)' },
        { nom: 'Savon',                               unite: 'pièce(s)' },
        { nom: 'Lingettes bébé',                      unite: 'paquet(s)' },
        { nom: 'Couches',                             unite: 'paquet(s)' },
        { nom: 'Protège-slip',                        unite: 'boîte(s)' },
        { nom: 'Serviettes hygiéniques',              unite: 'paquet(s)' },
        { nom: 'Rasoir',                              unite: 'pièce(s)' },
        { nom: 'Crème à raser',                       unite: 'pièce(s)' },
        // Soins capillaires
        { nom: 'Après-shampoing',                     unite: 'ml' },
        { nom: 'Masque capillaire',                   unite: 'ml' },
        // Soins visage adulte
        { nom: 'Crème hydratante visage',             unite: 'ml' },
        { nom: 'Nettoyant visage',                    unite: 'ml' },
        { nom: 'Eau micellaire',                      unite: 'ml' },
        { nom: 'Sérum visage',                        unite: 'ml' },
        { nom: 'Crème contour des yeux',              unite: 'ml' },
        { nom: 'Baume à lèvres',                      unite: 'pièce(s)' },
        // Soins corps adulte
        { nom: 'Lait corporel',                       unite: 'ml' },
        { nom: 'Crème pour les mains',                unite: 'ml' },
        // Hygiène bucco-dentaire
        { nom: 'Brosse à dents',                      unite: 'pièce(s)' },
        { nom: 'Fil dentaire',                        unite: 'pièce(s)' },
        { nom: 'Bain de bouche',                      unite: 'ml' },
        { nom: 'Brossettes interdentaires',           unite: 'boîte(s)' },
        // Hygiène quotidienne
        { nom: 'Mouchoirs',                           unite: 'boîte(s)' },
        { nom: 'Cotons démaquillants',                unite: 'paquet(s)' },
        // Hygiène intime & féminine
        { nom: 'Tampons',                             unite: 'boîte(s)' },
        { nom: 'Gel intime',                          unite: 'ml' },
        // Soins bébé
        { nom: 'Crème pour le change',                unite: 'ml' },
        { nom: 'Shampoing bébé',                      unite: 'ml' },
        { nom: 'Lait de toilette bébé',               unite: 'ml' },
        // Solaire adulte
        { nom: 'Crème solaire adulte',                unite: 'ml' },
        { nom: 'Après-soleil',                        unite: 'ml' },
        { nom: 'Rasoirs jetables',                    unite: 'paquet(s)' },
        { nom: 'Mousse à raser',                      unite: 'ml' },
      ],
    },
    {
      cat: 'Boulangerie',
      produits: [
        // Pains
        { nom: 'Baguette',                   unite: 'pièce(s)' },
        { nom: 'Baguette tradition',         unite: 'pièce(s)' },
        { nom: 'Pain de campagne',           unite: 'pièce(s)' },
        { nom: 'Pain complet',               unite: 'pièce(s)' },
        { nom: 'Pain aux céréales',          unite: 'pièce(s)' },
        { nom: 'Pain de seigle',             unite: 'pièce(s)' },
        { nom: 'Pain d\'épeautre',           unite: 'pièce(s)' },
        { nom: 'Pain brié',                  unite: 'pièce(s)' },
        { nom: 'Pain au levain',             unite: 'pièce(s)' },
        { nom: 'Pain viennois',              unite: 'pièce(s)' },
        { nom: 'Pain nordique',              unite: 'pièce(s)' },
        { nom: 'Pain aux noix',              unite: 'pièce(s)' },
        { nom: 'Pain aux figues',            unite: 'pièce(s)' },
        { nom: 'Pain brioche',               unite: 'pièce(s)' },
        { nom: 'Pain hot-dog',               unite: 'paquet(s)' },
        { nom: 'Pain burger',                unite: 'pièce(s)' },
        { nom: 'Bagel',                      unite: 'pièce(s)' },
        { nom: 'Ciabatta',                   unite: 'pièce(s)' },
        { nom: 'Focaccia',                   unite: 'pièce(s)' },
        { nom: 'Pain turc',                  unite: 'pièce(s)' },
        { nom: 'Pain de mie complet',        unite: 'pièce(s)' },
        // Viennoiseries
        { nom: 'Croissant',                  unite: 'pièce(s)' },
        { nom: 'Pain au chocolat',           unite: 'pièce(s)' },
        { nom: 'Pain aux raisins',           unite: 'pièce(s)' },
        { nom: 'Chausson aux pommes',        unite: 'pièce(s)' },
        { nom: 'Brioche',                    unite: 'pièce(s)' },
        { nom: 'Brioche tressée',            unite: 'pièce(s)' },
        { nom: 'Brioche vendéenne',          unite: 'pièce(s)' },
        { nom: 'Brioche aux pépites',        unite: 'pièce(s)' },
        { nom: 'Brioche suisse',             unite: 'pièce(s)' },
        { nom: 'Palmier',                    unite: 'pièce(s)' },
        { nom: 'Viennoiserie',               unite: 'pièce(s)' },
        // Pâtisseries individuelles
        { nom: 'Madeleine',                  unite: 'pièce(s)' },
        { nom: 'Financier',                  unite: 'pièce(s)' },
        { nom: 'Cookie',                     unite: 'pièce(s)' },
        { nom: 'Muffin',                     unite: 'pièce(s)' },
        { nom: 'Brownie',                    unite: 'pièce(s)' },
        { nom: 'Éclair chocolat',            unite: 'pièce(s)' },
        { nom: 'Éclair café',                unite: 'pièce(s)' },
        { nom: 'Mille-feuille',              unite: 'pièce(s)' },
        { nom: 'Religieuse',                 unite: 'pièce(s)' },
        { nom: 'Paris-Brest',                unite: 'pièce(s)' },
        // Gâteaux à la coupe
        { nom: 'Cake marbré',                unite: 'tranche(s)' },
        { nom: 'Quatre-quarts',              unite: 'tranche(s)' },
        { nom: 'Flan pâtissier',             unite: 'pièce(s)' },
        { nom: 'Tarte aux pommes',           unite: 'pièce(s)' },
        { nom: 'Tarte citron',               unite: 'pièce(s)' },
        { nom: 'Tarte aux fruits',           unite: 'pièce(s)' },
        { nom: 'Gâteau',                     unite: 'pièce(s)' },
        { nom: 'Tarte',                      unite: 'pièce(s)' },
      ],
    },
    {
      cat: 'Boissons',
      produits: [
        { nom: 'Eau plate',                  unite: 'L' },
        { nom: 'Eau gazeuse',                unite: 'L' },
        { nom: 'Jus d\'orange',              unite: 'L' },
        { nom: 'Jus de pomme',               unite: 'L' },
        { nom: 'Jus de raisin',              unite: 'L' },
        { nom: 'Jus multifruits',            unite: 'L' },
        { nom: 'Nectar de mangue',           unite: 'L' },
        { nom: 'Sirop de citron',            unite: 'ml' },
        { nom: 'Sirop de grenadine',         unite: 'ml' },
        { nom: 'Sirop de menthe',            unite: 'ml' },
        { nom: 'Soda',                       unite: 'L' },
        { nom: 'Cola',                       unite: 'L' },
        { nom: 'Limonade',                   unite: 'L' },
        { nom: 'Café',                       unite: 'g' },
        { nom: 'Café moulu',                 unite: 'g' },
        { nom: 'Café en grains',             unite: 'g' },
        { nom: 'Café soluble',               unite: 'g' },
        { nom: 'Thé noir',                   unite: 'boîte(s)' },
        { nom: 'Thé vert',                   unite: 'boîte(s)' },
        { nom: 'Thé à la menthe',            unite: 'boîte(s)' },
        { nom: 'Tisane',                     unite: 'boîte(s)' },
        { nom: 'Lait végétal',               unite: 'L' },
        { nom: 'Lait d\'amande',             unite: 'L' },
        { nom: 'Lait d\'avoine',             unite: 'L' },
        { nom: 'Lait de soja',               unite: 'L' },
        { nom: 'Lait de riz',                unite: 'L' },
        { nom: 'Boisson chocolatée',         unite: 'g' },
        { nom: 'Chocolat en poudre',         unite: 'g' },
        // Eaux aromatisées
        { nom: 'Eau aromatisée citron',      unite: 'L' },
        { nom: 'Eau aromatisée fruits rouges', unite: 'L' },
        // Jus supplémentaires
        { nom: 'Jus d\'ananas',              unite: 'L' },
        { nom: 'Jus de mangue',              unite: 'L' },
        { nom: 'Jus d\'abricot',             unite: 'L' },
        { nom: 'Jus de pêche',               unite: 'L' },
        { nom: 'Jus de poire',               unite: 'L' },
        { nom: 'Jus de tomate',              unite: 'L' },
        // Sodas supplémentaires
        { nom: 'Cola sans sucre',            unite: 'L' },
        { nom: 'Tonic',                      unite: 'L' },
        { nom: 'Ginger ale',                 unite: 'L' },
        { nom: 'Ginger beer',                unite: 'L' },
        { nom: 'Orangeade',                  unite: 'L' },
        { nom: 'Soda citron',                unite: 'L' },
        // Boissons énergétiques
        { nom: 'Boisson énergétique',        unite: 'ml' },
        { nom: 'Boisson isotonique',         unite: 'ml' },
        // Cafés
        { nom: 'Capsules café',              unite: 'boîte(s)' },
        { nom: 'Dosettes café',              unite: 'boîte(s)' },
        { nom: 'Café décaféiné',             unite: 'g' },
        // Thés & infusions
        { nom: 'Earl Grey',                  unite: 'sachet(s)' },
        { nom: 'Rooibos',                    unite: 'sachet(s)' },
        { nom: 'Camomille',                  unite: 'sachet(s)' },
        { nom: 'Verveine',                   unite: 'sachet(s)' },
        { nom: 'Tilleul',                    unite: 'sachet(s)' },
        { nom: 'Infusion fruits rouges',     unite: 'sachet(s)' },
        // Bières
        { nom: 'Bière blonde',               unite: 'L' },
        { nom: 'Bière blanche',              unite: 'L' },
        { nom: 'Bière ambrée',               unite: 'L' },
        { nom: 'Bière sans alcool',          unite: 'L' },
        // Vins & pétillants
        { nom: 'Rosé',                       unite: 'L' },
        { nom: 'Champagne',                  unite: 'L' },
        { nom: 'Crémant',                    unite: 'L' },
        // Fermentés & apéros
        { nom: 'Kombucha',                   unite: 'L' },
        { nom: 'Cidre doux',                 unite: 'L' },
        { nom: 'Cidre brut',                 unite: 'L' },
        // Sirops enfants
        { nom: 'Sirop de fraise',            unite: 'ml' },
        { nom: 'Sirop de pêche',             unite: 'ml' },
      ],
    },
    {
      cat: 'Entretien',
      produits: [
        { nom: 'Liquide vaisselle',          unite: 'pièce(s)' },
        { nom: 'Capsules lave-vaisselle',    unite: 'paquet(s)' },
        { nom: 'Sel régénérant',             unite: 'kg' },
        { nom: 'Lessive liquide',            unite: 'L' },
        { nom: 'Lessive en poudre',          unite: 'kg' },
        { nom: 'Capsules lessive',           unite: 'paquet(s)' },
        { nom: 'Adoucissant',                unite: 'L' },
        { nom: 'Spray nettoyant multi-usage',unite: 'pièce(s)' },
        { nom: 'Spray salle de bain',        unite: 'pièce(s)' },
        { nom: 'Spray vitres',               unite: 'pièce(s)' },
        { nom: 'Déboucheur',                 unite: 'pièce(s)' },
        { nom: 'Détartrant',                 unite: 'pièce(s)' },
        { nom: 'Javel',                      unite: 'L' },
        { nom: 'Éponge',                     unite: 'pièce(s)' },
        { nom: 'Essuie-tout',                unite: 'rouleau(x)' },
        { nom: 'Papier toilette',            unite: 'rouleau(x)' },
        { nom: 'Sacs poubelle',              unite: 'rouleau(x)' },
        { nom: 'Sacs congélation',           unite: 'paquet(s)' },
        { nom: 'Film alimentaire',           unite: 'rouleau(x)' },
        { nom: 'Papier cuisson',             unite: 'rouleau(x)' },
        { nom: 'Aluminium ménager',          unite: 'rouleau(x)' },
        { nom: 'Torchon',                    unite: 'pièce(s)' },
        { nom: 'Brosse WC',                  unite: 'pièce(s)' },
        { nom: 'Balai',                      unite: 'pièce(s)' },
        { nom: 'Serpillière',                unite: 'pièce(s)' },
        // Produits WC
        { nom: 'Gel WC',                     unite: 'ml' },
        { nom: 'Bloc WC',                    unite: 'pièce(s)' },
        { nom: 'Tablettes WC',               unite: 'boîte(s)' },
        // Nettoyants sols
        { nom: 'Nettoyant sols parquet',     unite: 'L' },
        { nom: 'Nettoyant sols carrelage',   unite: 'L' },
        // Nettoyants spécialisés
        { nom: 'Dégraissant cuisine',        unite: 'ml' },
        { nom: 'Nettoyant four',             unite: 'ml' },
        { nom: 'Anti-calcaire',              unite: 'ml' },
        { nom: 'Désinfectant ménager',       unite: 'ml' },
        // Lave-vaisselle
        { nom: 'Tablettes lave-vaisselle',   unite: 'boîte(s)' },
        { nom: 'Liquide de rinçage',         unite: 'ml' },
        // Lessive supplémentaire
        { nom: 'Détachant textile',          unite: 'ml' },
        // Accessoires ménage
        { nom: 'Lavettes',                   unite: 'paquet(s)' },
        { nom: 'Chiffons microfibres',       unite: 'paquet(s)' },
        { nom: 'Brosse de ménage',           unite: 'pièce(s)' },
        // Sacs supplémentaires
        { nom: 'Sacs poubelle cuisine',      unite: 'paquet(s)' },
        { nom: 'Sacs poubelle salle de bain',unite: 'paquet(s)' },
        // Consommables cuisine
        { nom: 'Filtres à café',             unite: 'boîte(s)' },
      ],
    },
  ]

  const produits: Produit[] = []
  for (const groupe of PAR_CAT) {
    const categorieId = cat(groupe.cat)
    if (!categorieId) continue
    for (const p of groupe.produits) {
      produits.push({
        id: `seed-prod-${norm(p.nom)}`,
        nom: p.nom,
        nomNormalise: norm(p.nom),
        type: 'consommable',
        categorie: categorieId,
        categorieIds: [categorieId],
        unite: p.unite,
        frequenceAchat: 0,
        archive: false,
        ...withAudit({}),
        deviceId: 'seed',
      } as Produit)
    }
  }

  await db.produits.bulkPut(produits)
}

// ── Fiches pédagogiques complètes ─────────────────────────────────────────────
async function seedActivites(): Promise<void> {
  const now = new Date()

  function act(
    nom: string,
    categorie: string,
    ageMin: number,
    ageMax: number,
    _dureePreparation: number,
    dureeActivite: number,
    difficulte: 'facile' | 'moyen' | 'difficile',
    objectifPedagogique: string,
    materiel: string[],
    competencesCiblees: string[],
    instructions: string,
  ): Activite {
    return {
      id: stableActivityId(nom),
      nom,
      categorie,
      ageMin,
      ageMax,
      dureeEstimee: dureeActivite,
      difficulte,
      objectifPedagogique,
      materiel,
      competencesCiblees,
      instructions,
      statutBibliotheque: 'a_faire',
      archive: false,
      createdAt: now,
      updatedAt: now,
      deviceId: '',
    }
  }

  const activites: Activite[] = [

    // ═══════════════════════════════════════════════════════
    // SENSORIEL
    // ═══════════════════════════════════════════════════════

    act('Lavage de voitures cacao', 'Sensoriel', 18, 48, 5, 20, 'facile',
      'Stimuler les sens tactiles et olfactifs tout en développant la motricité fine et la coordination œil-main.',
      ['Bac ou bassine', 'Petites voitures', 'Cacao en poudre', 'Eau tiède', 'Petites éponges', 'Serviettes'],
      ['Motricité fine', 'Coordination œil-main', 'Exploration sensorielle'],
      '1. Préparer une bassine d\'eau tiède avec du cacao. 2. Présenter les voitures sales à l\'enfant. 3. L\'inviter à les laver avec les éponges. 4. Rincer et sécher ensemble. Nommer les sensations : chaud, froid, doux, mouillé.',
    ),

    act('Lavage animaux ferme', 'Sensoriel', 18, 48, 5, 20, 'facile',
      'Développer l\'exploration sensorielle tactile et la motricité fine à travers le jeu symbolique.',
      ['Bac', 'Figurines animaux ferme', 'Eau tiède', 'Savon doux', 'Brosses douces', 'Serviettes'],
      ['Motricité fine', 'Jeu symbolique', 'Exploration sensorielle'],
      '1. Remplir le bac d\'eau savonneuse tiède. 2. Disposer les animaux. 3. L\'enfant lave, brosse, rince chaque animal. 4. Nommer les animaux et leurs sons. Enrichir le vocabulaire : ferme, cochon, vache, mouton.',
    ),

    act('Bac dinosaures archéologie', 'Sensoriel', 24, 60, 10, 30, 'moyen',
      'Stimuler la curiosité scientifique et la motricité fine à travers la fouille et la découverte.',
      ['Bac', 'Sable fin ou farine', 'Figurines dinosaures', 'Petits pinceaux', 'Cuillères'],
      ['Motricité fine', 'Curiosité scientifique', 'Concentration'],
      '1. Enfouir les dinosaures dans le sable. 2. Donner les outils de fouille à l\'enfant. 3. L\'enfant fouille et découvre. 4. Nommer chaque dinosaure, parler de la préhistoire. Encourager la patience et la précision.',
    ),

    act('Bac ferme sensoriel', 'Sensoriel', 12, 48, 5, 20, 'facile',
      'Éveiller les sens et enrichir le vocabulaire autour du thème de la ferme.',
      ['Bac', 'Foin ou raphia', 'Figurines animaux ferme', 'Graines', 'Terre', 'Petits outils'],
      ['Exploration sensorielle', 'Vocabulaire', 'Jeu symbolique'],
      '1. Remplir le bac de foin et graines. 2. Cacher les animaux. 3. L\'enfant explore, découvre, nomme. 4. Créer une histoire avec les animaux. Enrichir le vocabulaire : fermier, enclos, pâture.',
    ),

    act('Bac potager', 'Sensoriel', 18, 54, 10, 25, 'facile',
      'Développer la connaissance du monde végétal et l\'exploration sensorielle.',
      ['Bac', 'Terre', 'Graines réelles ou plastique', 'Petits légumes', 'Outils jardinage'],
      ['Découverte du monde', 'Exploration sensorielle', 'Motricité fine'],
      '1. Préparer le bac avec de la terre. 2. Présenter les légumes et graines. 3. L\'enfant plante, arrose, récolte. 4. Parler du cycle de croissance des plantes. Nommer les légumes et leurs couleurs.',
    ),

    act('Bac eau poissons', 'Sensoriel', 12, 42, 5, 20, 'facile',
      'Stimuler l\'exploration sensorielle aquatique et le vocabulaire marin.',
      ['Bac', 'Eau bleue colorée', 'Poissons jouets', 'Épuisettes', 'Cailloux', 'Coquillages'],
      ['Exploration sensorielle', 'Motricité fine', 'Vocabulaire'],
      '1. Colorier l\'eau en bleu. 2. Disposer les poissons et éléments marins. 3. L\'enfant pêche, observe, trie. 4. Nommer les animaux marins et leur habitat. Encourager le langage descriptif.',
    ),

    act('Bac glace pingouins', 'Sensoriel', 18, 48, 15, 25, 'facile',
      'Explorer les contrastes chaud/froid et développer la conscience des habitats naturels.',
      ['Bac', 'Glaçons', 'Figurines pingouins', 'Eau froide', 'Neige artificielle optionnelle'],
      ['Exploration sensorielle', 'Découverte du monde', 'Vocabulaire'],
      '1. Préparer le bac avec de l\'eau froide et des glaçons. 2. Disposer les pingouins sur la glace. 3. L\'enfant explore les températures. 4. Parler des animaux polaires et de la banquise. Observer la fonte des glaçons.',
    ),

    act('Bac mousse sensorielle', 'Sensoriel', 12, 42, 10, 20, 'facile',
      'Stimuler l\'exploration tactile et favoriser l\'expression créative à travers un médium inhabituel.',
      ['Bac', 'Mousse à raser', 'Colorants alimentaires', 'Petits jouets', 'Spatules'],
      ['Exploration sensorielle', 'Expression créative', 'Motricité fine'],
      '1. Étaler la mousse à raser dans le bac. 2. Ajouter quelques gouttes de colorant. 3. L\'enfant malaxe, trace des formes, joue. 4. Nommer les couleurs et les sensations. Encourager le langage : doux, froid, léger.',
    ),

    act('Bac riz coloré', 'Sensoriel', 12, 48, 15, 25, 'facile',
      'Développer l\'exploration sensorielle auditive et tactile à travers le transvasement.',
      ['Riz cru', 'Colorants alimentaires', 'Bac', 'Récipients variés', 'Cuillères', 'Entonnoirs'],
      ['Exploration sensorielle', 'Motricité fine', 'Coordination'],
      '1. Préparer le riz coloré à l\'avance. 2. Proposer différents contenants. 3. L\'enfant verse, transvase, écoute le son. 4. Nommer les couleurs et comparer les quantités. Introduire les notions plein/vide, plus/moins.',
    ),

    act('Bac semoule cachée', 'Sensoriel', 18, 48, 5, 20, 'facile',
      'Stimuler l\'exploration tactile et kinesthésique et développer la concentration.',
      ['Bac', 'Semoule fine', 'Petits objets cachés', 'Cuillères', 'Tamis'],
      ['Exploration sensorielle', 'Concentration', 'Motricité fine'],
      '1. Remplir le bac de semoule. 2. Cacher des objets. 3. L\'enfant cherche avec les mains ou les outils. 4. Nommer et décrire les objets trouvés. Travailler le vocabulaire : caché, trouvé, dessous.',
    ),

    act('Bac sable sec', 'Sensoriel', 12, 60, 5, 30, 'facile',
      'Explorer les propriétés physiques du sable et développer la motricité fine.',
      ['Bac', 'Sable fin sec', 'Moules', 'Tamis', 'Cuillères', 'Petits contenants'],
      ['Exploration sensorielle', 'Motricité fine', 'Compréhension physique'],
      '1. Remplir le bac de sable sec. 2. Proposer moules et outils. 3. L\'enfant verse, tamisere, trace. 4. Observer comment le sable coule. Comparer : lourd/léger, plein/vide.',
    ),

    act('Bac sable mouillé', 'Sensoriel', 12, 60, 5, 30, 'facile',
      'Explorer les propriétés du sable humide et développer la créativité constructive.',
      ['Bac', 'Sable fin', 'Eau', 'Moules variés', 'Spatules', 'Petits outils'],
      ['Exploration sensorielle', 'Créativité', 'Motricité fine'],
      '1. Humidifier le sable progressivement. 2. Montrer comment former des châteaux. 3. L\'enfant construit librement. 4. Parler des constructions, comparer formes et tailles. Observer les différences sable sec/mouillé.',
    ),

    act('Bac eau colorée', 'Sensoriel', 12, 48, 5, 20, 'facile',
      'Explorer les propriétés visuelles de l\'eau colorée et stimuler la créativité.',
      ['Bac', 'Eau', 'Colorants alimentaires', 'Seringues', 'Pipettes', 'Petits contenants transparents'],
      ['Exploration sensorielle', 'Découverte des couleurs', 'Motricité fine'],
      '1. Préparer plusieurs couleurs dans des contenants. 2. L\'enfant mélange les couleurs. 3. Observer les mélanges et nommer les nouvelles couleurs. 4. Travailler le mélange primaire/secondaire. Encourager les prédictions.',
    ),

    act('Bac épices', 'Sensoriel', 18, 54, 5, 15, 'facile',
      'Développer la discrimination olfactive et enrichir le vocabulaire sensoriel.',
      ['Petits bols', 'Épices variées (cannelle, cumin, curcuma…)', 'Bac', 'Cuillères'],
      ['Exploration sensorielle', 'Discrimination olfactive', 'Vocabulaire'],
      '1. Disposer les épices dans des bols séparés. 2. L\'enfant sent et explore. 3. Décrire les odeurs ensemble. 4. Associer les épices à des aliments connus. Introduire : fort, doux, piquant, sucré.',
    ),

    act('Bac tissus', 'Sensoriel', 12, 42, 5, 20, 'facile',
      'Développer la discrimination tactile et enrichir le vocabulaire des textures.',
      ['Bac', 'Tissus variés (velours, soie, coton, laine, rugueux)', 'Objets en tissu'],
      ['Exploration sensorielle', 'Discrimination tactile', 'Vocabulaire'],
      '1. Disposer les tissus dans le bac. 2. L\'enfant explore avec les mains et les pieds. 3. Décrire les textures. 4. Trier par texture : doux/rugueux, chaud/froid. Encourager la description.',
    ),

    act('Bac glace objets', 'Sensoriel', 18, 54, 30, 25, 'moyen',
      'Explorer le concept de changement d\'état et développer la patience et la persévérance.',
      ['Moules à glace', 'Petits objets', 'Bac', 'Sel', 'Pipettes d\'eau tiède', 'Outils'],
      ['Compréhension scientifique', 'Patience', 'Motricité fine'],
      '1. Préparer les glaçons avec des objets dedans la veille. 2. L\'enfant libère les objets avec le sel et l\'eau. 3. Observer la fonte. 4. Parler des changements d\'état : solide/liquide. Encourager la persévérance.',
    ),

    act('Bac animaux sauvages', 'Sensoriel', 18, 60, 5, 25, 'facile',
      'Enrichir le vocabulaire animalier et favoriser le jeu symbolique.',
      ['Bac', 'Herbe artificielle ou naturelle', 'Figurines animaux sauvages', 'Sable', 'Eau'],
      ['Vocabulaire', 'Jeu symbolique', 'Découverte du monde'],
      '1. Créer différents habitats dans le bac. 2. L\'enfant place les animaux dans leur habitat. 3. Inventer des histoires. 4. Nommer les animaux et leur continent. Parler de la savane, jungle, désert.',
    ),

    act('Bac mer sensoriel', 'Sensoriel', 18, 54, 10, 25, 'facile',
      'Explorer l\'environnement marin et développer la curiosité naturaliste.',
      ['Bac', 'Eau bleue', 'Sable', 'Coquillages', 'Galets', 'Figurines marines', 'Algues factices'],
      ['Exploration sensorielle', 'Découverte du monde', 'Vocabulaire'],
      '1. Créer un décor marin dans le bac. 2. L\'enfant explore et joue librement. 3. Identifier les éléments marins. 4. Parler de l\'océan, des plages, des créatures marines.',
    ),

    act('Bac eau transvasement', 'Sensoriel', 12, 42, 5, 20, 'facile',
      'Développer la coordination œil-main et la compréhension des volumes.',
      ['Bac', 'Eau', 'Récipients variés', 'Seringues', 'Entonnoirs', 'Éponges', 'Louches'],
      ['Coordination œil-main', 'Compréhension des volumes', 'Motricité fine'],
      '1. Remplir le bac d\'eau. 2. Proposer différents contenants. 3. L\'enfant verse et transvase. 4. Comparer les volumes : plus/moins, plein/vide. Introduire la notion de capacité.',
    ),

    act('Bac farine', 'Sensoriel', 12, 42, 5, 20, 'facile',
      'Stimuler l\'exploration tactile et kinesthésique à travers un médium naturel.',
      ['Bac', 'Farine', 'Moules', 'Cuillères', 'Entonnoirs'],
      ['Exploration sensorielle', 'Motricité fine', 'Créativité'],
      '1. Remplir le bac de farine. 2. Proposer des moules et outils. 3. L\'enfant trace, façonne, verse. 4. Observer les empreintes. Parler des textures : doux, léger, qui coule.',
    ),

    act('Bac nature mix', 'Sensoriel', 18, 60, 10, 25, 'facile',
      'Développer la curiosité naturaliste et la discrimination sensorielle multi-matières.',
      ['Bac', 'Feuilles', 'Brindilles', 'Cailloux', 'Mousse', 'Écorces', 'Glands', 'Châtaignes'],
      ['Découverte du monde', 'Exploration sensorielle', 'Vocabulaire'],
      '1. Rassembler des éléments naturels. 2. L\'enfant explore et trie. 3. Identifier chaque élément. 4. Classer par texture, taille, couleur. Parler des saisons et de la nature.',
    ),

    act('Bac animaux polaire', 'Sensoriel', 18, 54, 15, 25, 'facile',
      'Explorer les milieux polaires et enrichir le vocabulaire animalier.',
      ['Bac', 'Neige artificielle ou sel', 'Glaçons', 'Figurines polaires (ours, pingouin, phoque)', 'Eau froide'],
      ['Découverte du monde', 'Vocabulaire', 'Exploration sensorielle'],
      '1. Créer un paysage polaire dans le bac. 2. L\'enfant place les animaux. 3. Explorer les températures. 4. Parler de l\'Arctique et de l\'Antarctique. Nommer les animaux polaires.',
    ),

    act('Bac aimants', 'Sensoriel', 24, 60, 5, 20, 'moyen',
      'Développer la curiosité scientifique et comprendre les propriétés magnétiques.',
      ['Bac', 'Semoule ou sable', 'Objets métalliques', 'Objets non magnétiques', 'Aimants variés'],
      ['Curiosité scientifique', 'Logique', 'Motricité fine'],
      '1. Mélanger objets métalliques et non métalliques dans le bac. 2. L\'enfant utilise l\'aimant pour trier. 3. Distinguer ce qui est attiré ou non. 4. Faire des prédictions avant d\'essayer. Introduire : métal, aimant, attraction.',
    ),

    act('Bac eau chaude froide', 'Sensoriel', 18, 48, 5, 15, 'facile',
      'Explorer les sensations thermiques et développer le vocabulaire des températures.',
      ['Deux bacs', 'Eau chaude (tiède)', 'Eau froide', 'Petits objets', 'Serviettes'],
      ['Exploration sensorielle', 'Discrimination thermique', 'Vocabulaire'],
      '1. Préparer deux bacs à températures différentes. 2. L\'enfant trempe les mains alternativement. 3. Décrire les sensations. 4. Trier les objets dans les bacs selon la préférence. Nommer : chaud, froid, tiède.',
    ),

    act('Bac mousse colorée', 'Sensoriel', 12, 42, 10, 20, 'facile',
      'Stimuler l\'exploration tactile et visuelle à travers la couleur et la texture.',
      ['Bac', 'Mousse à raser', 'Colorants alimentaires', 'Spatules', 'Petits jouets'],
      ['Exploration sensorielle', 'Découverte des couleurs', 'Expression créative'],
      '1. Préparer la mousse colorée par zones. 2. L\'enfant malaxe et mélange. 3. Observer les mélanges de couleurs. 4. Tracer des formes et des lettres. Encourager la description des sensations.',
    ),

    act('Bac graines', 'Sensoriel', 12, 48, 5, 20, 'facile',
      'Développer la discrimination sensorielle et la connaissance du monde végétal.',
      ['Bac', 'Graines variées (lentilles, haricots, maïs, tournesol)', 'Récipients', 'Cuillères', 'Tamis'],
      ['Exploration sensorielle', 'Découverte du monde', 'Motricité fine'],
      '1. Mélanger les graines dans le bac. 2. L\'enfant trie, transvase, explore. 3. Identifier chaque graine. 4. Parler de leur origine végétale. Comparer les tailles et textures.',
    ),

    act('Bac cuisine sensoriel', 'Sensoriel', 18, 54, 10, 25, 'facile',
      'Développer le jeu symbolique et l\'exploration sensorielle dans un contexte familier.',
      ['Bac', 'Semoule ou farine', 'Petits ustensiles de cuisine', 'Moules', 'Cuillères', 'Bols'],
      ['Jeu symbolique', 'Exploration sensorielle', 'Motricité fine'],
      '1. Installer le bac comme une mini-cuisine. 2. L\'enfant prépare des "repas". 3. Nommer les ustensiles et les actions. 4. Encourager le vocabulaire culinaire. Jouer le rôle du client et du cuisinier.',
    ),

    act('Bac tri couleurs', 'Sensoriel', 18, 48, 5, 20, 'facile',
      'Développer la discrimination visuelle des couleurs et les compétences de classement.',
      ['Bac', 'Objets multicolores variés', 'Petits bols colorés correspondants'],
      ['Discrimination visuelle', 'Logique', 'Motricité fine'],
      '1. Mélanger les objets dans le bac. 2. Présenter les bols colorés. 3. L\'enfant trie les objets par couleur. 4. Nommer et compter les objets dans chaque bol. Complexifier avec des nuances.',
    ),

    act('Bac boutons', 'Motricité fine', 18, 54, 5, 20, 'facile',
      'Développer la motricité fine et la discrimination visuelle à travers le tri et la manipulation.',
      ['Bac', 'Boutons variés (tailles, couleurs, formes)', 'Récipients de tri', 'Pince à épiler optionnelle'],
      ['Motricité fine', 'Discrimination visuelle', 'Logique'],
      '1. Verser les boutons dans le bac. 2. Proposer de trier par couleur, taille ou forme. 3. Utiliser les doigts puis la pince. 4. Compter les boutons de chaque groupe. Complexifier selon l\'âge.',
    ),

    act('Bac construction', 'Construction et logique', 24, 60, 5, 30, 'moyen',
      'Développer la pensée spatiale et la créativité constructive.',
      ['Bac', 'Sable humide', 'Brindilles', 'Petites pierres', 'Cubes', 'Figurines'],
      ['Pensée spatiale', 'Créativité', 'Motricité fine'],
      '1. Préparer le bac avec différents matériaux. 2. L\'enfant construit librement. 3. Nommer les constructions. 4. Encourager la planification. Parler d\'architecture, de ponts, de maisons.',
    ),

    // ═══════════════════════════════════════════════════════
    // MOTRICITÉ FINE
    // ═══════════════════════════════════════════════════════

    act('Transvasement cuillère', 'Motricité fine', 12, 36, 3, 15, 'facile',
      'Développer la coordination œil-main et le contrôle des mouvements fins.',
      ['Deux bols', 'Cuillère à soupe', 'Haricots ou lentilles'],
      ['Coordination œil-main', 'Contrôle moteur', 'Concentration'],
      '1. Placer les légumineuses dans un bol. 2. Montrer comment transférer cuillère par cuillère. 3. L\'enfant transvase de gauche à droite. 4. Compter les cuillerées. Varier avec différentes cuillères.',
    ),

    act('Transvasement à la main', 'Motricité fine', 12, 30, 3, 10, 'facile',
      'Développer la proprioception et le contrôle du geste.',
      ['Deux bols larges', 'Haricots', 'Maïs', 'Gros cailloux lisses'],
      ['Proprioception', 'Contrôle moteur', 'Coordination'],
      '1. Remplir un bol de matière à transporter. 2. L\'enfant transfère à pleines mains. 3. Varier la texture des objets. 4. Encourager la précision : ne rien renverser. Observer la progression.',
    ),

    act('Déchirer papier', 'Motricité fine', 12, 36, 2, 15, 'facile',
      'Renforcer les muscles des mains et développer la coordination bimanuelle.',
      ['Papier journal', 'Papier de soie', 'Colle', 'Feuille blanche'],
      ['Coordination bimanuelle', 'Tonus musculaire', 'Créativité'],
      '1. Montrer comment tenir le papier des deux mains. 2. L\'enfant déchire librement. 3. Coller les morceaux sur une feuille pour créer un collage. 4. Nommer les formes obtenues. Varier les textures de papier.',
    ),

    act('Collage libre', 'Motricité fine', 18, 54, 5, 20, 'facile',
      'Développer la créativité et la motricité fine à travers l\'utilisation de la colle.',
      ['Colle en stick ou liquide', 'Diverses matières (papier, tissu, feuilles)', 'Support cartonné'],
      ['Motricité fine', 'Créativité', 'Expression artistique'],
      '1. Présenter les matériaux disponibles. 2. L\'enfant choisit et colle librement. 3. Encourager sans diriger. 4. Verbaliser les choix et les créations. Exposer le résultat.',
    ),

    act('Pinces à linge', 'Motricité fine', 24, 54, 2, 15, 'moyen',
      'Renforcer les muscles des doigts et développer la pince tripode.',
      ['Pinces à linge en bois', 'Boîte ou panier', 'Cartes colorées optionnelles'],
      ['Pince tripode', 'Tonus musculaire', 'Coordination'],
      '1. Montrer comment ouvrir une pince. 2. L\'enfant attache les pinces sur le bord de la boîte. 3. Complexifier avec un tri par couleur. 4. Compter les pinces. Prépare la prise du crayon.',
    ),

    act('Transvasement pince', 'Motricité fine', 24, 54, 3, 15, 'moyen',
      'Affiner la motricité fine et la coordination œil-main avec un outil.',
      ['Pince de cuisine ou à épiler', 'Deux bols', 'Petits objets (pompons, fèves, billes)'],
      ['Coordination œil-main', 'Pince tripode', 'Concentration'],
      '1. Placer les objets dans un bol. 2. L\'enfant utilise la pince pour transférer. 3. Varier la taille des objets. 4. Encourager la précision. Compter et nommer les couleurs.',
    ),

    act('Enfiler perles', 'Motricité fine', 24, 60, 3, 20, 'moyen',
      'Développer la coordination fine et la concentration à travers une activité de préhension.',
      ['Perles de tailles variées', 'Lacet ou fil rigide', 'Bol'],
      ['Coordination fine', 'Concentration', 'Patience'],
      '1. Montrer comment tenir le fil et la perle. 2. L\'enfant enfile les perles. 3. Créer des alternances de couleurs. 4. Compter les perles. Varier la taille selon la progression.',
    ),

    act('Visser dévisser', 'Motricité fine', 18, 48, 3, 15, 'facile',
      'Développer la coordination bimanuelle et comprendre le mécanisme de rotation.',
      ['Bocaux avec couvercles variés', 'Boulons et écrous', 'Boîtes à visser'],
      ['Coordination bimanuelle', 'Compréhension mécanique', 'Motricité fine'],
      '1. Présenter les bocaux fermés. 2. Montrer le sens de rotation. 3. L\'enfant visse et dévisse. 4. Varier les tailles. Introduire : serrer, desserrer, tourner.',
    ),

    act('Trier objets', 'Motricité fine', 18, 48, 5, 20, 'facile',
      'Développer la logique classificatoire et la discrimination visuelle.',
      ['Objets variés (couleurs, formes, tailles)', 'Boîtes de tri', 'Bacs'],
      ['Logique', 'Discrimination visuelle', 'Motricité fine'],
      '1. Mélanger les objets. 2. Définir les critères de tri avec l\'enfant. 3. L\'enfant trie. 4. Valider ensemble et compter. Varier les critères : couleur, forme, taille, matière.',
    ),

    act('Gommettes', 'Motricité fine', 18, 48, 2, 15, 'facile',
      'Développer la pince fine et la coordination œil-main à travers le collage de gommettes.',
      ['Gommettes variées', 'Feuille blanche ou dessin à compléter'],
      ['Pince fine', 'Coordination œil-main', 'Créativité'],
      '1. Présenter les gommettes. 2. L\'enfant décolle et colle librement ou suit un modèle. 3. Nommer les formes et couleurs. 4. Compter les gommettes. Proposer de compléter un dessin.',
    ),

    act('Pâte à modeler', 'Motricité fine', 18, 72, 5, 25, 'facile',
      'Renforcer les muscles des mains et développer la créativité tridimensionnelle.',
      ['Pâte à modeler', 'Outils de modelage', 'Emporte-pièces', 'Rouleau'],
      ['Tonus musculaire', 'Créativité 3D', 'Motricité fine'],
      '1. Réchauffer la pâte dans les mains. 2. Montrer les techniques de base : rouler, aplatir, pincer. 3. L\'enfant crée librement ou suit un thème. 4. Nommer et valoriser les créations.',
    ),

    act('Pinces cuisine', 'Motricité fine', 24, 54, 2, 15, 'moyen',
      'Affiner la motricité fine et renforcer les muscles de la main.',
      ['Pinces de cuisine', 'Éponges ou pompons', 'Deux bols'],
      ['Motricité fine', 'Coordination', 'Tonus musculaire'],
      '1. Présenter les pinces et les objets. 2. L\'enfant utilise les pinces pour transférer. 3. Varier la taille des objets. 4. Chronomètre optionnel pour les plus grands. Comparer avec les doigts.',
    ),

    act('Papier à trouer', 'Motricité fine', 24, 54, 5, 20, 'moyen',
      'Développer la coordination et le contrôle du geste avec un outil.',
      ['Perforatrice', 'Papier varié', 'Bol pour récupérer les confettis'],
      ['Coordination', 'Contrôle du geste', 'Motricité fine'],
      '1. Montrer comment utiliser la perforatrice. 2. L\'enfant perce le papier. 3. Observer les formes créées. 4. Utiliser les confettis pour un collage. Renforcer les muscles nécessaires à l\'écriture.',
    ),

    // ═══════════════════════════════════════════════════════
    // PRÉ-ÉCRITURE
    // ═══════════════════════════════════════════════════════

    act('Labyrinthe doigt', 'Pré-écriture', 24, 54, 2, 10, 'facile',
      'Développer le contrôle directionnel du geste et préparer au tracé.',
      ['Plateau de sable ou sel', 'Fiches labyrinthe plastifiées', 'Feutres'],
      ['Contrôle directionnel', 'Coordination', 'Concentration'],
      '1. Tracer le labyrinthe dans le sable avec le doigt. 2. L\'enfant suit le chemin. 3. Progresser vers des labyrinthes plus complexes. 4. Transférer sur papier avec un feutre. Verbaliser : gauche, droite, tout droit.',
    ),

    act('Tracés verticaux', 'Pré-écriture', 24, 48, 2, 10, 'facile',
      'Maîtriser le tracé vertical de haut en bas, base de plusieurs lettres.',
      ['Feuilles lignées larges', 'Crayons de cire', 'Tableau blanc', 'Plateau de sable'],
      ['Contrôle du geste', 'Coordination', 'Orientation spatiale'],
      '1. Montrer le tracé du haut vers le bas. 2. L\'enfant s\'entraîne sur sable puis papier. 3. Varier les supports. 4. Vérifier la tenue du crayon. Prépare les lettres l, i, t.',
    ),

    act('Tracés horizontaux', 'Pré-écriture', 24, 48, 2, 10, 'facile',
      'Maîtriser le tracé horizontal de gauche à droite, sens conventionnel de l\'écriture.',
      ['Feuilles larges', 'Crayons', 'Tableau', 'Plateau de sable'],
      ['Contrôle du geste', 'Sens de l\'écriture', 'Coordination'],
      '1. Montrer le tracé de gauche à droite. 2. Associer à une image (train sur ses rails). 3. L\'enfant trace sur sable puis papier. 4. Varier la taille des tracés. Prépare les lettres e, t, L.',
    ),

    act('Ponts', 'Pré-écriture', 30, 54, 2, 10, 'moyen',
      'Maîtriser le tracé en arc, base de nombreuses lettres minuscules.',
      ['Feuilles', 'Crayons de cire', 'Modèles de ponts'],
      ['Contrôle du geste', 'Coordination', 'Précision'],
      '1. Montrer le tracé en arc (comme un pont). 2. Partir de gauche, monter, descendre. 3. L\'enfant reproduit la suite de ponts. 4. Varier la taille. Prépare les lettres n, m, h, p.',
    ),

    act('Boucles', 'Pré-écriture', 30, 54, 2, 10, 'moyen',
      'Maîtriser le tracé en boucle pour préparer l\'écriture cursive.',
      ['Feuilles larges', 'Crayons', 'Modèles'],
      ['Contrôle du geste', 'Fluidité', 'Coordination'],
      '1. Montrer la boucle sur grand format. 2. Associer à une image (escargot). 3. L\'enfant trace une suite de boucles. 4. Diminuer la taille progressivement. Prépare les lettres l, b, e, f.',
    ),

    act('Suivi de lignes', 'Pré-écriture', 24, 48, 2, 10, 'facile',
      'Développer le contrôle du geste et la précision du tracé.',
      ['Fiches plastifiées avec chemins', 'Feutres effaçables', 'Crayons'],
      ['Précision', 'Contrôle du geste', 'Concentration'],
      '1. Présenter la fiche avec le chemin. 2. L\'enfant suit la ligne sans sortir. 3. Augmenter la difficulté. 4. Valider ensemble. Varier : pointillés, lignes courbes, zigzags.',
    ),

    act('Découpage ligne', 'Pré-écriture', 30, 54, 2, 15, 'moyen',
      'Développer la coordination bimanuelle et le contrôle des ciseaux.',
      ['Ciseaux adaptés enfant', 'Feuilles avec lignes droites imprimées'],
      ['Coordination bimanuelle', 'Contrôle des ciseaux', 'Motricité fine'],
      '1. Montrer la prise correcte des ciseaux. 2. L\'enfant découpe en suivant la ligne. 3. Commencer par des bandes larges. 4. Progresser vers des lignes plus fines. Règle de sécurité.',
    ),

    act('Découpage formes', 'Pré-écriture', 36, 60, 3, 20, 'difficile',
      'Maîtriser le découpage de formes géométriques et développer la précision.',
      ['Ciseaux enfant', 'Feuilles avec formes imprimées (cercle, carré, triangle)'],
      ['Précision', 'Coordination bimanuelle', 'Contrôle moteur'],
      '1. Rappeler les règles de sécurité. 2. Commencer par le carré (angles droits). 3. Progresser vers le cercle. 4. Coller les formes découpées. Nommer les formes géométriques.',
    ),

    // ═══════════════════════════════════════════════════════
    // CONSTRUCTION ET LOGIQUE
    // ═══════════════════════════════════════════════════════

    act('Lego fin', 'Construction et logique', 30, 72, 3, 30, 'moyen',
      'Développer la pensée spatiale, la patience et la motricité fine.',
      ['Lego Duplo ou Lego classique selon l\'âge', 'Modèles optionnels'],
      ['Pensée spatiale', 'Motricité fine', 'Patience', 'Concentration'],
      '1. Commencer par une construction libre. 2. Proposer un modèle simple. 3. L\'enfant reproduit ou crée. 4. Nommer les couleurs et compter les pièces. Encourager la persévérance.',
    ),

    act('Reproduire modèle', 'Construction et logique', 30, 60, 5, 20, 'moyen',
      'Développer la pensée spatiale et la mémoire visuelle.',
      ['Cartes modèles', 'Cubes de couleur', 'Perles', 'Formes géométriques'],
      ['Mémoire visuelle', 'Pensée spatiale', 'Concentration'],
      '1. Présenter le modèle à reproduire. 2. L\'enfant observe puis reproduit. 3. Comparer avec l\'original. 4. Augmenter la complexité. Travailler la mémorisation à court terme.',
    ),

    act('Activité multi-étapes', 'Construction et logique', 36, 60, 10, 30, 'difficile',
      'Développer la planification, la séquentialité et la persévérance.',
      ['Kit d\'activité avec étapes claires', 'Matériel varié selon le projet'],
      ['Planification', 'Séquentialité', 'Persévérance'],
      '1. Présenter le projet et ses étapes. 2. L\'enfant réalise étape par étape. 3. Valider chaque étape avant de passer à la suivante. 4. Célébrer le résultat final. Développe la cognition exécutive.',
    ),

    act('Bac aimants', 'Construction et logique', 24, 60, 5, 20, 'moyen',
      'Découvrir les propriétés magnétiques et développer le raisonnement scientifique.',
      ['Aimants variés', 'Objets métalliques et non métalliques', 'Bac', 'Fiche de tri'],
      ['Raisonnement scientifique', 'Logique', 'Curiosité'],
      '1. Présenter les aimants et les objets. 2. L\'enfant prédit puis vérifie. 3. Trier selon les résultats. 4. Expliquer simplement le magnétisme. Encourager les questions.',
    ),

    // ═══════════════════════════════════════════════════════
    // MATHÉMATIQUES
    // ═══════════════════════════════════════════════════════

    act('Compter avec des Lego', 'Mathématiques', 24, 54, 3, 20, 'facile',
      'Développer la numération et la correspondance terme à terme.',
      ['Lego Duplo', 'Cartes chiffres', 'Boîte'],
      ['Numération', 'Correspondance terme à terme', 'Logique'],
      '1. Montrer une carte chiffre. 2. L\'enfant pose le nombre correspondant de Lego. 3. Valider en comptant ensemble. 4. Progresser jusqu\'à 10 puis 20. Associer le chiffre au cardinal.',
    ),

    act('Tours de jetons', 'Mathématiques', 24, 48, 3, 15, 'facile',
      'Développer la numération et la notion de quantité.',
      ['Jetons de couleur', 'Cartes chiffres'],
      ['Numération', 'Notion de quantité', 'Coordination'],
      '1. Montrer un chiffre. 2. L\'enfant empile le nombre de jetons correspondant. 3. Comparer les tours. 4. Plus grand / plus petit. Introduire la notion de hauteur liée à la quantité.',
    ),

    act('Boîtes à compter', 'Mathématiques', 24, 54, 5, 20, 'facile',
      'Développer la numération et la discrimination quantitative.',
      ['Boîtes numérotées de 1 à 10', 'Petits objets (billes, haricots)'],
      ['Numération', 'Correspondance terme à terme', 'Logique'],
      '1. Présenter les boîtes numérotées. 2. L\'enfant place le bon nombre d\'objets. 3. Valider en comptant. 4. Mélanger et recommencer. Travailler l\'association chiffre/quantité.',
    ),

    act('Chasse aux nombres', 'Mathématiques', 24, 54, 5, 20, 'facile',
      'Reconnaître les chiffres dans l\'environnement et développer la conscience numérique.',
      ['Cartes chiffres', 'Objets de la maison', 'Panier'],
      ['Reconnaissance des chiffres', 'Conscience numérique', 'Langage'],
      '1. Montrer un chiffre. 2. L\'enfant cherche ce nombre d\'objets. 3. Compter ensemble. 4. Varier les espaces de recherche. Travailler l\'environnement numérique.',
    ),

    act('Puzzle de quantités', 'Mathématiques', 30, 60, 3, 15, 'moyen',
      'Associer chiffre, mot et quantité de manière concrète.',
      ['Puzzle chiffre/quantité', 'Fiches auto-correctives'],
      ['Association chiffre/quantité', 'Lecture des chiffres', 'Logique'],
      '1. Mélanger les pièces du puzzle. 2. L\'enfant associe chaque chiffre à sa quantité. 3. Auto-corriger. 4. Nommer chaque chiffre. Renforcer la correspondance terme à terme.',
    ),

    act('Ponts de Lego', 'Mathématiques', 30, 60, 5, 25, 'moyen',
      'Développer la notion de mesure et de comparaison.',
      ['Lego Duplo', 'Petites voitures ou figurines', 'Règle optionnelle'],
      ['Mesure', 'Comparaison', 'Pensée spatiale'],
      '1. Construire des ponts de différentes longueurs. 2. Faire passer les voitures. 3. Comparer les tailles. 4. Mesurer en Lego. Introduire : plus long, plus court, pareil.',
    ),

    act('Jeu du panier', 'Mathématiques', 24, 48, 3, 15, 'facile',
      'Développer la notion de quantité et le calcul intuitif.',
      ['Panier', 'Balles ou objets', 'Cartes chiffres'],
      ['Notion de quantité', 'Calcul intuitif', 'Motricité globale'],
      '1. L\'enfant lance des objets dans le panier. 2. Compter les objets dedans et dehors. 3. Ajouter ou retirer des objets. 4. Poser des questions : combien il en reste ? Introduire addition/soustraction intuitive.',
    ),

    act('Cartes à points', 'Mathématiques', 24, 54, 3, 15, 'facile',
      'Développer la subitisation (reconnaissance immédiate des quantités) et la numération.',
      ['Cartes à points (type dés)', 'Cartes chiffres'],
      ['Subitisation', 'Numération', 'Mémoire'],
      '1. Montrer une carte à points rapidement. 2. L\'enfant annonce la quantité. 3. Valider. 4. Associer au chiffre correspondant. Développe la conscience du nombre.',
    ),

    act('Mini marché', 'Mathématiques', 30, 60, 15, 30, 'moyen',
      'Développer la compréhension de l\'échange monétaire et le calcul concret.',
      ['Aliments jouets', 'Pièces de monnaie jouets', 'Étiquettes prix simples'],
      ['Calcul concret', 'Compréhension monétaire', 'Jeu symbolique'],
      '1. Installer le marché avec les aliments et prix. 2. L\'enfant achète avec les pièces. 3. Rendre la monnaie simple. 4. Varier les rôles. Introduire le concept d\'échange et de valeur.',
    ),

    act('Collage quantités', 'Mathématiques', 24, 48, 5, 20, 'facile',
      'Associer représentation graphique et quantité concrète.',
      ['Feuilles avec chiffres imprimés', 'Gommettes ou collants', 'Colle'],
      ['Association chiffre/quantité', 'Motricité fine', 'Numération'],
      '1. Montrer une fiche avec un chiffre. 2. L\'enfant colle le bon nombre de gommettes. 3. Valider ensemble. 4. Nommer le chiffre et la quantité. Travailler jusqu\'à 10.',
    ),

    act('Mini loto nombres', 'Mathématiques', 30, 54, 3, 20, 'moyen',
      'Reconnaître les chiffres et développer l\'attention et la mémoire.',
      ['Planches de loto avec chiffres', 'Cartes à tirer', 'Jetons'],
      ['Reconnaissance des chiffres', 'Attention', 'Mémoire'],
      '1. Distribuer les planches. 2. Tirer une carte. 3. L\'enfant cherche et couvre le chiffre. 4. Le premier qui complète gagne. Jouer en famille pour enrichir l\'expérience.',
    ),

    // ═══════════════════════════════════════════════════════
    // LANGAGE ET PRÉLECTURE
    // ═══════════════════════════════════════════════════════

    act('Tri de syllabes', 'Langage et prélecture', 36, 60, 5, 20, 'moyen',
      'Développer la conscience phonologique et segmenter les mots en syllabes.',
      ['Images d\'objets', 'Cartes syllabes', 'Bols de tri'],
      ['Conscience phonologique', 'Segmentation syllabique', 'Mémoire auditive'],
      '1. Présenter une image. 2. Frapper les syllabes ensemble. 3. Placer dans le bon bol. 4. Comparer les mots longs et courts. Chanter des comptines pour ancrer.',
    ),

    act('Lecture imagée', 'Langage et prélecture', 30, 60, 3, 20, 'facile',
      'Développer le vocabulaire et la compréhension de l\'écrit.',
      ['Livres imagés', 'Cartes images/mots', 'Albums'],
      ['Vocabulaire', 'Compréhension', 'Lien image/mot'],
      '1. Montrer l\'image et lire le mot. 2. L\'enfant retrouve l\'image quand on dit le mot. 3. Inventer une phrase. 4. Travailler thème par thème. Construire le lexique.',
    ),

    act('Puzzle mots simples', 'Langage et prélecture', 36, 60, 3, 15, 'moyen',
      'Reconnaître les lettres et reconstituer des mots simples.',
      ['Puzzles de mots avec images associées'],
      ['Reconnaissance des lettres', 'Assemblage', 'Logique'],
      '1. Montrer l\'image. 2. L\'enfant assemble les lettres pour former le mot. 3. Lire le mot ensemble. 4. Commencer par des mots de 3 lettres. Progresser vers 4-5 lettres.',
    ),

    act('Memory syllabes', 'Langage et prélecture', 36, 60, 3, 20, 'moyen',
      'Développer la mémoire auditive et la conscience phonologique.',
      ['Paires de cartes syllabes avec images'],
      ['Mémoire', 'Conscience phonologique', 'Attention'],
      '1. Mélanger et retourner les cartes. 2. L\'enfant retourne deux cartes. 3. Si même syllabe, garder la paire. 4. Prononcer à chaque retournement. Enrichit la mémoire de travail.',
    ),

    act('Dictée imagée', 'Langage et prélecture', 42, 66, 5, 20, 'difficile',
      'Développer le lien oral/écrit et la conscience phonologique avancée.',
      ['Fiches avec cases vides', 'Images', 'Crayon'],
      ['Lien oral/écrit', 'Conscience phonologique', 'Motricité fine'],
      '1. Montrer une image. 2. L\'enfant dessine ou trace la première lettre. 3. Valider ensemble. 4. Progresser vers des mots entiers. Prépare à l\'écriture autonome.',
    ),

    act('Bingo syllabes', 'Langage et prélecture', 36, 60, 5, 20, 'moyen',
      'Reconnaître et associer les syllabes de manière ludique.',
      ['Planches de bingo syllabes', 'Cartes syllabes', 'Jetons'],
      ['Conscience phonologique', 'Attention', 'Mémoire auditive'],
      '1. Distribuer les planches. 2. Piocher et annoncer une syllabe. 3. L\'enfant couvre si présent. 4. Prononcer et chercher des mots avec cette syllabe. Rend l\'apprentissage ludique.',
    ),

    act('Lecture tactile', 'Langage et prélecture', 30, 54, 5, 15, 'facile',
      'Associer la forme des lettres à leur son à travers le toucher.',
      ['Lettres rugueuses (Montessori)', 'Lettres en mousse', 'Sable pour tracer'],
      ['Reconnaissance des lettres', 'Mémoire tactile', 'Association son/graphème'],
      '1. Présenter une lettre rugueuse. 2. L\'enfant trace avec le doigt en disant le son. 3. Chercher des mots commençant par ce son. 4. Tracer dans le sable. Méthode sensorielle efficace.',
    ),

    act('Collage de mots', 'Langage et prélecture', 36, 60, 10, 25, 'moyen',
      'Reconnaître les mots écrits et développer la conscience de l\'écrit.',
      ['Magazines', 'Journaux', 'Ciseaux', 'Colle', 'Feuille thématique'],
      ['Conscience de l\'écrit', 'Motricité fine', 'Vocabulaire'],
      '1. Choisir un thème. 2. L\'enfant cherche et découpe des mots. 3. Coller sur la feuille thématique. 4. Lire ensemble les mots trouvés. Développe la conscience que l\'écrit a du sens.',
    ),

    act('Jeu de rôle lecture', 'Langage et prélecture', 30, 60, 5, 20, 'facile',
      'Développer le langage oral et la compréhension narrative à travers le jeu symbolique.',
      ['Albums illustrés', 'Marionnettes', 'Accessoires liés à l\'histoire'],
      ['Langage oral', 'Compréhension narrative', 'Jeu symbolique'],
      '1. Lire l\'histoire ensemble. 2. Distribuer les rôles. 3. L\'enfant rejoue l\'histoire. 4. Inventer une suite. Développe la compréhension et le langage expressif.',
    ),

    act('Cherche et lis', 'Langage et prélecture', 36, 60, 5, 20, 'moyen',
      'Reconnaître les mots globalement et développer la lecture par reconnaissance.',
      ['Étiquettes mots', 'Objets correspondants dans la maison'],
      ['Lecture globale', 'Discrimination visuelle', 'Mémoire'],
      '1. Poser des étiquettes sur les objets. 2. L\'enfant lit l\'étiquette et va chercher l\'objet. 3. Valider ensemble. 4. Augmenter le nombre de mots. Méthode globale de reconnaissance.',
    ),

    act('Syllabes mobiles', 'Langage et prélecture', 36, 60, 5, 20, 'moyen',
      'Composer et décomposer des mots en manipulant des syllabes concrètes.',
      ['Cartes syllabes', 'Images de mots correspondants'],
      ['Conscience phonologique', 'Composition de mots', 'Logique'],
      '1. Présenter l\'image. 2. L\'enfant assemble les cartes syllabes pour former le mot. 3. Prononcer syllabe par syllabe. 4. Trouver d\'autres mots avec les mêmes syllabes. Consolide la conscience syllabique.',
    ),

    act('Histoire séquentielle', 'Langage et prélecture', 30, 60, 3, 20, 'moyen',
      'Développer la compréhension narrative et la pensée séquentielle.',
      ['Cartes images d\'une histoire à remettre en ordre', '4 à 6 images'],
      ['Compréhension narrative', 'Pensée séquentielle', 'Langage'],
      '1. Mélanger les cartes. 2. L\'enfant remet dans l\'ordre. 3. Raconter l\'histoire avec les mots. 4. Comparer avec la version originale. Développe l\'anticipation et la causalité.',
    ),

    act('Chasse aux mots', 'Langage et prélecture', 36, 60, 5, 20, 'moyen',
      'Reconnaître les mots dans l\'environnement et développer la conscience de l\'écrit.',
      ['Magazines', 'Journaux', 'Loupe jouet', 'Liste de mots cibles'],
      ['Conscience de l\'écrit', 'Discrimination visuelle', 'Attention'],
      '1. Donner la liste de mots à chercher. 2. L\'enfant cherche dans les magazines. 3. Entourer les mots trouvés. 4. Valider et lire ensemble. Développe la conscience que l\'écrit est partout.',
    ),

    // ═══════════════════════════════════════════════════════
    // MOTRICITÉ GLOBALE
    // ═══════════════════════════════════════════════════════

    act('Parcours moteur jardin', 'Motricité globale', 18, 60, 15, 30, 'moyen',
      'Développer la coordination motrice globale et la conscience corporelle.',
      ['Cerceaux', 'Tunnels', 'Plots', 'Lattes', 'Balles'],
      ['Coordination motrice', 'Conscience corporelle', 'Équilibre'],
      '1. Installer le parcours. 2. Montrer chaque étape. 3. L\'enfant réalise le parcours complet. 4. Varier la difficulté. Encourager sans compétition. Développe les habiletés locomotrices.',
    ),

    act('Chasse aux trésors', 'Motricité globale', 24, 72, 20, 40, 'moyen',
      'Développer la motricité globale, l\'orientation spatiale et le langage.',
      ['Indices écrits ou dessinés', 'Trésor final', 'Espace à explorer'],
      ['Orientation spatiale', 'Langage', 'Motricité globale'],
      '1. Préparer les indices. 2. L\'enfant suit les instructions. 3. Trouver le trésor. 4. Relire les indices ensemble. Développe les concepts spatiaux : devant, derrière, à gauche.',
    ),

    act('Lancer de balle dans panier', 'Motricité globale', 18, 54, 3, 15, 'facile',
      'Développer la coordination œil-main et la force des bras.',
      ['Balles de tailles variées', 'Panier ou bac'],
      ['Coordination œil-main', 'Motricité globale', 'Ajustement de la force'],
      '1. Placer le panier à distance variable. 2. L\'enfant lance. 3. Compter les réussites. 4. Varier la distance et la balle. Encourager l\'estimation de la force nécessaire.',
    ),

    act('Course simple', 'Motricité globale', 18, 48, 2, 15, 'facile',
      'Développer la locomotion, l\'endurance et la gestion de l\'espace.',
      ['Espace dégagé', 'Plots ou repères'],
      ['Locomotion', 'Endurance', 'Orientation spatiale'],
      '1. Délimiter le parcours avec des repères. 2. L\'enfant court d\'un repère à l\'autre. 3. Varier : vite, lentement, en reculant. 4. Introduire des défis : sans tomber, avec équilibre. Renforce le cardio.',
    ),

    act('Jeu du stop (statue)', 'Motricité globale', 24, 60, 2, 15, 'facile',
      'Développer le contrôle du corps, l\'inhibition motrice et l\'écoute.',
      ['Musique', 'Espace dégagé'],
      ['Contrôle moteur', 'Inhibition', 'Écoute'],
      '1. Expliquer les règles : bouger quand la musique joue, s\'arrêter quand elle s\'arrête. 2. L\'enfant joue. 3. Varier les poses de statue. 4. Jouer en groupe. Développe l\'inhibition cognitive.',
    ),

    act('Jeu d\'équilibre (ligne au sol)', 'Motricité globale', 18, 54, 2, 15, 'facile',
      'Développer l\'équilibre statique et dynamique et la conscience corporelle.',
      ['Ruban adhésif ou corde', 'Sol plat'],
      ['Équilibre', 'Conscience corporelle', 'Coordination'],
      '1. Tracer une ligne au sol. 2. L\'enfant marche sur la ligne. 3. Complexifier : les bras écartés, à reculons, avec un objet en équilibre. 4. Varier les trajectoires. Renforce la proprioception.',
    ),

    act('Transport d\'objets', 'Motricité globale', 18, 48, 3, 15, 'facile',
      'Développer la coordination et la gestion de l\'effort.',
      ['Objets de poids variés', 'Sacs', 'Brouette jouet', 'Parcours défini'],
      ['Coordination', 'Gestion de l\'effort', 'Motricité globale'],
      '1. Définir un parcours. 2. L\'enfant transporte des objets d\'un point à un autre. 3. Varier le poids et la taille. 4. Compter les voyages. Développe la force et la planification.',
    ),

    act('Saut dans cerceaux', 'Motricité globale', 24, 54, 3, 15, 'facile',
      'Développer la coordination et les habiletés de saut.',
      ['Cerceaux', 'Sol plat'],
      ['Coordination', 'Habiletés de saut', 'Équilibre'],
      '1. Disposer les cerceaux en chemin. 2. L\'enfant saute de cerceau en cerceau. 3. Varier : pieds joints, pied droit, pied gauche. 4. Nommer la couleur de chaque cerceau. Développe la latéralité.',
    ),

    act('Jeu du "va chercher"', 'Motricité globale', 18, 42, 2, 15, 'facile',
      'Développer la compréhension des consignes et la mémoire à court terme.',
      ['Objets variés dans la maison ou jardin'],
      ['Compréhension des consignes', 'Mémoire', 'Locomotion'],
      '1. Donner une consigne simple. 2. L\'enfant cherche et rapporte. 3. Complexifier : deux objets, avec critère de couleur. 4. Jouer à l\'inverse. Développe la mémoire de travail.',
    ),

    act('Mini parcours vélo / trottinette', 'Motricité globale', 24, 60, 10, 30, 'moyen',
      'Développer l\'équilibre dynamique et la coordination à deux roues.',
      ['Vélo draisienne ou trottinette', 'Plots', 'Espace dégagé'],
      ['Équilibre dynamique', 'Coordination', 'Confiance en soi'],
      '1. Installer le parcours. 2. L\'enfant navigue entre les plots. 3. Varier la difficulté. 4. Chronométrer optionnellement. Respecter le casque et les équipements de sécurité.',
    ),

    act('Jeu chaud/froid', 'Motricité globale', 24, 60, 5, 20, 'facile',
      'Développer l\'orientation spatiale et la compréhension des indications directionnelles.',
      ['Objet caché', 'Espace de jeu'],
      ['Orientation spatiale', 'Compréhension des consignes', 'Stratégie'],
      '1. Cacher un objet. 2. L\'enfant cherche. 3. Guider avec chaud/froid. 4. Inverser les rôles. Développe l\'orientation spatiale et l\'inférence.',
    ),

    act('Lancer loin / près', 'Motricité globale', 24, 54, 2, 15, 'facile',
      'Développer la conscience spatiale et la gestion de la force de lancer.',
      ['Balles', 'Sacs de sable', 'Repères de distance'],
      ['Conscience spatiale', 'Gestion de la force', 'Motricité globale'],
      '1. Marquer des zones de distance. 2. L\'enfant lance vers différentes zones. 3. Comparer les distances. 4. Introduire : loin, près, plus loin, moins loin. Développe l\'estimation.',
    ),

    act('Sauter comme un animal', 'Motricité globale', 18, 48, 2, 15, 'facile',
      'Développer la motricité globale et l\'imagination à travers l\'imitation.',
      ['Espace dégagé', 'Images d\'animaux optionnelles'],
      ['Motricité globale', 'Imagination', 'Conscience corporelle'],
      '1. Nommer un animal. 2. L\'enfant imite son mouvement. 3. Varier : grenouille, kangourou, cheval, serpent. 4. Inventer ses propres animaux. Développe la créativité et le schéma corporel.',
    ),

    act('Observer les nuages', 'Motricité globale', 24, 72, 0, 20, 'facile',
      'Développer l\'observation, l\'imagination et le vocabulaire atmosphérique.',
      ['Espace extérieur', 'Couverture optionnelle'],
      ['Observation', 'Imagination', 'Vocabulaire'],
      '1. S\'allonger et regarder le ciel. 2. Décrire ce qu\'on voit dans les nuages. 3. Nommer les types de nuages. 4. Parler de la météo. Développe l\'attention visuelle et l\'imagination.',
    ),

    act('Ramper sous obstacle', 'Motricité globale', 18, 48, 5, 15, 'facile',
      'Développer la conscience corporelle et la coordination en situation de contrainte.',
      ['Chaises', 'Table', 'Tissu', 'Tunnel'],
      ['Conscience corporelle', 'Coordination', 'Motricité globale'],
      '1. Installer l\'obstacle bas. 2. L\'enfant rampe en dessous. 3. Varier la hauteur. 4. Créer un parcours avec différents obstacles. Développe le schéma corporel en situation.',
    ),

    act('Jeu d\'eau extérieur', 'Motricité globale', 18, 60, 5, 30, 'facile',
      'Développer la motricité globale et explorer les propriétés de l\'eau de manière ludique.',
      ['Arrosoir', 'Seaux', 'Tuyau d\'arrosage', 'Vêtements imperméables'],
      ['Motricité globale', 'Exploration sensorielle', 'Coordination'],
      '1. Installer l\'espace eau extérieur. 2. L\'enfant joue librement. 3. Proposer des défis : remplir un seau, faire des bulles. 4. Observer les phénomènes. Activité estivale idéale.',
    ),

    // ═══════════════════════════════════════════════════════
    // NATURE ET DÉCOUVERTE
    // ═══════════════════════════════════════════════════════

    act('Ramasser et trier nature', 'Nature et découverte', 18, 60, 5, 25, 'facile',
      'Développer la curiosité naturaliste et les compétences de classification.',
      ['Sac ou panier', 'Boîtes de tri', 'Loupe'],
      ['Curiosité naturaliste', 'Classification', 'Vocabulaire'],
      '1. Se promener en nature. 2. Ramasser feuilles, cailloux, brindilles. 3. Trier selon différents critères. 4. Identifier ensemble. Parler des êtres vivants et de leur environnement.',
    ),

    act('Arrosage du jardin', 'Nature et découverte', 18, 54, 3, 20, 'facile',
      'Développer la responsabilité et comprendre les besoins des plantes.',
      ['Arrosoir adapté', 'Plantes ou jardin', 'Eau'],
      ['Responsabilité', 'Découverte du monde végétal', 'Motricité globale'],
      '1. Montrer comment remplir l\'arrosoir. 2. Expliquer pourquoi les plantes ont besoin d\'eau. 3. L\'enfant arrose régulièrement. 4. Observer la croissance. Développe le sens des responsabilités.',
    ),

    act('Creuser / manipuler la terre', 'Nature et découverte', 18, 54, 3, 25, 'facile',
      'Explorer le monde souterrain et développer la curiosité scientifique.',
      ['Pelles', 'Petits outils', 'Jardin ou bac de terre', 'Loupe'],
      ['Curiosité scientifique', 'Exploration sensorielle', 'Découverte du monde'],
      '1. Donner les outils. 2. L\'enfant creuse et observe. 3. Chercher des vers, racines, cailloux. 4. Parler de ce qu\'on trouve. Introduire le rôle des vers dans l\'écosystème.',
    ),

    act('Jeu du vent (rubans)', 'Nature et découverte', 18, 48, 3, 15, 'facile',
      'Explorer le phénomène du vent et développer la conscience sensorielle.',
      ['Rubans', 'Foulards légers', 'Espace extérieur', 'Moulins à vent'],
      ['Découverte du monde', 'Exploration sensorielle', 'Expression créative'],
      '1. Donner un ruban à l\'enfant. 2. Observer comment le vent le fait bouger. 3. Courir pour créer du vent. 4. Parler de l\'air invisible. Introduire le concept de force invisible.',
    ),
  ]

  await db.activites.bulkAdd(activites)
}

// ── Migration one-shot : IDs stables pour activités seedées ──────────────────
// Chaque appareil seedait avec uuid() → IDs différents → planifications brisées
// Cette migration remplace tous les IDs aléatoires par des IDs stables basés sur le nom
export async function migrateActivitesToStableIds(): Promise<void> {
  const CLE = 'stable_activity_ids_v1'
  const already = await db.parametresSync.where('cle').equals(CLE).first()
  if (already) return

  const now = new Date()
  const activites = await db.activites.toArray()
  let migrated = 0

  for (const a of activites) {
    const newId = stableActivityId(a.nom)
    if (newId === a.id) continue

    // Mettre à jour les références dans planificationsActivites
    const planifs = await db.planificationsActivites.filter(p => p.activite === a.id).toArray()
    await Promise.all(planifs.map(p => db.planificationsActivites.update(p.id, { activite: newId, updatedAt: now })))

    // Mettre à jour les références dans activitesProgramme
    const aps = await db.activitesProgramme.filter(ap => ap.activiteCatalogueId === a.id).toArray()
    await Promise.all(aps.map(ap => db.activitesProgramme.update(ap.id, { activiteCatalogueId: newId, updatedAt: now })))

    // Recréer l'activité avec l'ID stable (put + delete car Dexie ne supporte pas le renommage d'ID)
    await db.activites.put({ ...a, id: newId, updatedAt: now })
    await db.activites.delete(a.id)
    migrated++
  }

  await db.parametresSync.put({ id: uuid(), cle: CLE, valeur: 'true', derniereModification: now, createdAt: now, updatedAt: now })
  if (migrated > 0) console.log(`[FamilyOS] ${migrated} activité(s) migrée(s) vers IDs stables.`)
}

// ── Purge one-shot des recettes pré-enregistrées (deviceId === 'seed') ────────
async function purgeSeededRecettes(): Promise<void> {
  const CLE = 'seeded_recipes_purged_v1'
  const already = await db.parametresSync.where('cle').equals(CLE).first()
  if (already) return

  const now = new Date()

  const seeded = await db.recettes.filter(r => r.deviceId === 'seed').toArray()
  if (seeded.length > 0) {
    const ids = seeded.map(r => r.id)
    const ingIds = (await db.recettesIngredients.filter(i => ids.includes(i.recette)).toArray()).map(i => i.id)
    if (ingIds.length > 0) await db.recettesIngredients.bulkDelete(ingIds)
    await db.recettes.bulkDelete(ids)
    console.log(`[FamilyOS] ${seeded.length} recette(s) pré-enregistrée(s) supprimée(s).`)
  }

  await db.parametresSync.put({ id: uuid(), cle: CLE, valeur: 'true', derniereModification: now, createdAt: now, updatedAt: now })
}

// ── Recettes importées depuis Notion ExportBlock ──────────────────────────────
async function seedRecettes(): Promise<void> {
  const cats = await db.categoriesRecettes.toArray()
  const catId = (nom: string): string => cats.find(c => c.nom === nom)?.id ?? cats[0]?.id ?? ''

  const produits = await db.produits.toArray()
  const prodByNorm = new Map(produits.map(p => [p.nomNormalise ?? norm(p.nom), p.id]))
  const findProduit = (nom: string): string | undefined => prodByNorm.get(norm(nom))

  const now = new Date()
  function recette(
    nom: string,
    categorieNom: string,
    tempsPreparation: number | undefined,
    tags: string[],
    favori: boolean,
    ingredientNoms: string[],
  ) {
    const id = uuid()
    const r = {
      id, nom, categorie: catId(categorieNom),
      etapes: [], tags, favori, archive: false,
      tempsPreparation, createdAt: now, updatedAt: now, deviceId: 'seed',
    }
    const ings = ingredientNoms
      .map(n => findProduit(n))
      .filter((pid): pid is string => !!pid)
      .map(pid => ({
        id: uuid(), recette: id, produit: pid,
        quantite: 1, optionnel: false, createdAt: now, updatedAt: now,
      }))
    return { r, ings }
  }

  type Entry = ReturnType<typeof recette>
  const entries: Entry[] = [
    // ── PLATS ─────────────────────────────────────────────────────────────────
    recette('Orzo aux tomates confites', 'Plats principaux', 20, [], false,
      ['Tomates cerises','Oignons rouges','Orzo','Beurre','Bouillon de légumes','Parmesan râpé','Ricotta','Citron','Basilic',"Huile d'olive",'Vinaigre balsamique','Paprika fumé','Persillade','Thym']),
    recette('Galettes d\'agneau aux pistaches & sauce yaourt au sumac', 'Plats principaux', 20, ['Viande rouge'], false,
      ['Agneau haché','Pistaches','Oignons','Ail','Roquette',"Huile d'olive",'Sumac','Yaourt grec','Citron']),
    recette('Tagliatelles de courgettes, nuggets de poulet & sauce au parmesan', 'Plats principaux', 30, [], false,
      ['Poulet (Blanc)','Corn-flakes nature','Chapelure panko','Sauce soja sucrée','Paprika fumé','Oeufs','Courgettes',"Huile d'olive",'Sel','Poivre','Bouillon de volaille','Parmesan râpé','Crème liquide']),
    recette('Tajine de poisson et patates douces', 'Plats principaux', 10, [], false,
      ['Filet de colin','Oignons',"Huile d'olive",'Pomme de terre','Patates douces','Tomates concassées','Ail','Coriandre','Poivrons','Bouillon de poisson','Petit pois','Sel','Poivre']),
    recette('Pommes de terre & tomates rôties, sauce feta-basilic', 'Plats principaux', 15, [], false,
      ['Pommes grenailles','Beurre','Paprika fumé','Tomates cerises','Vinaigre balsamique','Persillade','Miel',"Huile d'olive",'Parmesan râpé','Micro pousses','Yaourt grec','Feta','Basilic']),
    recette('Pomme de terre rôtie pesto courgette pistache et burrata', 'Plats principaux', 20, [], false, []),
    recette('Pommes de terre au four, œuf mollet & sauce tonnato', 'Plats principaux', 20, [], false,
      ['Pomme de terre',"Huile d'olive",'Fleur de sel','Oeufs','Citron','Persil','Thon en boîte','Câpres','Anchois','Ail']),
    recette('Pommes de terre rôties, œufs pochés & sauce verte', 'Plats principaux', 20, [], false,
      ['Pommes grenailles',"Huile d'olive",'Thym','Vinaigre blanc','Oeufs','Bloc de Parmesan','Basilic','Echalotes','Bouillon de volaille','Épinards frais','Sel','Beurre','Paprika fumé','Crème liquide']),
    recette('Potimarron rôti & crousti-crumble', 'Plats principaux', 15, [], false,
      ['Potimarron',"Huile d'olive",'Sauce soja salée','Miel','Persillade','Sel','Poivre','Paprika fumé','Coriandre','Basilic','Graines de sésame']),
    recette('Pommes de terre farcies épinards & gorgonzola', 'Plats principaux', 20, [], false,
      ['Pomme de terre','Beurre','Crème liquide','Gorgonzola','Épinards frais','Sel','Poivre']),
    recette('Saumon croustillant, carottes rôties & sauce beurre blanc', 'Plats principaux', 20, [], false,
      ['Saumon','Moutarde','Carottes',"Huile d'olive",'Beurre','Ail en poudre','Oignon en poudre','Persil','Citron','Sauce soja sucrée','Echalotes',"Sirop d'agave",'Bouillon de légumes','Vinaigre de vin']),
    recette('Tomates rôties à la burrata & crème de pesto', 'Plats principaux', 10, [], false,
      ['Tomates cerises',"Huile d'olive",'Sauce soja salée','Paprika fumé','Persillade',"Sirop d'érable",'Burrata','Beurre','Farine','Parmesan râpé','Basilic','Noix de cajou']),
    recette('Sardines farcies à la charmoula & sauce aux poivrons', 'Plats principaux', 30, [], false,
      ['Filet de sardine','Coriandre','Persil','Citron confit','Semoule de maïs','Tomates','Poivrons','Piment','Ail']),
    recette('Yaourt froid & tomates rôties, œuf poché, pommes de terre croustillantes & pain', 'Plats principaux', 15, [], false,
      ['Tomates cerises',"Huile d'olive",'Cumin','Sucre','Ail','Thym','Origan','Citron','Yaourt grec','Sel','Poivre']),
    recette('Saumon laqué miel-harissa, sauce citron & chapelure de coriandre', 'Plats principaux', 15, [], false,
      ['Pavé de saumon','Miel','Harissa','Citron','Sel','Poivre','Yaourt grec','Coriandre','Ail en poudre','Échalotes en poudre']),
    recette('Patates douces rôties, sauce feta, ail & citron', 'Plats principaux', 40, [], false,
      ['Chapelure panko','Miel','Ail',"Huile d'olive",'Oignons rouges','Patates douces','Persillade','Feta','Yaourt grec','Citron','Ciboulette']),
    recette('Brocolis en croûte de parmesan & sauce ricotta–beurre de cacahuètes', 'Plats principaux', 10, ['Healthy'], false,
      ['Brocoli','Oignons rouges','Chapelure panko','Parmesan râpé',"Huile d'olive",'Miel','Sauce soja salée','Persillade','Ricotta','Vinaigre blanc','Yaourt grec','Beurre de cacahuète']),
    recette('Poulet juteux, pommes de terre croustillantes & crème de poivron', 'Plats principaux', 20, [], false,
      ['Poulet (Blanc)','Sel','Poivre',"Huile d'olive",'Beurre','Pommes grenailles','Romarin','Ail','Poivron rouge','Crème liquide']),
    recette('Gratin de butternut & épinards au comté', 'Plats principaux', 15, [], false,
      ['Courge de Butternut','Oignons rouges','Comté','Ail','Crème fraîche','Épinards frais','Bouillon de volaille','Poivre','Basilic']),
    recette('Mamita', 'Plats principaux', undefined, ['Marocain'], false, []),
    recette('Couscous', 'Plats principaux', undefined, ['Marocain'], false, ['Oignons','Navets']),
    recette('Bœuf bourguignon', 'Plats principaux', 20, ['Plats mijotés'], false,
      ['Paleron de boeuf','Carottes','Oignons','Ail','Champignons de paris','Bouillon de volaille','Concentré de tomate','Farine','Bouquet garni','Vinaigre balsamique',"Huile d'olive",'Sel','Poivre']),
    recette('Boeuf aux oignons', 'Plats principaux', undefined, ['Asiatique'], false, []),
    recette('Boeuf Loclac', 'Plats principaux', undefined, ['Asiatique'], false,
      ['Rumsteak','Ail','Sauce soja salée','Sauce huître','Sucre','Poivre','Maïzena','Huile de tournesol','Riz','Oeufs','Concombre','Coriandre']),
    recette('Nouilles sautées', 'Plats principaux', undefined, ['Asiatique'], false, []),
    recette('Pad thaï', 'Plats principaux', undefined, ['Asiatique'], false, []),
    recette('Saumon teriyaki', 'Plats principaux', undefined, ['Asiatique'], false, []),
    recette('Bo bun', 'Plats principaux', undefined, ['Asiatique'], false, []),
    recette('Dumpling', 'Plats principaux', undefined, ['Asiatique'], false, []),
    recette('Curry japonais', 'Plats principaux', undefined, ['Asiatique'], false, []),
    recette('Pastilla', 'Plats principaux', undefined, ['Marocain'], false, []),
    recette('Rfissa', 'Plats principaux', undefined, ['Marocain'], false, []),
    recette('Tajine poulet aux olives', 'Plats principaux', undefined, ['Marocain'], false, []),
    recette('Veau aux pruneaux', 'Plats principaux', undefined, ['Marocain'], false, []),
    recette("L'a3dess", 'Plats principaux', undefined, ['Marocain'], false, []),
    recette('Lasagne bolognaise & légumes', 'Plats principaux', undefined, ['Lasagnes et gratins'], false, []),
    recette('Lasagne aubergine bolognaise', 'Plats principaux', undefined, ['Lasagnes et gratins'], false, []),
    recette('Lasagne saumon épinards', 'Plats principaux', undefined, ['Lasagnes et gratins'], false, []),
    recette('Lasagne courgettes ricotta', 'Plats principaux', undefined, ['Lasagnes et gratins'], false, []),
    recette('Hachis parmentier aux légumes', 'Plats principaux', undefined, ['Lasagnes et gratins'], false, []),
    recette('Butter chicken', 'Plats principaux', undefined, ['Indien'], false, []),
    recette('Tikka masala', 'Plats principaux', undefined, ['Indien'], false, []),
    recette('Agneau madras', 'Plats principaux', undefined, ['Indien'], false, []),
    recette('Dhal de lentilles corail', 'Plats principaux', undefined, ['Indien'], false, []),
    recette('Poulet tandoori et riz rouge', 'Plats principaux', undefined, ['Indien'], false, []),
    recette('Poulet curry', 'Plats principaux', undefined, ['Indien'], false, []),
    recette('Blanquette de veau', 'Plats principaux', undefined, ['Plats mijotés'], false, []),
    recette('Boeuf effiloché', 'Plats principaux', undefined, ['Plats mijotés'], false, []),
    recette('Veau en sauce', 'Plats principaux', undefined, ['Plats mijotés'], false, []),
    recette("Souris d'agneau ultra fondante – sauce brune intense", 'Plats principaux', undefined, [], false, []),
    // ── PIZZA, TARTES & QUICHES ───────────────────────────────────────────────
    recette('Tartatouille', 'Plats principaux', 20, [], false,
      ['Poivron rouge','Courgettes','Tomates','Aubergines','Oignons rouges','Ail',"Huile d'olive",'Pâte feuilletée','Mozzarella','St Moret','Oeufs','Basilic']),
    // ── LÉGUMES & ACCOMPAGNEMENTS ─────────────────────────────────────────────
    recette('Carottes rôties, tahini & dukkah de noix', 'Plats principaux', 20, [], false,
      ['Carottes','Ail',"Huile d'olive",'Cumin','Paprika','Miel','Poivre','Yaourt grec','Tahini','Citron','Coriandre','Dukkah de Noix']),
    recette('Poireaux rôtis, œufs pochés & sauce verte', 'Plats principaux', undefined, [], false, []),
    recette('Pommes de terre rôties à la harissa & ail confit', 'Plats principaux', undefined, [], false, []),
    recette('Gratin dauphinois', 'Plats principaux', undefined, [], false, []),
    // ── SAUCES ────────────────────────────────────────────────────────────────
    recette('Sauce chaude au gorgonzola', 'Sauces', 5, [], false,
      ['Gorgonzola','Mascarpone','Ciboulette','Sel','Poivre']),
    recette('Crème froide de poivrons à la grecque', 'Sauces', 10, [], false,
      ['Poivron rouge','Oignons rouges','Poivrons','Tomates','Feta','Yaourt grec','Tahini',"Huile d'olive",'Sauce soja sucrée','Sauce soja salée','Miel','Paprika fumé']),
    recette('Sauce chaude coco – pistache', 'Sauces', 10, [], false,
      ['Pignons de pin','Pistaches','Bouillon de volaille','Mascarpone','Lait de coco','Paprika fumé','Coriandre','Basilic']),
    recette('Sauce chaude crémeuse aux champignons', 'Sauces', 20, [], false,
      ['Beurre','Bouillon de volaille','Oignons rouges','Echalotes','Ail','Champignons de paris','Crème fraîche','Parmesan râpé','Persil','Noisettes','Sel','Poivre']),
    recette('Sauce chaude à la tomate', 'Sauces', 10, [], false,
      ['Oignons rouges',"Huile d'olive",'Thym','Sauce soja salée','Paprika fumé','Miel','Vinaigre balsamique','Tomates cerises','Ail','Basilic','Bouillon de légumes']),
    recette('Sauce froide citron', 'Sauces', 10, [], false,
      ['Yaourt grec','Citron','Sauce soja salée',"Huile d'olive",'Miel',"Sirop d'agave"]),
    recette('Sauce froide fouettée au mascarpone & ciboulette', 'Sauces', 5, [], false,
      ['Beurre','Bouillon de volaille','Ail','Mascarpone','Crème liquide','Oeufs','Ciboulette','Sel','Poivre','Echalotes']),
    recette('Sauce froide verte aux herbes fraîches', 'Sauces', 10, [], false,
      ['Yaourt grec','Coriandre','Menthe',"Huile d'olive",'Miel','Sauce soja salée','Paprika','Tahini']),
    // ── SALADES ───────────────────────────────────────────────────────────────
    recette('Salade de carottes au yaourt, cannelle & herbes', 'Entrées & Salades', undefined, [], false, []),
    recette('Beef, hummus & salades', 'Entrées & Salades', 10, [], false,
      ['Riz','Boeuf haché','Salades','Avocat','Hummus']),
    recette('Salade kale & avocat', 'Entrées & Salades', 10, [], false,
      ['Kale','Avocat','Halloumi','Citron','Quinoa','Oeufs']),
    // ── SOUPES ────────────────────────────────────────────────────────────────
    recette('Soupe de petits pois et Boursin', 'Soupes', 10, [], false,
      ['Petit pois','Oignons','Bouillon de légumes','Boursin au poivre','Bacon',"Huile d'olive",'Sel','Poivre']),
    // ── DESSERTS ──────────────────────────────────────────────────────────────
    recette('Cookies pistache', 'Desserts', undefined, [], false, []),
  ]

  await db.recettes.bulkAdd(entries.map(e => e.r))
  const allIngs = entries.flatMap(e => e.ings)
  if (allIngs.length > 0) {
    await db.recettesIngredients.bulkAdd(allIngs)
  }
}

// ── Anniversaires famille ────────────────────────────────────────────────────

export async function seedAnniversaires(): Promise<void> {
  const SEED_KEY = 'anniversaires_famille_v2'

  // Nettoie les versions précédentes
  const anciens = await db.evenements
    .filter(e => e.notes === 'anniversaires_famille_v1')
    .toArray()
  if (anciens.length > 0) {
    await db.evenements.bulkDelete(anciens.map(e => e.id))
  }

  const déjàFait = await db.evenements
    .filter(e => e.notes === SEED_KEY && !e.archive)
    .count()
  if (déjàFait > 0) return

  const now = new Date()
  const annéeActuelle = now.getFullYear()
  const ANNÉE_MARIAGE = 2018

  function dateAnniversaire(mois: number, jour: number): Date {
    // Prochaine occurrence (cette année ou l'an prochain si déjà passée)
    const d = new Date(annéeActuelle, mois - 1, jour, 12, 0, 0)
    if (d < now) d.setFullYear(annéeActuelle + 1)
    return d
  }

  const annéesMariage = annéeActuelle - ANNÉE_MARIAGE
  const nocesLabel = getNocesLabel(annéesMariage)

  const anniversaires: Array<Omit<Evenement, 'createdAt' | 'updatedAt' | 'deviceId'>> = [
    {
      id: uuid(),
      titre: 'Nawfel & Manel 🎂',
      description: 'Anniversaire des enfants',
      type: 'anniversaire',
      couleur: '#86EFAC',
      dateDebut: dateAnniversaire(1, 24),
      journeeEntiere: true,
      recurrence: true,
      frequence: 'annuelle',
      alerteMinutes: 10080, // 7 jours avant
      contexteMedical: false,
      archive: false,
      notes: SEED_KEY,
    },
    {
      id: uuid(),
      titre: 'Anniversaire Eliès 🎂',
      type: 'anniversaire',
      couleur: '#60A5FA',
      dateDebut: dateAnniversaire(7, 19),
      journeeEntiere: true,
      recurrence: true,
      frequence: 'annuelle',
      alerteMinutes: 10080,
      contexteMedical: false,
      archive: false,
      notes: SEED_KEY,
    },
    {
      id: uuid(),
      titre: 'Anniversaire Yasmine 🎂',
      type: 'anniversaire',
      couleur: '#F9A8D4',
      dateDebut: dateAnniversaire(5, 15),
      journeeEntiere: true,
      recurrence: true,
      frequence: 'annuelle',
      alerteMinutes: 10080,
      contexteMedical: false,
      archive: false,
      notes: SEED_KEY,
    },
    {
      id: uuid(),
      titre: 'Anniversaire Mimouth 🎂',
      type: 'anniversaire',
      couleur: '#FCD34D',
      dateDebut: dateAnniversaire(2, 2),
      journeeEntiere: true,
      recurrence: true,
      frequence: 'annuelle',
      alerteMinutes: 10080,
      contexteMedical: false,
      archive: false,
      notes: SEED_KEY,
    },
    {
      id: uuid(),
      titre: 'Anniversaire Amel 🎂',
      type: 'anniversaire',
      couleur: '#C4B5FD',
      dateDebut: dateAnniversaire(12, 6),
      journeeEntiere: true,
      recurrence: true,
      frequence: 'annuelle',
      alerteMinutes: 10080,
      contexteMedical: false,
      archive: false,
      notes: SEED_KEY,
    },
    {
      id: uuid(),
      titre: 'Anniversaire Rania 🎂',
      type: 'anniversaire',
      couleur: '#C4B5FD',
      dateDebut: dateAnniversaire(12, 21),
      journeeEntiere: true,
      recurrence: true,
      frequence: 'annuelle',
      alerteMinutes: 10080,
      contexteMedical: false,
      archive: false,
      notes: SEED_KEY,
    },
    {
      id: uuid(),
      titre: 'Anniversaire Maman 🎂',
      type: 'anniversaire',
      couleur: '#A78BFA',
      dateDebut: dateAnniversaire(3, 4),
      journeeEntiere: true,
      recurrence: true,
      frequence: 'annuelle',
      alerteMinutes: 10080,
      contexteMedical: false,
      archive: false,
      notes: SEED_KEY,
    },
    {
      id: 'anniversaire-mariage',
      titre: `${nocesLabel} ♥ (${annéesMariage} ans)`,
      description: `Mariés le 29 novembre ${ANNÉE_MARIAGE} — clé: mariage:${ANNÉE_MARIAGE}`,
      type: 'anniversaire',
      couleur: '#F59E0B',
      dateDebut: dateAnniversaire(11, 29),
      journeeEntiere: true,
      recurrence: true,
      frequence: 'annuelle',
      alerteMinutes: 10080,
      contexteMedical: false,
      archive: false,
      notes: SEED_KEY,
    },
  ]

  const now2 = new Date()
  const entities = anniversaires.map(a => ({
    ...a,
    createdAt: now2,
    updatedAt: now2,
    deviceId: '',
  }))

  await db.evenements.bulkAdd(entities as Evenement[])
  console.log('[FamilyOS] Anniversaires famille initialisés.')
}

// ── Déduplication tâches grand ménage (migration one-shot) ───────────────────
async function dedupGrandMenageTaches(): Promise<void> {
  // v2 : soft-delete aussi dans Supabase pour éviter que pullAll ramène les doublons
  const CLE = 'grandMenage.dedupDone.v2'
  const already = await db.parametresSync.where('cle').equals(CLE).first()
  if (already) return

  const doublons = await db.taches
    .filter(t => t.moduleOrigine === 'maison' && !t.id.startsWith('seed-tache-'))
    .toArray()

  if (doublons.length > 0) {
    const now = new Date()
    // Soft-delete local
    await db.taches.bulkDelete(doublons.map(t => t.id))
    // Soft-delete dans Supabase pour éviter la re-sync
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const ids = doublons.map(t => t.id)
      // Par batch de 100 pour éviter les requêtes trop longues
      for (let i = 0; i < ids.length; i += 100) {
        await supabase.from('taches').update({ deleted_at: now.toISOString() }).in('id', ids.slice(i, i + 100))
      }
    }
    console.log(`[FamilyOS] ${doublons.length} tâches ménage dupliquées supprimées (local + Supabase).`)
  }

  const now = new Date()
  await db.parametresSync.put({ id: uuid(), cle: CLE, valeur: 'true', derniereModification: now, createdAt: now, updatedAt: now })
}

// ── Grand ménage : tâches par pièce ───────────────────────────────────────────

async function seedGrandMenageTaches(): Promise<void> {
  const CLE = 'grandMenage.tachesSeeded.v1'
  const already = await db.parametresSync.where('cle').equals(CLE).first()
  if (already) return

  // Récupère les pièces actives par nom normalisé
  const pieces = await db.pieces.filter(p => p.actif && !p.deletedAt).toArray()
  const byNom = (nom: string): string | undefined =>
    pieces.find(p => p.nom.toLowerCase().includes(nom.toLowerCase()))?.id

  const now = new Date()

  type TacheRaw = {
    id: string; titre: string; statut: 'a_faire'; moduleOrigine: 'maison';
    recurrence: boolean; frequence: 'trimestrielle' | 'semestrielle' | 'mensuelle';
    pieceAssociee?: string; archive: boolean;
    createdAt: Date; updatedAt: Date; deviceId: string;
  }

  function stableTacheId(titre: string): string {
    const slug = titre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80)
    return `seed-tache-${slug}`
  }

  function t(titre: string, pieceId: string | undefined, freq: TacheRaw['frequence'] = 'trimestrielle'): TacheRaw {
    return { id: stableTacheId(titre), titre, statut: 'a_faire', moduleOrigine: 'maison', recurrence: true, frequence: freq, pieceAssociee: pieceId, archive: false, createdAt: now, updatedAt: now, deviceId: 'seed' }
  }

  const cuisineId  = byNom('cuisine')
  const buanderieId = byNom('buanderie')
  const cellierId  = byNom('cellier')
  const salonId    = byNom('salon')
  const chambreAdId = byNom('chambre parent') ?? byNom('chambre adult') ?? byNom('parentale')
  const chambreEnId = byNom('chambre enfant') ?? byNom('enfants')
  const toilettesId = byNom('toilette')
  const bureauId   = byNom('bureau')
  const garageId   = byNom('garage')
  const jardinId   = byNom('jardin')

  const taches: TacheRaw[] = [
    // 🍽 CUISINE
    t('Nettoyer four + grilles + plaques', cuisineId),
    t('Décaper poêles et casseroles en inox', cuisineId),
    t('Dégraisser hotte + filtres', cuisineId),
    t('Nettoyer façades de placards', cuisineId),
    t('Nettoyer murs autour des plaques', cuisineId),
    t('Nettoyer frigo complet', cuisineId),
    t('Nettoyer congélateur + inventaire', cuisineId, 'semestrielle'),
    t('Trier épices', cuisineId, 'semestrielle'),
    t('Vider et nettoyer 1 placard en profondeur', cuisineId),
    t('Nettoyer évier + siphon', cuisineId),
    t('Laver poubelles', cuisineId, 'mensuelle'),
    t('Détartrer bouilloire', cuisineId, 'mensuelle'),
    t('Entretenir machine à café à grain (bac, groupe, détartrage, réservoir, buses)', cuisineId, 'mensuelle'),
    // 🧺 BUANDERIE
    t('Nettoyer machine à laver (joint + filtre)', buanderieId, 'mensuelle'),
    t('Nettoyer sèche-linge', buanderieId, 'trimestrielle'),
    t('Nettoyer étagères buanderie', buanderieId),
    t('Trier produits ménagers', buanderieId, 'semestrielle'),
    t('Organiser paniers à linge', buanderieId, 'trimestrielle'),
    t('Laver bacs à linge', buanderieId, 'mensuelle'),
    t('Trier vêtements à donner', buanderieId, 'semestrielle'),
    // 🥫 CELLIER
    t('Trier stock alimentaire', cellierId),
    t('Vérifier dates de péremption', cellierId),
    t('Nettoyer étagères cellier', cellierId),
    t('Réorganiser par catégories', cellierId, 'semestrielle'),
    t('Faire inventaire cellier', cellierId),
    t('Nettoyer sol + coins cellier', cellierId),
    // 🛋 SALON
    t('Dépoussiérage complet salon', salonId),
    t('Nettoyer plinthes salon', salonId),
    t('Laver vitres + rails', salonId),
    t('Nettoyer canapé', salonId),
    t('Laver rideaux salon', salonId, 'semestrielle'),
    t('Trier meuble TV', salonId, 'semestrielle'),
    // 🛏 CHAMBRE ADULTE
    t('Retourner matelas', chambreAdId, 'semestrielle'),
    t('Aspirer sous le lit', chambreAdId),
    t('Trier armoire chambre adulte', chambreAdId, 'semestrielle'),
    t('Laver couette / oreillers', chambreAdId, 'semestrielle'),
    t('Nettoyer tables de nuit', chambreAdId),
    t('Ranger tiroirs chambre adulte', chambreAdId),
    // 🧸 CHAMBRE ENFANT
    t('Trier jouets', chambreEnId),
    t('Nettoyer étagères chambre enfant', chambreEnId),
    t('Laver peluches', chambreEnId, 'semestrielle'),
    t('Trier vêtements enfant', chambreEnId),
    t('Nettoyer sous le lit enfant', chambreEnId),
    t('Organiser bibliothèque enfant', chambreEnId),
    // 🚽 TOILETTES
    t('Détartrer cuvette', toilettesId, 'mensuelle'),
    t('Nettoyer réservoir toilettes', toilettesId),
    t('Nettoyer murs / plinthes toilettes', toilettesId),
    t('Laver poubelles toilettes', toilettesId, 'mensuelle'),
    t('Nettoyer porte + poignée toilettes', toilettesId),
    t('Réorganiser produits toilettes', toilettesId, 'semestrielle'),
    // 🖥 BUREAU
    t('Trier papiers bureau', bureauId, 'mensuelle'),
    t('Classer documents', bureauId),
    t('Nettoyer écran + clavier', bureauId, 'mensuelle'),
    t('Vider tiroirs bureau', bureauId, 'semestrielle'),
    t('Organiser fournitures', bureauId),
    t('Scanner documents importants', bureauId, 'semestrielle'),
    // 🚗 GARAGE
    t('Trier outils garage', garageId, 'semestrielle'),
    t('Désencombrer cartons', garageId),
    t('Nettoyer étagères garage', garageId),
    t('Balayer + aspirer sol garage', garageId),
    t('Nettoyer porte de garage', garageId),
    t('Organiser matériel saisonnier', garageId, 'semestrielle'),
    // 🌿 JARDIN
    t('Désherber', jardinId, 'mensuelle'),
    t('Tailler haies / plantes', jardinId, 'mensuelle'),
    t('Nettoyer salon de jardin', jardinId),
    t('Nettoyer terrasse', jardinId),
    t('Ranger cabanon', jardinId, 'semestrielle'),
    t('Vérifier outils de jardin', jardinId, 'semestrielle'),
    t('Nettoyer poubelles extérieures', jardinId, 'mensuelle'),
    // 🧼 ENTRETIEN GÉNÉRAL (sans pièce spécifique)
    t('Tineco toute la maison (sols complets)', undefined, 'mensuelle'),
    t('Nettoyer plinthes maison entière', undefined),
    t('Laver portes', undefined),
    t('Laver poignées', undefined),
    t('Nettoyer interrupteurs', undefined),
    t('Nettoyer radiateurs', undefined),
    t('Nettoyer luminaires', undefined),
    t('Laver tapis', undefined, 'mensuelle'),
    t('Nettoyer voiture', undefined, 'mensuelle'),
  ]

  await db.taches.bulkPut(taches as any)

  // Marquer comme seedé (put = idempotent)
  await db.parametresSync.put({ id: uuid(), cle: CLE, valeur: 'true', derniereModification: now, createdAt: now, updatedAt: now })
  console.log(`[FamilyOS] ${taches.length} tâches grand ménage initialisées.`)
}
