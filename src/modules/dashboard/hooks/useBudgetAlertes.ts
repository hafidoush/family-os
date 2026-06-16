import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';

export function useBudgetAlertes() {
  return useLiveQuery(async () => {
    const enveloppes = await db.enveloppes
      .filter((e) => !e.deletedAt && !e.archive)
      .toArray();

    return enveloppes
      .filter((e) => {
        if (!e.alerteSeuil || !e.montantPrevu) return false;
        const consomme = (e as unknown as Record<string, number>)['montantDepense'] ?? 0;
        const pct = consomme / e.montantPrevu;
        return pct >= e.alerteSeuil / 100;
      })
      .map((e) => {
        const depense = (e as unknown as Record<string, number>)['montantDepense'] ?? 0;
        return {
          ...e,
          pctConsomme: Math.round((depense / e.montantPrevu) * 100),
          montantRestant: e.montantPrevu - depense,
        };
      });
  }, []);
}