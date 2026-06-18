import { useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { pullAll, installDexieHooks, startRealtime, stopRealtime, pushRecord, drainQueue } from './syncService'
import { db } from '../db/database'
import { v4 as uuid } from 'uuid'

// Push one-shot de toutes les activités seedées vers Supabase
// Garantit que les IDs stables sont connus de Supabase avant le pull
async function pushInitialActivites() {
  const CLE = 'activites_pushed_v1'
  const already = await db.parametresSync.where('cle').equals(CLE).first()
  if (already) return

  const activites = await db.activites.toArray()
  await Promise.all(activites.map(a => pushRecord('activites', a as unknown as Record<string, unknown>)))

  const now = new Date()
  await db.parametresSync.put({ id: uuid(), cle: CLE, valeur: 'true', derniereModification: now, createdAt: now, updatedAt: now })
}

export function useSyncOnMount() {
  const { session } = useAuth()

  useEffect(() => {
    if (!session) return

    installDexieHooks()

    // Démarrage : rejouer les pushes en attente puis faire un pull complet
    pushInitialActivites()
      .then(() => drainQueue())
      .then(() => pullAll())

    startRealtime()

    // Retour en ligne : rejouer la file + pull complet
    function handleOnline() {
      console.log('[sync] retour en ligne — drain + pull')
      drainQueue().then(() => pullAll())
    }
    window.addEventListener('online', handleOnline)

    // Pull périodique toutes les 5 minutes si l'app reste ouverte
    const interval = setInterval(() => {
      if (navigator.onLine) pullAll()
    }, 5 * 60 * 1000)

    return () => {
      stopRealtime()
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [session?.user.id])
}
