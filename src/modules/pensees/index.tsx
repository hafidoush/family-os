/**
 * FAMILY OS — Module Pensées
 * F1 : Décharger ma tête — capture rapide texte
 * F2 : Tableau des oublis — vue organisée par catégorie
 */

import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../core/db/database'
import { newEntity, withUpdate, softDeleteFields } from '../../core/db/helpers'
import { IconCalendar } from '@shared/components/ui/Icon/Icon'
import { ConfirmModal } from '../../shared/components/ui/ConfirmModal'

import type { Pensee, CategoriePensee, StatutPensee, Tache, CoursesItem, Evenement } from '../../shared/types'
import './pensees.css'

// ─── Config catégories ────────────────────────────────────────────────────────

const CATEGORIES: { key: CategoriePensee; label: string; emoji: string; color: string }[] = [
  { key: 'enfants',       label: 'Enfants',       emoji: '👧', color: '#86EFAC' },
  { key: 'maison',        label: 'Maison',         emoji: '🏠', color: '#BAE6FD' },
  { key: 'administratif', label: 'Administratif',  emoji: '📋', color: '#DDD6FE' },
  { key: 'animaux',       label: 'Animaux',        emoji: '🐾', color: '#FDE68A' },
  { key: 'achats',        label: 'Achats',         emoji: '🛒', color: '#FCA5A5' },
  { key: 'evenements',    label: 'Événements',     emoji: '🗓',  color: '#FBCFE8' },
  { key: 'sante',         label: 'Santé',          emoji: '💊', color: '#A7F3D0' },
  { key: 'autre',         label: 'Autre',          emoji: '💭', color: '#E5E7EB' },
]

// ─── Détection automatique de catégorie ──────────────────────────────────────

const MOTS_CLES: Record<CategoriePensee, string[]> = {
  enfants:       ['enfant', 'manel', 'nawfel', 'nono', 'loulou', 'école', 'ecole', 'sac', 'cartable', 'chaussure', 'vêtement', 'vetement', 'anniversaire', 'goûter', 'gouter', 'crèche', 'creche', 'cantine', 'activit', 'fils', 'fille', 'bébé', 'bebe'],
  maison:        ['maison', 'pièce', 'piece', 'cuisine', 'chambre', 'salon', 'salle', 'rangement', 'ménage', 'menage', 'nettoy', 'réparer', 'reparer', 'plombier', 'électricien', 'electricien'],
  administratif: ['document', 'papier', 'formulaire', 'déclaration', 'declaration', 'impôt', 'impot', 'assurance', 'mutuelle', 'rdv', 'rendez-vous', 'rendez_vous', 'admin', 'banque', 'facture'],
  animaux:       ['vétérinaire', 'veterinaire', 'vét', 'vet', 'chien', 'chat', 'animal', 'antiparasitaire', 'vaccin', 'croquettes', 'litière', 'litiere'],
  achats:        ['acheter', 'achat', 'commande', 'commander', 'courses', 'magasin', 'boutique', 'livraison', 'cadeau'],
  evenements:    ['samedi', 'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'fête', 'fete', 'sortie', 'vacances', 'week-end', 'week end'],
  sante:         ['médecin', 'medecin', 'docteur', 'pharmacie', 'médicament', 'medicament', 'santé', 'sante', 'consultation', 'ordonnance', 'dentiste', 'kiné', 'kine'],
  autre:         [],
}

const NOMS_JOURS: Record<string, number> = {
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0,
}

export function detecterCategorie(texte: string): CategoriePensee {
  const t = texte.toLowerCase()
  for (const [cat, mots] of Object.entries(MOTS_CLES) as [CategoriePensee, string[]][]) {
    if (cat === 'autre') continue
    if (mots.some(m => t.includes(m))) return cat
  }
  return 'autre'
}

function detecterDate(texte: string): string | undefined {
  const t = texte.toLowerCase()
  // Détection "samedi", "lundi", etc. → prochain jour correspondant
  for (const [jour, jourIndex] of Object.entries(NOMS_JOURS)) {
    if (t.includes(jour)) {
      const today = new Date()
      const todayIndex = today.getDay()
      let diff = jourIndex - todayIndex
      if (diff < 0) diff += 7
      const cible = new Date(today)
      cible.setDate(today.getDate() + diff)
      return cible.toISOString().split('T')[0]
    }
  }
  // Détection "demain"
  if (t.includes('demain')) {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }
  return undefined
}

function detecterAction(texte: string): string | undefined {
  const t = texte.toLowerCase()
  if (t.includes('acheter') || t.includes('commander') || t.includes('cadeau')) return 'Acheter'
  if (t.includes('appeler') || t.includes('appel') || t.includes('téléphoner')) return 'Appeler'
  if (t.includes('prendre rdv') || t.includes('rendez-vous') || t.includes('rendez_vous')) return 'Prendre rendez-vous'
  if (t.includes('vérifier') || t.includes('verifier') || t.includes('checker')) return 'Vérifier'
  if (t.includes('préparer') || t.includes('preparer')) return 'Préparer'
  if (t.includes('penser à') || t.includes('penser a')) return 'Penser à'
  return undefined
}

// ─── Détection alimentaire ────────────────────────────────────────────────────

const ALIMENTAIRE_MOTS = [
  'lait','pain','beurre','fromage','yaourt','yogourt','creme','farine','sucre',
  'pates','riz','huile','sel','poivre','cafe','the','eau','jus','soda','biere','vin',
  'poulet','boeuf','viande','poisson','saumon','thon','jambon','saucisse',
  'tomate','courgette','carotte','salade','oignon','ail','pomme de terre','patate',
  'pomme','banane','orange','fraise','raisin','fruit','legume',
  'lessive','savon','shampoing','dentifrice','gel douche','papier toilette','essuie-tout',
  'liquide vaisselle','sac poubelle','eponge','sopalin',
  'chips','chocolat','biscuit','confiture','miel','cereales','compote',
  'surgele','conserve','sauce','bouillon','moutarde','mayonnaise','ketchup',
]

function nr(s: string) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }
function estAlimentaire(texte: string): boolean {
  const t = nr(texte)
  return ALIMENTAIRE_MOTS.some(m => t.includes(nr(m)))
}

