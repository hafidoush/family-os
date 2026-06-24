/**
 * FAMILY OS — WidgetCapturePensee v3
 * Design "Comment puis-je t'aider aujourd'hui ?"
 *
 * - Salutation SALAM MOMMY (fixe)
 * - Grande question centrale
 * - 3 boutons suggestion → navigation module
 * - Input "Décharge tes pensées ici…" + classification IA
 */

import { useState, useRef, useCallback, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { newEntity, withUpdate } from '../../../core/db/helpers'
import type {
  Pensee, CategoriePensee, Evenement, Tache,
  CoursesItem, TypeEvenement, WishlistItem,
} from '../../../shared/types'
import { useContexteHoraire } from '../hooks/useContexteHoraire'
import './WidgetCapturePensee.css'

// ─── Icône envoi ──────────────────────────────────────────────────────────────

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"/>
    <polyline points="5 12 12 5 19 12"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

// ─── Labels confirmation ──────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  evenement: 'Événement ajouté au calendrier',
  tache:     'Tâche créée',
  achat:     'Ajouté aux courses',
  note:      'Pensée enregistrée',
}

// ─── Détection locale (fallback sans IA) ─────────────────────────────────────

const MOTS_CAT: Record<CategoriePensee, string[]> = {
  enfants:       ['enfant', 'école', 'sac', 'cartable', 'anniversaire', 'cantine', 'manel', 'nawfel', 'nono', 'loulou', 'bébé', 'bebe', 'fille', 'garcon', 'garçon', 'fils', 'petite', 'petit'],
  maison:        ['maison', 'cuisine', 'chambre', 'rangement', 'ménage', 'réparer'],
  administratif: ['document', 'papier', 'formulaire', 'impôt', 'assurance', 'banque', 'facture'],
  animaux:       ['vétérinaire', 'chien', 'chat', 'animal', 'vaccin'],
  achats:        ['acheter', 'achat', 'commande', 'courses', 'magasin', 'cadeau'],
  evenements:    ['samedi', 'dimanche', 'fête', 'sortie', 'vacances', 'semaine'],
  sante:         ['médecin', 'docteur', 'pharmacie', 'médicament', 'dentiste'],
  autre:         [],
}

function detecterCategorie(texte: string): CategoriePensee {
  const t = texte.toLowerCase()
  for (const [cat, mots] of Object.entries(MOTS_CAT) as [CategoriePensee, string[]][]) {
    if (cat === 'autre') continue
    if (mots.some(m => t.includes(m))) return cat
  }
  return 'autre'
}

// ─── Résolution de date intelligente ─────────────────────────────────────────

const JOURS_SEMAINE: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3,
  jeudi: 4, vendredi: 5, samedi: 6,
}

/**
 * Résout une expression temporelle en Date.
 * - "lundi", "jeudi"          → prochain jour (jamais aujourd'hui)
 * - "lundi prochain"          → le lundi de la semaine d'après
 * - "demain"                  → J+1
 * - "après-demain"            → J+2
 * - "ce soir"                 → aujourd'hui 19h
 * - Retourne null si rien détecté
 */
function resolverDate(texte: string): Date | null {
  const t = texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const auj = new Date()
  auj.setHours(0, 0, 0, 0)

  if (t.includes('apres-demain') || t.includes('après-demain')) {
    const d = new Date(auj); d.setDate(d.getDate() + 2); return d
  }
  if (t.includes('demain')) {
    const d = new Date(auj); d.setDate(d.getDate() + 1); return d
  }
  if (t.includes('ce soir')) {
    const d = new Date(); d.setHours(19, 0, 0, 0); return d
  }
  if (t.includes('ce week-end') || t.includes('weekend')) {
    const d = new Date(auj)
    const jourAuj = d.getDay()
    const diffSam = (6 - jourAuj + 7) % 7 || 7
    d.setDate(d.getDate() + diffSam)
    return d
  }
  if (t.includes('semaine prochaine')) {
    const d = new Date(auj); d.setDate(d.getDate() + 7); return d
  }

  // Cherche un nom de jour dans le texte
  for (const [nom, cible] of Object.entries(JOURS_SEMAINE)) {
    if (!t.includes(nom)) continue
    const estProchain = t.includes(`${nom} prochain`) || t.includes(`prochain ${nom}`)
    const d = new Date(auj)
    const jourAuj = d.getDay()
    let diff = (cible - jourAuj + 7) % 7
    // "lundi" seul → toujours le prochain (jamais aujourd'hui)
    if (diff === 0) diff = 7
    // "lundi prochain" → encore une semaine en plus
    if (estProchain) diff += 7
    d.setDate(d.getDate() + diff)
    return d
  }

  return null
}

// ─── Détection locale d'intention (routing sans IA) ──────────────────────────

