import { useEffect } from 'react'

/**
 * Intercepte le bouton retour browser quand une vue détail est active.
 * Pousse une entrée fantôme dans l'historique, puis écoute popstate pour
 * appeler `onBack` au lieu de naviguer vers la route précédente.
 *
 * Usage :
 *   useBackToList(!!selectedId, () => setSelectedId(null))
 *   useBackToList(view.type === 'detail', () => setView({ type: 'list' }))
 *
 * Pour le bouton retour interne (back-bar), appeler window.history.back()
 * au lieu de changer l'état directement — le popstate s'en chargera.
 */
export function useBackToList(isDetailActive: boolean, onBack: () => void) {
  useEffect(() => {
    if (!isDetailActive) return
    window.history.pushState({ internalDetail: true }, '')
    const handler = () => onBack()
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [isDetailActive]) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Navigue vers la liste via le bouton interne (back-bar).
 * Si une entrée fantôme existe (isDetailActive), consomme-la via history.back().
 * Sinon, appelle directement onBack (fallback sûr).
 */
export function backToList(isDetailActive: boolean, onBack: () => void) {
  if (isDetailActive) {
    window.history.back()
  } else {
    onBack()
  }
}
