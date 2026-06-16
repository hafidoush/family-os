/**
 * FAMILY OS — Champs d'audit universels
 * Présents sur toutes les entités modifiables.
 * Convention : camelCase (CONVENTIONS.md §1)
 * Ne jamais renseigner manuellement — injectés par withAudit() / withDevice()
 */

export interface AuditFields {
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface DeviceField {
  deviceId?: string;
}

/** Entité complète avec audit + device */
export type WithAudit<T> = T & AuditFields;
export type WithDevice<T> = T & DeviceField;
export type FullEntity<T> = T & AuditFields & DeviceField;
