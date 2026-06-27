/**
 * FAMILY OS — Détection automatique de catégorie produit
 * Partagé entre WidgetCapturePensee, pensees/index et tout autre module
 * qui ajoute des articles à la liste de courses.
 */

import { db } from '../../../core/db/database';

// Mapping produit → catégorie (ordre = priorité de détection)
export const CAT_MOTS: Array<{ nom: string; icone: string; mots: string[] }> = [
  { nom: 'Fruits',               icone: '🍎', mots: ['pomme', 'poire', 'banane', 'orange', 'citron', 'fraise', 'framboise', 'myrtille', 'raisin', 'melon', 'pasteque', 'mangue', 'kiwi', 'ananas', 'peche', 'abricot', 'prune', 'cerise', 'avocat', 'clementine', 'mandarine', 'pamplemousse', 'figue', 'grenade', 'litchi', 'noix', 'amande', 'noisette', 'datte', 'pruneaux', 'raisin sec', 'abricot sec', 'fruit'] },
  { nom: 'Légumes',              icone: '🥦', mots: ['tomate', 'courgette', 'poivron', 'carotte', 'salade', 'epinard', 'brocoli', 'pomme de terre', 'patate', 'oignon', 'ail', 'poireau', 'champignon', 'concombre', 'aubergine', 'radis', 'celeri', 'persil', 'menthe', 'coriandre', 'basilic', 'fenouil', 'navet', 'artichaut', 'asperge', 'endive', 'mache', 'roquette', 'betterave', 'mais frais', 'petit pois', 'haricot vert', 'chou', 'courge', 'potiron', 'butternut', 'echalote', 'legume'] },
  { nom: 'Viande & Charcuterie', icone: '🥩', mots: ['poulet', 'boeuf', 'porc', 'agneau', 'veau', 'dinde', 'lapin', 'saucisse', 'jambon', 'bacon', 'lardons', 'merguez', 'steak', 'cotelette', 'escalope', 'filet', 'viande', 'charcuterie', 'saucisson', 'roti', 'cuisse', 'blanc de poulet', 'aile', 'kebab', 'chipolata', 'boudin', 'chorizo', 'nuggets'] },
  { nom: 'Poissons',             icone: '🐟', mots: ['saumon', 'thon frais', 'cabillaud', 'truite', 'dorade', 'bar', 'crevette', 'moule', 'huitre', 'calamar', 'poulpe', 'anchois frais', 'sardine fraiche', 'maquereau', 'sole', 'merlan', 'lieu', 'colin', 'saint-jacques', 'homard', 'langouste', 'poisson frais', 'fruits de mer'] },
  { nom: 'Épicerie salée',       icone: '🫙', mots: ['pates', 'riz', 'farine', 'huile', 'vinaigre', 'moutarde', 'mayonnaise', 'ketchup', 'bouillon', 'levure', 'lentilles', 'pois chiches', 'haricots secs', 'sel', 'poivre', 'crackers', 'biscottes', 'semoule', 'quinoa', 'boulgour', 'polenta', 'chips', 'olives', 'cornichon', 'capres', 'pesto', 'tahin', 'harissa', 'concentre de tomate', 'tomates sechees', 'lait de coco', 'creme de coco', 'fecule', 'maizena', 'chapelure', 'lasagnes', 'spaghetti', 'tagliatelles'] },
  { nom: 'Épicerie sucrée',      icone: '🍫', mots: ['sucre', 'confiture', 'miel', 'chocolat', 'biscuit', 'gateau', 'compote', 'cereales', 'granola', 'nutella', 'pate a tartiner', 'bonbon', 'caramel', 'vanille', 'cacao', 'levure chimique', 'flan', 'confiserie', 'marshmallow', 'speculoos'] },
  { nom: 'Conserves',            icone: '🥫', mots: ['conserve', 'tomates pelees', 'mais en boite', 'thon en boite', 'sardines en boite', 'haricots verts en boite', 'petits pois en boite', 'champignons en boite', 'cassoulet', 'ratatouille en boite', 'ravioli en boite', 'soupe en boite'] },
  { nom: 'Surgelés',             icone: '🧊', mots: ['surgele', 'congele', 'pizza surgelee', 'frites surgelees', 'glace', 'sorbet', 'epinards surgeles', 'poisson pane', 'nuggets surgeles', 'wok surgele'] },
  { nom: 'Épices',               icone: '🌿', mots: ['cumin', 'curry', 'paprika', 'cannelle', 'gingembre en poudre', 'curcuma', 'thym', 'laurier', 'origan', 'romarin', 'estragon', 'piment', 'muscade', 'cardamome', 'anis', 'clou de girofle', 'ras el hanout', 'fenugrec', 'sumac', 'epice', 'herbes de provence'] },
  { nom: 'Asiatique',            icone: '🥢', mots: ['sauce soja', 'miso', 'sake', 'mirin', 'nouilles chinoises', 'ramen', 'udon', 'soba', 'nori', 'wasabi', 'tofu', 'edamame', 'shiitake', 'dashi', 'sriracha', 'sauce hoisin', 'sauce huitre', 'sauce poisson', 'citronnelle', 'sambal'] },
  { nom: 'Hygiène',              icone: '🧼', mots: ['savon', 'shampoing', 'gel douche', 'dentifrice', 'brosse a dents', 'deodorant', 'rasoir', 'coton', 'lingette', 'lotion', 'bain de bouche', 'fil dentaire', 'coton-tige', 'serviette hygienique', 'tampon', 'couche', 'baume', 'after-shave', 'hygiene'] },
  { nom: 'Entretien',            icone: '🧹', mots: ['lessive', 'liquide vaisselle', 'eponge', 'produit menager', 'nettoyant', 'desinfectant', 'javel', 'detartrant', 'assouplissant', 'pastille lave-vaisselle', 'torchon', 'serpillere', 'sac poubelle', 'film etirable', 'aluminium', 'papier cuisson', 'sopalin', 'essuie-tout', 'papier toilette', 'entretien'] },
  { nom: 'Produits Laitiers',    icone: '🥛', mots: ['lait', 'beurre', 'creme fraiche', 'creme liquide', 'creme entiere', 'creme allegee', 'fromage', 'camembert', 'brie', 'emmental', 'gruyere', 'mozzarella', 'feta', 'ricotta', 'mascarpone', 'kefir', 'yaourt', 'yogourt', 'fromage blanc', 'fromage frais', 'lait vegetal', "lait d'amande", 'lait de soja', "lait d'avoine", 'petit suisse', 'creme dessert'] },
  { nom: 'Boulangerie',          icone: '🍞', mots: ['pain', 'baguette', 'croissant', 'brioche', 'pain de mie', 'pain complet', 'pain aux cereales', 'pain de seigle', 'pain burger', 'viennoiserie', 'pain au chocolat', 'chausson', 'madeleine', 'financier', 'pain pita', 'naan', 'tortilla', 'wrap'] },
  { nom: 'Boissons',             icone: '🧃', mots: ['eau', 'jus de fruit', "jus d'orange", 'jus de pomme', 'nectar', 'sirop', 'soda', 'coca', 'limonade', 'cafe', 'the', 'tisane', 'infusion', 'chocolat chaud', 'smoothie', 'boisson', 'biere', 'vin', 'cidre', 'kombucha'] },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function detecterNomCategorie(nomProduit: string): { nom: string; icone: string } | null {
  const t = normalize(nomProduit)
  for (const { nom, icone, mots } of CAT_MOTS) {
    if (mots.some(m => t.includes(normalize(m)))) return { nom, icone }
  }
  return null
}

export async function resolverCategorieProduitId(nomProduit: string): Promise<string | undefined> {
  const cat = detecterNomCategorie(nomProduit)
  if (!cat) return undefined
  const existing = await db.categoriesProduits
    .filter(c => !c.deletedAt && c.nom === cat.nom)
    .toArray()
  if (existing[0]) return existing[0].id
  // Créer la catégorie si absente
  const { v4: uuid } = await import('uuid')
  const { newEntity } = await import('../../../core/db/helpers')
  const ordre = await db.categoriesProduits.count() + 1
  const id = uuid()
  await db.categoriesProduits.add({
    ...newEntity({ nom: cat.nom, icone: cat.icone, typeProduit: 'consommable', ordre, personnalisee: false }),
    id,
  })
  return id
}
