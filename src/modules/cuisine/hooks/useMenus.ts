/**
 * Liste tous les menus non archivés, du plus récent au plus ancien.
 * Se met à jour automatiquement via useLiveQuery.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';

export function useMenus() {
  return useLiveQuery(
    () =>
      db.menus
        .filter((m) => !m.archive && !m.deletedAt)
        .toArray()
        .then((list) => list.sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))),
    []
  );
}
