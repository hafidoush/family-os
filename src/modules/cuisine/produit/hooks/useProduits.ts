import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../core/db/database';

export function useProduits(categorieId?: string) {
  const produits = useLiveQuery(
    () =>
      categorieId
        ? db.produits
            .filter((p) => {
              if (p.archive || p.deletedAt) return false;
              if (p.categorieIds?.length) return p.categorieIds.includes(categorieId);
              return p.categorie === categorieId;
            })
            .toArray()
        : db.produits
            .filter((p) => !p.archive && !p.deletedAt)
            .toArray(),
    [categorieId]
  );

  const categories = useLiveQuery(
    () => db.categoriesProduits.filter((c) => !c.deletedAt).sortBy('ordre'),
    []
  );

  const sorted = (produits ?? []).sort((a, b) =>
    (a.nom ?? "").localeCompare(b.nom ?? "", 'fr', { sensitivity: 'base' })
  );

  // Déduplication par nom — évite les doublons si le seed a tourné plusieurs fois
  const rawCats = categories ?? [];
  const seen = new Set<string>();
  const uniqueCategories = rawCats.filter(c => {
    if (seen.has(c.nom)) return false;
    seen.add(c.nom);
    return true;
  });

  return {
    produits: sorted,
    categories: uniqueCategories,
    isLoading: produits === undefined || categories === undefined,
  };
}