type IntentionLocale =
  | { type: 'achat';          articles: string[] }          // alimentaire → courses
  | { type: 'achat_ponctuel'; nom: string }                 // non-alimentaire → À acheter
  | { type: 'tache';          titre: string; date?: Date }
  | { type: 'evenement';      titre: string; date?: Date }
  | { type: 'pensee' }

// ── Marqueurs de nécessité ────────────────────────────────────────────────────
// "il faut/besoin de" seuls ne signifient PAS un achat :
//   "il faut appeler" → tâche   |   "il faut du lait" → achat (car "acheter" implicite)
// Ces marqueurs sont testés en PRÉ-CHECK avant MOTS_ACHAT.
const MARQUEURS_NECESSITE = [
  'il faut', 'besoin de', "besoin d'",
  'on doit', "n'oublie pas", 'faut pas oublier', 'oublie pas de',
]

// ── Mots déclencheurs achat ───────────────────────────────────────────────────
// Règles d'ambiguïté résolues :
//   "prendre/ramener/rapporter" → achat SEULEMENT avec article PARTITIF (du/de la/des)
//   "prendre un/une" EXCLU → trop ambigu ("prendre un rdv" ≠ achat)
//   "manque" EXCLU des déclencheurs directs → géré séparément (peut être abstrait)
const MOTS_ACHAT = [
  'acheter', 'commander', 'rajouter', 'ajouter', 'on a plus',
  'il faut du ', "il faut de l'", 'il faut de la ', 'il faut des ',
  'besoin de du ', 'besoin de la ', "besoin de l'", 'besoin des ',
  // prendre + partitif = achat ("prendre du lait" ✓ / "prendre un rdv" ✗ / "prendre les médicaments" ✗)
  'prendre du ', 'prendre de la ', "prendre de l'", 'prendre des ',
  // ramener/rapporter + partitif = achat ("ramener du pain" ✓ / "ramener les enfants" ✗)
  'ramener du ', 'ramener de la ', "ramener de l'", 'ramener des ',
  'rapporter du ', 'rapporter de la ', "rapporter de l'", 'rapporter des ',
]

// ── Mots déclencheurs tâche ───────────────────────────────────────────────────
// "rendez-vous/rdv" sans date → tâche "à planifier" (avec date → événement, testé avant)
const MOTS_TACHE = [
  'appeler', 'rappeler', 'envoyer', 'faire', 'prévenir', 'penser à',
  'ne pas oublier', 'oublier pas', 'contacter', 'vérifier', 'regarder',
  'chercher', 'réserver', 'confirmer', 'remplir', 'donner',
  'rendez-vous', 'rdv',
  'passer', 'préparer', 'organiser', 'payer', 'signer', 'imprimer',
  'prendre rendez-vous', 'prendre contact', 'prendre les ', 'prendre connaissance',
  'ramener les ', 'rapporter le ', 'rapporter les ',
]

const MOTS_EVT  = ['rendez-vous', 'rdv', 'réunion', 'anniversaire', 'fête', 'sortie', 'vacances', 'voyage', 'concert', 'spectacle', 'match', 'pique-nique', 'mariage', 'baptême', 'bapteme', 'examen']
const MOTS_DATE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'demain', 'après-demain', 'ce soir', 'ce week-end', 'semaine prochaine']

// Mots qui déclenchent "manque" comme achat seulement si le produit est alimentaire/physique
const MOTS_MANQUE = ['manque', 'il manque', 'on manque de', 'plus de', 'fini le', 'fini la', 'finis les']

// ─── Nettoyage du nom produit ─────────────────────────────────────────────────

const VERBES_ACHAT = ['acheter', 'commander', 'prendre', 'ramener', 'rapporter', 'rajouter', 'ajouter', 'mettre']
const PREFIXES_ACHAT = ['il faut', 'on a plus de', 'on a plus d\'', 'besoin de', "besoin d'", 'manque du', 'manque de la', "manque de l'", 'manque des', 'manque de']
const ARTICLES = ['du', 'de la', "de l'", 'des', 'le', 'la', 'les', 'un', 'une', 'de']

