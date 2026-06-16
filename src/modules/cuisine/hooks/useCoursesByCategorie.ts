import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import type { CoursesItem, CategorieProduit } from '../../../shared/types';

export interface CoursesGroupe {
  categorie: CategorieProduit | null; // null = "Sans catégorie"
  items: CoursesItem[];
  nbCochés: number;
}

export function useCoursesByCategorie(): {
  groupes: CoursesGroupe[];
  isLoading: boolean;
} {
  const result = useLiveQuery(async () => {
    const [items, categories] = await Promise.all([
      db.coursesItems
        .filter(i => !i.archive && !i.deletedAt)
        .sortBy('nom'),
      db.categoriesProduits
        .filter(c => !c.deletedAt)
        .toArray(),
    ]);

    const catMap = new Map<string, CategorieProduit>(
      categories.map(c => [c.id, c])
    );

    // Grouper par categorieProduitId
    const groupMap = new Map<string | null, CoursesItem[]>();

    for (const item of items) {
      const key = item.categorieProduitId ?? null;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(item);
    }

    // Construire les groupes triés : catégories nommées d'abord (ordre alpha), puis "Sans catégorie"
    const groupes: CoursesGroupe[] = [];

    // Catégories connues, triées par nom
    const catIds = [...groupMap.keys()].filter(k => k !== null) as string[];
    catIds.sort((a, b) => {
      const catA = catMap.get(a)?.nom ?? a;
      const catB = catMap.get(b)?.nom ?? b;
      return catA.localeCompare(catB, 'fr');
    });

    for (const catId of catIds) {
      const items = groupMap.get(catId)!;
      groupes.push({
        categorie: catMap.get(catId) ?? null,
        items,
        nbCochés: items.filter(i => i.coche).length,
      });
    }

    // Sans catégorie en dernier
    if (groupMap.has(null)) {
      const items = groupMap.get(null)!;
      groupes.push({
        categorie: null,
        items,
        nbCochés: items.filter(i => i.coche).length,
      });
    }

    return groupes;
  }, [], [] as CoursesGroupe[]);

  return {
    groupes: result ?? [],
    isLoading: result === undefined,
  };
}
