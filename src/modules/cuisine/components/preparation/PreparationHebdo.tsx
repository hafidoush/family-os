/**
 * FAMILY OS — PreparationHebdo
 * F8 : Préparation hebdomadaire maison
 * - Sélection de la catégorie (Goûters & Petits-déj', Desserts, Repas)
 * - Sélection des recettes à préparer
 * - Calcul automatique temps total + ingrédients
 * - Suivi conservation
 */

import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../core/db/database'
import { newEntity, withUpdate } from '../../../../core/db/helpers'
import type { Recette, SessionPreparation } from '../../../../shared/types'
import { type BatchCategorie, BATCH_CATEGORIES, typesForCategorie } from './batchTypes'
import './PreparationHebdo.css'

// ─── Types de préparation (pour l'affichage des icônes dans la grille) ────────

const TYPES_PREP = [
  { key: 'gouter',         label: 'Goûters',          emoji: '🧁' },
  { key: 'dessert',        label: 'Desserts',          emoji: '🍮' },
  { key: 'petit_dejeuner', label: 'Petits-déjeuners',  emoji: '🥐' },
  { key: 'snack',          label: 'Snacks',             emoji: '🥜' },
  { key: 'plat',           label: 'Plats préparés',    emoji: '🍲' },
] as const

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

// ─── Sélecteur de catégorie batch ────────────────────────────────────────────

function SelecteurCategorie({ onChoisir, onAnnuler }: {
  onChoisir: (cat: BatchCategorie) => void
  onAnnuler: () => void
}) {
  return (
    <div className="prep-selecteur">
      <p className="prep-categorie__intro">Que souhaites-tu préparer ?</p>
      <div className="prep-categorie-grid">
        {BATCH_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            className="prep-categorie-card"
            onClick={() => onChoisir(cat.key)}
          >
            <span className="prep-categorie-card__emoji">{cat.emoji}</span>
            <span className="prep-categorie-card__label">{cat.label}</span>
            <span className="prep-categorie-card__desc">{cat.description}</span>
          </button>
        ))}
      </div>
      <div className="prep-selecteur__actions" style={{ marginTop: 12 }}>
        <button className="prep-btn prep-btn--cancel" onClick={onAnnuler}>Annuler</button>
      </div>
    </div>
  )
}

// ─── Sélecteur de recettes ────────────────────────────────────────────────────

