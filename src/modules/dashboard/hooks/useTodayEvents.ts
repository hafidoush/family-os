import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { toISODate } from '../../../shared/utils/formatDate';

export function useTodayEvents() {
  return useLiveQuery(async () => {
    const now = new Date();
    // Plage locale du jour en cours (00:00 à 23:59 heure locale)
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Pour les événements journée entière stockés à minuit UTC (= 2h avant minuit local en France),
    // on recule startOfDay de 12h pour les capturer sans risque d'exclure des jours adjacents
    const startLarge = new Date(startOfDay);
    startLarge.setHours(startLarge.getHours() - 12);

    const all = await db.evenements
      .where('dateDebut')
      .between(startLarge, endOfDay, true, true)
      .and((e) => !e.deletedAt && !e.archive)
      .sortBy('dateDebut');

    // Filtrer côté JS — comparaison en DATE LOCALE (pas UTC)
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    return all.filter(e => {
      const eb = new Date(e.dateDebut);
      return eb.getFullYear() === y && eb.getMonth() === m && eb.getDate() === d;
    });
  }, []);
}

export function useWeekEvents() {
  return useLiveQuery(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfDay);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);

    // Filtre JS plutôt que between() Dexie : les dateDebut synchronisées depuis
    // Supabase arrivent sous forme de string ISO, incompatibles avec la comparaison
    // d'index Dexie basée sur des objets Date.
    const all = await db.evenements
      .filter((e) => !e.deletedAt && !e.archive)
      .toArray();

    return all
      .filter((e) => {
        const d = new Date(e.dateDebut);
        return d >= startOfDay && d <= endOfWeek;
      })
      .sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime());
  }, []);
}