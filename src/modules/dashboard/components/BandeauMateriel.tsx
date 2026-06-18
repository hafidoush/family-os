/**
 * FAMILY OS — BandeauMateriel
 * Bandeau dismissible affiché quand un programme actif démarre
 * dans moins de 30 jours et a du matériel non confirmé.
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'

const DISMISS_KEY = 'bandeau_materiel_dismissed'

export function BandeauMateriel() {
  const [dismissed, setDismissed] = useState(() => {
    try { return !!sessionStorage.getItem(DISMISS_KEY) } catch { return false }
  })

  const alerte = useLiveQuery(async () => {
    if (dismissed) return null

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const dans30j = new Date(today); dans30j.setDate(today.getDate() + 30)

    const programmes = await db.programmesPedagogiques
      .filter(p => !p.archive && !p.deletedAt && (p.statut === 'actif' || p.statut === 'brouillon'))
      .toArray()

    for (const prog of programmes) {
      const debut = new Date(prog.dateDebut)
      if (debut > dans30j) continue  // trop loin

      // Compter le matériel non confirmé
      const activites = await db.activitesProgramme
        .where('programmeId').equals(prog.id)
        .filter(a => !a.archive && !a.deletedAt)
        .toArray()

      const statuts = prog.materielStatuts ?? {}
      let nonConfirme = 0

      for (const act of activites) {
        const items = [...(act.materielNecessaire ?? []), ...(act.materielOptionnel ?? [])]
        for (const item of items) {
          const key = item.nom.toLowerCase().trim()
          if (!statuts[key] || statuts[key] === 'a_verifier') nonConfirme++
        }
      }

      const total = new Set(
        activites.flatMap(a => [
          ...(a.materielNecessaire ?? []),
          ...(a.materielOptionnel ?? [])
        ].map(i => i.nom.toLowerCase().trim()))
      ).size

      if (total === 0 || nonConfirme === 0) continue

      const joursAvant = Math.ceil((debut.getTime() - today.getTime()) / 86400000)
      return { titre: prog.titre, nonConfirme, total, joursAvant, debut }
    }

    return null
  }, [dismissed])

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* noop */ }
    setDismissed(true)
  }

  if (!alerte) return null

  const { titre, nonConfirme, total, joursAvant } = alerte
  const urgence = joursAvant <= 7

  return (
    <div className={`bandeau-materiel${urgence ? ' bandeau-materiel--urgent' : ''}`}>
      <span className="bandeau-materiel__icon">📦</span>
      <div className="bandeau-materiel__body">
        <p className="bandeau-materiel__titre">
          {joursAvant <= 0
            ? `Programme "${titre}" en cours`
            : `Programme "${titre}" dans ${joursAvant} jour${joursAvant > 1 ? 's' : ''}`}
        </p>
        <p className="bandeau-materiel__sub">
          {nonConfirme} item{nonConfirme > 1 ? 's' : ''} sur {total} à vérifier dans la liste matériel
        </p>
      </div>
      <button className="bandeau-materiel__close" onClick={dismiss} aria-label="Fermer">×</button>
    </div>
  )
}
