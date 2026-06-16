import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';

// Charge tous les membres avec le rôle 'enfant' — dynamique, sans IDs hardcodés
export function useEnfants() {
  const membres = useLiveQuery(
    () => db.membres
      .where('role').equals('enfant')
      .filter((m) => m.actif)
      .toArray(),
    []
  );

  const enfants = useLiveQuery(
    async () => {
      const ids = (await db.membres.where('role').equals('enfant').filter((m) => m.actif).toArray()).map((m) => m.id);
      if (ids.length === 0) return [];
      return db.enfants.where('membreId').anyOf(ids).toArray();
    },
    []
  );

  return {
    membres: membres ?? [],
    enfants: enfants ?? [],
    isLoading: membres === undefined || enfants === undefined,
  };
}

// Charge les données d'un enfant spécifique
export function useEnfant(membreId: string | null) {
  const membre = useLiveQuery(
    () => membreId ? db.membres.get(membreId) : undefined,
    [membreId]
  );

  const enfant = useLiveQuery(
    () => membreId
      ? db.enfants.where('membreId').equals(membreId).first()
      : undefined,
    [membreId]
  );

  return {
    membre: membre ?? null,
    enfant: enfant ?? null,
    isLoading: membre === undefined,
  };
}
