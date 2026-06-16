const NOCES: Record<number, string> = {
  1: 'Noces de coton', 2: 'Noces de papier', 3: 'Noces de cuir',
  4: 'Noces de cire', 5: 'Noces de bois', 6: 'Noces de bonbons',
  7: 'Noces de laine', 8: 'Noces de coquelicot', 9: 'Noces de faïence',
  10: "Noces d'étain", 11: 'Noces de corail', 12: 'Noces de soie',
  13: 'Noces de muguet', 14: 'Noces de plomb', 15: 'Noces de cristal',
  16: 'Noces de saphir', 17: 'Noces de rose', 18: 'Noces de turquoise',
  19: 'Noces de crêpe', 20: 'Noces de porcelaine', 25: "Noces d'argent",
  30: 'Noces de perle', 35: 'Noces de corail', 40: 'Noces de rubis',
  45: 'Noces de saphir', 50: "Noces d'or", 60: 'Noces de diamant',
}

export function getNocesLabel(anneesMariage: number): string {
  if (NOCES[anneesMariage]) return NOCES[anneesMariage]
  const clés = Object.keys(NOCES).map(Number).sort((a, b) => b - a)
  const proche = clés.find(k => k <= anneesMariage)
  return proche ? NOCES[proche] : 'Anniversaire de mariage'
}