function nettoyerNomProduit(texte: string): string {
  let s = texte.trim().toLowerCase()
  // Enlever les préfixes complets en premier
  for (const p of PREFIXES_ACHAT) {
    if (s.startsWith(p)) { s = s.slice(p.length).trim(); break }
  }
  // Enlever les verbes d'achat en début
  for (const v of VERBES_ACHAT) {
    const re = new RegExp(`^${v}\\s+`)
    if (re.test(s)) { s = s.replace(re, ''); break }
  }
  // Enlever les articles restants en début
  for (const a of ARTICLES) {
    const re = new RegExp(`^${a}\\s+`)
    if (re.test(s)) { s = s.replace(re, ''); break }
  }
  // Capitaliser
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function extraireArticles(texte: string): string[] {
  const t = texte.toLowerCase()
  // Séparer sur "et", ",", "ainsi que", "+"
  const separateurs = /\s+et\s+|,\s*|\s+ainsi\s+que\s+|\s*\+\s*/
  // Trouver la partie après le verbe/préfixe
  let reste = t
  for (const p of PREFIXES_ACHAT) {
    if (reste.includes(p)) { reste = reste.split(p).slice(1).join(''); break }
  }
  for (const v of VERBES_ACHAT) {
    const re = new RegExp(`${v}\\s+`)
    if (re.test(reste)) { reste = reste.replace(re, ''); break }
  }
  const parties = reste.split(separateurs).map(p => p.trim()).filter(Boolean)
  if (parties.length > 1) {
    return parties.map(p => nettoyerNomProduit(p)).filter(Boolean)
  }
  return [nettoyerNomProduit(texte)]
}

// ─── Catégorisation automatique des produits ──────────────────────────────────

// Mapping produit → catégorie (ordre = priorité de détection)
const CAT_MOTS: Array<{ nom: string; icone: string; mots: string[] }> = [
  // Catégories existantes dans le seed
  { nom: 'Fruits',               icone: '🍎', mots: ['pomme', 'poire', 'banane', 'orange', 'citron', 'citron vert', 'fraise', 'framboise', 'myrtille', 'raisin', 'melon', 'pasteque', 'mangue', 'kiwi', 'ananas', 'peche', 'abricot', 'prune', 'cerise', 'avocat', 'clementine', 'mandarine', 'pamplemousse', 'figue', 'grenade', 'litchi', 'noix', 'amande', 'noisette', 'datte', 'pruneaux', 'raisin sec', 'abricot sec', 'fruit'] },
  { nom: 'Légumes',              icone: '🥦', mots: ['tomate', 'courgette', 'poivron', 'carotte', 'salade', 'epinard', 'brocoli', 'pomme de terre', 'patate', 'oignon', 'ail', 'poireau', 'champignon', 'concombre', 'aubergine', 'radis', 'celeri', 'persil', 'menthe', 'coriandre', 'basilic', 'fenouil', 'navet', 'artichaut', 'asperge', 'endive', 'mache', 'roquette', 'betterave', 'mais frais', 'petit pois', 'haricot vert', 'chou', 'courge', 'potiron', 'butternut', 'echalote', 'legume'] },
  { nom: 'Viande & Charcuterie', icone: '🥩', mots: ['poulet', 'boeuf', 'porc', 'agneau', 'veau', 'dinde', 'lapin', 'saucisse', 'jambon', 'bacon', 'lardons', 'merguez', 'steak', 'cotelette', 'escalope', 'filet de poulet', 'filet de boeuf', 'viande', 'charcuterie', 'saucisson', 'pate de campagne', 'roti', 'cuisse de poulet', 'blanc de poulet', 'aile de poulet', 'kebab', 'chipolata', 'boudin', 'chorizo', 'nuggets'] },
  { nom: 'Poissons',             icone: '🐟', mots: ['saumon', 'thon frais', 'cabillaud', 'truite', 'dorade', 'bar', 'crevette', 'moule', 'huitre', 'calamar', 'poulpe', 'anchois frais', 'sardine fraiche', 'maquereau', 'sole', 'merlan', 'lieu', 'colin', 'saint-jacques', 'homard', 'langouste', 'poisson frais', 'fruits de mer'] },
  { nom: 'Épicerie salée',       icone: '🫙', mots: ['pates', 'riz', 'farine', 'huile', 'vinaigre', 'moutarde', 'mayonnaise', 'ketchup', 'bouillon', 'levure boulangere', 'lentilles', 'pois chiches', 'haricots secs', 'sel', 'poivre', 'crackers', 'biscottes', 'semoule', 'quinoa', 'boulgour', 'polenta', 'chips', 'olives', 'cornichon', 'capres', 'pesto', 'tahin', 'harissa', 'concentre de tomate', 'tomates sechees', 'lait de coco', 'creme de coco', 'fecule', 'maizena', 'chapelure', 'lasagnes', 'spaghetti', 'tagliatelles'] },
  { nom: 'Épicerie sucrée',      icone: '🍫', mots: ['sucre', 'confiture', 'miel', 'chocolat', 'biscuit', 'gateau', 'compote', 'cereales', 'granola', 'nutella', 'pate a tartiner', 'bonbon', 'caramel', 'vermicelles', 'gelatine', 'vanille', 'cacao', 'levure chimique', 'flan', 'confiserie', 'marshmallow', 'speculoos'] },
  { nom: 'Conserves',            icone: '🥫', mots: ['conserve', 'tomates pelees', 'mais en boite', 'thon en boite', 'sardines en boite', 'haricots verts en boite', 'petits pois en boite', 'champignons en boite', 'cassoulet', 'ratatouille en boite', 'ravioli en boite', 'soupe en boite'] },
  { nom: 'Surgelés',             icone: '🧊', mots: ['surgele', 'congele', 'pizza surgelee', 'frites surgelees', 'glace', 'sorbet', 'epinards surgeles', 'poisson pane', 'nuggets surgeles', 'wok surgele'] },
  { nom: 'Épices',               icone: '🌿', mots: ['cumin', 'curry', 'paprika', 'cannelle', 'gingembre en poudre', 'curcuma', 'thym', 'laurier', 'origan', 'romarin', 'estragon', 'piment', 'muscade', 'cardamome', 'anis', 'clou de girofle', 'ras el hanout', 'fenugrec', 'sumac', 'epice', 'herbes de provence'] },
  { nom: 'Asiatique',            icone: '🥢', mots: ['sauce soja', 'miso', 'sake', 'mirin', 'nouilles chinoises', 'ramen', 'udon', 'soba', 'nori', 'wasabi', 'tofu', 'edamame', 'shiitake', 'dashi', 'sriracha', 'sauce hoisin', 'sauce huitre', 'sauce poisson', 'citronnelle', 'sambal'] },
  { nom: 'Hygiène',              icone: '🧼', mots: ['savon', 'shampoing', 'gel douche', 'dentifrice', 'brosse a dents', 'deodorant', 'rasoir', 'coton', 'lingette', 'lotion', 'bain de bouche', 'fil dentaire', 'coton-tige', 'serviette hygienique', 'tampon', 'couche', 'baume', 'after-shave', 'hygiene'] },
  { nom: 'Entretien',            icone: '🧹', mots: ['lessive', 'liquide vaisselle', 'eponge', 'produit menager', 'nettoyant', 'desinfectant', 'javel', 'detartrant', 'assouplissant', 'pastille lave-vaisselle', 'torchon', 'serpillere', 'sac poubelle', 'film etirable', 'aluminium', 'papier cuisson', 'sopalin', 'essuie-tout', 'papier toilette', 'entretien'] },
  // Catégories à créer si absentes
  { nom: 'Produits Laitiers',    icone: '🥛', mots: ['lait', 'beurre', 'creme fraiche', 'creme liquide', 'creme entiere', 'creme allegee', 'fromage', 'camembert', 'brie', 'emmental', 'gruyere', 'mozzarella', 'feta', 'ricotta', 'mascarpone', 'kefir', 'yaourt', 'yogourt', 'fromage blanc', 'fromage frais', 'lait vegetal', "lait d'amande", 'lait de soja', "lait d'avoine", 'lait entier', 'lait demi', 'petit suisse', 'creme dessert'] },
  { nom: 'Boulangerie',          icone: '🍞', mots: ['pain', 'baguette', 'croissant', 'brioche', 'pain de mie', 'pain complet', 'pain aux cereales', 'pain de seigle', 'pain burger', 'viennoiserie', 'pain au chocolat', 'chausson', 'madeleine', 'financier', 'pain pita', 'naan', 'tortilla', 'wrap'] },
  { nom: 'Boissons',             icone: '🧃', mots: ['eau', 'jus de fruit', 'jus d\'orange', 'jus de pomme', 'nectar', 'sirop', 'soda', 'coca', 'limonade', 'cafe', 'the', 'tisane', 'infusion', 'chocolat chaud', 'lait aromatise', 'smoothie', 'boisson', 'biere', 'vin', 'cidre', 'kombucha'] },
]

function n(s: string) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ ]/g, '') }