// ─── Formulaire de saisie ─────────────────────────────────────────────────────

interface SaisieFormProps { onClose: () => void; defaultContenu?: string }

function SaisieForm({ onClose, defaultContenu = '' }: SaisieFormProps) {
  const [contenu, setContenu] = useState(defaultContenu)
  const [categorie, setCategorie] = useState<CategoriePensee>('autre')
  const [categorieAutoDetectee, setCategorieAutoDetectee] = useState<CategoriePensee | null>(null)
  const [saving, setSaving] = useState(false)

  // Analyse en temps réel pendant la saisie
  const handleChange = (val: string) => {
    setContenu(val)
    if (val.length > 3) {
      const auto = detecterCategorie(val)
      setCategorieAutoDetectee(auto)
      setCategorie(auto)
    } else {
      setCategorieAutoDetectee(null)
    }
  }

  const handleSave = async () => {
    if (!contenu.trim()) return
    setSaving(true)
    try {
      const texte = contenu.trim()
      const categorieLocale = categorie
      const dateLocale = detecterDate(texte)
      const actionLocale = detecterAction(texte)

      // 1. Sauvegarde immédiate avec la classification locale — l'UI se ferme de suite
      const pensee = newEntity<Pensee>({
        contenu: texte,
        categorie: categorieLocale,
        dateDetectee: dateLocale,
        actionSuggeree: actionLocale,
        statut: 'active',
        archive: false,
      })
      await db.pensees.add(pensee)
      onClose()

    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  const catInfo = CATEGORIES.find(c => c.key === categorie)

  return (
    <div className="pensees-modal-backdrop" onClick={onClose}>
      <div className="pensees-modal" onClick={e => e.stopPropagation()}>
        <div className="pensees-modal__handle" />
        <p className="pensees-modal__hint">Qu'est-ce qui occupe ton esprit ?</p>
        <textarea
          className="pensees-saisie"
          value={contenu}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Acheter un cadeau pour samedi · Vérifier les chaussures de Manel · Prendre rdv vétérinaire…"
          rows={4}
          autoFocus
        />

        {categorieAutoDetectee && (
          <p className="pensees-auto-detect">
            Classé dans <strong>{catInfo?.emoji} {catInfo?.label}</strong>
          </p>
        )}

        <div className="pensees-categories">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              className={`pensees-cat-btn${categorie === c.key ? ' pensees-cat-btn--active' : ''}`}
              style={{ '--cat-color': c.color } as React.CSSProperties}
              onClick={() => setCategorie(c.key)}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <div className="pensees-modal__actions">
          <button className="pensees-btn pensees-btn--cancel" onClick={onClose}>Annuler</button>
          <button
            className="pensees-btn pensees-btn--save"
            onClick={handleSave}
            disabled={saving || !contenu.trim()}
          >
            {saving ? '…' : 'Décharger'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Carte pensée ─────────────────────────────────────────────────────────────

function PenseeCard({ pensee, onTraiter, onSupprimer, onTransformer }: {
  pensee: Pensee
  onTraiter: () => void
  onSupprimer: () => void
  onTransformer: (vers: 'tache' | 'achat' | 'calendrier') => void
}) {
  const cat = CATEGORIES.find(c => c.key === pensee.categorie)
  const dateLabel = pensee.dateDetectee
    ? new Date(pensee.dateDetectee + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  return (
    <div className={`pensee-card${pensee.statut === 'traitee' ? ' pensee-card--traitee' : ''}`}
         style={{ '--cat-color': cat?.color } as React.CSSProperties}>
      <div className="pensee-card__body">
        <p className="pensee-card__contenu">{pensee.contenu}</p>
        {(dateLabel || pensee.actionSuggeree) && (
          <div className="pensee-card__hints">
            {pensee.actionSuggeree && (
              <span className="pensee-card__action">→ {pensee.actionSuggeree}</span>
            )}
            {dateLabel && (
              <span className="pensee-card__date"><IconCalendar size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {dateLabel}</span>
            )}
          </div>
        )}
      </div>
      <div className="pensee-card__actions">
        <button className="pensee-card__btn pensee-card__btn--traiter" onClick={onTraiter}
                title={pensee.statut === 'traitee' ? 'Rouvrir' : 'Marquer comme traité'}>
          {pensee.statut === 'traitee' ? '↩' : '✓'}
        </button>
        <button className="pensee-card__btn pensee-card__btn--suppr" onClick={onSupprimer} title="Supprimer">✕</button>
      </div>

      {pensee.statut !== 'traitee' && (
        <div className="pensee-card__transform">
          <button className={`pensee-card__chip pensee-card__chip--tache${pensee.aFaire ? ' pensee-card__chip--active' : ''}`}
            onClick={() => onTransformer('tache')}>
            {pensee.aFaire ? '✓ À faire' : '→ Faire'}
          </button>
          <button className="pensee-card__chip pensee-card__chip--achat"
            onClick={() => onTransformer('achat')}>
            {estAlimentaire(pensee.contenu) ? '→ Courses' : '→ Acheter'}
          </button>
          <button className="pensee-card__chip pensee-card__chip--cal"
            onClick={() => onTransformer('calendrier')}>→ Planifier</button>
        </div>
      )}
    </div>
  )
}

// ─── Module principal ─────────────────────────────────────────────────────────

export default function Pensees() {
  const [showSaisie, setShowSaisie] = useState(false)
  const [filtreStatut, setFiltreStatut] = useState<StatutPensee | 'toutes'>('active')
  const [confirmPensee, setConfirmPensee] = useState<Pensee | null>(null)

  const pensees = useLiveQuery(
    () => db.pensees
      .filter(p => !p.archive && !p.deletedAt)
      .toArray()
      .then(list => list.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )),
    []
  )

  const filtered = (pensees ?? []).filter(p =>
    filtreStatut === 'toutes' || p.statut === filtreStatut
  )

  // Regroupement par catégorie
  const parCategorie = CATEGORIES.map(cat => ({
    cat,
    items: filtered.filter(p => p.categorie === cat.key),
  })).filter(g => g.items.length > 0)

  const traiter = useCallback(async (p: Pensee) => {
    const nouveauStatut: StatutPensee = p.statut === 'traitee' ? 'active' : 'traitee'
    await db.pensees.update(p.id, withUpdate<Pensee>({ statut: nouveauStatut }))
  }, [])

  const supprimer = useCallback(async (p: Pensee) => {
    await db.pensees.update(p.id, softDeleteFields())
  }, [])

  const transformer = useCallback(async (p: Pensee, vers: 'tache' | 'achat' | 'calendrier') => {
    if (vers === 'tache') {
      await db.pensees.update(p.id, withUpdate<Pensee>({ aFaire: !p.aFaire }))
    } else if (vers === 'achat') {
      if (estAlimentaire(p.contenu)) {
        await db.coursesItems.add(newEntity<CoursesItem>({
          produit: '', nom: p.contenu, coche: false, source: 'manuel', dateAjout: new Date(),
        }))
      } else {
        await db.taches.add(newEntity<Tache>({
          titre: p.contenu, statut: 'a_faire', priorite: 'normale',
          moduleOrigine: 'famille', recurrence: false, archive: false,
        }))
      }
    } else {
      await db.evenements.add(newEntity<Evenement>({
        titre: p.contenu, type: 'evenement',
        dateDebut: p.dateDetectee ? new Date(p.dateDetectee + 'T00:00:00') : new Date(),
        journeeEntiere: true, archive: false, recurrence: false, contexteMedical: false,
      }))
    }
    await db.pensees.update(p.id, withUpdate<Pensee>({ statut: 'traitee' }))
  }, [])

  const nbActives = (pensees ?? []).filter(p => p.statut === 'active').length

  return (
    <div className="pensees-module">
      <div className="pensees-header">
        <div>
          <h1 className="pensees-title">Tableau des oublis</h1>
          <p className="pensees-subtitle">Tout ce qui occupe ton esprit, en un endroit</p>
        </div>
        {nbActives > 0 && (
          <span className="pensees-badge">{nbActives}</span>
        )}
      </div>

      {/* Filtres */}
      <div className="pensees-filtres">
        {(['active', 'traitee', 'toutes'] as const).map(s => (
          <button
            key={s}
            className={`pensees-filtre${filtreStatut === s ? ' pensees-filtre--active' : ''}`}
            onClick={() => setFiltreStatut(s)}
          >
            {s === 'active' ? 'En cours' : s === 'traitee' ? 'Traitées' : 'Toutes'}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {pensees === undefined && (
        <div className="pensees-skeleton" />
      )}

      {pensees !== undefined && filtered.length === 0 && (
        <div className="pensees-empty">
          <span className="pensees-empty__icon">🧠</span>
          <p className="pensees-empty__title">
            {filtreStatut === 'active' ? 'Ton esprit est libre' : 'Rien ici'}
          </p>
          {filtreStatut === 'active' && (
            <p className="pensees-empty__sub">Capture ce qui t'occupe l'esprit</p>
          )}
        </div>
      )}

      {parCategorie.map(({ cat, items }) => (
        <div key={cat.key} className="pensees-groupe">
          <div className="pensees-groupe__header"
               style={{ '--cat-color': cat.color } as React.CSSProperties}>
            <span className="pensees-groupe__emoji">{cat.emoji}</span>
            <span className="pensees-groupe__label">{cat.label}</span>
            <span className="pensees-groupe__count">{items.length}</span>
          </div>
          <div className="pensees-groupe__list">
            {items.map(p => (
              <PenseeCard
                key={p.id}
                pensee={p}
                onTraiter={() => traiter(p)}
                onSupprimer={() => setConfirmPensee(p)}
                onTransformer={(vers) => transformer(p, vers)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* FAB capture rapide */}
      <button className="pensees-fab" onClick={() => setShowSaisie(true)} aria-label="Capturer une pensée">
        <span className="pensees-fab__icon">💭</span>
        <span className="pensees-fab__label">Vide ta tête</span>
      </button>

      {showSaisie && (
        <SaisieForm onClose={() => setShowSaisie(false)} />
      )}

      <ConfirmModal
        open={confirmPensee !== null}
        title="Supprimer cette pensée ?"
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={async () => { if (confirmPensee) { await supprimer(confirmPensee); setConfirmPensee(null) } }}
        onCancel={() => setConfirmPensee(null)}
      />
    </div>
  )
}
