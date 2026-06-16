/**
 * Retourne le menu validé qui couvre la date du jour, avec tous ses slots résolus.
 * Utilisé par le module Dashboard (WidgetMenu) et potentiellement les courses.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';
import { toISODate } from '@shared/utils/formatDate';

export function useActiveMenu() {
  return useLiveQuery(async () => {
    const today = toISODate(new Date());

    const menu = await db.menus
      .filter(
        (m) =>
          m.valide === true &&
          m.dateDebut <= today &&
          (m.dateFin == null || m.dateFin >= today) &&
          !m.archive &&
          !m.deletedAt
      )
      .first();

    if (!menu) return null;

    const slots = await db.menuSlots
      .where('menu')
      .equals(menu.id)
      .filter((s) => !s.archive && !s.deletedAt)
      .toArray();

    const recetteIds = [...new Set(slots.map((s) => s.recette).filter(Boolean) as string[])];
    const recettes = recetteIds.length
      ? await db.recettes.where('id').anyOf(recetteIds).toArray()
      : [];
    const recettesMap = Object.fromEntries(recettes.map((r) => [r.id, r]));

    return {
      menu,
      slots: slots.map((s) => ({
        ...s,
        recetteResolue: s.recette ? recettesMap[s.recette] : undefined,
      })),
    };
  }, []);
}
