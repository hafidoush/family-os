/**
 * FAMILY OS — NotificationBanner
 *
 * Bandeau de notification contextuelle affiché en haut du dashboard.
 * - 1 seule notification visible à la fois
 * - Action directe + dismiss
 * - Animation d'entrée douce
 * - 3 variantes : info (lavande), warning (ambre), urgent (rouge doux)
 */

import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import './NotificationBanner.css'

export function NotificationBanner() {
  const navigate = useNavigate()
  const { notification, dismiss } = useNotifications()

  if (!notification) return null

  function handleAction() {
    if (!notification) return
    dismiss()
    navigate(
      notification.actionRoute,
      notification.actionState ? { state: notification.actionState } : undefined
    )
  }

  function handleDismiss() {
    dismiss()
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
