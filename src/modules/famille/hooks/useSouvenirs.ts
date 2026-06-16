/**
 * FAMILY OS — Hooks Souvenirs
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';

export function useSouvenirs(membreId?: string | null, type?: string | null) {
  return useLiveQuery(
    () => db.souvenirs
      .filter(s => {
        if (s.archive || s.deletedAt) return false;
        if (membreId && !(s.membresAssocies ?? []).includes(membreId)) return false;
        if (type && s.type !== type) return false;
        return true;
      })
      .toArray()
      .then(list => list.sort((a, b) => b.date.localeCompare(a.date))),
    [membreId, type]
  );
}

export function useSouvenir(id: string | null) {
  return useLiveQuery(
    () => id ? db.souvenirs.get(id) : undefined,
    [id]
  );
}
