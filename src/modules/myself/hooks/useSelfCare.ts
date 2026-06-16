import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import type { SelfCareItem } from '../../../shared/types';

export function useSelfCare() {
  const items = useLiveQuery(
    () => db.selfCareItems.filter((s) => !s.deletedAt).toArray(),
    []
  );
  return { items: items ?? [], isLoading: items === undefined };
}

export function useSelfCareByType() {
  const { items, isLoading } = useSelfCare();
  const grouped = new Map<string, SelfCareItem[]>();
  for (const item of items) {
    const key = item.type;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  return { grouped, isLoading };
}
