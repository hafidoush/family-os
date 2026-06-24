/**
 * FAMILY OS — useSyncStatus
 * Statut de synchronisation observable en temps réel.
 */

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'

export type SyncState = 'synced' | 'pending' | 'syncing' | 'error' | 'offline'

export interface SyncStatus {
  state: SyncState
  lastPullAt: Date | null
  pendingCount: number
  deadLetterCount: number
  lastError: string | null
  isOnline: boolean
}

export function useSyncStatus(): SyncStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    function onOnline()  { setIsOnline(true) }
    function onOffline() { setIsOnline(false) }
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Écouter les changements de parametresSync pour détecter la sync en cours
  const lastPullRow = useLiveQuery(
    () => db.parametresSync.where('cle').equals('sync.lastPullAt').first(),
    []
  )
  const queueRow = useLiveQuery(
    () => db.parametresSync.where('cle').equals('sync.pendingQueue').first(),
    []
  )
  const deadLetterRow = useLiveQuery(
    () => db.parametresSync.where('cle').equals('sync.deadLetterQueue').first(),
    []
  )
  const errorRow = useLiveQuery(
    () => db.parametresSync.where('cle').equals('sync.lastError').first(),
    []
  )

  // Écouter les mises à jour fréquentes de parametresSync pour détecter la synchro active
  const recentUpdates = useLiveQuery(
    () => db.parametresSync.orderBy('updatedAt').last(),
    []
  )

  useEffect(() => {
    if (!recentUpdates) return
    const age = Date.now() - new Date(recentUpdates.updatedAt).getTime()
    if (age < 3000) {
      setIsSyncing(true)
      const t = setTimeout(() => setIsSyncing(false), 3000)
      return () => clearTimeout(t)
    }
  }, [recentUpdates?.updatedAt])

  const lastPullAt = lastPullRow?.valeur ? new Date(lastPullRow.valeur) : null

  let pendingCount = 0
  try {
    pendingCount = queueRow ? (JSON.parse(queueRow.valeur) as unknown[]).length : 0
  } catch { pendingCount = 0 }

  let deadLetterCount = 0
  try {
    deadLetterCount = deadLetterRow ? (JSON.parse(deadLetterRow.valeur) as unknown[]).length : 0
  } catch { deadLetterCount = 0 }

  let lastError: string | null = null
  try {
    if (errorRow) {
      const parsed = JSON.parse(errorRow.valeur) as { msg: string; at: string }
      lastError = parsed.msg
    }
  } catch { lastError = null }

  let state: SyncState
  if (!isOnline)                       state = 'offline'
  else if (isSyncing)                  state = 'syncing'
  else if (pendingCount > 0)           state = 'pending'
  else if (deadLetterCount > 0)        state = 'error'
  else if (lastError)                  state = 'error'
  else                                 state = 'synced'

  return { state, lastPullAt, pendingCount, deadLetterCount, lastError, isOnline }
}
