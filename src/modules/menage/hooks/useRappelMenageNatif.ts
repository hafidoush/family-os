/**
 * useRappelMenageNatif
 *
 * Demande la permission de notifications navigateur et envoie une notification
 * native une fois par jour si des tâches ménagères sont dues.
 * Fonctionne quand la PWA est installée (Android/iOS/desktop).
 */

import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { isDueToday, isOverdue } from '../utils/nextDueDate'
import type { Tache } from '@shared/types/entities'

const LS_KEY = 'menage_notif_native'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function isCompletedToday(t: Tache): boolean {
  if (t.statut !== 'fait' || !t.completeeLe) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const c = new Date(t.completeeLe); c.setHours(0, 0, 0, 0)
  return c.getTime() === today.getTime()
}

function dejaMontreeAujourdhui(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === todayISO()
  } catch { return false }
}

function marquerCommeMontree() {
  try { localStorage.setItem(LS_KEY, todayISO()) } catch { /* */ }
}

export function useRappelMenageNatif() {
  const taches = useLiveQuery(async () => {
    const all = await db.taches
      .filter(t => !t.deletedAt && !t.archive && t.moduleOrigine === 'maison')
      .toArray()

    const quotidiennes = all.filter(
      t => t.frequence === 'quotidienne' && !isCompletedToday(t)
    )
    const periodiques = all.filter(
      t => t.frequence && t.frequence !== 'quotidienne' && t.frequence !== 'ponctuelle'
        && !t.contexteLibre?.startsWith('saisonniere::')
        && (isDueToday(t) || isOverdue(t)) && !isCompletedToday(t)
    )
    return quotidiennes.length + periodiques.length
  }) ?? 0

  useEffect(() => {
    if (!('Notification' in window)) return
    if (dejaMontreeAujourdhui()) return
    if (taches === 0) return

    const envoyer = () => {
      if (Notification.permission !== 'granted') return
      marquerCommeMontree()
      const n = new Notification('Ménage du jour 🧹', {
        body: `${taches} tâche${taches > 1 ? 's' : ''} vous attende${taches > 1 ? 'nt' : ''} aujourd'hui.`,
        icon: '/icons/icon-192.png',
        tag: 'menage-du-jour',
      })
      n.onclick = () => {
        window.focus()
        n.close()
      }
    }

    if (Notification.permission === 'granted') {
      envoyer()
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') envoyer()
      })
    }
  }, [taches])
}
