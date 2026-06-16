/**
 * FAMILY OS — WidgetOrchestrateur
 *
 * Deux sections en un seul widget :
 *   1. "Organiser ma semaine" — 4 étapes avec statut visuel
 *   2. "Que faire aujourd'hui ?" — 3 actions prioritaires
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWeeklyStatus } from '../hooks/useWeeklyStatus'
import { useTodayFocus } from '../hooks/useTodayFocus'
import type { ActionNiveau } from '../hooks/useTodayFocus'
import './WidgetOrchestrateur.css'

function getDismissKey() {
  return `orc-dismissed-${new Date().toISOString().slice(0, 10)}`
}
function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(getDismissKey())
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}
function addDismissed(id: string) {
  const dismissed = getDismissed()
  dismissed.add(id)
  localStorage.setItem(getDismissKey(), JSON.stringify([...dismissed]))
}

// ─── Couleurs par niveau d'action ────────────────────────────────────────────

const NIVEAU_CONFIG: Record<ActionNiveau, { label: string; className: string }> = {
  urgent:    { label: 'Urgent',    className: 'orc-action--urgent' },
  important: { label: 'Important', className: 'orc-action--important' },
  utile:     { label: 'Utile',     className: 'orc-action--utile' },
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function WidgetOrchestrateur() {
  const navigate      = useNavigate()
  const { etapes, nbDone } = useWeeklyStatus()
  const allActions    = useTodayFocus()
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed)
  const [showSemaine, setShowSemaine] = useState(false)

  const handleDismiss = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    addDismissed(id)
    setDismissed(getDismissed())
  }, [])

  const actions = allActions.filter(a => !dismissed.has(a.id))

  const progressPct   = Math.round((nbDone / etapes.length) * 100)
  const toutFait      = nbDone === etapes.length
  const semaineVisible = !toutFait || showSemaine

  return (
    <div className="widget-orc">

      {/* ── Section 1 : Organiser ma semaine ── */}
      {semaineVisible && <div className="orc-semaine">
        <div className="orc-semaine__header">
          <div className="orc-semaine__title-row">
            <span className="orc-semaine__icon">✨</span>
            <h3 className="orc-semaine__title">Organiser ma semaine</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="orc-semaine__score">
              {toutFait ? 'Semaine prête' : `${nbDone} / ${etapes.length}`}
            </span>
            {toutFait && showSemaine && (
              <button className="orc-semaine__close" onClick={() => setShowSemaine(false)} aria-label="Fermer">×</button>
            )}
          </div>
        </div>

        {/* Barre de progression */}
        <div className="orc-semaine__progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="orc-semaine__progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Étapes */}
        <div className="orc-semaine__steps">
          {etapes.map((etape) => (
            <button
              key={etape.id}
              className={`orc-step${etape.done ? ' orc-step--done' : ''}`}
              onClick={() => navigate(etape.route)}
              aria-label={`${etape.label} — ${etape.detail ?? ''}`}
            >
              <div className="orc-step__check" aria-hidden="true">
                {etape.done ? '✓' : etape.emoji}
              </div>
              <div className="orc-step__body">
                <span className="orc-step__label">{etape.label}</span>
                {etape.detail && (
                  <span className="orc-step__detail">{etape.detail}</span>
                )}
              </div>
            </button>
          ))}
        </div>


      </div>}

      {semaineVisible && <div className="orc-divider" />}

      {/* ── Lien "Revoir ma semaine" quand tout est fait ── */}
      {toutFait && !showSemaine && (
        <button className="orc-revoir" onClick={() => setShowSemaine(true)}>
          Revoir ma semaine →
        </button>
      )}

      {/* ── Section 2 : Que faire aujourd'hui ────────────────────────── */}
      <div className="orc-today">
        <div className="orc-today__header">
          <span className="orc-semaine__icon">🎯</span>
          <h3 className="orc-semaine__title">Que faire aujourd'hui&nbsp;?</h3>
        </div>

        <div className="orc-actions">
          {actions.length === 0 ? (
            <p className="orc-actions__vide">Tout est en ordre pour aujourd'hui.</p>
          ) : actions.map((action, idx) => {
            const cfg = NIVEAU_CONFIG[action.niveau]
            return (
              <div key={action.id} className="orc-action-wrap">
                <button
                  className={`orc-action ${cfg.className}`}
                  onClick={() => navigate(action.route, action.routeState ? { state: action.routeState } : undefined)}
                >
                  <div className="orc-action__left">
                    <span className="orc-action__rank">{idx + 1}</span>
                    <div className="orc-action__body">
                      <span className="orc-action__texte">{action.texte}</span>
                      {action.contexte && (
                        <span className="orc-action__contexte">{action.contexte}</span>
                      )}
                    </div>
                  </div>
                  <span className={`orc-action__badge orc-action__badge--${action.niveau}`}>
                    {cfg.label}
                  </span>
                </button>
                <button
                  className="orc-action__dismiss"
                  onClick={(e) => handleDismiss(action.id, e)}
                  aria-label="Masquer cette suggestion"
                  title="Masquer"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