function estAlimentaire(texte: string): boolean {
  const t = n(texte)
  return CAT_MOTS.some(cat => cat.mots.some(m => t.includes(n(m))))
}

function detecterNomCategorie(nomProduit: string): { nom: string; icone: string } | null {
  const t = n(nomProduit)
  for (const { nom, icone, mots } of CAT_MOTS) {
    if (mots.some(m => t.includes(n(m)))) return { nom, icone }
  }
  return null
}

async function resolverCategorieProduitId(nomProduit: string): Promise<string | undefined> {
  const cat = detecterNomCategorie(nomProduit)
  if (!cat) return undefined
  // Chercher la catégorie existante
  const existing = await db.categoriesProduits
    .filter(c => !c.deletedAt && c.nom === cat.nom)
    .toArray()
  if (existing[0]) return existing[0].id
  // Créer la catégorie si elle n'existe pas encore
  const { v4: uuid } = await import('uuid')
  const { newEntity: ne } = await import('../../../core/db/helpers')
  const ordre = await db.categoriesProduits.count() + 1
  const id = uuid()
  await db.categoriesProduits.add({
    ...ne({ nom: cat.nom, icone: cat.icone, typeProduit: 'consommable', ordre, personnalisee: false }),
    id,
  })
  return id
}

function detecterIntentionLocale(texte: string): IntentionLocale {
  const t = texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const date        = resolverDate(t) ?? undefined
  const hasEvtKw    = MOTS_EVT.some(m => t.includes(m))
  const hasTacheKw  = MOTS_TACHE.some(m => t.includes(m))
  const hasAchatKw  = MOTS_ACHAT.some(m => t.includes(m))
  const hasManqueKw = MOTS_MANQUE.some(m => t.includes(m))
  const hasNecKw    = MARQUEURS_NECESSITE.some(m => t.includes(m))

  // ── Règle 1 : marqueur de nécessité + verbe de tâche → tâche ────────────────
  // "il faut appeler" ✓  "besoin de vérifier" ✓  "il faut acheter" → achat (pas de verbe tâche)
  if (hasNecKw && hasTacheKw) {
    return { type: 'tache', titre: texte.trim(), date }
  }

  // ── Règle 2 : "manque de X" → achat seulement si X est un produit physique ──
  // "manque de lait" ✓ courses  |  "manque de sommeil" → pensée
  if (hasManqueKw && !hasAchatKw) {
    if (estAlimentaire(texte)) {
      return { type: 'achat', articles: extraireArticles(texte) }
    }
    return { type: 'pensee' }
  }

  // ── Règle 3 : verbe d'achat explicite → courses ou À acheter ─────────────────
  if (hasAchatKw) {
    if (estAlimentaire(texte)) {
      return { type: 'achat', articles: extraireArticles(texte) }
    }
    return { type: 'achat_ponctuel', nom: texte.trim() }
  }

  // ── Règle 4 : mot-clé événement + date → calendrier ─────────────────────────
  // Une date SEULE sans mot-clé événement ne suffit pas (ex: "appeler demain" = tâche)
  if (date && hasEvtKw) {
    return { type: 'evenement', titre: texte.trim(), date }
  }

  // ── Règle 5 : verbe d'action → tâche (avec date = deadline, pas événement) ──
  if (hasTacheKw) {
    return { type: 'tache', titre: texte.trim(), date }
  }

  // ── Règle 6 : pensée libre ───────────────────────────────────────────────────
  return { type: 'pensee' }
}

