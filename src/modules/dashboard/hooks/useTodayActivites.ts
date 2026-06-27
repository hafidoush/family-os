import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';

export function useTodayActivites() {
  return useLiveQuery(async () => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();

    // datePrevue peut être stocké en UTC (ex: "2026-06-26T22:00:00.000Z" = minuit Paris).
    // On filtre côté JS en comparant les composantes locales de la date pour éviter
    // tout décalage de fuseau horaire.
    const planifs = (await db.planificationsActivites
      .filter((p) => (p.statut === 'planifiee' || p.statut === 'realisee') && !p.deletedAt)
      .toArray())
      .filter((p) => {
        const dp = new Date(p.datePrevue);
        return dp.getFullYear() === y && dp.getMonth() === m && dp.getDate() === d;
      });

    // Fix : champs corrects = p.activite (FK) et p.enfant (FK)
    const activiteIds = [...new Set(planifs.map((p) => p.activite).filter(Boolean))];
    const membreIds = [...new Set(planifs.map((p) => p.enfant).filter(Boolean) as string[])];

    const [activites, membres] = await Promise.all([
      activiteIds.length ? db.activites.where('id').anyOf(activiteIds).toArray() : [],
      membreIds.length ? db.membres.where('id').anyOf(membreIds).toArray() : [],
    ]);

    const activitesMap = Object.fromEntries(activites.map((a) => [a.id, a]));
    const membresMap = Object.fromEntries(membres.map((m) => [m.id, m]));

    return planifs.map((p) => ({
      ...p,
      activite: activitesMap[p.activite],
      membre: p.enfant ? membresMap[p.enfant] : undefined,
    }));
  }, []);
}