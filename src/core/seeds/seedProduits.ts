/**
 * FAMILY OS — Seed Produits
 * src/core/db/seedProduits.ts
 *
 * ~120 produits courants pré-chargés au premier lancement.
 * Appelé depuis seedDatabase() dans seed.ts après seedCategoriesProduits().
 *
 * Les IDs de catégories sont récupérés dynamiquement par nom
 * car seedCategoriesProduits() génère des UUIDs aléatoires.
 */

import { db } from '@core/db/database';
import { normaliserNom } from '@core/produits/ProduitService';
import { newEntity } from '@core/db/helpers';
import type { Produit } from '@shared/types';

interface ProduitSeed {
  nom: string;
  unite?: string;
  marque?: string;
}

const PRODUITS_PAR_CATEGORIE: Record<string, ProduitSeed[]> = {
  Fruits: [
    { nom: 'Bananes', unite: 'kg' },
    { nom: 'Pommes', unite: 'kg' },
    { nom: 'Oranges', unite: 'kg' },
    { nom: 'Fraises', unite: 'barquette' },
    { nom: 'Raisins', unite: 'kg' },
    { nom: 'Poires', unite: 'kg' },
    { nom: 'Abricots', unite: 'kg' },
    { nom: 'Pêches', unite: 'kg' },
    { nom: 'Kiwis', unite: 'pièce(s)' },
    { nom: 'Citrons', unite: 'pièce(s)' },
    { nom: 'Pastèque', unite: 'pièce(s)' },
    { nom: 'Melon', unite: 'pièce(s)' },
  ],
  Légumes: [
    { nom: 'Carottes', unite: 'kg' },
    { nom: 'Pommes de terre', unite: 'kg' },
    { nom: 'Tomates', unite: 'kg' },
    { nom: 'Courgettes', unite: 'pièce(s)' },
    { nom: 'Poivrons', unite: 'pièce(s)' },
    { nom: 'Oignons', unite: 'kg' },
    { nom: 'Ail', unite: 'tête(s)' },
    { nom: 'Salade verte', unite: 'pièce(s)' },
    { nom: 'Épinards', unite: 'sachet(s)' },
    { nom: 'Brocolis', unite: 'pièce(s)' },
    { nom: 'Champignons', unite: 'barquette' },
    { nom: 'Concombre', unite: 'pièce(s)' },
    { nom: 'Poireaux', unite: 'pièce(s)' },
    { nom: 'Aubergine', unite: 'pièce(s)' },
  ],
  'Produits frais': [
    { nom: 'Lait demi-écrémé', unite: 'L' },
    { nom: 'Lait entier', unite: 'L' },
    { nom: 'Beurre', unite: 'g' },
    { nom: 'Crème fraîche', unite: 'ml' },
    { nom: 'Yaourt nature', unite: 'pièce(s)' },
    { nom: 'Yaourt aux fruits', unite: 'pièce(s)' },
    { nom: 'Œufs', unite: 'pièce(s)' },
    { nom: 'Fromage râpé', unite: 'g' },
    { nom: 'Emmental', unite: 'g' },
    { nom: 'Camembert', unite: 'pièce(s)' },
    { nom: 'Poulet entier', unite: 'kg' },
    { nom: 'Escalopes de poulet', unite: 'kg' },
    { nom: 'Steak haché', unite: 'g' },
    { nom: 'Poisson blanc', unite: 'g' },
    { nom: 'Saumon', unite: 'g' },
    { nom: 'Jus d\'orange frais', unite: 'L' },
  ],
  Épicerie: [
    { nom: 'Riz basmati', unite: 'kg' },
    { nom: 'Pâtes', unite: 'kg' },
    { nom: 'Spaghetti', unite: 'kg' },
    { nom: 'Farine de blé', unite: 'kg' },
    { nom: 'Sucre en poudre', unite: 'kg' },
    { nom: 'Sucre glace', unite: 'kg' },
    { nom: 'Sel', unite: 'g' },
    { nom: 'Poivre noir', unite: 'g' },
    { nom: 'Huile d\'olive', unite: 'ml' },
    { nom: 'Huile de tournesol', unite: 'ml' },
    { nom: 'Vinaigre', unite: 'ml' },
    { nom: 'Sauce tomate', unite: 'boîte(s)' },
    { nom: 'Concentré de tomates', unite: 'boîte(s)' },
    { nom: 'Pois chiches', unite: 'boîte(s)' },
    { nom: 'Lentilles', unite: 'g' },
    { nom: 'Thon en boîte', unite: 'boîte(s)' },
    { nom: 'Levure chimique', unite: 'sachet(s)' },
    { nom: 'Levure de boulanger', unite: 'sachet(s)' },
    { nom: 'Chocolat noir', unite: 'g' },
    { nom: 'Miel', unite: 'g' },
    { nom: 'Confiture', unite: 'pot(s)' },
    { nom: 'Semoule', unite: 'g' },
    { nom: 'Couscous', unite: 'g' },
  ],
  Surgelés: [
    { nom: 'Petits pois surgelés', unite: 'kg' },
    { nom: 'Épinards surgelés', unite: 'kg' },
    { nom: 'Frites surgelées', unite: 'kg' },
    { nom: 'Pizza surgelée', unite: 'pièce(s)' },
    { nom: 'Poisson pané surgelé', unite: 'pièce(s)' },
    { nom: 'Mélange légumes surgelés', unite: 'kg' },
    { nom: 'Glace vanille', unite: 'L' },
  ],
  Boissons: [
    { nom: 'Eau minérale', unite: 'L' },
    { nom: 'Eau pétillante', unite: 'L' },
    { nom: 'Jus de pomme', unite: 'L' },
    { nom: 'Jus de raisin', unite: 'L' },
    { nom: 'Jus d\'orange', unite: 'L' },
    { nom: 'Sirop de menthe', unite: 'ml' },
    { nom: 'Café moulu', unite: 'g' },
    { nom: 'Thé', unite: 'boîte(s)' },
    { nom: 'Lait de croissance', unite: 'L' },
  ],
  Bébé: [
    { nom: 'Couches taille 3', unite: 'paquet(s)' },
    { nom: 'Couches taille 4', unite: 'paquet(s)' },
    { nom: 'Couches taille 5', unite: 'paquet(s)' },
    { nom: 'Lingettes bébé', unite: 'paquet(s)' },
    { nom: 'Crème change bébé', unite: 'tube(s)' },
    { nom: 'Shampoing bébé', unite: 'flacon(s)' },
    { nom: 'Petits pots légumes', unite: 'pièce(s)' },
    { nom: 'Petits pots fruits', unite: 'pièce(s)' },
    { nom: 'Céréales bébé', unite: 'boîte(s)' },
  ],
  Hygiène: [
    { nom: 'Dentifrice', unite: 'tube(s)' },
    { nom: 'Brosse à dents', unite: 'pièce(s)' },
    { nom: 'Savon liquide', unite: 'flacon(s)' },
    { nom: 'Savon solide', unite: 'pièce(s)' },
    { nom: 'Shampoing', unite: 'flacon(s)' },
    { nom: 'Après-shampoing', unite: 'flacon(s)' },
    { nom: 'Gel douche', unite: 'flacon(s)' },
    { nom: 'Déodorant', unite: 'pièce(s)' },
    { nom: 'Papier toilette', unite: 'paquet(s)' },
    { nom: 'Mouchoirs', unite: 'boîte(s)' },
    { nom: 'Coton-tiges', unite: 'boîte(s)' },
    { nom: 'Serviettes hygiéniques', unite: 'paquet(s)' },
  ],
  Entretien: [
    { nom: 'Lessive liquide', unite: 'L' },
    { nom: 'Lessive capsules', unite: 'paquet(s)' },
    { nom: 'Adoucissant', unite: 'L' },
    { nom: 'Liquide vaisselle', unite: 'flacon(s)' },
    { nom: 'Pastilles lave-vaisselle', unite: 'paquet(s)' },
    { nom: 'Produit nettoyant WC', unite: 'flacon(s)' },
    { nom: 'Produit nettoyant salle de bain', unite: 'flacon(s)' },
    { nom: 'Spray multi-surfaces', unite: 'flacon(s)' },
    { nom: 'Sacs poubelle', unite: 'rouleau(x)' },
    { nom: 'Éponges', unite: 'paquet(s)' },
    { nom: 'Papier essuie-tout', unite: 'rouleau(x)' },
  ],
};

export async function seedProduits(): Promise<void> {
  // Récupérer les catégories par nom pour obtenir leurs IDs dynamiques
  const categories = await db.categoriesProduits.toArray();
  const catMap = new Map(categories.map((c: { nom: string; id: string }) => [c.nom, c.id]));

  const produits: Produit[] = [];

  for (const [nomCategorie, items] of Object.entries(PRODUITS_PAR_CATEGORIE)) {
    const categorieId = catMap.get(nomCategorie);
    if (!categorieId) {
      console.warn(`[seedProduits] Catégorie introuvable : ${nomCategorie}`);
      continue;
    }

    for (const item of items) {
      produits.push(
        newEntity<Produit>({
          nom: item.nom,
          nomNormalise: normaliserNom(item.nom),
          type: 'consommable',
          categorie: categorieId,
          categorieIds: [categorieId],
          unite: item.unite,
          marque: item.marque,
          frequenceAchat: 0,
          archive: false,
        })
      );
    }
  }

  await db.produits.bulkAdd(produits);
  console.log(`[FamilyOS] ${produits.length} produits initialisés.`);
}
