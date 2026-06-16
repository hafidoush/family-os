/**
 * FAMILY OS — Service Préparation Pédagogique
 * Agrège les tâches de préparation de tous les programmes actifs
 * pour alimenter la vue "À préparer cette semaine".
 */

import { db } from '../../../../core/db/database'
import { withUpdate } from '../../../../core/db/helpers'
import type { TachePreparation, ItemMateriel } from '../../../../shared/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TachePreparationEnrichie extends TachePreparation {
  programmeId: string
  programmeTitre: string
  semaineNumero: number
  semaineTitre: string
}

export interface MaterielManquant extends ItemMateriel {
  programmeId: string
  programmeTitre: string
  activiteTitre: string
  activiteId: string
  semaineNumero: number
}

export interface BilanPreparation {
  urgentes: TachePreparationEnrichie[]
  cetteSemaine: TachePreparationEnrichie[]
  prochaineSemaine: TachePreparationEnrichie[]
  materielAcheter: MaterielManquant[]
}

// ─── Calcul de la semaine courante ───────────────────────────────────────────

function semaineEnCours(dateDebut: string, today = new Date()): number {
  const debut = new Date(dateDebut)
  const diff = Math.floor((today.getTime() - debut.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return Math.max(1, diff + 1)
}

// ─── Agrégation principale ───────────────────────────────────────────────────

export async function getPreparationSemaine(): Promise<BilanPreparation> {
  const programmes = await db.programmesPedagogiques
    .where('statut').equals('actif')
    .filter(p => !p.archive)
    .toArray()

  const toutesLesTaches: TachePreparationEnrichie[] = []
  const toutLeMateriel: MaterielManquant[] = []

  for (const programme of programmes) {
    const semaineCourante = semaineEnCours(programme.dateDebut)
    // On s'intéresse à la semaine courante et la suivante
    const semainesAnticiiper = programme.semaines.filter(
      s => s.numero === semaineCourante || s.numero === semaineCourante + 1
    )

    for (const semaine of semainesAnticiiper) {
      const tachesNonFaites = semaine.tachesPreparation.filter(t => !t.faite)
      toutesLesTaches.push(
        ...tachesNonFaites.map(t => ({
          ...t,
          programmeId: programme.id,
          programmeTitre: programme.titre,
          semaineNumero: semaine.numero,
          semaineTitre: semaine.titre,
        }))
      )

      // Matériel à acheter pour les activités de cette semaine
      const activiteIds = semaine.activiteIds
      if (activiteIds.length > 0) {
        const activites = await db.activitesProgramme
          .where('id').anyOf(activiteIds)
          .filter(a => !a.archive && a.statutRealisation === 'a_faire')
          .toArray()

        for (const activite of activites) {
          const items = activite.materielNecessaire.filter(m => m.aAcheter)
          toutLeMateriel.push(
            ...items.map(m => ({
              ...m,
              programmeId: programme.id,
              programmeTitre: programme.titre,
              activiteTitre: activite.titre,
              activiteId: activite.id,
              semaineNumero: semaine.numero,
            }))
          )
        }
      }
    }
  }

  return {
    urgentes:         toutesLesTaches.filter(t => t.urgence === 'immediate'),
    cetteSemaine:     toutesLesTaches.filter(t => t.urgence === 'cette_semaine'),
    prochaineSemaine: toutesLesTaches.filter(t => t.urgence === 'prochaine_semaine'),
    materielAcheter:  toutLeMateriel,
  }
}

// ─── Export matériel vers liste de courses ────────────────────────────────────

export async function exporterMaterielVersCourses(items: MaterielManquant[]): Promise<void> {
  const { newEntity } = await import('../../../../core/db/helpers')

  for (const item of items) {
    // Éviter les doublons : vérifier si déjà dans les courses non cochées
    if (item.produitId) {
      const existant = await db.coursesItems
        .where('produit').equals(item.produitId)
        .filter(c => !c.coche && !(c.archive))
        .first()
      if (existant) continue
    }

    const coursesItem = newEntity({
      produit: item.produitId ?? '',
      nom: item.nom,
      quantite: undefined,
      unite: item.quantite ?? undefined,
      coche: false,
      source: 'programme' as const,
      dateAjout: new Date(),
    })
    await db.coursesItems.add(coursesItem as Parameters<typeof db.coursesItems.add>[0])
  }
}

// ─── Marquer une tâche de préparation comme faite depuis le bilan ─────────────

export async function marquerTacheFaiteDepuisBilan(
  programmeId: string,
  semaineNumero: number,
  tacheId: string,
): Promise<void> {
  const programme = await db.programmesPedagogiques.get(programmeId)
  if (!programme) return
  const semaines = programme.semaines.map(s => {
    if (s.numero !== semaineNumero) return s
    return {
      ...s,
      tachesPreparation: s.tachesPreparation.map(t =>
        t.id === tacheId ? { ...t, faite: true } : t
      ),
    }
  })
  await db.programmesPedagogiques.update(programmeId, withUpdate({ semaines }))
}
