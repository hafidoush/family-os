# Module Enfants — Guide d'intégration

## Fichiers à placer dans le projet

Copier le dossier `src/modules/enfants/` dans ton projet tel quel.

---

## Dépendances

Toutes déjà dans le projet :
- `dexie-react-hooks` → `useLiveQuery`
- `zustand` → store local
- `src/core/db/database.ts` → `db`
- `src/core/db/helpers.ts` → `withAudit`, `withDevice`, `newEntity`
- `src/core/automation/engine.ts` → `emit`
- `src/shared/types/` → `Membre`, `Enfant`, `Activite`, `PlanificationActivite`, `Competence`, `CompetenceSuivi`

---

## Tables Dexie utilisées

| Table | Usage |
|---|---|
| `membres` | Profils Manel + Nawfel (seedés) |
| `enfants` | Données enfant liées au membre |
| `activites` | Catalogue d'activités |
| `planificationActivites` | Planning activités par enfant |
| `competences` | Catalogue compétences |
| `competenceSuivis` | Suivi progression par enfant |
| `elementReligions` | Suivi religion (sourates, prophètes, duaas, fondamentaux) |

### ⚠️ Table `elementReligions` — champs attendus

La table stocke le suivi religion avec cette structure :
```typescript
{
  id: string
  membreId: string       // 'membre-manel' | 'membre-nawfel'
  elementId: string      // ex: 'sourate-114', 'prophete-adam'...
  type: string           // 'sourate' | 'prophete' | 'duaa' | 'apprentissage'
  statuts: string[]      // ['raconte', 'etudie', 'memorise'] — combinaisons possibles
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
  deviceId?: string
}
```

Si le schéma Dexie actuel de `elementReligions` ne correspond pas, adapter `database.ts` :
```typescript
elementReligions: '++id, membreId, type, elementId, *statuts'
```

---

## Seed religion

Les données religion (sourates, prophètes, duaas, fondamentaux) sont définies dans :
`src/modules/enfants/religion/religionSeedData.ts`

Ces données sont **statiques côté front** — elles ne sont PAS seedées en base Dexie car elles sont lues directement depuis le fichier TS (pas besoin de les persister, elles ne changent pas). Seul le **suivi par enfant** (`elementReligions`) est en base.

Si tu veux les rendre éditables depuis l'UI à terme, il faudra les migrer en base et adapter le seed.

---

## Routing

Le placeholder `src/modules/enfants/index.tsx` est remplacé par ce composant. Aucune modification du router nécessaire car le lazy-load pointe déjà vers `index.tsx`.

---

## Ce qui reste à faire (hors scope Phase 3)

- [ ] Connecter `navigationStore` pour que le FAB (A-31) sache qu'on est dans le module Enfants
- [ ] Formulaire d'ajout d'activité au catalogue (actuellement seul le planning est géré)
- [ ] Détail complet d'un apprentissage fondamental (accordéon avec description complète)
- [ ] Export/partage des progrès religion (Phase 6)