const LABEL_LOCAL: Record<string, string> = {
  achat:     'Ajouté aux courses',
  tache:     'Tâche créée',
  evenement: 'Événement ajouté au calendrier',
  pensee:    'Pensée enregistrée',
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

async function createEntityLocal(intention: IntentionLocale, original: string): Promise<string> {
  switch (intention.type) {
    case 'achat':
      await Promise.all(intention.articles.map(async nom => {
        const categorieProduitId = await resolverCategorieProduitId(nom)
        return db.coursesItems.add(newEntity<CoursesItem>({
          produit: '', nom, coche: false, source: 'manuel', dateAjout: new Date(),
          ...(categorieProduitId ? { categorieProduitId } : {}),
        }))
      }))
      return intention.articles.length > 1
        ? `${intention.articles.length} articles ajoutés aux courses`
        : `"${intention.articles[0]}" ajouté aux courses`

    case 'achat_ponctuel': {
      await db.wishlistItems.add(newEntity<WishlistItem>({
        nom: intention.nom, contexte: 'achats_besoins',
        statut: 'a_decider', priorite: 'haute', archive: false,
      }))
      return `Ajouté à "À acheter" · ${intention.nom}`
    }

    case 'tache': {
      await db.pensees.add(newEntity<Pensee>({
        contenu: intention.titre, categorie: detecterCategorie(intention.titre),
        statut: 'active', aFaire: true, archive: false,
        dateDetectee: intention.date ? intention.date.toISOString().split('T')[0] : undefined,
      }))
      return 'Ajouté dans "À faire" · ' + intention.titre
    }

    case 'evenement': {
      const dateDebut = intention.date ?? new Date()
      await db.evenements.add(newEntity<Evenement>({
        titre: intention.titre, type: 'evenement' as TypeEvenement,
        dateDebut, journeeEntiere: true,
        archive: false, recurrence: false, contexteMedical: false,
      }))
      const suffix = intention.date ? ` · ${formatDateLabel(intention.date)}` : ''
      return LABEL_LOCAL.evenement + suffix
    }

    case 'pensee':
    default:
      await db.pensees.add(newEntity<Pensee>({
        contenu: original, categorie: detecterCategorie(original),
        statut: 'active', archive: false,
      }))
      return LABEL_LOCAL.pensee
  }
}

// ─── Création des entités (avec résultat Gemini) — conservé pour référence ────

async function createEntity(
  result: { type: string; titre: string; date?: string | null; heure?: string | null; typeEvenement?: string | null; articles?: string[] } | null,
  original: string
): Promise<void> {
  if (!result) {
    await db.pensees.add(newEntity<Pensee>({
      contenu: original,
      categorie: detecterCategorie(original),
      statut: 'active',
      archive: false,
    }))
    return
  }

  const { type, titre, date, heure, typeEvenement } = result

  switch (type) {
    case 'evenement':
      // Sans date explicite → pensée (pas d'événement sans date)
      if (!date) {
        await db.pensees.add(newEntity<Pensee>({
          contenu: original, categorie: detecterCategorie(original),
          statut: 'active', archive: false,
        }))
        break
      }
      await db.evenements.add(newEntity<Evenement>({
        titre,
        type: (typeEvenement as TypeEvenement) ?? 'evenement',
        dateDebut:      new Date(date + (heure ? `T${heure}:00` : 'T00:00:00')),
        journeeEntiere: !heure,
        heureDebut:     heure ?? undefined,
        archive:        false,
        recurrence:     false,
        contexteMedical: false,
      }))
      break

    case 'tache':
      await db.pensees.add(newEntity<Pensee>({
        contenu: titre, categorie: detecterCategorie(titre),
        statut: 'active', aFaire: true, archive: false,
        dateDetectee: date ?? undefined,
      }))
      break

    case 'achat': {
      const items = result.articles?.length ? result.articles : [titre]
      const alimentaires    = items.filter(nom => estAlimentaire(nom))
      const nonAlimentaires = items.filter(nom => !estAlimentaire(nom))
      if (alimentaires.length > 0) {
        await Promise.all(alimentaires.map(async nom => {
          const categorieProduitId = await resolverCategorieProduitId(nom)
          return db.coursesItems.add(newEntity<CoursesItem>({
            produit: '', nom, coche: false, source: 'manuel', dateAjout: new Date(),
            ...(categorieProduitId ? { categorieProduitId } : {}),
          }))
        }))
      }
      if (nonAlimentaires.length > 0) {
        await Promise.all(nonAlimentaires.map(nom =>
          db.wishlistItems.add(newEntity<WishlistItem>({
            nom, contexte: 'achats_besoins',
            statut: 'a_decider', priorite: 'haute', archive: false,
          }))
        ))
      }
      break
    }

    case 'note':
    default:
      await db.pensees.add(newEntity<Pensee>({
        contenu:   original,
        categorie: detecterCategorie(original),
        statut:    'active',
        archive:   false,
      }))
      break
  }
}

function formatConfirm(result: { type: string; titre: string; date?: string | null; articles?: string[] } | null): string {
  if (!result) return 'Pensée enregistrée'
  // Événement sans date → redirigé vers pensée
  if (result.type === 'evenement' && !result.date) return 'Pensée enregistrée'
  const label = TYPE_LABEL[result.type] ?? 'Enregistré'
  const date  = result.date
    ? new Date(result.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    : null
  if (result.type === 'achat') {
    const items = result.articles?.length ? result.articles : [result.titre]
    const alimentaires    = items.filter(nom => estAlimentaire(nom))
    const nonAlimentaires = items.filter(nom => !estAlimentaire(nom))
    if (nonAlimentaires.length > 0 && alimentaires.length === 0)
      return `Tâche créée · ${nonAlimentaires.join(', ')}`
    if (alimentaires.length > 0 && nonAlimentaires.length === 0)
      return `Ajouté aux courses · ${alimentaires.join(', ')}`
    return `Courses + tâche · ${items.join(', ')}`
  }
  return `${label} · ${result.titre}${date ? ` · ${date}` : ''}`
}

// ─── Score charge mentale ─────────────────────────────────────────────────────

// Tâche "actionnable maintenant" :
//  — fréquence courte (quotidienne / hebdo / bi-hebdo)
//  — OU échéance définie dans les 7 prochains jours (ou en retard)
// On exclut volontairement les tâches sans fréquence ET sans date
// (vieilles tâches flottantes jamais traitées qui pollueraient le compteur).
const FREQ_COURTES = new Set(['quotidienne', 'hebdomadaire', 'bihebdomadaire'])

function estActionnable(t: Tache, finSemaine: Date): boolean {
  if (FREQ_COURTES.has(t.frequence ?? '')) return true
  if (t.dateEcheance && new Date(t.dateEcheance) <= finSemaine) return true
  return false
}

function useChargeScore() {
  const taches = useLiveQuery(async () => {
    const finSemaine = new Date()
    finSemaine.setDate(finSemaine.getDate() + 7)
    finSemaine.setHours(23, 59, 59, 999)
    const all = await db.taches.filter(t =>
      !t.deletedAt && !t.archive && t.statut === 'a_faire'
    ).toArray()
    return all.filter(t => estActionnable(t, finSemaine)).length
  }, []) ?? 0

  const pensees = useLiveQuery(
    () => db.pensees.filter(p => !p.deletedAt && !p.archive && p.statut === 'active').count(),
    []
  ) ?? 0

  const total = taches + pensees

  if (total === 0) return { total, label: 'Journée sereine', variant: 'green' as const }
  if (total <= 4)  return { total, label: 'Journée légère',  variant: 'green' as const }
  if (total <= 9)  return { total, label: 'Charge modérée',  variant: 'amber' as const }
  return             { total, label: 'Semaine chargée', variant: 'red'   as const }
}

// ─── Détail ventilation ───────────────────────────────────────────────────────

function useChargeDetail() {
  return useLiveQuery(async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const finSemaine = new Date(today)
    finSemaine.setDate(finSemaine.getDate() + (7 - finSemaine.getDay()))
    finSemaine.setHours(23, 59, 59, 999)

    const allTaches = await db.taches.filter(t =>
      !t.deletedAt && !t.archive && t.statut === 'a_faire'
    ).toArray()

    const actionnables = allTaches.filter(t => estActionnable(t, finSemaine))

    const pensees = await db.pensees.filter(p =>
      !p.deletedAt && !p.archive && p.statut === 'active'
    ).toArray()

    const evenementsAujourdhui = await db.evenements.filter(e => {
      if (e.deletedAt || e.archive) return false
      const d = new Date(e.dateDebut)
      d.setHours(0, 0, 0, 0)
      return d.getTime() === today.getTime()
    }).count()

    // Ventilation par module
    const parModule: Record<string, number> = {}
    for (const t of actionnables) {
      const m = t.moduleOrigine ?? 'autre'
      parModule[m] = (parModule[m] ?? 0) + 1
    }

    return { actionnables, pensees, evenementsAujourdhui, parModule }
  })
}

// ─── Boutons suggestion ───────────────────────────────────────────────────────


// ─── Composant principal ──────────────────────────────────────────────────────

export function WidgetCapturePensee() {
  const navigate    = useNavigate()
  const contexte    = useContexteHoraire()
  const charge      = useChargeScore()
  const detail      = useChargeDetail()
  const [texte,        setTexte]        = useState('')
  const [processing,   setProcessing]   = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [showDetail,   setShowDetail]   = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleCapture = useCallback(async () => {
    const contenu = texte.trim()
    if (!contenu || processing) return

    setTexte('')
    setProcessing(true)

    try {
      {
        const intention = detecterIntentionLocale(contenu)
        const label = await createEntityLocal(intention, contenu)
        setConfirmation(label)
      }
      setTimeout(() => setConfirmation(null), 4000)
    } finally {
      setProcessing(false)
      textareaRef.current?.focus()
    }
  }, [texte, processing])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCapture()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTexte(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <div className="widget-hero-groupe">

      {/* ── Carte haute : dégradé + question ── */}
      <div className="widget-hero">
        <div className="widget-hero__blob" aria-hidden="true" />

        <div className="widget-hero__top">
          <button
            className={`widget-hero__charge widget-hero__charge--${charge.variant} widget-hero__charge--btn`}
            onClick={() => charge.total > 0 && setShowDetail(true)}
            disabled={charge.total === 0}
          >
            <span className="widget-hero__charge-dot" />
            {charge.label}{charge.total > 0 ? ` · ${charge.total} élément${charge.total > 1 ? 's' : ''}` : ''}
          </button>
          <p className="widget-hero__salam">Salam Mommy</p>
        </div>

        <div className="widget-hero__question-block">
          <h2 className="widget-hero__question">{contexte.titre}</h2>
          {contexte.sousTitre && (
            <p className="widget-hero__sous-titre">{contexte.sousTitre}</p>
          )}
        </div>

        <div className="widget-hero__suggestions">
          {contexte.chips.map(({ label, route, badge }) => (
            <button
              key={label}
              className="widget-hero__chip"
              onClick={() => route && navigate(route)}
            >
              {label}
              {badge && <span className="widget-hero__chip-badge">{badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Carte basse : glassmorphisme + input ── */}
      <div className="widget-hero-input">
        <div className={`widget-hero__input-row${processing ? ' widget-hero__input-row--loading' : ''}`}>
          <textarea
            ref={textareaRef}
            className="widget-hero__textarea"
            placeholder="Décharge tes pensées ici…"
            value={texte}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={processing}
          />
          <button
            className="widget-hero__send"
            onClick={handleCapture}
            disabled={!texte.trim() || processing}
            aria-label="Envoyer"
          >
            {processing
              ? <span className="widget-hero__spinner" />
              : <SendIcon />
            }
          </button>
        </div>

        {confirmation && (
          <div className="widget-hero__confirm">
            <CheckIcon />
            <span>{confirmation}</span>
          </div>
        )}
      </div>

      {/* ── Drawer détail charge ── */}
      {showDetail && detail && (
        <ChargeDetailDrawer
          detail={detail}
          onClose={() => setShowDetail(false)}
        />
      )}

    </div>
  )
}

// ─── Drawer ventilation ───────────────────────────────────────────────────────

const MODULE_INFO: Record<string, { label: string; emoji: string; path: string }> = {
  maison:          { label: 'Maison',     emoji: '🏠', path: '/menage'    },
  cuisine:         { label: 'Cuisine',    emoji: '🍽', path: '/cuisine'   },
  enfants:         { label: 'Enfants',    emoji: '🧸', path: '/enfants'   },
  myself:          { label: 'Moi',        emoji: '🌸', path: '/myself'    },
  famille:         { label: 'Famille',    emoji: '👨‍👩‍👧', path: '/famille'   },
  achats:          { label: 'Achats',     emoji: '🛍',  path: '/achats'    },
  dashboard:       { label: 'Dashboard',  emoji: '🏡', path: '/dashboard' },
  dashboard_today: { label: "Aujourd'hui",emoji: '📋', path: '/dashboard' },
}

type DetailData = NonNullable<ReturnType<typeof useChargeDetail>>

function ModuleSection({
  mod, taches, onClose,
}: { mod: string; taches: Tache[]; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const info = MODULE_INFO[mod] ?? { label: mod, emoji: '📌', path: '/dashboard' }

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.025)', marginBottom: 4 }}>
      {/* En-tête cliquable → déplie la liste */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '11px 14px', border: 'none', background: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 500 }}>
          <span>{info.emoji}</span>
          <span style={{ color: 'var(--color-text, #1a1a2e)' }}>{info.label}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: '0.78rem', fontWeight: 600,
            background: 'rgba(167,139,250,0.15)', color: '#7C3AED',
            padding: '2px 8px', borderRadius: 20,
          }}>{taches.length}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Liste des tâches */}
      {open && (
        <div style={{ padding: '0 14px 10px' }}>
          {taches.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 0',
              borderTop: '1px solid rgba(0,0,0,0.04)',
              fontSize: '0.83rem', color: '#374151',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A78BFA', flexShrink: 0 }} />
              {t.titre}
            </div>
          ))}
          <button
            onClick={() => { navigate(info.path); onClose(); }}
            style={{
              marginTop: 8, fontSize: '0.78rem', color: '#7C3AED',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500,
            }}
          >
            Voir dans {info.label} →
          </button>
        </div>
      )}
    </div>
  )
}

