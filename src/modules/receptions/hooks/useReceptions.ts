import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'

export function useProchainEvenements(limit = 10) {
  return useLiveQuery(async () => {
    const now = new Date()
    const all = await db.evenements
      .filter(e => !e.archive && !e.deletedAt && new Date(e.dateDebut) >= now)
      .toArray()
    return all
      .sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime())
      .slice(0, limit)
  }, [])
}

export function useEvenementDetail(evenementId: string | null) {
  return useLiveQuery(
    () => evenementId ? db.evenementsDetails.get(evenementId) : undefined,
    [evenementId],
  )
}

export function useAllEvenements() {
  return useLiveQuery(async () => {
    const now = new Date()
    const passee = new Date(now)
    passee.setDate(passee.getDate() - 30)

    const all = await db.evenements
      .filter(e => !e.archive && !e.deletedAt && new Date(e.dateDebut) >= passee)
      .toArray()
    return all.sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime())
  }, [])
}

export function useRecettes() {
  return useLiveQuery(() =>
    db.recettes.filter(r => !r.archive).toArray(), []
  )
}
