/**
 * FAMILY OS — HistoriqueBatch
 * Liste des sessions de batch cooking terminées, en lecture seule.
 * Affiche date, recettes, et planning sauvegardé (si disponible).
 */

import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../core/db/database'
import type { SessionPreparation, Recette } from '../../../../shared/types'
import { BlocTimelineItem, ConservationCard } from './PreparationHebdo'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDuree(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}` : `${h}h`
}

// ─── Détail d'une session ─────────────────────────────────────────────────────

function SessionHistorique({ session }: { session: SessionPreparation }) {
  const [ouvert, setOuvert] = useState(false)
  const [conseilsOuverts, setConseilsOuverts] = useState(false)
  const [alertesOuvertes, setAlertesOuvertes] = useState(false)

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

  return (
    <div className="histo-session">
      {/* En-tête cliquable */}
      <button className="histo-session__header" onClick={() => setOuvert(v => !v)}>
        <div className="histo-session__header-left">
          <span className="histo-session__date">{formatDate(session.dateSession)}</span>
          {session.notes && (
            <span className="histo-session__notes">{session.notes}</span>
          )}
          <span className="histo-session__count">
            {session.recetteIds.length} recette{session.recetteIds.length > 1 ? 's' : ''}
            {planning && ` · ⏱ ${formatDuree(planning.dureeTotaleMinutes)}`}
          </span>
        </div>
        <span className="histo-session__chevron">{ouvert ? '▲' : '▼'}</span>
      </button>

      {ouvert && (
        <div className="histo-session__body">
          {/* Liste recettes */}
          <div className="histo-session__recettes">
            {(recettes ?? []).map(r => (
              <div key={r.id} className="histo-recette-item">
                <span className="histo-recette-item__nom">{r.nom}</span>
                {r.modeConservation && (
                  <span className="histo-recette-item__meta">{r.modeConservation}</span>
                )}
              </div>
            ))}
            {recettes && recettes.length === 0 && session.recetteIds.length > 0 && (
              <p className="histo-session__empty">Recettes supprimées depuis.</p>
            )}
          </div>

          {/* Planning (lecture seule) */}
          {planning ? (
            <div className="histo-planning">
              <h4 className="histo-planning__title">Planning de la session</h4>

              <div className="planning-timeline">
                {planning.timeline.map((bloc, i) => (
                  <BlocTimelineItem
                    key={i}
                    bloc={bloc}
                    recettesParId={recettesParId}
                    /* pas de sessionId → mode lecture seule, pas de checkbox */
                  />
                ))}
              </div>

              {planning.conservation.length > 0 && (
                <div className="planning-conservation" style={{ marginTop: 16 }}>
                  <h4 className="planning-conservation__title">Conservation</h4>
                  {planning.conservation.map(item => (
                    <ConservationCard key={item.recetteId} item={item} />
                  ))}
                </div>
              )}

              {planning.conseils.length > 0 && (
                <div className="planning-repliable" style={{ marginTop: 10 }}>
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

              {planning.alertesEquipement.length > 0 && (
                <div className="planning-repliable planning-repliable--alerte" style={{ marginTop: 8 }}>
                  <button
                    className="planning-repliable__toggle"
                    onClick={() => setAlertesOuvertes(v => !v)}
                  >
                    <span>⚠️ Alertes équipement ({planning.alertesEquipement.length})</span>
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
            <p className="histo-session__no-planning">
              Aucun planning enregistré pour cette session.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function HistoriqueBatch() {
  const sessions = useLiveQuery(
    () => db.sessionsPreparation
      .orderBy('dateSession')
      .reverse()
      .filter(s => s.statut === 'terminee' && !s.deletedAt)
      .toArray(),
    []
  )

  if (sessions === undefined) {
    return (
      <div className="histo-empty">
        Chargement…
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="histo-empty">
        <p>Aucune session terminée pour l'instant.</p>
        <p className="histo-empty__sub">Les sessions marquées "Terminée" apparaîtront ici.</p>
      </div>
    )
  }

  return (
    <div className="histo-module">
      <div className="histo-header">
        <h2 className="histo-title">Historique</h2>
        <span className="histo-count">{sessions.length} session{sessions.length > 1 ? 's' : ''}</span>
      </div>
      <div className="histo-list">
        {sessions.map(s => (
          <SessionHistorique key={s.id} session={s} />
        ))}
      </div>
    </div>
  )
}
