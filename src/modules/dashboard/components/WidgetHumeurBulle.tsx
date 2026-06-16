/**
 * FAMILY OS — WidgetHumeurBulle
 * Bannière flottante style "cookie" — fixe au-dessus de la nav.
 * Affiche toute la famille. Disparaît quand tous ont été remplis ou si fermée.
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { newEntity } from '../../../core/db/helpers'
import { toISODate } from '../../../shared/utils/formatDate'
import type { Humeur, ValeurHumeur, Membre } from '../../../shared/types'
import './WidgetHumeurBulle.css'

const EMOJIS: { valeur: ValeurHumeur; emoji: string }[] = [
  { valeur: 1, emoji: '😔' },
  { valeur: 3, emoji: '😐' },
  { valeur: 4, emoji: '🙂' },
  { valeur: 5, emoji: '😊' },
  { valeur: 7, emoji: '🤩' },
]

function Avatar({ membre }: { membre: Membre }) {
  return (
    <div
      className="humeur-bulle__avatar"
      style={{ background: membre.couleur ?? 'hsl(262, 45%, 62%)' }}
    >
      {membre.prenom[0].toUpperCase()}
    </div>
  )
}

export function WidgetHumeurBulle() {
  const today = toISODate(new Date())
  const [dismissed, setDismissed] = useState(false)
  const [local, setLocal] = useState<Record<string, ValeurHumeur>>({})

  const membres = useLiveQuery(
    () => db.membres.filter(m => m.actif).toArray(),
    []
  )

  const humeursDuJour = useLiveQuery(
    () => db.humeurs.where('date').equals(today).toArray(),
    [today]
  )

  if (!membres || membres.length === 0 || !humeursDuJour || dismissed) return null

  // Disparaît dès que tout le monde a son humeur (DB + sélections locales)
  const tousRemplis = membres.every(
    m => humeursDuJour.some(h => h.membre === m.id) || !!local[m.id]
  )
  if (tousRemplis) return null

  const getValeur = (membreId: string): ValeurHumeur | null =>
    local[membreId] ?? humeursDuJour.find(h => h.membre === membreId)?.valeur ?? null

  const handleSelect = async (membreId: string, valeur: ValeurHumeur) => {
    setLocal(prev => ({ ...prev, [membreId]: valeur }))
    const existing = await db.humeurs.where({ membre: membreId, date: today }).first()
    if (existing) {
      await db.humeurs.update(existing.id, { valeur, updatedAt: new Date() })
    } else {
      await db.humeurs.add(newEntity<Humeur>({
        membre: membreId, date: today, valeur, source: 'saisie_rapide',
      }))
    }
  }

  return (
    <div className="humeur-bulle">
      <div className="humeur-bulle__header">
        <span className="humeur-bulle__title">Comment va la famille aujourd'hui ?</span>
        <button className="humeur-bulle__close" onClick={() => setDismissed(true)} aria-label="Fermer">✕</button>
      </div>

      <div className="humeur-bulle__liste">
        {membres.map(m => {
          const valeur = getValeur(m.id)
          return (
            <div key={m.id} className="humeur-bulle__ligne">
              <Avatar membre={m} />
              <span className="humeur-bulle__prenom">{m.prenom}</span>
              <div className="humeur-bulle__emojis">
                {EMOJIS.map(opt => (
                  <button
                    key={opt.valeur}
                    className={`humeur-bulle__btn${valeur === opt.valeur ? ' humeur-bulle__btn--selected' : ''}`}
                    onClick={() => handleSelect(m.id, opt.valeur)}
                    aria-pressed={valeur === opt.valeur}
                  >
                    {opt.emoji}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WidgetHumeurBulle
