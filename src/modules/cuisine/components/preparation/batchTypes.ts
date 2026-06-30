export type BatchCategorie = 'gouters_petitdej' | 'desserts' | 'repas'

// IDs de catégories Dexie (seed.ts) — utilisés pour le filtre étendu
export const CAT_IDS_GOUTER    = ['cat-recette-gouter', 'cat-recette-petit-dejeuner']
export const CAT_IDS_DESSERT   = ['cat-recette-dessert']
export const CAT_IDS_REPAS     = ['cat-recette-plat-principal', 'cat-recette-soupe', 'cat-recette-entree', 'cat-recette-sauce', 'cat-recette-legumes-accompagnement']
export const CAT_IDS_NON_REPAS = [...CAT_IDS_GOUTER, ...CAT_IDS_DESSERT]

export function matchesBatchCategorie(
  r: { typePreparation?: string | null; categorie: string; archive?: boolean; deletedAt?: Date | string | null },
  categorie: BatchCategorie
): boolean {
  if (r.archive || r.deletedAt) return false
  const types = typesForCategorie(categorie)
  if (categorie === 'gouters_petitdej') {
    return types.includes(r.typePreparation as string | undefined | null) || CAT_IDS_GOUTER.includes(r.categorie)
  }
  if (categorie === 'desserts') {
    return r.typePreparation === 'dessert' || CAT_IDS_DESSERT.includes(r.categorie)
  }
  // repas
  return (
    r.typePreparation === 'plat' ||
    CAT_IDS_REPAS.includes(r.categorie) ||
    (r.typePreparation == null && !CAT_IDS_NON_REPAS.includes(r.categorie))
  )
}

export const BATCH_CATEGORIES: {
  key: BatchCategorie
  label: string
  labelKids: string
  emoji: string
  description: string
  descriptionKids: string
}[] = [
  {
    key: 'gouters_petitdej',
    label: "Goûters & Petits-déj'",
    labelKids: 'Goûters & petits-dej',
    emoji: '🥐',
    description: 'Goûters, snacks et petits-déjeuners maison',
    descriptionKids: 'Choisis tes goûters et petits-dej pour la semaine',
  },
  {
    key: 'desserts',
    label: 'Desserts',
    labelKids: 'Desserts',
    emoji: '🍮',
    description: 'Gâteaux, tartes, crèmes et douceurs',
    descriptionKids: 'Choisis tes desserts préférés',
  },
  {
    key: 'repas',
    label: 'Repas',
    labelKids: 'Repas',
    emoji: '🍲',
    description: 'Plats principaux pour la semaine',
    descriptionKids: 'Choisis les plats que tu veux manger cette semaine',
  },
]

export function typesForCategorie(cat: BatchCategorie): Array<string | undefined | null> {
  if (cat === 'gouters_petitdej') return ['gouter', 'petit_dejeuner', 'snack']
  if (cat === 'desserts') return ['dessert']
  return ['plat', undefined, null]
}

export function labelForCategorie(cat: BatchCategorie, kids = false): string {
  return BATCH_CATEGORIES.find(c => c.key === cat)?.[kids ? 'labelKids' : 'label'] ?? cat
}
