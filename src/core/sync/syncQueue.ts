/**
 * FAMILY OS — syncQueue
 * File d'attente persistante pour les pushes échoués.
 * Stockée dans parametresSync sous la clé 'sync.pendingQueue'.
 * Drainée automatiquement au retour de connexion.
 */

import { db } from '../db/database'
import { v4 as uuid } from 'uuid'

const QUEUE_KEY = 'sync.pendingQueue'
const LAST_PULL_KEY = 'sync.lastPullAt'
const LAST_ERROR_KEY = 'sync.lastError'

type QueueItem = { table: string; id: string; retries?: number; lastError?: string }

// ── Lecture / écriture de la file ────────────────────────────────────────────

async function readQueue(): Promise<QueueItem[]> {
  try {
    const row = await db.parametresSync.where('cle').equals(QUEUE_KEY).first()
    return row ? (JSON.parse(row.valeur) as QueueItem[]) : []
  } catch {
    return []
  }
}

async function writeQueue(queue: QueueItem[]): Promise<void> {
  const now = new Date()
  const existing = await db.parametresSync.where('cle').equals(QUEUE_KEY).first()
  if (existing) {
    await db.parametresSync.update(existing.id, {
      valeur: JSON.stringify(queue),
      derniereModification: now,
      updatedAt: now,
    })
  } else {
    await db.parametresSync.add({
      id: uuid(),
      cle: QUEUE_KEY,
      valeur: JSON.stringify(queue),
      derniereModification: now,
      createdAt: now,
      updatedAt: now,
    })
  }
}

// ── API publique ──────────────────────────────────────────────────────────────

const MAX_RETRIES = 5
const DEAD_LETTER_KEY = 'sync.deadLetterQueue'

export async function addToQueue(table: string, id: string, error?: string): Promise<void> {
  const queue = await readQueue()
  const existing = queue.find(q => q.table === table && q.id === id)
  if (existing) {
    existing.retries = (existing.retries ?? 0) + 1
    existing.lastError = error
    if (existing.retries >= MAX_RETRIES) {
      // Déplacer vers la dead letter queue — ne plus réessayer
      const filtered = queue.filter(q => !(q.table === table && q.id === id))
      await writeQueue(filtered)
      await addToDeadLetter(table, id, error)
      return
    }
    await writeQueue(queue)
  } else {
    queue.push({ table, id, retries: 0, lastError: error })
    await writeQueue(queue)
  }
}

async function addToDeadLetter(table: string, id: string, error?: string): Promise<void> {
  try {
    const now = new Date()
    const existing = await db.parametresSync.where('cle').equals(DEAD_LETTER_KEY).first()
    const current: QueueItem[] = existing ? (JSON.parse(existing.valeur) as QueueItem[]) : []
    if (!current.find(q => q.table === table && q.id === id)) {
      current.push({ table, id, lastError: error })
    }
    const valeur = JSON.stringify(current)
    if (existing) {
      await db.parametresSync.update(existing.id, { valeur, derniereModification: now, updatedAt: now })
    } else {
      await db.parametresSync.add({ id: (await import('uuid')).v4(), cle: DEAD_LETTER_KEY, valeur, derniereModification: now, createdAt: now, updatedAt: now })
    }
  } catch { /* silencieux */ }
}

export async function getDeadLetterCount(): Promise<number> {
  try {
    const row = await db.parametresSync.where('cle').equals(DEAD_LETTER_KEY).first()
    return row ? (JSON.parse(row.valeur) as QueueItem[]).length : 0
  } catch { return 0 }
}

export async function getDeadLetterItems(): Promise<QueueItem[]> {
  try {
    const row = await db.parametresSync.where('cle').equals(DEAD_LETTER_KEY).first()
    return row ? (JSON.parse(row.valeur) as QueueItem[]) : []
  } catch { return [] }
}

// Remet tous les éléments de la dead letter queue dans la file normale pour réessai
export async function retryDeadLetter(): Promise<void> {
  try {
    const items = await getDeadLetterItems()
    if (!items.length) return
    const queue = await readQueue()
    for (const item of items) {
      if (!queue.find(q => q.table === item.table && q.id === item.id)) {
        queue.push({ table: item.table, id: item.id, retries: 0 })
      }
    }
    await writeQueue(queue)
    // Vider la dead letter queue
    const now = new Date()
    const existing = await db.parametresSync.where('cle').equals(DEAD_LETTER_KEY).first()
    if (existing) {
      await db.parametresSync.update(existing.id, {
        valeur: JSON.stringify([]),
        derniereModification: now,
        updatedAt: now,
      })
    }
  } catch { /* silencieux */ }
}

export async function removeFromQueue(table: string, id: string): Promise<void> {
  const queue = await readQueue()
  const filtered = queue.filter(q => !(q.table === table && q.id === id))
  if (filtered.length !== queue.length) {
    await writeQueue(filtered)
  }
}

export async function getPendingCount(): Promise<number> {
  const queue = await readQueue()
  return queue.length
}

export async function getQueue(): Promise<QueueItem[]> {
  return readQueue()
}

// ── Dernière sync réussie ─────────────────────────────────────────────────────

export async function setLastPullAt(): Promise<void> {
  const now = new Date()
  const existing = await db.parametresSync.where('cle').equals(LAST_PULL_KEY).first()
  if (existing) {
    await db.parametresSync.update(existing.id, {
      valeur: now.toISOString(),
      derniereModification: now,
      updatedAt: now,
    })
  } else {
    await db.parametresSync.add({
      id: uuid(),
      cle: LAST_PULL_KEY,
      valeur: now.toISOString(),
      derniereModification: now,
      createdAt: now,
      updatedAt: now,
    })
  }
}

export async function getLastPullAt(): Promise<Date | null> {
  const row = await db.parametresSync.where('cle').equals(LAST_PULL_KEY).first()
  return row ? new Date(row.valeur) : null
}

// ── Dernière erreur ───────────────────────────────────────────────────────────

export async function setLastError(msg: string): Promise<void> {
  const now = new Date()
  const existing = await db.parametresSync.where('cle').equals(LAST_ERROR_KEY).first()
  const valeur = JSON.stringify({ msg, at: now.toISOString() })
  if (existing) {
    await db.parametresSync.update(existing.id, { valeur, derniereModification: now, updatedAt: now })
  } else {
    await db.parametresSync.add({ id: uuid(), cle: LAST_ERROR_KEY, valeur, derniereModification: now, createdAt: now, updatedAt: now })
  }
}

export async function clearLastError(): Promise<void> {
  const existing = await db.parametresSync.where('cle').equals(LAST_ERROR_KEY).first()
  if (existing) await db.parametresSync.delete(existing.id)
}