function ChargeDetailDrawer({
  detail, onClose,
}: {
  detail: DetailData
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { actionnables, pensees, evenementsAujourdhui } = detail
  const total = actionnables.length + pensees.length

  const parModule = actionnables.reduce<Record<string, Tache[]>>((acc, t) => {
    const m = t.moduleOrigine ?? 'autre'
    ;(acc[m] = acc[m] ?? []).push(t)
    return acc
  }, {})

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 999, backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
        background: 'var(--color-surface, #fff)',
        borderRadius: '20px 20px 0 0',
        padding: '20px 20px 40px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
        maxHeight: '78vh', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.12)', margin: '0 auto 18px' }} />

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            {total} élément{total > 1 ? 's' : ''} à traiter cette semaine
          </h3>
        </div>

        {/* Tâches par module, dépliables */}
        {Object.entries(parModule)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([mod, taches]) => (
            <ModuleSection key={mod} mod={mod} taches={taches} onClose={onClose} />
          ))}

        {/* Pensées */}
        {pensees.length > 0 && (
          <button
            onClick={() => { navigate('/pensees'); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '11px 14px', borderRadius: 12, border: 'none',
              background: 'rgba(251,146,60,0.06)', cursor: 'pointer', marginBottom: 4, marginTop: 4,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 500 }}>
              💭 Pensées non traitées
            </span>
            <span style={{
              fontSize: '0.78rem', fontWeight: 600,
              background: 'rgba(251,146,60,0.15)', color: '#EA580C',
              padding: '2px 8px', borderRadius: 20,
            }}>{pensees.length}</span>
          </button>
        )}

        {evenementsAujourdhui > 0 && (
          <div style={{
            marginTop: 8, padding: '10px 14px', borderRadius: 12,
            background: 'rgba(96,165,250,0.08)',
            fontSize: '0.83rem', color: '#1d4ed8', fontWeight: 500,
          }}>
            📅 {evenementsAujourdhui} événement{evenementsAujourdhui > 1 ? 's' : ''} prévu{evenementsAujourdhui > 1 ? 's' : ''} aujourd'hui
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 16, width: '100%', padding: '11px', borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.08)', background: 'none',
            fontSize: '0.83rem', color: '#6b7280', cursor: 'pointer',
          }}
        >
          Fermer
        </button>
      </div>
    </>
  )
}

export default WidgetCapturePensee
