import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { toISODate } from '../../../shared/utils/formatDate';

export function useTodayActivites() {
  return useLiveQuery(async () => {
    const today = toISODate(new Date());

    // datePrevue est stocké comme ISO string complète ex: "2026-06-09T00:00:00.000Z"
    // → on utilise startsWith pour matcher le préfixe "YYYY-MM-DD"
    // On récupère planifiées ET réalisées — le widget gère l'affichage différencié
    const planifs = await db.planificationsActivites
      .where('datePrevue')
      .startsWith(today)
      .and((p) => (p.statut === 'planifiee' || p.statut === 'realisee') && !p.deletedAt)
      .toArray();

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