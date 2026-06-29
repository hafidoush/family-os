/**
 * FAMILY OS — SectionPreparation
 * Vue globale de tout ce que l'adulte doit préparer en amont pour un programme :
 * tâches de préparation structurées (par semaine) + préparations spécifiques
 * propres à chaque activité (impressions, fiches, déco, mise en scène…).
 * Le matériel (achats) reste géré séparément dans SectionMateriel — inchangé.
 */

import { useState, useMemo } from 'react'
import './SectionPreparation.css'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../core/db/database'
import { marquerTachePreparationFaite } from '../services/programmeService'
import type { ProgrammePedagogique, TachePreparation } from '../../../../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TacheEnrichie extends TachePreparation {
  semaineNumero: number
  semaineTitre: string
}

interface PreparationActivite {
  activiteId: string
  activiteTitre: string
  semaineNumero: number
  items: string[]
}

const URGENCE_CONFIG: Record<TachePreparation['urgence'], { label: string; color: string; bg: string }> = {
  immediate:         { label: 'Urgent',            color: '#DC2626', bg: 'rgba(239,68,68,0.08)' },
  cette_semaine:      { label: 'Cette semaine',     color: '#92400E', bg: 'rgba(245,158,11,0.08)' },
  prochaine_semaine:  { label: 'Semaine prochaine', color: '#6B7280', bg: 'rgba(0,0,0,0.04)' },
}

// ── Composant ─────────────────────────────────────────────────────────────────

interface SectionPreparationProps {
  programme: ProgrammePedagogique
}

export function SectionPreparation({ programme }: SectionPreparationProps) {
  const [itemsCoches, setItemsCoches] = useState<Set<string>>(new Set())

  const activites = useLiveQuery(
    () => db.activitesProgramme
      .where('programmeId').equals(programme.id)
      .filter(a => !a.archive && !a.deletedAt)
      .toArray(),
    [programme.id],
    []
  ) ?? []

  // Tâches de préparation structurées (issues des semaines)
  const taches: TacheEnrichie[] = useMemo(() => {
    return programme.semaines.flatMap(s =>
      s.tachesPreparation.map(t => ({ ...t, semaineNumero: s.numero, semaineTitre: s.titre }))
    )
  }, [programme.semaines])

  const tachesNonFaites = taches.filter(t => !t.faite)
  const tachesFaites = taches.filter(t => t.faite)

  // Préparations spécifiques par activité (texte libre, non structuré en base)
  const preparationsActivites: PreparationActivite[] = useMemo(() => {
    return activites
      .filter(a => a.preparationSpecifique && a.preparationSpecifique.length > 0)
      .sort((a, b) => a.semaineNumero - b.semaineNumero || a.ordre - b.ordre)
      .map(a => ({
        activiteId: a.id,
        activiteTitre: a.titre,
        semaineNumero: a.semaineNumero,
        items: a.preparationSpecifique ?? [],
      }))
  }, [activites])

  async function toggleTache(tache: TacheEnrichie) {
    if (tache.faite) return
    await marquerTachePreparationFaite(programme.id, tache.semaineNumero, tache.id)
  }

  function toggleItemLibre(key: string) {
    setItemsCoches(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const intro = programme.introductionTheme
  const rienAPreparer = taches.length === 0 && preparationsActivites.length === 0 && !intro

  if (rienAPreparer) {
    return (
      <div className="prep-empty">
        <span>🧰</span>
        <p>Aucune préparation particulière n'est nécessaire pour ce programme.</p>
      </div>
    )
  }

  return (
    <div className="prep-section">

      {/* Introduction du thème — aide au lancement */}
      {intro && (
        <div className="prep-intro">
          <h3 className="prep-intro__title">🎬 Introduction du thème</h3>
          {intro.histoire && (
            <div className="prep-intro__bloc">
              <span className="prep-intro__label">Histoire de départ</span>
              <p className="prep-intro__text">{intro.histoire}</p>
            </div>
          )}
          {intro.presentation && (
            <div className="prep-intro__bloc">
              <span className="prep-intro__label">Présenter le thème</span>
              <p className="prep-intro__text">{intro.presentation}</p>
            </div>
          )}
          {intro.rituelLancement && (
            <div className="prep-intro__bloc">
              <span className="prep-intro__label">Rituel de lancement</span>
              <p className="prep-intro__text">{intro.rituelLancement}</p>
            </div>
          )}
          {intro.miseEnScene && (
            <div className="prep-intro__bloc">
              <span className="prep-intro__label">Mise en scène</span>
              <p className="prep-intro__text">{intro.miseEnScene}</p>
            </div>
          )}
        </div>
      )}

      {/* Tâches de préparation structurées */}
      {taches.length > 0 && (
        <div className="prep-bloc">
          <h3 className="prep-bloc__title">À faire avant de commencer</h3>
          <div className="prep-list">
            {tachesNonFaites.map(t => {
              const cfg = URGENCE_CONFIG[t.urgence]
              return (
                <button key={t.id} className="prep-tache" onClick={() => toggleTache(t)}>
                  <span className="prep-tache__check" />
                  <div className="prep-tache__body">
                    <span className="prep-tache__titre">{t.titre}</span>
                    <span className="prep-tache__meta">
                      Semaine {t.semaineNumero} · {t.dureeEstimee} min
                    </span>
                  </div>
                  <span className="prep-tache__urgence" style={{ color: cfg.color, background: cfg.bg }}>
                    {cfg.label}
                  </span>
                </button>
              )
            })}
            {tachesFaites.map(t => (
              <button key={t.id} className="prep-tache prep-tache--faite" disabled>
                <span className="prep-tache__check prep-tache__check--ok">✓</span>
                <div className="prep-tache__body">
                  <span className="prep-tache__titre">{t.titre}</span>
                  <span className="prep-tache__meta">Semaine {t.semaineNumero}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Préparations spécifiques par activité */}
      {preparationsActivites.length > 0 && (
        <div className="prep-bloc">
          <h3 className="prep-bloc__title">Préparations par activité</h3>
          <div className="prep-activites">
            {preparationsActivites.map(pa => (
              <div key={pa.activiteId} className="prep-activite">
                <span className="prep-activite__titre">
                  Semaine {pa.semaineNumero} · {pa.activiteTitre}
                </span>
                <div className="prep-activite__items">
                  {pa.items.map((item, i) => {
                    const key = `${pa.activiteId}-${i}`
                    const coche = itemsCoches.has(key)
                    return (
                      <button
                        key={key}
                        className={`prep-item${coche ? ' prep-item--coche' : ''}`}
                        onClick={() => toggleItemLibre(key)}
                      >
                        <span className="prep-item__check">{coche ? '✓' : ''}</span>
                        <span className="prep-item__text">{item}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
