/**
 * FAMILY OS — NotificationBanner
 *
 * Bandeau de notification contextuelle affiché en haut du dashboard.
 * - 1 seule notification visible à la fois
 * - Action directe + dismiss
 * - Animation d'entrée douce
 * - 3 variantes : info (lavande), warning (ambre), urgent (rouge doux)
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import './NotificationBanner.css'

export function NotificationBanner() {
  const navigate = useNavigate()
  const { notification, dismiss } = useNotifications()

  // Force re-render après dismiss (localStorage ne trigger pas React)
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed state quand une nouvelle notification arrive
  useEffect(() => {
    setDismissed(false)
  }, [notification?.id])

  if (!notification || dismissed) return null

  function handleAction() {
    if (!notification) return
    dismiss()
    setDismissed(true)
    navigate(
      notification.actionRoute,
      notification.actionState ? { state: notification.actionState } : undefined
    )
  }

  function handleDismiss() {
    dismiss()
    setDismissed(true)
  }

  return (
    <div className={`notif-banner notif-banner--${notification.variant}`} role="alert">
      <span className="notif-banner__emoji" aria-hidden="true">
        {notification.emoji}
      </span>

      <p className="notif-banner__message">
        {notification.message}
      </p>

      <div className="notif-banner__actions">
        <button
          className="notif-banner__action"
          onClick={handleAction}
        >
          {notification.actionLabel}
        </button>
        <button
          className="notif-banner__dismiss"
          onClick={handleDismiss}
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
    </div>
  )
}
