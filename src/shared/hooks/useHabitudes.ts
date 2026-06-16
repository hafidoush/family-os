/**
 * FAMILY OS — useHabitudes
 *
 * Lecture et écriture du profil d'habitudes utilisateur.
 * Stocké dans parametresSync sous la clé 'habitudes' (JSON).
 * Fonctionne entièrement hors ligne via Dexie.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback } from 'react'
import { db } from '../../core/db/database'
import { newEntity, withUpdate } from '../../core/db/helpers'
import type { Habitudes, ParametreSync } from '../types'

const CLE = 'habitudes'

// ─── Lecture ─────────────────────────────────────────────────────────────────

export function useHabitudes(): Habitudes {
  const raw = useLiveQuery(
    () => db.parametresSync.where('cle').equals(CLE).first(),
    []
  )
  if (!raw?.valeur) return {}
  try { return JSON.parse(raw.valeur) as Habitudes }
  catch { return {} }
}

// ─── Lecture + écriture ───────────────────────────────────────────────────────

export function useHabitudesEditable(): {
  habitudes: Habitudes
  save: (patch: Partial<Habitudes>) => Promise<void>
} {
  const raw = useLiveQuery(
    () => db.parametresSync.where('cle').equals(CLE).first(),
    []
  )

  const habitudes: Habitudes = (() => {
    if (!raw?.valeur) return {}
    try { return JSON.parse(raw.valeur) as Habitudes }
    catch { return {} }
  })()

  const save = useCallback(async (patch: Partial<Habitudes>) => {
    const merged = { ...habitudes, ...patch }
    const valeur = JSON.stringify(merged)
    const existing = await db.parametresSync.where('cle').equals(CLE).first()
    if (existing) {
      await db.parametresSync.update(existing.id, withUpdate<ParametreSync>({
        valeur,
        derniereModification: new Date(),
      }))
    } else {
      await db.parametresSync.add(newEntity<ParametreSync>({
        cle: CLE,
        valeur,
        derniereModification: new Date(),
      }))
    }
  }, [habitudes])

  return { habitudes, save }
}
