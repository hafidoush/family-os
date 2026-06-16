import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import type { CoursesItem } from '../../../shared/types';

export interface UseCourseResult {
  items: CoursesItem[];
  itemsActifs: CoursesItem[];
  itemsCochés: CoursesItem[];
  itemsNonCochés: CoursesItem[];
  nbTotal: number;
  nbCochés: number;
  isLoading: boolean;
}

export function useCourses(): UseCourseResult {
  const items = useLiveQuery(
    () =>
      db.coursesItems
        .filter(i => !i.archive && !i.deletedAt)
        .sortBy('nom'),
    [],
    [] as CoursesItem[]
  );

  const isLoading = items === undefined;
  const safeItems = items ?? [];

  const itemsNonCochés = safeItems.filter(i => !i.coche);
  const itemsCochés = safeItems.filter(i => i.coche);

  return {
    items: safeItems,
    itemsActifs: safeItems,
    itemsCochés,
    itemsNonCochés,
    nbTotal: safeItems.length,
    nbCochés: itemsCochés.length,
    isLoading,
  };
}
