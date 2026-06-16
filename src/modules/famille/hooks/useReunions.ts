/**
 * FAMILY OS — Hooks Réunions Famille
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';

export function useReunions() {
  return useLiveQuery(
    () => db.reunionsFamille
      .orderBy('date')
      .reverse()
      .toArray(),
    []
  );
}

export function useReunion(id: string | null) {
  return useLiveQuery(
    () => id ? db.reunionsFamille.get(id) : undefined,
    [id]
  );
}

export function useProchainReunion() {
  const today = new Date().toISOString().slice(0, 10);
  return useLiveQuery(
    () => db.reunionsFamille
      .filter(r => !r.terminee && r.date >= today)
      .first(),
    []
  );
}
