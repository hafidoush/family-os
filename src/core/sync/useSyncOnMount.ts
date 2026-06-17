import { useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { pullAll, installDexieHooks, startRealtime, stopRealtime } from './syncService'

export function useSyncOnMount() {
  const { session } = useAuth()

  useEffect(() => {
    if (!session) return

    installDexieHooks()
    pullAll()
    startRealtime()

    return () => stopRealtime()
  }, [session?.user.id])
}
