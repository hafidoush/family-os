# FAMILY OS — Conventions de développement

## 1. Nommage des champs d'entité

**Règle absolue : camelCase partout dans le code TypeScript/Dexie.**

Le Data Model v2 utilise snake_case comme référence fonctionnelle (documentation).
Le code TypeScript et IndexedDB utilisent camelCase.

| Data Model v2 (référence doc) | Code TypeScript / Dexie |
|-------------------------------|-------------------------|
| `updated_at`                  | `updatedAt`             |
| `created_at`                  | `createdAt`             |
| `deleted_at`                  | `deletedAt`             |
| `device_id`                   | `deviceId`              |
| `module_origine`              | `moduleOrigine`         |
| `date_début`                  | `dateDebut`             |
| `taux_dégradation`            | `tauxDegradation`       |

Les snapshots JSON exportés utilisent également **camelCase**.
Cette convention est obligatoire pour que Last-Write-Wins (A-38) fonctionne correctement :
comparer `snapshot.entity.updatedAt` avec `local.entity.updatedAt` — même clé, même casse.

## 2. Champs d'audit automatiques

Les champs `createdAt`, `updatedAt`, `deletedAt`, `deviceId` sont injectés
automatiquement par les helpers `withAudit()` et `withDevice()` dans `src/core/db/helpers.ts`.
**Ne jamais les renseigner manuellement dans un service ou composant.**

## 3. Soft delete

**Aucun appel `db.table.delete(id)` direct** dans le code applicatif.
Toute suppression passe par `softDelete()` qui positionne `archive = true` et `deletedAt = now`.

## 4. Valeurs calculées

Les champs `montantDepense`, `montantRestant`, `progression`, `scoreProprety` ne sont
**jamais stockés comme valeurs fixes** dans Dexie. Ils sont calculés à la volée via
`useLiveQuery` depuis les données sources. (Décision D-03)

## 5. Imports cross-modules

**Interdit.** Un module ne peut importer que depuis `@core` et `@shared`.
Les données partagées transitent par Dexie ou les Zustand stores globaux.

## 6. A-28 — Rappels iOS

Les rappels via Service Worker sur iOS ne se déclenchent **que si l'app est au premier plan**.
Afficher systématiquement un badge "Rappels limités sur iPhone" dans les Paramètres > Notifications.
Ne pas promettre des rappels fiables dans les copies UI.

## 7. Limitation des blobs dans les snapshots

Par défaut, les exports snapshot **excluent les Blobs** (photos de recettes, produits, souvenirs).
Les entités importées sans blob affichent un `<ImagePlaceholder />` (composant dédié).
Un mode "export complet avec médias" est prévu en phase 2.
