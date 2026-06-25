import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { WidgetPensees } from './WidgetPensees'
import { WidgetAchatsMoment } from './WidgetAchatsMoment'
import './WidgetPenseesAchats.css'

export function WidgetPenseesAchats() {
  const [onglet, setOnglet] = useState<'pensees' | 'achats'>('pensees')

  const nbPensees = useLiveQuery(
    () => db.pensees.filter(p => !p.archive && !p.deletedAt && p.statut === 'active').count(),
    [], 0
  ) ?? 0

  const nbAchats = useLiveQuery(
    () => db.wishlistItems.filter(i => i.contexte === 'achats_besoins' && !i.archive && !i.deletedAt && i.statut !== 'achete').count(),
    [], 0
  ) ?? 0

  return (
    <div className="wpa">
      <div className="wpa__tabs">
        <button
          className={`wpa__tab ${onglet === 'pensees' ? 'wpa__tab--active wpa__tab--lavande' : ''}`}
          onClick={() => setOnglet('pensees')}
        >
          Dans ma tête
          {nbPensees > 0 && <span className="wpa__badge wpa__badge--lavande">{nbPensees}</span>}
        </button>
        <button
          className={`wpa__tab ${onglet === 'achats' ? 'wpa__tab--active wpa__tab--ambre' : ''}`}
          onClick={() => setOnglet('achats')}
        >
          À acheter
          {nbAchats > 0 && <span className="wpa__badge wpa__badge--ambre">{nbAchats}</span>}
        </button>
      </div>
      <div className="wpa__content" key={onglet}>
        {onglet === 'pensees' ? <WidgetPensees /> : <WidgetAchatsMoment />}
      </div>
    </div>
  )
}
