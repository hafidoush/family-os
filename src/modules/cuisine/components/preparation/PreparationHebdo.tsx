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
import {
  genererPlanningSession,
  cocherTachePlanning,
  cocherEtapePreparation,
  cocherIngredientCourses,
} from '../../../../core/ai/batchPlanningService'
import type {
  Recette, SessionPreparation, BlocTimeline, ConservationRecette, PlanningGenere,
  IngredientAgrege, EtapePreparation,
} from '../../../../shared/types'
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

export function BlocTimelineItem({ bloc, recettesParId }: {
  bloc: BlocTimeline
  recettesParId: Map<string, string>
  // Lecture seule uniquement — utilisé par HistoriqueBatch
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
          const noms = (t.recetteIds ?? []).map(id => recettesParId.get(id) ?? id).join(' · ')
          return (
            <div
              key={`${t.etapeId}-${i}`}
              className={['planning-tache', `planning-tache--${t.type}`, t.fait ? 'planning-tache--fait' : ''].filter(Boolean).join(' ')}
            >
              <div className="planning-tache__header">
                <span className={`planning-tache__badge planning-tache__badge--${t.type}`}>
                  {t.type === 'actif' ? '● Actif' : '○ Passif'}
                </span>
                {noms && <span className="planning-tache__recette">{noms}</span>}
              </div>
              <p className="planning-tache__desc">{t.description}</p>
              {t.equipement.filter(e => e !== 'aucun').length > 0 && (
                <div className="planning-tache__equip">
                  {t.equipement.filter(e => e !== 'aucun').map(e => (
                    <span key={e} className="planning-tache__equip-badge">{EQUIPEMENT_LABEL[e] ?? e}</span>
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

// ─── Composant tâche partagé (recetteIds[] + index-based cochage) ────────────

function TacheItem({ tache, blocIndex, taskIndex, recettesParId, sessionId, tempsDebut }: {
  tache: { recetteIds: string[]; etapeId: string; description: string; type: 'actif' | 'passif'; equipement: string[]; fait?: boolean }
  blocIndex: number
  taskIndex: number
  recettesParId: Map<string, string>
  sessionId: string
  tempsDebut?: number
}) {
  const nomsRecettes = tache.recetteIds
    .map(id => recettesParId.get(id) ?? id)
    .join(' · ')

  return (
    <div className={['planning-tache', `planning-tache--${tache.type}`, tache.fait ? 'planning-tache--fait' : ''].filter(Boolean).join(' ')}>
      <div className="planning-tache__header">
        <button
          className={`planning-tache__check${tache.fait ? ' planning-tache__check--fait' : ''}`}
          onClick={() => void cocherTachePlanning(sessionId, blocIndex, taskIndex, !tache.fait)}
          aria-label={tache.fait ? 'Marquer comme à faire' : 'Marquer comme fait'}
        >
          {tache.fait ? '✓' : ''}
        </button>
        <span className={`planning-tache__badge planning-tache__badge--${tache.type}`}>
          {tache.type === 'actif' ? '● Actif' : '○ Passif'}
        </span>
        {nomsRecettes && (
          <span className="planning-tache__recette">{nomsRecettes}</span>
        )}
        {tempsDebut !== undefined && (
          <span className="planning-tache__temps-secondaire">{formatMinutes(tempsDebut)}</span>
        )}
      </div>
      <p className="planning-tache__desc">{tache.description}</p>
      {tache.equipement.filter(e => e !== 'aucun').length > 0 && (
        <div className="planning-tache__equip">
          {tache.equipement.filter(e => e !== 'aucun').map(e => (
            <span key={e} className="planning-tache__equip-badge">{EQUIPEMENT_LABEL[e] ?? e}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Vue chronologique (défaut — "quoi faire maintenant") ─────────────────────

function PlanningChrono({ planning, recettesParId, sessionId }: {
  planning: PlanningGenere
  recettesParId: Map<string, string>
  sessionId: string
}) {
  return (
    <div className="planning-chrono">
      {planning.timeline.map((bloc, bi) => (
        <div key={bi} className="planning-chrono__bloc">
          <div className="planning-chrono__bloc-header">
            <span className="planning-chrono__plage">
              {formatMinutes(bloc.tempsDebut)} → {formatMinutes(bloc.tempsFin)}
            </span>
            <span className="planning-chrono__duree">{bloc.tempsFin - bloc.tempsDebut} min</span>
          </div>
          {bloc.taches.map((t, ti) => (
            <TacheItem
              key={`${bi}-${ti}`}
              tache={t}
              blocIndex={bi}
              taskIndex={ti}
              recettesParId={recettesParId}
              sessionId={sessionId}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Vue par recette (préparation mentale) ────────────────────────────────────

function PlanningParRecette({ planning, recettesParId, sessionId }: {
  planning: PlanningGenere
  recettesParId: Map<string, string>
  sessionId: string
}) {
  // Collecte toutes les tâches avec position et temps, dans l'ordre chronologique
  type TacheAvecPos = {
    tache: BlocTimeline['taches'][number]
    blocIndex: number
    taskIndex: number
    tempsDebut: number
  }

  const tachesAvecPos: TacheAvecPos[] = planning.timeline.flatMap((bloc, bi) =>
    bloc.taches.map((t, ti) => ({ tache: t, blocIndex: bi, taskIndex: ti, tempsDebut: bloc.tempsDebut }))
  )

  // Une tâche avec recetteIds = [A, B] apparaît dans le groupe A ET dans le groupe B
  const parRecette = new Map<string, TacheAvecPos[]>()
  for (const entry of tachesAvecPos) {
    const ids = entry.tache.recetteIds.length > 0
      ? entry.tache.recetteIds
      : ['__sans_recette__']
    for (const recetteId of ids) {
      if (!parRecette.has(recetteId)) parRecette.set(recetteId, [])
      parRecette.get(recetteId)!.push(entry)
    }
  }

  // Affiche d'abord les recettes connues dans l'ordre de session.recetteIds
  const recetteIdsOrdre = [...recettesParId.keys()]
  const groupes: [string, TacheAvecPos[]][] = []
  for (const id of recetteIdsOrdre) {
    if (parRecette.has(id)) groupes.push([id, parRecette.get(id)!])
  }

  return (
    <div className="planning-par-recette">
      {groupes.map(([recetteId, entries]) => (
        <div key={recetteId} className="planning-recette-groupe">
          <h5 className="planning-recette-groupe__nom">{recettesParId.get(recetteId) ?? recetteId}</h5>
          {entries.map((entry, i) => (
            <TacheItem
              key={`${entry.blocIndex}-${entry.taskIndex}-${i}`}
              tache={entry.tache}
              blocIndex={entry.blocIndex}
              taskIndex={entry.taskIndex}
              recettesParId={recettesParId}
              sessionId={sessionId}
              tempsDebut={entry.tempsDebut}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Section liste de courses ─────────────────────────────────────────────────

function SectionListeCourses({ items, sessionId }: {
  items: IngredientAgrege[]
  sessionId: string
}) {
  if (items.length === 0) return (
    <p className="modal-section__vide">Aucun ingrédient renseigné sur ces recettes.</p>
  )
  return (
    <ul className="courses-liste">
      {items.map(item => (
        <li
          key={`${item.produitId}|${item.unite ?? ''}`}
          className={`courses-item${item.fait ? ' courses-item--fait' : ''}${item.optionnel ? ' courses-item--optionnel' : ''}`}
        >
          <button
            className={`courses-item__check${item.fait ? ' courses-item__check--fait' : ''}`}
            onClick={() => void cocherIngredientCourses(sessionId, item.produitId, item.unite, !item.fait)}
            aria-label={item.fait ? 'Décocher' : 'Cocher'}
          >
            {item.fait ? '✓' : ''}
          </button>
          <span className="courses-item__nom">{item.nom}</span>
          <span className="courses-item__quantite">
            {item.quantiteTotale % 1 === 0 ? item.quantiteTotale : item.quantiteTotale.toFixed(1)}
            {item.unite ? ` ${item.unite}` : ''}
          </span>
          {item.optionnel && <span className="courses-item__opt">facultatif</span>}
        </li>
      ))}
    </ul>
  )
}

// ─── Section avant de commencer ───────────────────────────────────────────────

function SectionPreparationAmont({ etapes, sessionId }: {
  etapes: EtapePreparation[]
  sessionId: string
}) {
  if (etapes.length === 0) return null
  return (
    <ul className="prep-amont-liste">
      {etapes.map(e => (
        <li key={e.id} className={`prep-amont-item${e.fait ? ' prep-amont-item--fait' : ''}`}>
          <button
            className={`prep-amont-item__check${e.fait ? ' prep-amont-item__check--fait' : ''}`}
            onClick={() => void cocherEtapePreparation(sessionId, e.id, !e.fait)}
            aria-label={e.fait ? 'Décocher' : 'Cocher'}
          >
            {e.fait ? '✓' : ''}
          </button>
          <span className="prep-amont-item__desc">{e.description}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Modal détail session ─────────────────────────────────────────────────────

function SessionDetailModal({ session, planningEnCours, onClose, onRelancerPlanning }: {
  session: SessionPreparation
  planningEnCours: string | null
  onClose: () => void
  onRelancerPlanning: () => void
}) {
  const [vuePlanning, setVuePlanning] = useState<'chrono' | 'recette'>('chrono')

  const recettes = useLiveQuery(
    async () => {
      const list = await Promise.all(session.recetteIds.map(id => db.recettes.get(id)))
      return list.filter(Boolean) as Recette[]
    },
    [session.recetteIds]
  )

  const recettesParId = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of recettes ?? []) map.set(r.id, r.nom)
    return map
  }, [recettes])

  const planning = session.planning
  const enGeneration = planningEnCours === session.id

  const dateStr = new Date(session.dateSession + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="batch-overlay" onClick={onClose}>
      <div className="batch-modal batch-modal--session" onClick={e => e.stopPropagation()}>

        <div className="batch-modal__header">
          <span className="batch-modal__title">Session du {dateStr}</span>
          <button className="batch-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="batch-modal__body batch-modal__body--session">

          {/* Section liste de courses */}
          {planning && (planning.listeCourses?.length ?? 0) > 0 && (
            <div className="modal-section">
              <h4 className="modal-section__title">Liste de courses</h4>
              <SectionListeCourses items={planning.listeCourses!} sessionId={session.id} />
            </div>
          )}

          {/* Section avant de commencer */}
          {planning && (planning.preparationAmont?.length ?? 0) > 0 && (
            <div className="modal-section">
              <h4 className="modal-section__title">Avant de commencer</h4>
              <SectionPreparationAmont etapes={planning.preparationAmont!} sessionId={session.id} />
            </div>
          )}

          {/* Section recettes */}
          <div className="modal-section">
            <h4 className="modal-section__title">Recettes</h4>
            <div className="modal-recettes">
              {(recettes ?? []).map(r => (
                <span key={r.id} className="modal-recette-chip">{r.nom}</span>
              ))}
            </div>
          </div>

          {/* Section planning */}
          <div className="modal-section">
            <div className="modal-section__header">
              <h4 className="modal-section__title">
                Planning
                {planning && (
                  <span className="modal-section__meta"> · {formatDuree(planning.dureeTotaleMinutes)}</span>
                )}
              </h4>
              {planning && !enGeneration && (
                <div className="planning-vue-toggle">
                  <button
                    className={`planning-vue-toggle__btn${vuePlanning === 'chrono' ? ' planning-vue-toggle__btn--active' : ''}`}
                    onClick={() => setVuePlanning('chrono')}
                  >Chronologique</button>
                  <button
                    className={`planning-vue-toggle__btn${vuePlanning === 'recette' ? ' planning-vue-toggle__btn--active' : ''}`}
                    onClick={() => setVuePlanning('recette')}
                  >Par recette</button>
                </div>
              )}
            </div>

            {enGeneration && (
              <div className="planning-generation-banner">
                <span className="planning-generation-banner__spinner" />
                Génération du planning IA en cours…
              </div>
            )}

            {!enGeneration && !planning && (
              <div className="planning-manquant">
                <p className="planning-manquant__texte">Planning non disponible</p>
                {hasOpenAIKey() && (
                  <button className="planning-manquant__btn" onClick={onRelancerPlanning}>
                    Générer le planning IA
                  </button>
                )}
              </div>
            )}

            {planning && vuePlanning === 'chrono' && (
              <PlanningChrono planning={planning} recettesParId={recettesParId} sessionId={session.id} />
            )}
            {planning && vuePlanning === 'recette' && (
              <PlanningParRecette planning={planning} recettesParId={recettesParId} sessionId={session.id} />
            )}
          </div>

          {/* Section conservation */}
          {planning && planning.conservation.length > 0 && (
            <div className="modal-section">
              <h4 className="modal-section__title">Conservation</h4>
              {planning.conservation.map(item => (
                <ConservationCard key={item.recetteId} item={item} />
              ))}
            </div>
          )}

          {/* Section conseils — rétrocompat ancien format */}
          {planning && (planning.conseils?.length ?? 0) > 0 && (
            <div className="modal-section">
              <h4 className="modal-section__title">Conseils</h4>
              <ul className="modal-conseils">
                {planning.conseils!.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {/* Alertes équipement */}
          {planning && planning.alertesEquipement.length > 0 && (
            <div className="modal-section modal-section--alerte">
              <h4 className="modal-section__title">Alertes équipement</h4>
              <ul className="modal-conseils">
                {planning.alertesEquipement.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Carte session compacte ───────────────────────────────────────────────────

function SessionCard({ session, planningEnCours, onOuvrir, onTerminer }: {
  session: SessionPreparation
  planningEnCours: string | null
  onOuvrir: () => void
  onTerminer: () => void
}) {
  const enGeneration = planningEnCours === session.id
  const dateStr = new Date(session.dateSession + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="session-card">
      <button className="session-card__body" onClick={onOuvrir}>
        <div className="session-card__info">
          <span className="session-card__date">Session du {dateStr}</span>
          <span className="session-card__count">
            {session.recetteIds.length} recette{session.recetteIds.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="session-card__right">
          {enGeneration ? (
            <span className="session-card__badge session-card__badge--generating">Génération en cours…</span>
          ) : session.planning ? (
            <span className="session-card__badge session-card__badge--ready">Planning prêt</span>
          ) : (
            <span className="session-card__badge session-card__badge--planned">Planifiée</span>
          )}
          <span className="session-card__chevron">›</span>
        </div>
      </button>
      {session.statut !== 'terminee' && (
        <button className="session-card__btn-terminer" onClick={onTerminer}>
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
  const [planningEnCours, setPlanningEnCours] = useState<string | null>(null)
  const [modalSessionOuvert, setModalSessionOuvert] = useState(false)
  const [recapFinalVisible, setRecapFinalVisible] = useState(false)

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
          <SessionCard
            session={sessionEnCours}
            planningEnCours={planningEnCours}
            onOuvrir={() => setModalSessionOuvert(true)}
            onTerminer={() => {
              if (sessionEnCours.planning?.recapFinal) {
                setRecapFinalVisible(true)
              } else {
                void handleTerminer(sessionEnCours)
              }
            }}
          />
          {modalSessionOuvert && (
            <SessionDetailModal
              session={sessionEnCours}
              planningEnCours={planningEnCours}
              onClose={() => setModalSessionOuvert(false)}
              onRelancerPlanning={handleRelancerPlanning}
            />
          )}
          {recapFinalVisible && sessionEnCours.planning?.recapFinal && (
            <div className="batch-overlay" onClick={() => setRecapFinalVisible(false)}>
              <div className="batch-modal batch-modal--recap" onClick={e => e.stopPropagation()}>
                <div className="batch-modal__header">
                  <span className="batch-modal__title">Session terminée</span>
                </div>
                <div className="batch-modal__body batch-modal__body--recap">
                  <p className="recap-final__texte">{sessionEnCours.planning.recapFinal}</p>
                </div>
                <div className="batch-modal__bottom">
                  <button
                    className="batch-cta"
                    onClick={() => {
                      setRecapFinalVisible(false)
                      setModalSessionOuvert(false)
                      void handleTerminer(sessionEnCours)
                    }}
                  >
                    Fermer la session
                  </button>
                </div>
              </div>
            </div>
          )}
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
