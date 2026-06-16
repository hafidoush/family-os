/**
 * WidgetConservation — Ce qui a été préparé récemment et jusqu'à quand ça se conserve
 *
 * Logique :
 *   - Recettes avec `dernierePreparation` renseignée
 *   - Calcul : dateExpiration = dernierePreparation + dureeConservation jours
 *   - Couleur : vert (> 2j), jaune (1-2j), orange (aujourd'hui), rouge (périmé)
 *   - Triées par date d'expiration la plus proche en premier
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { WidgetCard } from './WidgetCard'
import { useNavigate } from 'react-router-dom'
import './WidgetConservation.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function daysDiff(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

type ConservationStatut = 'fresh' | 'soon' | 'expires' | 'expired'

function getStatut(joursRestants: number): ConservationStatut {
  if (joursRestants < 0)  return 'expired'
  if (joursRestants === 0) return 'expires'
  if (joursRestants <= 2) return 'soon'
  return 'fresh'
}

function badgeLabel(joursRestants: number): string {
  if (joursRestants < 0)   return `Périmé (${Math.abs(joursRestants)}j)`
  if (joursRestants === 0) return 'Expire aujourd\'hui'
  if (joursRestants === 1) return 'Expire demain'
  return `Encore ${joursRestants} j`
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function WidgetConservation() {
  const navigate = useNavigate()

  const items = useLiveQuery(async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const recettes = await db.recettes
      .filter(r =>
        !r.archive &&
        !r.deletedAt &&
        Boolean(r.dernierePreparation) &&
        Boolean(r.dureeConservation)
      )
      .toArray()

    return recettes
      .map(r => {
        const prepDate = parseDate(r.dernierePreparation!)
        const expiryDate = addDays(prepDate, r.dureeConservation!)
        const joursRestants = daysDiff(today, expiryDate)
        return {
          id: r.id,
          nom: r.nom,
          joursRestants,
          statut: getStatut(joursRestants),
          modeConservation: r.modeConservation,
          congelable: r.congelable,
          prepDate: r.dernierePreparation!,
        }
      })
      .sort((a, b) => a.joursRestants - b.joursRestants)
      .slice(0, 6)
  }, [])

  const loading = items === undefined

  const hasItems = (items ?? []).length > 0

  return (
    <WidgetCard
      icon="🧊"
      title="Frigo & conserves"
      accentColor="var(--color-sky)"
      loading={loading}
      action={
        hasItems ? (
          <button
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', color: 'var(--color-muted)',
            }}
            onClick={() => navigate('/cuisine')}
          >
            Voir tout →
          </button>
        ) : undefined
      }
    >
      {!hasItems ? (
        <p className="widget-conservation__empty">
          Rien de préparé récemment.<br />
          <span style={{ fontSize: '0.75rem' }}>
            Lance une session Hebdo pour voir le suivi ici.
          </span>
        </p>
      ) : (
        <ul className="widget-conservation__list" role="list">
          {(items ?? []).map(item => (
            <li key={item.id} className={`wc-item wc-item--${item.statut}`}>
              <div className="wc-item__info">
                <div className="wc-item__nom">{item.nom}</div>
                <div className="wc-item__meta">
                  {item.modeConservation && <span>📦 {item.modeConservation}</span>}
                  {item.congelable && <span>❄️</span>}
                  <span>
                    Préparé le {new Date(item.prepDate + 'T00:00:00')
                      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
              <span className="wc-item__badge">{badgeLabel(item.joursRestants)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}

export default WidgetConservation
