import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';
import { toISODate } from '@shared/utils/formatDate';
import type { JourMenu } from '@shared/types';

const JOURS: JourMenu[] = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function useDinerAujourdhui() {
  return useLiveQuery(async () => {
    const today = toISODate(new Date());
    const heure = new Date().getHours();
    const jourAujourdhui = JOURS[new Date().getDay()];

    const menu = await db.menus
      .filter(
        (m) =>
          !m.archive &&
          !m.deletedAt &&
          m.dateDebut <= today &&
          m.dateFin != null &&
          m.dateFin >= today
      )
      .first();

    if (!menu) return { diner: null, menu: null, slots: [], jourAujourdhui, heure };

    const slots = await db.menuSlots
      .where('menu')
      .equals(menu.id)
      .filter((s) => !s.archive && !s.deletedAt)
      .toArray();

    const dinerSlot = slots.find((s) => s.jour === jourAujourdhui && s.repas === 'diner');
    const recette = dinerSlot?.recette
      ? await db.recettes.get(dinerSlot.recette)
      : undefined;

    return {
      diner: dinerSlot ? { ...dinerSlot, recetteResolue: recette } : null,
      menu,
      slots,
      jourAujourdhui,
      heure,
    };
  }, []);
}
