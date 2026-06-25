import { useState } from 'react'
import { WidgetPensees } from './WidgetPensees'
import { WidgetAchatsMoment } from './WidgetAchatsMoment'
import './WidgetPenseesAchats.css'

export function WidgetPenseesAchats() {
  const [onglet, setOnglet] = useState<'pensees' | 'achats'>('pensees')

  return (
    <div className="wpa">
      <div className="wpa__tabs">
        <button
          className={`wpa__tab ${onglet === 'pensees' ? 'wpa__tab--active wpa__tab--lavande' : ''}`}
          onClick={() => setOnglet('pensees')}
        >
          Dans ma tête
        </button>
        <button
          className={`wpa__tab ${onglet === 'achats' ? 'wpa__tab--active wpa__tab--ambre' : ''}`}
          onClick={() => setOnglet('achats')}
        >
          À acheter
        </button>
      </div>
      <div className="wpa__content" key={onglet}>
        {onglet === 'pensees' ? <WidgetPensees /> : <WidgetAchatsMoment />}
      </div>
    </div>
  )
}
