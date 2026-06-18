/**
 * FAMILY OS — useActivitesPlacer
 * Retourne les activités du programme actif de la semaine courante (+ semaine passée)
 * qui n'ont pas encore de date planifiée.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import type { ActiviteProgramme } from '../../../shared/types';

function semaineEnCours(dateDebut: string, today = new Date()): number {
  const debut = new Date(dateDebut);
  const diff = Math.floor((today.getTime() - debut.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

export type ActiviteAPlacer = ActiviteProgramme & {
  semainePasse: boolean;
  programmeNom: string;
};

export function useActivitesPlacer(): ActiviteAPlacer[] {
  return useLiveQuery(async () => {
    const programmes = await db.programmesPedagogiques
      .where('statut').equals('actif')
      .filter(p => !p.archive && !p.deletedAt)
      .toArray();

    if (programmes.length === 0) return [];

    const result: ActiviteAPlacer[] = [];

    for (const prog of programmes) {
      const semaineCourante = semaineEnCours(prog.dateDebut);
      const semainePrec = semaineCourante - 1;

      const activites = await db.activitesProgramme
        .where('programmeId').equals(prog.id)
        .filter(a =>
          !a.archive &&
          !a.deletedAt &&
          !a.datePlanifiee &&
          a.statutRealisation !== 'realise' &&
          a.statutRealisation !== 'saute' &&
          (a.semaineNumero === semaineCourante || (semainePrec >= 1 && a.semaineNumero === semainePrec))
        )
        .toArray();

      for (const a of activites) {
        result.push({
          ...a,
          semainePasse: a.semaineNumero === semainePrec,
          programmeNom: prog.titre,
        });
      }
    }

    return result.sort((a, b) => {
      if (a.semainePasse !== b.semainePasse) return a.semainePasse ? 1 : -1;
      return a.ordre - b.ordre;
    });
  }, [], []) ?? [];
}
