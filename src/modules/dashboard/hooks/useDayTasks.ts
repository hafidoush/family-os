/**
 * useDayTasks(dateISO) — tâches + activités + selfcare pour un jour donné.
 * Remplace useTodayTasks() et corrige le bug des champs activite/enfant.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';

export interface TodoItem {
  id: string;
  titre: string;
  priorite: 'haute' | 'normale' | 'basse';
  moduleOrigine: 'enfants' | 'maison' | 'myself' | 'cuisine' | 'famille';
  type: 'tache' | 'activite' | 'selfcare';
  statut: string;
  heure?: string;
}

export function useDayTasks(dateISO: string) {
  return useLiveQuery(async () => {
    const date = new Date(dateISO + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0=dim

    // dateEcheance est un Date object → comparaison avec between()
    const startOfDay = new Date(dateISO + 'T00:00:00');
    const endOfDay   = new Date(dateISO + 'T23:59:59.999');

    const [tachesEcheance, tachesRecurrentes, planifications, selfcares] =
      await Promise.all([
        db.taches
          .where('dateEcheance')
          .between(startOfDay, endOfDay, true, true)
          .and((t) => !t.deletedAt)
          .toArray(),
        db.taches
          .filter((t) => t.recurrence === true && !t.deletedAt)
          .toArray(),
        // datePrevue est un ISO string complet → startsWith pour matcher "YYYY-MM-DD"
        db.planificationsActivites
          .where('datePrevue')
          .startsWith(dateISO)
          .and((p) => !p.deletedAt && !p.archive)
          .toArray(),
        db.selfCareItems
          .filter((s) => s.remonteDashboard === true && !s.deletedAt)
          .toArray(),
      ]);

    // Récurrentes → filtrer selon le jour
    const recFiltrees = tachesRecurrentes.filter((t) => {
      if (!t.frequence) return false;
      if (t.frequence === 'quotidienne') return true;
      if (t.frequence === 'hebdomadaire' && (t.joursSemaine ?? []).includes(['dim','lun','mar','mer','jeu','ven','sam'][dayOfWeek] as import('../../../shared/types').JourSemaine)) return true;
      return false;
    });

    // Résoudre les noms d'activités (fix bug : champ "activite" pas "activiteId")
    const activiteIds = [...new Set(planifications.map((p) => p.activite).filter(Boolean))];
    const activites = activiteIds.length
      ? await db.activites.where('id').anyOf(activiteIds).toArray()
      : [];
    const activitesMap = new Map(activites.map((a) => [a.id, a]));

    const priorityOrder: Record<string, number> = { haute: 0, normale: 1, basse: 2 };

    const items: TodoItem[] = [
      ...tachesEcheance.map((t) => ({
        id: t.id,
        titre: t.titre,
        priorite: (t.priorite as TodoItem['priorite']) ?? 'normale',
        moduleOrigine: (t.moduleOrigine as TodoItem['moduleOrigine']) ?? 'famille',
        type: 'tache' as const,
        statut: t.statut,
      })),
      ...recFiltrees.map((t) => ({
        id: t.id,
        titre: t.titre,
        priorite: (t.priorite as TodoItem['priorite']) ?? 'normale',
        moduleOrigine: (t.moduleOrigine as TodoItem['moduleOrigine']) ?? 'famille',
        type: 'tache' as const,
        statut: t.statut,
      })),
      // Fix : utilise p.activite (FK) et résout le nom depuis activitesMap
      ...planifications.map((p) => ({
        id: p.id,
        titre: activitesMap.get(p.activite)?.nom ?? 'Activité',
        priorite: 'normale' as const,
        moduleOrigine: 'enfants' as const,
        type: 'activite' as const,
        statut: p.statut,
        heure: p.heurePrevue,
      })),
      ...selfcares.map((s) => ({
        id: s.id,
        titre: 'Soin',
        priorite: 'normale' as const,
        moduleOrigine: 'myself' as const,
        type: 'selfcare' as const,
        statut: 'actif',
      })),
    ];

    return items.sort((a, b) => priorityOrder[a.priorite] - priorityOrder[b.priorite]);
  }, [dateISO]);
}
