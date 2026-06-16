/**
 * FAMILY OS — WidgetBilanSemaine
 * Design premium 15/06/2026
 *
 * Affiché : sam 18h → lun 12h (dev = toujours)
 * Structure : zone hero (score) + zone body (points + CTA)
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWeeklyBilan } from '../hooks/useWeeklyBilan'
import { genererTexteBilan } from '../../../core/ai/bilanService'
import './WidgetBilanSemaine.css'

// ─── Fenêtre d'affichage ──────────────────────────────────────────────────────

function dansLaFenetreBilan(): boolean {
  if (import.meta.env.DEV) return true
  const now = new Date(), j = now.getDay(), h = now.getHours()
  return (j === 6 && h >= 18) || j === 0 || (j === 1 && h < 12)
}

// ─── Config icônes par point ──────────────────────────────────────────────────

const ICONS: Record<string, string> = {
  'Menus semaine prochaine': '🍽',
  'Liste de courses':        '🛒',
  'Activités enfants':       '🎨',
  'Ménage':                  '✨',
  'Tâches en retard':        '📌',
  'Pensées en attente':      '💭',
}

// ─── Labels score ─────────────────────────────────────────────────────────────

function scoreConfig(score: number): { label: string; sub: string; variant: 'green' | 'amber' | 'clay' } {
  if (score >= 75) return { label: 'Semaine bien préparée', sub: 'Tu peux aborder la semaine sereinement', variant: 'green' }
  if (score >= 45) return { label: 'Quelques points à régler', sub: 'Un peu d\'organisation et tu seras prête', variant: 'amber' }
  return { label: 'Semaine à organiser', sub: 'Prends 10 minutes pour tout préparer', variant: 'clay' }
}

// ─── Semaine courante formatée ────────────────────────────────────────────────

function labelSemaine(): string {
  const d = new Date()
  const lundi = new Date(d)
  lundi.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1))
  const dim = new Date(lundi); dim.setDate(lundi.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  return `${lundi.toLocaleDateString('fr-FR', opts)} – ${dim.toLocaleDateString('fr-FR', opts)}`
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function WidgetBilanSemaine() {
  const navigate  = useNavigate()
  const bilan     = useWeeklyBilan()
  const [texteIA,   setTexteIA]   = useState<string | null>(null)
  const [loadingIA, setLoadingIA] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Dismissal par semaine
  const semaineCle = (() => {
    const d = new Date()
    const lundi = new Date(d)
    lundi.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1))
    return `bilan_dismissed_${lundi.toISOString().slice(0, 10)}`
  })()

  useEffect(() => {
    if (localStorage.getItem(semaineCle) === 'true') setDismissed(true)
  }, [semaineCle])

  // Texte IA au montage
  useEffect(() => {
    if (!bilan || texteIA !== null || loadingIA) return
    setLoadingIA(true)
    genererTexteBilan(bilan).then(t => { setTexteIA(t); setLoadingIA(false) })
  }, [bilan])

  if (!dansLaFenetreBilan() || dismissed || !bilan) return null

  const { points, score, pret, semaineCourante: sc } = bilan
  const { label, sub, variant } = scoreConfig(score)

  // Dasharray SVG : cercle de rayon 15.9, périmètre ≈ 100
  const perimetre = 100
  const rempli    = (score / 100) * perimetre

  const dismiss = () => {
    localStorage.setItem(semaineCle, 'true')
    setDismissed(true)
  }

  return (
    <div className="widget-bilan">

      {/* ── Zone hero ─────────────────────────────────────────────── */}
      <div className="bilan__hero">

        <div className="bilan__header">
          <div className="bilan__header-left">
            <span className="bilan__eyebrow">{labelSemaine()}</span>
            <h3 className="bilan__title">Bilan de semaine</h3>
          </div>
          <button className="bilan__dismiss" onClick={dismiss} aria-label="Fermer">×</button>
        </div>

        {/* Score anneau */}
        <div className="bilan__score-zone">
          <div className="bilan__score-ring-wrap">
            <svg viewBox="0 0 36 36" className="bilan__score-svg">
              <circle className="bilan__score-track" cx="18" cy="18" r="15.9" />
              <circle
                className={`bilan__score-arc bilan__score-arc--${variant}`}
                cx="18" cy="18" r="15.9"
                strokeDasharray={`${rempli} ${perimetre - rempli}`}
                strokeDashoffset="25"
              />
            </svg>
            <div className="bilan__score-inner">
              <span className="bilan__score-num">{score}</span>
              <span className="bilan__score-denom">/100</span>
            </div>
          </div>
          <div className="bilan__score-caption">
            <span className="bilan__score-label">{label}</span>
            <span className="bilan__score-sub">{sub}</span>
          </div>
        </div>

        {/* Texte IA */}
        {loadingIA && <p className="bilan__ia-loading">Analyse en cours…</p>}
        {texteIA   && <p className="bilan__ia">{texteIA}</p>}

      </div>

      {/* ── Zone body ─────────────────────────────────────────────── */}
      <div className="bilan__body">

        <span className="bilan__section-label">Pour la semaine prochaine</span>

        {/* Lignes de points */}
        <div className="bilan__rows">
          {points.map((p, i) => {
            const rowVariant = p.ok ? 'ok' : p.urgent ? 'clay' : 'warn'
            return (
              <div key={i} className={`bilan__row bilan__row--${rowVariant}`}>
                <span className="bilan__row-icon">{ICONS[p.label] ?? '·'}</span>
                <div className="bilan__row-body">
                  <span className="bilan__row-label">{p.label}</span>
                  <span className="bilan__row-valeur">{p.valeur}</span>
                </div>
                <div className="bilan__row-dot" />
              </div>
            )
          })}
        </div>

        {/* Récap semaine courante */}
        {sc.activitesTotal > 0 && (
          <div className="bilan__recap">
            <span className="bilan__recap-icon">✨</span>
            <p className="bilan__recap-text">
              Cette semaine : <strong>{sc.activitesRealisees}</strong> activité{sc.activitesRealisees > 1 ? 's' : ''} réalisée{sc.activitesRealisees > 1 ? 's' : ''} sur <strong>{sc.activitesTotal}</strong>
            </p>
          </div>
        )}

        {/* CTA */}
        <button className="bilan__cta" onClick={() => { navigate('/cuisine'); dismiss() }}>
          <span>{pret ? 'Voir les menus' : 'Préparer la semaine'}</span>
          <span className="bilan__cta-arrow">→</span>
        </button>

      </div>
    </div>
  )
}
