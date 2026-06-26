/**
 * Hook partagé — sélection moteur Ménage pour aujourd'hui.
 *
 * Principe non négociable : la liste est calculée UNE SEULE FOIS par jour
 * (au premier accès) et stockée dans localStorage. Elle ne change plus
 * jusqu'au lendemain, même quand on coche des tâches.
 * Cela évite l'ajout automatique de tâches en cours de journée.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { selectTasksForToday, enrichTask } from '../engine/menageEngine'
import type { MenageMode, MenageTask } from '../engine/menageEngine'

export type { MenageMode, MenageTask }

interface DailySnapshot {
  date: string        // 'YYYY-MM-DD'
  taskIds: string[]
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function snapshotKey(mode: MenageMode): string {
  return `menage_snapshot_${mode}`
}

function loadSnapshot(mode: MenageMode): string[] | null {
  try {
    const raw = localStorage.getItem(snapshotKey(mode))
    if (!raw) return null
    const snap: DailySnapshot = JSON.parse(raw)
    return snap.date === todayStr() ? snap.taskIds : null
  } catch {
    return null
  }
}

function saveSnapshot(mode: MenageMode, taskIds: string[]): void {
  try {
    const snap: DailySnapshot = { date: todayStr(), taskIds }
    localStorage.setItem(snapshotKey(mode), JSON.stringify(snap))
  } catch {
    // localStorage plein ou indisponible — pas bloquant
  }
}

export function useTachesDuJourEngine(mode: MenageMode): MenageTask[] | undefined {
  return useLiveQuery(async () => {
    const today = new Date()

    const all = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison')
      .toArray()

    // Charger ou calculer la liste du jour (figée jusqu'à minuit)
    let taskIds = loadSnapshot(mode)
    if (!taskIds) {
      const engineTasks = selectTasksForToday(all, today, mode)
      taskIds = engineTasks.map(t => t.id)
      saveSnapshot(mode, taskIds)
    }

    // Récupérer l'état actuel (done/pas done) des tâches de la liste figée
    const taskMap = new Map(all.map(t => [t.id, t]))
    const tasks = taskIds
      .map(id => taskMap.get(id))
      .filter(Boolean as unknown as <T>(x: T | undefined) => x is T)

    return tasks.map(t => enrichTask(t, today))
  }, [mode])
}
