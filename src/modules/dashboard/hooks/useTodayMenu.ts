import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { toISODate } from '../../../shared/utils/formatDate';

// Correspondance date ISO → JourMenu
const ISO_JOUR: Record<number, string> = {
  0: 'dimanche',
  1: 'lundi',
  2: 'mardi',
  3: 'mercredi',
  4: 'jeudi',
  5: 'vendredi',
  6: 'samedi',
};

/**
 * Retourne les slots du menu actif assignés au jour courant,
 * enrichis avec leur recette résolue.
 * Seuls les slots avec `jour` = aujourd'hui sont retournés
 * (les slots sans jour sont des recettes "libres de la semaine",
 * elles ne s'affichent pas dans le widget du jour).
 */
export function useTodayMenu() {
  return useLiveQuery(async () => {
    const today = toISODate(new Date());
    const jourDuJour = ISO_JOUR[new Date().getDay()];

    // Menu validé dont la plage dateDebut–dateFin couvre today
    const menusActifs = await db.menus
      .filter(
        (m) =>
          m.valide === true &&
          m.dateDebut <= today &&
          (m.dateFin == null || m.dateFin >= today) &&
          !m.deletedAt
      )
      .toArray();

    if (!menusActifs.length) return null;

    const menu = menusActifs[0];

    // Slots assignés au jour courant (jour optionnel → filtre explicite)
    const slots = await db.menuSlots
      .where('menu')
      .equals(menu.id)
      .filter((s) => s.jour === jourDuJour && !s.deletedAt)
      .toArray();

    if (!slots.length) return [];

    // Résolution des recettes
    const recetteIds = slots.map((s) => s.recette).filter(Boolean) as string[];
    const recettes = recetteIds.length
      ? await db.recettes.where('id').anyOf(recetteIds).toArray()
      : [];
    const recettesMap = Object.fromEntries(recettes.map((r) => [r.id, r]));

    return slots.map((s) => ({
      ...s,
      recetteResolue: s.recette ? recettesMap[s.recette] : undefined,
    }));
  }, []);
}
