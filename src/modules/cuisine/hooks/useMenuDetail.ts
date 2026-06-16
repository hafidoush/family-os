/**
 * Retourne un menu + ses slots résolus avec recettes.
 * Réactif via useLiveQuery — se met à jour si un slot change.
 *
 * Slots retournés en deux groupes :
 *   - slotsLibres  : jour == undefined (recettes prévues sans jour)
 *   - slotsParJour : { lundi: [], mardi: [], ... } (recettes assignées)
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';
import type { JourMenu } from '@shared/types';

const JOURS_ORDRE: JourMenu[] = [
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
];

export function useMenuDetail(menuId: string | undefined) {
  return useLiveQuery(async () => {
    if (!menuId) return null;

    const menu = await db.menus.get(menuId);
    if (!menu || menu.archive) return null;

    const slots = await db.menuSlots
      .where('menu')
      .equals(menuId)
      .filter((s) => !s.archive && !s.deletedAt)
      .toArray();

    const recetteIds = [...new Set(slots.map((s) => s.recette).filter(Boolean) as string[])];
    const recettes = recetteIds.length
      ? await db.recettes.where('id').anyOf(recetteIds).toArray()
      : [];
    const recettesMap = Object.fromEntries(recettes.map((r) => [r.id, r]));

    const slotsResolus = slots.map((s) => ({
      ...s,
      recetteResolue: s.recette ? recettesMap[s.recette] : undefined,
    }));

    // Slots libres (sans jour assigné)
    const slotsLibres = slotsResolus.filter((s) => !s.jour);

    // Slots groupés par jour
    const slotsParJour = Object.fromEntries(
      JOURS_ORDRE.map((jour) => [
        jour,
        slotsResolus.filter((s) => s.jour === jour),
      ])
    ) as Record<JourMenu, typeof slotsResolus>;

    return { menu, slotsLibres, slotsParJour, tousLesSlots: slotsResolus };
  }, [menuId]);
}
