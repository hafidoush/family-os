/**
 * FAMILY OS — WidgetRoutine
 * F9 : Affiche la routine du créneau actuel sur le dashboard tablette
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../core/db/database'
import type { CreneauRoutine } from '../../../shared/types'
import './WidgetRoutine.css'

const CRENEAUX: { key: CreneauRoutine; label: string; emoji: string; heures: [number, number] }[] = [
  { key: 'matin',      label: 'Matin',      emoji: '🌅', heures: [6,  11] },
  { key: 'midi',       label: 'Midi',       emoji: '☀️', heures: [11, 14] },
  { key: 'apres_midi', label: 'Après-midi', emoji: '🌤', heures: [14, 18] },
  { key: 'soir',       label: 'Soir',       emoji: '🌙', heures: [18, 22] },
  { key: 'nuit',       label: 'Nuit',       emoji: '💤', heures: [22, 6]  },
]

function getCreneauActuel(): CreneauRoutine {
  const h = new Date().getHours()
  if (h >= 6  && h < 11) return 'matin'
  if (h >= 11 && h < 14) return 'midi'
  if (h >= 14 && h < 18) return 'apres_midi'
  if (h >= 18 && h < 22) return 'soir'
  return 'nuit'
}

export function WidgetRoutine() {
  const navigate = useNavigate()
  const creneauActuel = getCreneauActuel()
  const creneauInfo = CRENEAUX.find(c => c.key === creneauActuel)!

  const routines = useLiveQuery(
    () => db.routines
      .where('creneau').equals(creneauActuel)
      .filter(r => !r.archive && !r.deletedAt && r.actif)
      .toArray(),
    [creneauActuel]
  )

  const items = useLiveQuery(
    async () => {
      if (!routines || routines.length === 0) return []
      const allItems = await Promise.all(
        routines.map(r =>
          db.routineItems
            .where('routineId').equals(r.id)
            .filter(i => !i.archive && !i.deletedAt)
            .toArray()
        )
      )
      return allItems.flat().sort((a, b) => a.ordre - b.ordre)
    },
    [routines]
  )

  if (!routines || routines.length === 0) return null

  return (
    <div className="widget-routine" onClick={() => navigate('/routines')}>
      <div className="widget-routine__header">
        <span className="widget-routine__creneau-emoji">{creneauInfo.emoji}</span>
        <div>
          <p className="widget-routine__label">Routine du {creneauInfo.label.toLowerCase()}</p>
          <p className="widget-routine__name">{routines[0].nom}</p>
        </div>
        <span className="widget-routine__count">{(items ?? []).length} étapes</span>
      </div>

      <div className="widget-routine__items">
        {(items ?? []).slice(0, 5).map(item => (
          <div key={item.id} className="widget-routine__item">
            {item.emoji && <span>{item.emoji}</span>}
            <span>{item.libelle}</span>
          </div>
        ))}
        {(items ?? []).length > 5 && (
          <p className="widget-routine__more">+{(items ?? []).length - 5} autres</p>
        )}
      </div>
    </div>
  )
}
