# Family OS — Architecture des dépendances

## Flux de données entre modules (événements d'automatisation)

```
cuisine/MenuService          → emit('menu.validated')         → A-01 génère courses
cuisine/CoursesService       → emit('courses_item.added')     → A-02 crée fiche produit
cuisine/CoursesService       → emit('courses_item.checked')   → A-04 met à jour stocks
cuisine/importRecetteIA      → emit('import_recette.validated')→ A-46 indexe la recette

enfants/SectionActivites     → emit('planification.status_changed') → A-12 met à jour statut activité
enfants/programmeService     → emit('activite_programme.realised')  → A-45 progression programme

maison/ProjetService         → emit('projet.completed')             → A-16 affiche wishlist pièce
maison/TacheService          → emit('tache.menage_completed')       → A-14 remonte score propreté
maison/TacheService          → emit('tache.projet_status_changed')  → A-15 calcule progression projet

dashboard/WidgetTodo         → emit('tache.completed_recurrent')    → A-29 régénère tâche
dashboard/WidgetTodo         → emit('tache.completed_nonrecurrent') → A-30 archive tâche
dashboard/HumeurSaisie       → emit('humeur.created')               → A-21 historique émotionnel
dashboard/ActiviteJourney    → emit('planification.status_changed') → A-12

budget/BudgetModule          → emit('transaction.created_or_modified') → A-24 recalcule enveloppe
achats/index                 → emit('wishlist_item.status_changed')    → A-23 crée transaction

providers (boot)             → emit('app.first_launch')  → A-42 seed données initiales
providers (boot)             → emit('day.passed')        → A-13 dégrade scores propreté
```

## Modules propriétaires de chaque donnée

| Donnée | Module propriétaire | Consommateurs |
|--------|--------------------|----|
| `recettes` | cuisine/ | dashboard (widget menu), enfants (recettes enfants) |
| `menuSlots` | cuisine/ | courses/ (via A-01), dashboard (widget menu) |
| `coursesItems` | cuisine/ | dashboard (widget courses) |
| `pieces` | maison/ | menage/, dashboard (widget ménage) |
| `taches` | transversal | dashboard, maison/, enfants/ |
| `membres` | famille/ | dashboard (tous les widgets), enfants/, nous/ |
| `enveloppes` | budget/ | achats/ (via A-23) |

## Règles critiques (casser = app inutilisable)

| Règle | Trigger | Risque si bug |
|-------|---------|--------------|
| A-01 | `menu.validated` | Liste de courses vide après validation menu |
| A-13 | `day.passed` | Scores propreté figés ou reset à 0 |
| A-14 | `tache.menage_completed` | Score pièce ne remonte jamais |
| A-24 | `transaction.created_or_modified` | Budget toujours à 0 |
| A-42 | `app.first_launch` | App vide au premier lancement |

## Points de fragilité identifiés

- `seed.ts` : contient à la fois la seed initiale ET 8 migrations de données.
  → Risque : une migration tourne à chaque démarrage (lent + risque de doublon).
  → À séparer : `seed.ts` (données initiales) + `migrations.ts` (migrations versionnées).

- `coursesItems` : A-01 suppose que `produit` est toujours renseigné dans `recettesIngredients`.
  → Si un ingrédient sans `produit` existe, A-01 silently skip. Pas de log, pas d'alerte.

- `day.passed` émis au boot (providers.tsx:62), pas via un vrai cron.
  → Si l'app n'est pas ouverte un jour, la dégradation saute ce jour.
