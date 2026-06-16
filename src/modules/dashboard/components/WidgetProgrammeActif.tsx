/**
 * FAMILY OS — WidgetProgrammeActif
 * Dashboard : programme pédagogique actif + prochaine activité de la semaine.
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { ProgrammeDetail } from '../../enfants/programmes/components/ProgrammeDetail'
import './WidgetProgrammeActif.css'
import type { ProgrammePedagogique } from '../../../shared/types'

// ─── Calcul de la semaine courante dans le programme ─────────────────────────

function semaineEnCours(programme: ProgrammePedagogique): number {
  const debut = new Date(programme.dateDebut)
  const today = new Date()
  const diffJours = Math.floor((today.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24))
  const num = Math.floor(diffJours / 7) + 1
  return Math.max(1, Math.min(num, programme.semaines.length || 1))
}

// ─── Widget ──────────────────────────────────────────────────────────────────

export function WidgetProgrammeActif() {
  const [detailId, setDetailId] = useState<string | null>(null)

  const programmes = useLiveQuery(
    () => db.programmesPedagogiques
      .where('statut').equals('actif')
      .filter(p => !p.archive)
      .toArray(),
    [],
    undefined
  )

  const programme = programmes?.[0] ?? null

  const semaineNum = programme ? semaineEnCours(programme) : 1

  const activitesSemaine = useLiveQuery(
    async () => {
      if (!programme) return []
      return db.activitesProgramme
        .where(['programmeId', 'semaineNumero'])
        .equals([programme.id, semaineNum])
        .filter(a => !a.archive)
        .sortBy('ordre')
    },
    [programme?.id, semaineNum],
    []
  )

  const prochaineActivite = activitesSemaine?.find(a => a.statutRealisation === 'a_faire')
  const realisees = activitesSemaine?.filter(a => a.statutRealisation === 'realise').length ?? 0
  const totalSemaine = activitesSemaine?.length ?? 0

  // Chargement en cours — ne rien afficher pour éviter le flash de l'état vide
  if (programmes === undefined) return null

  // Pas de programme actif → état vide discret
  if (!programme) {
    return (
      <div className="wpa-empty">
        <span className="wpa-empty__icon">🎓</span>
        <span className="wpa-empty__text">Aucun programme actif</span>
      </div>
    )
  }

  const RADIUS = 20
  const CIRC = 2 * Math.PI * RADIUS
  const strokeDash = (programme.progression / 100) * CIRC
  const totalSemaines = programme.semaines.length || 1

  return (
    <>
      <div className="wpa-card" onClick={() => setDetailId(programme.id)} role="button" tabIndex={0}>

        {/* Badge IA */}
        {programme.genereParIA && (
          <span className="wpa-ia-badge">IA</span>
        )}

        {/* Anneau de progression + titre */}
        <div className="wpa-top">
          <div className="wpa-ring">
            <svg viewBox="0 0 48 48" width="52" height="52">
              <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="rgba(167,139,250,0.2)" strokeWidth="4" />
              <circle
                cx="24" cy="24" r={RADIUS}
                fill="none"
                stroke="#A78BFA"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${strokeDash} ${CIRC}`}
                transform="rotate(-90 24 24)"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <span className="wpa-ring__pct">{programme.progression}%</span>
          </div>

          <div className="wpa-info">
            <span className="wpa-label">Programme actif</span>
            <h3 className="wpa-titre">{programme.titre}</h3>
            <span className="wpa-semaine">
              Semaine {semaineNum} / {totalSemaines}
              {totalSemaine > 0 && (
                <> · {realisees}/{totalSemaine} activités</>
              )}
            </span>
          </div>

          <span className="wpa-arrow">›</span>
        </div>

        {/* Prochaine activité */}
        {prochaineActivite ? (
          <div className="wpa-next">
            <span className="wpa-next__dot" />
            <div className="wpa-next__body">
              <span className="wpa-next__label">Prochaine</span>
              <span className="wpa-next__titre">{prochaineActivite.titre}</span>
            </div>
            <span className="wpa-next__duree">{prochaineActivite.duree} min</span>
          </div>
        ) : totalSemaine > 0 ? (
          <div className="wpa-done">
            <span>✓</span>
            <span>Toutes les activités de la semaine sont réalisées</span>
          </div>
        ) : null}

      </div>

      {detailId && (
        <ProgrammeDetail
          programmeId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </>
  )
}
