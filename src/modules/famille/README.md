# Famille — Complément : Saisie humeurs en réunion

## Fichiers livrés

```
famille_complement/
├── services/
│   └── reunionHumeurService.ts           ← NOUVEAU — à placer dans services/
├── components/reunions/
│   ├── HumeurReunionSheet.tsx            ← NOUVEAU — bottom sheet saisie
│   └── ReunionDetail.tsx                 ← REMPLACE l'existant (v2)
```

## Instructions d'intégration

### 1. Copier le service
```
src/modules/famille/services/reunionHumeurService.ts
```
(pas d'import à ajouter dans reunionService.ts — service indépendant)

### 2. Copier HumeurReunionSheet
```
src/modules/famille/components/reunions/HumeurReunionSheet.tsx
```

### 3. Remplacer ReunionDetail
```
src/modules/famille/components/reunions/ReunionDetail.tsx
```
Remplace entièrement le fichier livré dans le ZIP précédent.

---

## Ce que ça fait

### `reunionHumeurService.saisirHumeur(reunionId, membreId, valeur, note)`
- Crée une `Humeur` avec `source = 'reunion_famille'`
- **Idempotent** : si une humeur du même membre est déjà liée à cette réunion, elle est mise à jour (pas de doublon)
- Lie l'ID dans `ReunionFamille.humeursSaisies[]` via `withUpdate()`
- Respecte toutes les règles d'audit (`newEntity`, `withUpdate`)

### `HumeurReunionSheet`
- Bottom sheet avec saisie membre par membre
- Barre de progression `n/total saisies`
- Chaque membre voit son emoji humeur + note libre
- Modification possible après saisie initiale
- Fermeture automatique proposée quand tous ont répondu

### `ReunionDetail` (v2)
- Section Humeurs avec bouton **"Saisir / Modifier"**
- Barre de progression visible dans le détail
- Affiche les humeurs avec couleur par valeur
- Zone cliquable si aucune humeur saisie

---

## Règles invariantes respectées
- Zéro écriture Dexie dans les composants
- `newEntity()` / `withUpdate()` pour tous les champs d'audit
- `useLiveQuery` pour toutes les données réactives
- Soft-delete non applicable ici (les humeurs ne sont pas supprimables depuis ce contexte)