function SelecteurRecettes({ categorie, onConfirmer, onAnnuler }: {
  categorie: BatchCategorie
  onConfirmer: (ids: string[]) => void
  onAnnuler: () => void
}) {
  const [selectionnes, setSelectionnes] = useState<string[]>([])

  const typesAutorises = typesForCategorie(categorie)
  const catInfo = BATCH_CATEGORIES.find(c => c.key === categorie)!

  const recettes = useLiveQuery(
    () => db.recettes
      .filter(r => {
        if (r.archive || r.deletedAt) return false
        if (categorie === 'repas') {
          // Repas : typePreparation = 'plat' ou non défini
          return r.typePreparation === 'plat' || r.typePreparation == null
        }
        return typesAutorises.includes(r.typePreparation as string | undefined)
      })
      .toArray()
      .then(list => list.sort((a, b) => (a.nom ?? "").localeCompare(b.nom ?? ""))),
    [categorie]
  )

  // Sous-filtres selon la catégorie
  const sousFiltresDisponibles = useMemo(() => {
    if (categorie === 'gouters_petitdej') {
      return TYPES_PREP.filter(t => ['gouter', 'petit_dejeuner', 'snack'].includes(t.key))
    }
    return []
  }, [categorie])

  const [filtreSous, setFiltreSous] = useState<string | 'toutes'>('toutes')

  const filtrees = useMemo(() =>
    (recettes ?? []).filter(r =>
      filtreSous === 'toutes' || r.typePreparation === filtreSous
    ),
    [recettes, filtreSous]
  )

  const toggle = (id: string) => {
    setSelectionnes(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectedRecettes = (recettes ?? []).filter(r => selectionnes.includes(r.id))
  const tempsTotalMin = selectedRecettes.reduce((acc, r) =>
    acc + (r.tempsPreparation ?? 0) + (r.tempsCuisson ?? 0), 0)

  return (
    <div className="prep-selecteur">
      <div className="prep-selecteur__cat-header">
        <span className="prep-selecteur__cat-emoji">{catInfo.emoji}</span>
        <span className="prep-selecteur__cat-label">{catInfo.label}</span>
        <button className="prep-selecteur__cat-back" onClick={onAnnuler}>← Changer</button>
      </div>

      {sousFiltresDisponibles.length > 0 && (
        <div className="prep-selecteur__filtres">
          <button
            className={`prep-filtre${filtreSous === 'toutes' ? ' prep-filtre--active' : ''}`}
            onClick={() => setFiltreSous('toutes')}
          >Tous</button>
          {sousFiltresDisponibles.map(t => (
            <button
              key={t.key}
              className={`prep-filtre${filtreSous === t.key ? ' prep-filtre--active' : ''}`}
              onClick={() => setFiltreSous(t.key)}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      )}

      {recettes !== undefined && filtrees.length === 0 && (
        <p className="prep-empty">
          {categorie === 'repas'
            ? 'Aucun plat trouvé. Ajoute des recettes avec le type "Plat principal".'
            : 'Aucune recette dans cette catégorie. Modifie tes recettes pour leur assigner un type.'}
        </p>
      )}

      <div className="prep-recettes-grid">
        {filtrees.map(r => {
          const typeInfo = TYPES_PREP.find(t => t.key === r.typePreparation)
          return (
            <button
              key={r.id}
              className={`prep-recette-card${selectionnes.includes(r.id) ? ' prep-recette-card--selected' : ''}`}
              onClick={() => toggle(r.id)}
            >
              <span className="prep-recette-card__emoji">{typeInfo?.emoji ?? (categorie === 'repas' ? '🍽' : '🧁')}</span>
              <span className="prep-recette-card__nom">{r.nom}</span>
              {r.dureeConservation && (
                <span className="prep-recette-card__conservation">
                  🗓 {r.dureeConservation}j
                </span>
              )}
              {selectionnes.includes(r.id) && (
                <span className="prep-recette-card__check">✓</span>
              )}
            </button>
          )
        })}
      </div>

      {selectionnes.length > 0 && (
        <div className="prep-recap">
          <span>{selectionnes.length} recette{selectionnes.length > 1 ? 's' : ''} sélectionnée{selectionnes.length > 1 ? 's' : ''}</span>
          {tempsTotalMin > 0 && (
            <span>⏱ ~{Math.floor(tempsTotalMin / 60) > 0 ? `${Math.floor(tempsTotalMin / 60)}h` : ''}{tempsTotalMin % 60 > 0 ? `${tempsTotalMin % 60}min` : ''}</span>
          )}
        </div>
      )}

      <div className="prep-selecteur__actions">
        <button className="prep-btn prep-btn--cancel" onClick={onAnnuler}>Annuler</button>
        <button
          className="prep-btn prep-btn--primary"
          onClick={() => onConfirmer(selectionnes)}
          disabled={selectionnes.length === 0}
        >
          Planifier ({selectionnes.length})
        </button>
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

  const catInfo = categorieChoisie ? BATCH_CATEGORIES.find(c => c.key === categorieChoisie) : null

  return (
    <div className="prep-module">
      <div className="prep-header">
        <div>
          <h2 className="prep-title">Batch cooking</h2>
          <p className="prep-subtitle">
            {catInfo ? `${catInfo.emoji} ${catInfo.label}` : 'Goûters, desserts, repas maison'}
          </p>
        </div>
        {etape === 'idle' && !sessionEnCours && (
          <button className="prep-btn-new" onClick={() => setEtape('categorie')}>
            + Planifier
          </button>
        )}
      </div>

      {etape === 'categorie' && (
        <SelecteurCategorie
          onChoisir={handleChoisirCategorie}
          onAnnuler={handleAnnuler}
        />
      )}

      {etape === 'recettes' && categorieChoisie && (
        <SelecteurRecettes
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
