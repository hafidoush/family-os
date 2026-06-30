/**
 * FAMILY OS — PreparationHebdo
 * F8 : Préparation hebdomadaire maison
 * - Sélection de la catégorie (Goûters & Petits-déj', Desserts, Repas)
 * - Sélection des recettes à préparer
 * - Calcul automatique temps total + ingrédients
 * - Suivi conservation
 */

import { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../core/db/database'
import { newEntity, withUpdate } from '../../../../core/db/helpers'
import type { Recette, SessionPreparation } from '../../../../shared/types'
import { type BatchCategorie, BATCH_CATEGORIES, typesForCategorie } from './batchTypes'
import './PreparationHebdo.css'

// IDs de catégories connus (seed.ts)
const CAT_IDS_GOUTER     = ['cat-recette-gouter', 'cat-recette-petit-dejeuner']
const CAT_IDS_DESSERT    = ['cat-recette-dessert']
const CAT_IDS_REPAS      = ['cat-recette-plat-principal', 'cat-recette-soupe', 'cat-recette-entree', 'cat-recette-sauce', 'cat-recette-legumes-accompagnement']
const CAT_IDS_NON_REPAS  = [...CAT_IDS_GOUTER, ...CAT_IDS_DESSERT]

const TYPES_PREP = [
  { key: 'gouter',         label: 'Goûters',          emoji: '🧁' },
  { key: 'dessert',        label: 'Desserts',          emoji: '🍮' },
  { key: 'petit_dejeuner', label: 'Petits-déjeuners',  emoji: '🥐' },
  { key: 'snack',          label: 'Snacks',             emoji: '🥜' },
  { key: 'plat',           label: 'Plats préparés',    emoji: '🍲' },
] as const

// ─── Vignette recette (style menu) ───────────────────────────────────────────

function RecetteThumb({ recette, selected, onToggle }: {
  recette: Recette
  selected: boolean
  onToggle: (id: string) => void
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (recette.imageData) { setImageUrl(recette.imageData); return }
    if (!recette.image) { setImageUrl(null); return }
    const url = URL.createObjectURL(recette.image)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [recette.imageData, recette.image])

  return (
    <button
      className={`batch-thumb${selected ? ' batch-thumb--selected' : ''}`}
      onClick={() => onToggle(recette.id)}
    >
      {imageUrl
        ? <img src={imageUrl} alt={recette.nom} loading="lazy" />
        : <div className="batch-thumb__placeholder">
            {TYPES_PREP.find(t => t.key === recette.typePreparation)?.emoji ?? '🍽️'}
          </div>
      }
      <div className="batch-thumb__glass" />
      {selected && (
        <div className="batch-thumb__check">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <div className="batch-thumb__footer">
        <span className="batch-thumb__nom">{recette.nom}</span>
        {recette.dureeConservation && (
          <span className="batch-thumb__conservation">🗓 {recette.dureeConservation}j</span>
        )}
      </div>
    </button>
  )
}

// ─── Session en cours ─────────────────────────────────────────────────────────

function SessionEnCours({ session, onTerminer }: {
  session: SessionPreparation
  onTerminer: () => void
}) {
  const recettes = useLiveQuery(
    async () => {
      const list = await Promise.all(session.recetteIds.map(id => db.recettes.get(id)))
      return list.filter(Boolean) as Recette[]
    },
    [session.recetteIds]
  )

  const tempsTotalMin = (recettes ?? []).reduce((acc, r) => {
    return acc + (r.tempsPreparation ?? 0) + (r.tempsCuisson ?? 0)
  }, 0)

  const formatDuree = (min: number) => {
    if (min < 60) return `${min} min`
    return `${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}` : ''}`
  }

  return (
    <div className="prep-session">
      <div className="prep-session__header">
        <h3 className="prep-session__title">Session du {new Date(session.dateSession + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
        <span className={`prep-session__statut prep-session__statut--${session.statut}`}>
          {session.statut === 'planifiee' ? 'Planifiée' : session.statut === 'en_cours' ? 'En cours' : 'Terminée'}
        </span>
      </div>

      {tempsTotalMin > 0 && (
        <div className="prep-session__meta">
          <span>⏱ Temps total estimé : <strong>{formatDuree(tempsTotalMin)}</strong></span>
        </div>
      )}

      <div className="prep-session__recettes">
        {(recettes ?? []).map(r => (
          <div key={r.id} className="prep-recette-item">
            <span className="prep-recette-item__nom">{r.nom}</span>
            <div className="prep-recette-item__details">
              {(r.tempsPreparation || r.tempsCuisson) && (
                <span>⏱ {formatDuree((r.tempsPreparation ?? 0) + (r.tempsCuisson ?? 0))}</span>
              )}
              {r.dureeConservation && (
                <span>🗓 Conservation : {r.dureeConservation} j{r.congelable ? ' · ❄ congélable' : ''}</span>
              )}
              {r.modeConservation && (
                <span>📦 {r.modeConservation}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {session.statut !== 'terminee' && (
        <button className="prep-btn prep-btn--primary" onClick={onTerminer}>
          Marquer comme terminée
        </button>
      )}
    </div>
  )
}

// ─── Modal sélecteur de catégorie ────────────────────────────────────────────

function SelecteurCategorieModal({ onChoisir, onAnnuler }: {
  onChoisir: (cat: BatchCategorie) => void
  onAnnuler: () => void
}) {
  return (
    <div className="batch-overlay" onClick={onAnnuler}>
      <div className="batch-modal" onClick={e => e.stopPropagation()}>
        <div className="batch-modal__header">
          <span className="batch-modal__title">Que prépares-tu ?</span>
          <button className="batch-modal__close" onClick={onAnnuler}>✕</button>
        </div>

        <div className="batch-modal__body">
          <div className="prep-categorie-grid">
            {BATCH_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                className="prep-categorie-card"
                onClick={() => onChoisir(cat.key)}
              >
                <span className="prep-categorie-card__emoji">{cat.emoji}</span>
                <div>
                  <span className="prep-categorie-card__label">{cat.label}</span>
                  <span className="prep-categorie-card__desc">{cat.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal sélecteur de recettes ─────────────────────────────────────────────

function SelecteurRecettesModal({ categorie, onConfirmer, onAnnuler }: {
  categorie: BatchCategorie
  onConfirmer: (ids: string[]) => void
  onAnnuler: () => void
}) {
  const [selectionnes, setSelectionnes] = useState<string[]>([])
  const [recherche, setRecherche] = useState('')
  const [filtreSous, setFiltreSous] = useState<string | 'toutes'>('toutes')
  const [cible, setCible] = useState(3)

  const catInfo = BATCH_CATEGORIES.find(c => c.key === categorie)!
  const typesAutorises = typesForCategorie(categorie)

  const recettes = useLiveQuery(
    () => db.recettes
      .filter(r => {
        if (r.archive || r.deletedAt) return false
        if (categorie === 'gouters_petitdej') {
          return (
            typesAutorises.includes(r.typePreparation as string | undefined | null) ||
            CAT_IDS_GOUTER.includes(r.categorie)
          )
        }
        if (categorie === 'desserts') {
          return r.typePreparation === 'dessert' || CAT_IDS_DESSERT.includes(r.categorie)
        }
        // repas : plat explicite, ou catégorie repas, ou typePrep null et pas gouter/dessert
        return (
          r.typePreparation === 'plat' ||
          CAT_IDS_REPAS.includes(r.categorie) ||
          (r.typePreparation == null && !CAT_IDS_NON_REPAS.includes(r.categorie))
        )
      })
      .toArray()
      .then(list => list.sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? '', 'fr'))),
    [categorie]
  )

  const sousFiltresDisponibles = useMemo(() => {
    if (categorie === 'gouters_petitdej') {
      return TYPES_PREP.filter(t => ['gouter', 'petit_dejeuner', 'snack'].includes(t.key))
    }
    return []
  }, [categorie])

  const filtrees = useMemo(() =>
    (recettes ?? []).filter(r => {
      if (filtreSous !== 'toutes' && r.typePreparation !== filtreSous) return false
      if (recherche && !r.nom.toLowerCase().includes(recherche.toLowerCase())) return false
      return true
    }),
    [recettes, filtreSous, recherche]
  )

  const toggle = (id: string) => {
    setSelectionnes(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectedRecettes = (recettes ?? []).filter(r => selectionnes.includes(r.id))
  const tempsTotalMin = selectedRecettes.reduce((acc, r) =>
    acc + (r.tempsPreparation ?? 0) + (r.tempsCuisson ?? 0), 0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onAnnuler() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onAnnuler])

  return (
    <div className="batch-overlay" onClick={onAnnuler}>
      <div className="batch-modal batch-modal--recettes" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="batch-modal__header">
          <div className="batch-modal__header-top">
            <button className="batch-modal__back" onClick={onAnnuler}>←</button>
            <span className="batch-modal__title">{catInfo.emoji} {catInfo.label}</span>
            <button className="batch-modal__close" onClick={onAnnuler}>✕</button>
          </div>

          {/* Stepper cible */}
          <div className="batch-cible">
            <span className="batch-cible__label">Objectif</span>
            <div className="batch-cible__stepper">
              <button
                className="batch-cible__btn"
                onClick={() => setCible(c => Math.max(1, c - 1))}
              >−</button>
              <span className="batch-cible__val">{cible} recette{cible > 1 ? 's' : ''}</span>
              <button
                className="batch-cible__btn"
                onClick={() => setCible(c => c + 1)}
              >+</button>
            </div>
          </div>

          {/* Recherche */}
          <input
            className="batch-search"
            placeholder="Rechercher une recette…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
          />

          {/* Sous-filtres */}
          {sousFiltresDisponibles.length > 0 && (
            <div className="batch-chips">
              <button
                className={`batch-chip${filtreSous === 'toutes' ? ' batch-chip--active' : ''}`}
                onClick={() => setFiltreSous('toutes')}
              >Tous</button>
              {sousFiltresDisponibles.map(t => (
                <button
                  key={t.key}
                  className={`batch-chip${filtreSous === t.key ? ' batch-chip--active' : ''}`}
                  onClick={() => setFiltreSous(t.key)}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Progression */}
          {selectionnes.length > 0 && (
            <div className="batch-progress">
              <div
                className="batch-progress__bar"
                style={{ width: `${Math.min(100, (selectionnes.length / cible) * 100)}%` }}
              />
              <span className="batch-progress__label">
                {selectionnes.length}/{cible}
                {tempsTotalMin > 0 && ` · ⏱ ${Math.floor(tempsTotalMin / 60) > 0 ? `${Math.floor(tempsTotalMin / 60)}h` : ''}${tempsTotalMin % 60 > 0 ? `${tempsTotalMin % 60}min` : ''}`}
              </span>
            </div>
          )}
        </div>

        {/* Grille recettes */}
        <div className="batch-modal__scroll">
          {recettes !== undefined && filtrees.length === 0 ? (
            <p className="batch-empty">
              {categorie === 'repas'
                ? 'Aucun plat trouvé. Ajoute des recettes avec le type "Plat" depuis la bibliothèque.'
                : 'Aucune recette dans cette catégorie. Ajoute des recettes avec le type Goûter ou Petits-déjeuners.'}
            </p>
          ) : (
            <div className="batch-grid">
              {filtrees.map(r => (
                <RecetteThumb
                  key={r.id}
                  recette={r}
                  selected={selectionnes.includes(r.id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          )}
        </div>

        {/* CTA bas */}
        <div className="batch-modal__bottom">
          <button
            className="batch-cta"
            onClick={() => onConfirmer(selectionnes)}
            disabled={selectionnes.length === 0}
          >
            {selectionnes.length === 0
              ? 'Sélectionne des recettes'
              : `Planifier · ${selectionnes.length} recette${selectionnes.length > 1 ? 's' : ''}`}
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

type EtapePlanification = 'idle' | 'categorie' | 'recettes'

export function PreparationHebdo() {
  const [etape, setEtape] = useState<EtapePlanification>('idle')
  const [categorieChoisie, setCategorieChoisie] = useState<BatchCategorie | null>(null)

  const sessions = useLiveQuery(
    () => db.sessionsPreparation
      .orderBy('dateSession')
      .reverse()
      .filter(s => !s.deletedAt)
      .limit(5)
      .toArray(),
    []
  )

  const sessionEnCours = (sessions ?? []).find(
    s => s.statut === 'planifiee' || s.statut === 'en_cours'
  )

  const handleChoisirCategorie = (cat: BatchCategorie) => {
    setCategorieChoisie(cat)
    setEtape('recettes')
  }

  const handlePlanifier = async (recetteIds: string[]) => {
    if (recetteIds.length === 0) return
    setEtape('idle')
    setCategorieChoisie(null)
    const dateSession = new Date().toISOString().split('T')[0]
    await db.sessionsPreparation.add(newEntity<SessionPreparation>({
      dateSession,
      recetteIds,
      statut: 'planifiee',
    }))
  }

  const handleAnnuler = () => {
    setEtape('idle')
    setCategorieChoisie(null)
  }

  const handleTerminer = async (session: SessionPreparation) => {
    for (const recetteId of session.recetteIds) {
      await db.recettes.update(recetteId, withUpdate<Recette>({
        dernierePreparation: session.dateSession,
      }))
    }
    await db.sessionsPreparation.update(session.id, withUpdate<SessionPreparation>({
      statut: 'terminee',
    }))
  }

  return (
    <div className="prep-module">
      <div className="prep-header">
        <div>
          <h2 className="prep-title">Batch cooking</h2>
          <p className="prep-subtitle">Goûters, desserts, repas maison</p>
        </div>
        {etape === 'idle' && !sessionEnCours && (
          <button className="prep-btn-new" onClick={() => setEtape('categorie')}>
            + Planifier
          </button>
        )}
      </div>

      {/* Modals flottantes */}
      {etape === 'categorie' && (
        <SelecteurCategorieModal
          onChoisir={handleChoisirCategorie}
          onAnnuler={handleAnnuler}
        />
      )}

      {etape === 'recettes' && categorieChoisie && (
        <SelecteurRecettesModal
          categorie={categorieChoisie}
          onConfirmer={handlePlanifier}
          onAnnuler={() => setEtape('categorie')}
        />
      )}

      {etape === 'idle' && sessionEnCours && (
        <SessionEnCours
          session={sessionEnCours}
          onTerminer={() => handleTerminer(sessionEnCours)}
        />
      )}

      {etape === 'idle' && !sessionEnCours && (
        <div className="prep-empty-state">
          <span className="prep-empty-state__icon">🍳</span>
          <p>Planifie ta prochaine session de préparation</p>
          <p className="prep-empty-state__sub">
            Goûters, desserts ou repas — choisis ce que tu veux préparer, l'app calcule le temps et les ingrédients
          </p>
        </div>
      )}

      {/* Historique sessions */}
      {(sessions ?? []).filter(s => s.statut === 'terminee').length > 0 && etape === 'idle' && (
        <div className="prep-historique">
          <h3 className="prep-historique__title">Sessions récentes</h3>
          {(sessions ?? []).filter(s => s.statut === 'terminee').slice(0, 3).map(s => (
            <div key={s.id} className="prep-historique__item">
              <span>{new Date(s.dateSession + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
              <span className="prep-historique__count">{s.recetteIds.length} recette{s.recetteIds.length > 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
