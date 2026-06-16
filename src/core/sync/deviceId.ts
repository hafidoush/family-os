/**
 * deviceId.ts — Re-export de compatibilité
 *
 * helpers.ts importe depuis '../sync/deviceId'
 * mais le fichier physique est device.ts.
 * Ce fichier résout l'ambiguïté sans toucher à helpers.ts (fichier existant).
 *
 * Si device.ts exporte déjà getDeviceId, ce re-export suffit.
 * Sinon, implémenter ici directement.
 */
export { getDeviceId, getSchemaVersion, setSchemaVersion } from './device'
