/**
 * FAMILY OS — PreparationHebdo
 * F8 : Préparation hebdomadaire maison
 * - Sélection de la catégorie (Goûters & Petits-déj', Desserts, Repas)
 * - Sélection des recettes à préparer
 * - Calcul automatique temps total + ingrédients
 * - Suivi conservation
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../core/db/database'
import { newEntity, withUpdate } from '../../../../core/db/helpers'
import { hasOpenAIKey } from '../../../../core/ai/openaiService'
import { genererPlanningSession, cocherTachePlanning } from '../../../../core/ai/batchPlanningService'
import type { Recette, SessionPreparation, BlocTimeline, ConservationRecette } from '../../../../shared/types'
import { type BatchCategorie, BATCH_CATEGORIES, matchesBatchCategorie } from './batchTypes'
import './PreparationHebdo.css'

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
        : <div className="batch-thumb__placeholder" />
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
          <span className="batch-thumb__conservation">{recette.dureeConservation}j</span>
        )}
      </div>
    </button>
  )
}

// ─── Helpers affichage ────────────────────────────────────────────────────────

function formatDuree(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}` : `${h}h`
}

function formatMinutes(min: number): string {
  if (min < 60) return `T+${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `T+${h}h${m}` : `T+${h}h`
}

const EQUIPEMENT_LABEL: Record<string, string> = {
  four: 'Four',
  plaque: 'Plaque',
  robot: 'Robot',
  plan_de_travail: 'Plan de travail',
  frigo: 'Frigo',
  aucun: '',
}

// ─── Sous-composants planning ──────────────────────────────────────────────────

export function BlocTimelineItem({ bloc, recettesParId, sessionId }: {
  bloc: BlocTimeline
  recettesParId: Map<string, string>
  sessionId?: string  // absent = mode lecture seule (Historique)
}) {
  return (
    <div className="planning-bloc">
      <div className="planning-bloc__temps">
        <span>{formatMinutes(bloc.tempsDebut)}</span>
        <span className="planning-bloc__tiret">→</span>
        <span>{formatMinutes(bloc.tempsFin)}</span>
        <span className="planning-bloc__duree">({bloc.tempsFin - bloc.tempsDebut} min)</span>
      </div>
      <div className="planning-bloc__taches">
        {bloc.taches.map((t, i) => {
          const handleToggle = sessionId
            ? () => void cocherTachePlanning(sessionId, t.recetteId, t.etapeId, !t.fait)
            : undefined
          return (
            <div
              key={`${t.recetteId}-${t.etapeId}-${i}`}
              className={[
                'planning-tache',
                `planning-tache--${t.type}`,
                t.fait ? 'planning-tache--fait' : '',
              ].filter(Boolean).join(' ')}
            >
              <div className="planning-tache__header">
                {handleToggle && (
                  <button
                    className={`planning-tache__check${t.fait ? ' planning-tache__check--fait' : ''}`}
                    onClick={handleToggle}
                    aria-label={t.fait ? 'Marquer comme à faire' : 'Marquer comme fait'}
                  >
                    {t.fait ? '✓' : ''}
                  </button>
                )}
                <span className={`planning-tache__badge planning-tache__badge--${t.type}`}>
                  {t.type === 'actif' ? '● Actif' : '○ Passif'}
                </span>
                <span className="planning-tache__recette">{recettesParId.get(t.recetteId) ?? t.recetteId}</span>
              </div>
              <p className="planning-tache__desc">{t.description}</p>
              {t.equipement.filter(e => e !== 'aucun').length > 0 && (
                <div className="planning-tache__equip">
                  {t.equipement.filter(e => e !== 'aucun').map(e => (
                    <span key={e} className="planning-tache__equip-badge">
                      {EQUIPEMENT_LABEL[e] ?? e}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ConservationCard({ item }: { item: ConservationRecette }) {
  return (
    <div className="planning-conservation-card">
      <div className="planning-conservation-card__header">
        <span className="planning-conservation-card__nom">{item.recetteNom}</span>
        <div className="planning-conservation-card__meta">
          {item.modeConservation && (
            <span className="planning-conservation-card__mode">
              {item.modeConservation}
            </span>
          )}
          {item.dureeConservationJours && (
            <span className="planning-conservation-card__duree">
              {item.dureeConservationJours}j
            </span>
          )}
        </div>
      </div>
      <p className="planning-conservation-card__conseil">{item.conseil}</p>
    </div>
  )
}

// ─── Session en cours ─────────────────────────────────────────────────────────

function SessionEnCours({ session, onTerminer, onRelancerPlanning }: {
  session: SessionPreparation
  onTerminer: () => void
  onRelancerPlanning: () => void
}) {
  const [conseilsOuverts, setConseilsOuverts] = useState(false)
  const [alertesOuvertes, setAlertesOuvertes] = useState(false)

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

  const recettesParId = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of recettes ?? []) map.set(r.id, r.nom)
    return map
  }, [recettes])

  const planning = session.planning

  return (
    <div className="prep-session">
      <div className="prep-session__header">
        <h3 className="prep-session__title">
          Session du {new Date(session.dateSession + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h3>
        <span className={`prep-session__statut prep-session__statut--${session.statut}`}>
          {session.statut === 'planifiee' ? 'Planifiée' : session.statut === 'en_cours' ? 'En cours' : 'Terminée'}
        </span>
      </div>

      {/* Liste recettes (existante, conservée) */}
      {tempsTotalMin > 0 && (
        <div className="prep-session__meta">
          <span>Temps total estimé : <strong>{formatDuree(tempsTotalMin)}</strong></span>
        </div>
      )}

      <div className="prep-session__recettes">
        {(recettes ?? []).map(r => (
          <div key={r.id} className="prep-recette-item">
            <span className="prep-recette-item__nom">{r.nom}</span>
            <div className="prep-recette-item__details">
              {(r.tempsPreparation || r.tempsCuisson) && (
                <span>{formatDuree((r.tempsPreparation ?? 0) + (r.tempsCuisson ?? 0))}</span>
              )}
              {r.dureeConservation && (
                <span>Conservation : {r.dureeConservation} j{r.congelable ? ' · congélable' : ''}</span>
              )}
              {r.modeConservation && (
                <span>{r.modeConservation}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Planning IA */}
      {planning ? (
        <div className="planning-section">
          <div className="planning-section__header">
            <h4 className="planning-section__title">Planning optimisé</h4>
            <span className="planning-section__duree">
              {formatDuree(planning.dureeTotaleMinutes)} au total
            </span>
          </div>

          {/* Timeline */}
          <div className="planning-timeline">
            {planning.timeline.map((bloc, i) => (
              <BlocTimelineItem key={i} bloc={bloc} recettesParId={recettesParId} sessionId={session.id} />
            ))}
          </div>

          {/* Conservation */}
          {planning.conservation.length > 0 && (
            <div className="planning-conservation">
              <h4 className="planning-conservation__title">Conservation de la semaine</h4>
              {planning.conservation.map(item => (
                <ConservationCard key={item.recetteId} item={item} />
              ))}
            </div>
          )}

          {/* Conseils */}
          {planning.conseils.length > 0 && (
            <div className="planning-repliable">
              <button
                className="planning-repliable__toggle"
                onClick={() => setConseilsOuverts(v => !v)}
              >
                <span>Conseils</span>
                <span className="planning-repliable__chevron">{conseilsOuverts ? '▲' : '▼'}</span>
              </button>
              {conseilsOuverts && (
                <ul className="planning-repliable__liste">
                  {planning.conseils.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Alertes équipement */}
          {planning.alertesEquipement.length > 0 && (
            <div className="planning-repliable planning-repliable--alerte">
              <button
                className="planning-repliable__toggle"
                onClick={() => setAlertesOuvertes(v => !v)}
              >
                <span>Alertes équipement ({planning.alertesEquipement.length})</span>
                <span className="planning-repliable__chevron">{alertesOuvertes ? '▲' : '▼'}</span>
              </button>
              {alertesOuvertes && (
                <ul className="planning-repliable__liste">
                  {planning.alertesEquipement.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="planning-manquant">
          <p className="planning-manquant__texte">Planning détaillé non disponible</p>
          {hasOpenAIKey() && (
            <button className="planning-manquant__btn" onClick={onRelancerPlanning}>
              Générer le planning IA
            </button>
          )}
        </div>
      )}

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

  const recettes = useLiveQuery(
    () => db.recettes
      .filter(r => matchesBatchCategorie(r, categorie))
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
            <span className="batch-modal__title">{catInfo.label}</span>
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
                  {t.label}
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
                {tempsTotalMin > 0 && ` · ${Math.floor(tempsTotalMin / 60) > 0 ? `${Math.floor(tempsTotalMin / 60)}h` : ''}${tempsTotalMin % 60 > 0 ? `${tempsTotalMin % 60}min` : ''}`}
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
  const [planningEnCours, setPlanningEnCours] = useState<string | null>(null) // sessionId en cours de génération

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

  const lancerGenerationPlanning = useCallback(async (sessionId: string) => {
    if (!hasOpenAIKey()) return
    setPlanningEnCours(sessionId)
    try {
      await genererPlanningSession(sessionId)
    } catch (err) {
      const e = err as { openaiError?: string }
      if (e.openaiError === 'quota') console.warn('[BatchPlanning] Quota IA dépassé')
      else if (e.openaiError === 'invalid_key') console.warn('[BatchPlanning] Clé OpenAI invalide')
      else console.error('[BatchPlanning] Erreur génération planning', err)
    } finally {
      setPlanningEnCours(null)
    }
  }, [])

  const handlePlanifier = async (recetteIds: string[]) => {
    if (recetteIds.length === 0) return
    setEtape('idle')
    setCategorieChoisie(null)
    const dateSession = new Date().toISOString().split('T')[0]
    const entity = newEntity<SessionPreparation>({ dateSession, recetteIds, statut: 'planifiee' })
    await db.sessionsPreparation.add(entity)
    // Génération du planning en arrière-plan (ne bloque pas l'UI)
    void lancerGenerationPlanning(entity.id)
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

  const handleRelancerPlanning = useCallback(() => {
    if (sessionEnCours) void lancerGenerationPlanning(sessionEnCours.id)
  }, [sessionEnCours, lancerGenerationPlanning])

  // Génération automatique si une session sans planning apparaît (ex : créée depuis le mode enfants)
  useEffect(() => {
    if (
      sessionEnCours &&
      !sessionEnCours.planning &&
      planningEnCours !== sessionEnCours.id &&
      hasOpenAIKey()
    ) {
      void lancerGenerationPlanning(sessionEnCours.id)
    }
  }, [sessionEnCours?.id, !!sessionEnCours?.planning]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <>
          {planningEnCours === sessionEnCours.id && (
            <div className="planning-generation-banner">
              <span className="planning-generation-banner__spinner" />
              Génération du planning IA en cours…
            </div>
          )}
          <SessionEnCours
            session={sessionEnCours}
            onTerminer={() => handleTerminer(sessionEnCours)}
            onRelancerPlanning={handleRelancerPlanning}
          />
        </>
      )}

      {etape === 'idle' && !sessionEnCours && (
        <div className="prep-empty-state">
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
