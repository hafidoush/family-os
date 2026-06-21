export type BatchCategorie = 'gouters_petitdej' | 'desserts' | 'repas'

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
