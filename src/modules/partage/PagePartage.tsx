/**
 * FAMILY OS — Page publique /partage/:token
 * Accessible sans compte. Élies coche les items en temps réel.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  fetchItemsListe,
  cocherItem,
  subscribeToListe,
  unsubscribe,
} from '../../core/supabase/partageService'
import type { ItemPartage } from '../../core/supabase/partageService'
import './PagePartage.css'

export default function PagePartage() {
  const { token } = useParams<{ token: string }>()
  const [items, setItems] = useState<ItemPartage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ticking, setTicking] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    // Chargement initial
    fetchItemsListe(token)
      .then(setItems)
      .catch(() => setError('Liste introuvable ou expirée.'))
      .finally(() => setLoading(false))

    // Abonnement temps réel
    const channel = subscribeToListe(token, setItems)
    return () => { unsubscribe(channel) }
  }, [token])

  const handleToggle = async (item: ItemPartage) => {
    if (ticking) return
    setTicking(item.id)
    // Optimistic update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, coche: !i.coche } : i))
    try {
      await cocherItem(item.id, !item.coche)
    } catch {
      // Rollback
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, coche: item.coche } : i))
    } finally {
      setTicking(null)
    }
  }

  const nbCoche = items.filter(i => i.coche).length
  const pct = items.length > 0 ? Math.round((nbCoche / items.length) * 100) : 0

  return (
    <div className="pp-page">

      {/* Header */}
      <div className="pp-header">
        <div className="pp-logo">✦ Family OS</div>
        <h1 className="pp-titre">Liste partagée</h1>
        {!loading && !error && items.length > 0 && (
          <div className="pp-progress">
            <div className="pp-progress__bar-wrap">
              <div className="pp-progress__bar" style={{ width: `${pct}%` }} />
            </div>
            <span className="pp-progress__label">{nbCoche} / {items.length} cochés</span>
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="pp-content">
        {loading && (
          <div className="pp-loading">
            <div className="pp-spinner" />
            <span>Chargement…</span>
          </div>
        )}

        {error && (
          <div className="pp-error">
            <span className="pp-error__icon">🔗</span>
            <p className="pp-error__text">{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="pp-empty">
            <span>✅</span>
            <p>La liste est vide.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="pp-list">
            {items.map(item => (
              <li
                key={item.id}
                className={`pp-item${item.coche ? ' pp-item--done' : ''}${ticking === item.id ? ' pp-item--ticking' : ''}`}
                onClick={() => handleToggle(item)}
              >
                <span className="pp-item__check">
                  {item.coche ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" opacity="0.15"/>
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="9 12 11 14 15 10"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                  )}
                </span>
                <span className="pp-item__label">{item.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="pp-footer">
        Partagé via Family OS · se met à jour en temps réel
      </div>

    </div>
  )
}
