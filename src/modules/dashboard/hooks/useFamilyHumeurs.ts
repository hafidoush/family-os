import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { toISODate } from '../../../shared/utils/formatDate';

const MEMBRES_IDS = ['membre-maman', 'membre-papa', 'membre-manel', 'membre-nawfel'];

export function useFamilyHumeurs() {
  return useLiveQuery(async () => {
    const today = toISODate(new Date());

    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(toISODate(d));
    }

    const [membres, humeurs] = await Promise.all([
      db.membres.where('id').anyOf(MEMBRES_IDS).toArray(),
      db.humeurs
        .where('membre')
        .anyOf(MEMBRES_IDS)
        .and((h) => dates.includes(toISODate(new Date(h.date))) && !h.deletedAt)
        .toArray(),
    ]);

    return membres.map((m) => {
      const humeursHistorique = dates.map((date) => {
        const h = humeurs.find(
          (h) => h.membre === m.id && toISODate(new Date(h.date)) === date
        );

        return {
          date,
          valeur: h?.valeur ?? null,
          note: h?.noteLibre,
        };
      });

      const aujourdhui = humeursHistorique.find((h) => h.date === today);

      return {
        membre: m,
        humeursHistorique,
        humeurAujourdhui: aujourdhui?.valeur ?? null,
        noteAujourdhui: aujourdhui?.note,
      };
    });
  }, []);
}