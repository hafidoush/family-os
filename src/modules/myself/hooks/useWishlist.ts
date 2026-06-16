import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';

export function useWishlistMyself() {
  const items = useLiveQuery(
    () => db.wishlistItems
      .where('contexte').equals('myself')
      .filter((w) => !w.deletedAt)
      .toArray(),
    []
  );
  return { items: items ?? [], isLoading: items === undefined };
}
