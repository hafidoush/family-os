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

type QueueItem = { table: string; id: string }

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

export async function addToQueue(table: string, id: string): Promise<void> {
  const queue = await readQueue()
  if (!queue.find(q => q.table === table && q.id === id)) {
    queue.push({ table, id })
    await writeQueue(queue)
  }
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
