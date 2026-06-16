import { v4 as uuid } from 'uuid'
import { db } from '@core/db/database'

const DEVICE_ID_KEY = 'family-os-device-id'

let cachedDeviceId: string | null = null

// ── Récupérer ou créer l'identifiant unique de l'appareil ────────────────────
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId

  // 1. Vérifier localStorage (rapide)
  const stored = localStorage.getItem(DEVICE_ID_KEY)
  if (stored) {
    cachedDeviceId = stored
    return stored
  }

  // 2. Vérifier la base (au cas où localStorage a été vidé)
  const param = await db.parametresSync.where('cle').equals('device_id').first()
  if (param) {
    localStorage.setItem(DEVICE_ID_KEY, param.valeur)
    cachedDeviceId = param.valeur
    return param.valeur
  }

  // 3. Créer un nouveau device_id
  const newId = `device-${uuid()}`
  localStorage.setItem(DEVICE_ID_KEY, newId)

  const now = new Date()
  await db.parametresSync.add({
    id: uuid(),
    cle: 'device_id',
    valeur: newId,
    derniereModification: now,
    createdAt: now,
    updatedAt: now,
  })

  cachedDeviceId = newId
  return newId
}

// ── Récupérer la version du schéma ───────────────────────────────────────────
export async function getSchemaVersion(): Promise<string> {
  const param = await db.parametresSync.where('cle').equals('schema_version').first()
  return param?.valeur ?? '1'
}

// ── Enregistrer la version du schéma ─────────────────────────────────────────
export async function setSchemaVersion(version: string): Promise<void> {
  const existing = await db.parametresSync.where('cle').equals('schema_version').first()
  const now = new Date()

  if (existing) {
    await db.parametresSync.update(existing.id, {
      valeur: version,
      derniereModification: now,
      updatedAt: now,
    })
  } else {
    await db.parametresSync.add({
      id: uuid(),
      cle: 'schema_version',
      valeur: version,
      derniereModification: now,
      createdAt: now,
      updatedAt: now,
    })
  }
}
