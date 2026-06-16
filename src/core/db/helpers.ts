import { v4 as uuidv4 } from 'uuid'

// ─── Types ───────────────────────────────────────────────────────────────────
export interface AuditFields {
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

export interface DeviceField {
  deviceId: string
}

// ─── getDeviceIdSync ──────────────────────────────────────────────────────────
/**
 * Lecture synchrone du deviceId depuis localStorage.
 * getDeviceId() (async) initialise localStorage au démarrage via providers.tsx.
 * Après ce point, localStorage contient toujours la valeur — lecture directe safe.
 * D-05: Ne jamais appeler getDeviceId() (async) dans helpers — DataCloneError.
 */
const DEVICE_ID_KEY = 'family-os-device-id'

function getDeviceIdSync(): string {
  // Priorité : localStorage (toujours disponible après init providers.tsx)
  const stored = localStorage.getItem(DEVICE_ID_KEY)
  if (stored) return stored

  // Fallback : génère un ID temporaire si appelé avant l'init (rare)
  // sera écrasé dès que getDeviceId() async s'exécute
  const fallback = `device-${uuidv4()}`
  localStorage.setItem(DEVICE_ID_KEY, fallback)
  return fallback
}

// ─── withAudit ────────────────────────────────────────────────────────────────
/**
 * Injects createdAt + updatedAt on entity creation.
 * D-05: Never set audit fields manually in services or components.
 */
export function withAudit<T extends object>(data: T): T & AuditFields {
  const now = new Date()
  return {
    ...data,
    createdAt: now,
    updatedAt: now,
  }
}

// ─── withDevice ───────────────────────────────────────────────────────────────
/**
 * Injects deviceId on every write.
 * D-05: Never set deviceId manually.
 * Used together with withAudit for new entities.
 */
export function withDevice<T extends object>(data: T): T & DeviceField {
  return {
    ...data,
    deviceId: getDeviceIdSync(),
  }
}

// ─── withUpdate ───────────────────────────────────────────────────────────────
/**
 * Updates updatedAt + deviceId for partial updates.
 * Usage: db.taches.update(id, withUpdate({ statut: 'fait' }))
 */
export function withUpdate<T extends object>(
  partial: Partial<T>
): Partial<T> & Pick<AuditFields, 'updatedAt'> & DeviceField {
  return {
    ...partial,
    updatedAt: new Date(),
    deviceId: getDeviceIdSync(),
  }
}

// ─── newEntity ────────────────────────────────────────────────────────────────
/**
 * Creates a full entity with auto-generated id + audit fields + deviceId.
 * Usage: db.taches.add(newEntity({ titre: 'Faire la vaisselle', ... }))
 */
export function newEntity<T extends object>(
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'deviceId'>
): T & { id: string } & AuditFields & DeviceField {
  return withDevice(withAudit({ id: uuidv4(), ...data })) as T & { id: string } & AuditFields & DeviceField
}

// ─── softDeleteFields ─────────────────────────────────────────────────────────
/**
 * D-04: Soft delete — never call db.table.delete(id) directly.
 * Sets archive = true, deletedAt = now, updatedAt = now.
 */
export function softDeleteFields(): { archive: true; deletedAt: Date } & Pick<AuditFields, 'updatedAt'> & DeviceField {
  return {
    archive: true as const,
    deletedAt: new Date(),
    updatedAt: new Date(),
    deviceId: getDeviceIdSync(),
  }
}
