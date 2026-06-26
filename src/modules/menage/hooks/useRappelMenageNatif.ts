/**
 * useRappelMenageNatif
 *
 * Deux notifications natives par jour (PWA) :
 *   1. Rappel quotidien — tâches dues non faites
 *   2. Alerte critique — tâches ratées ≥5 fois avec healthImportance ≥ 2
 */

import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { isDueToday, isOverdue } from '../utils/nextDueDate'
import { enrichTask, shouldAlertLevel3 } from '../engine/menageEngine'
import type { Tache } from '@shared/types/entities'

const LS_QUOTIDIEN = 'menage_notif_native'
const LS_ALERTE3   = 'menage_notif_alerte3'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function isCompletedToday(t: Tache): boolean {
  if (t.statut !== 'fait' || !t.completeeLe) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const c = new Date(t.completeeLe); c.setHours(0, 0, 0, 0)
  return c.getTime() === today.getTime()
}

function dejaMontree(key: string): boolean {
  try { return localStorage.getItem(key) === todayISO() } catch { return false }
}

function marquerMontree(key: string) {
  try { localStorage.setItem(key, todayISO()) } catch { /* */ }
}

function envoyer(titre: string, body: string, tag: string, lsKey: string) {
  if (Notification.permission !== 'granted') return
  marquerMontree(lsKey)
  const n = new Notification(titre, { body, icon: '/icons/icon-192.png', tag })
  n.onclick = () => { window.focus(); n.close() }
}

function demanderEtEnvoyer(titre: string, body: string, tag: string, lsKey: string) {
  if (Notification.permission === 'granted') {
    envoyer(titre, body, tag, lsKey)
  } else if (Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') envoyer(titre, body, tag, lsKey)
    })
  }
}

export function useRappelMenageNatif() {
  const data = useLiveQuery(async () => {
    if (!('Notification' in window)) return { count: 0, alertes: [] as string[] }

    const all = await db.taches
      .filter(t => !t.deletedAt && !t.archive && t.moduleOrigine === 'maison' && !!t.recurrence)
      .toArray()

    const today = new Date()

    const quotidiennes = all.filter(
      t => t.frequence === 'quotidienne' && !isCompletedToday(t)
    )
    const periodiques = all.filter(
      t => t.frequence && t.frequence !== 'quotidienne' && t.frequence !== 'ponctuelle'
        && !t.contexteLibre?.startsWith('saisonniere::')
        && (isDueToday(t) || isOverdue(t)) && !isCompletedToday(t)
    )

    // Tâches niveau 3 — enrichies pour lire _missedCount et _healthImportance
    const alertes = all
      .map(t => enrichTask(t, today))
      .filter(shouldAlertLevel3)
      .map(t => t.titre)

    return { count: quotidiennes.length + periodiques.length, alertes }
  })

  const count   = data?.count   ?? 0
  const alertes = data?.alertes ?? []

  // Rappel quotidien normal
  useEffect(() => {
    if (!('Notification' in window)) return
    if (dejaMontree(LS_QUOTIDIEN)) return
    if (count === 0) return
    demanderEtEnvoyer(
      'Ménage du jour 🧹',
      `${count} tâche${count > 1 ? 's' : ''} vous attende${count > 1 ? 'nt' : ''} aujourd'hui.`,
      'menage-du-jour',
      LS_QUOTIDIEN,
    )
  }, [count])

  // Alerte critique niveau 3
  useEffect(() => {
    if (!('Notification' in window)) return
    if (dejaMontree(LS_ALERTE3)) return
    if (alertes.length === 0) return
    const premiers = alertes.slice(0, 2).join(', ')
    const suite    = alertes.length > 2 ? ` (+${alertes.length - 2})` : ''
    demanderEtEnvoyer(
      'Tâche négligée ⚠️',
      `${premiers}${suite} — à faire dès que possible.`,
      'menage-alerte-critique',
      LS_ALERTE3,
    )
  }, [alertes.length]) // eslint-disable-line react-hooks/exhaustive-deps
}
