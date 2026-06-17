import { type ReactNode, useEffect, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { db } from './core/db/database'
import { emit } from './core/automation/engine'
import { searchService } from './core/search/SearchService'
import { seedDatabase } from './core/db/seed'
import { useNotificationsStore } from './shared/stores/notificationsStore'
import { AuthProvider } from './core/auth/AuthContext'
import { useSyncOnMount } from './core/sync/useSyncOnMount'

// ─── DnD Backend detection (F-01 fix) ───────────────────────────────────────
// HTML5Backend for desktop, TouchBackend for iPhone/iPad
function useDnDBackend() {
  const isTouchDevice =
    typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
  return isTouchDevice ? TouchBackend : HTML5Backend
}

// ─── Purge soft-delete > 30 jours ────────────────────────────────────────────
async function purgeSoftDeletes() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  // Recettes et ingrédients exclus — trop précieux, jamais purger automatiquement
  const tables = [
    'taches', 'evenements', 'wishlistItems', 'humeurs', 'notes',
    'enveloppes', 'transactions', 'activites',
    'planificationsActivites', 'competences', 'elementsReligion',
    'menus', 'menuSlots', 'coursesItems',
    'projetsMaison', 'souvenirs', 'selfCareItems', 'pensees',
  ] as const;

  for (const table of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (db as any)[table];
    if (!t) continue;
    const expired = await t
      .filter((r: { deletedAt?: string }) => !!r.deletedAt && r.deletedAt < cutoff)
      .toArray();
    if (expired.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await t.bulkDelete(expired.map((r: any) => r.id));
    }
  }
}

// ─── DB initialisation ───────────────────────────────────────────────────────
function useDbInit() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function init() {
    try {
      await db.open()
      // A-42 — Initialisation des données par défaut au premier lancement
      await seedDatabase()
      // Trigger A-42 — seed default data on first launch
      await emit('app.first_launch', {})
      // Trigger A-13 — daily cleanliness degradation catch-up
      await emit('day.passed', {})
      // Bootstrap search index from persisted data
      await searchService.buildIndex(db)
      // Purge physique des enregistrements soft-deleted > 30 jours
      await purgeSoftDeletes()

        setReady(true)
      } catch (err) {
        console.error('[DB] Init error:', err)
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    }
    init()
  }, [])

  return { ready, error }
}

// ─── AppProviders ────────────────────────────────────────────────────────────
interface AppProvidersProps {
  children: ReactNode
}

const EXPORT_REMINDER_KEY = 'family_os_last_export_reminder';
const EXPORT_REMINDER_DAYS = 14;

function useExportReminder() {
  const { addToast } = useNotificationsStore();
  useEffect(() => {
    const last = localStorage.getItem(EXPORT_REMINDER_KEY);
    const lastMs = last ? parseInt(last, 10) : 0;
    const daysSince = (Date.now() - lastMs) / (1000 * 60 * 60 * 24);
    if (daysSince >= EXPORT_REMINDER_DAYS) {
      // Délai de 3s pour laisser l'app s'initialiser
      const t = setTimeout(() => {
        addToast({
          message: 'Pensez à exporter vos données dans Paramètres pour les sauvegarder.',
          type: 'info',
          duration: 8000,
        });
        localStorage.setItem(EXPORT_REMINDER_KEY, String(Date.now()));
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [addToast]);
}

function SyncBridge() {
  useSyncOnMount()
  return null
}

export function AppProviders({ children }: AppProvidersProps) {
  const backend = useDnDBackend()
  const { ready, error } = useDbInit()
  useExportReminder()

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: 'var(--color-bg)',
          flexDirection: 'column',
          gap: '12px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '32px' }}>⚠️</span>
        <p style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-body)', fontSize: '15px' }}>
          Impossible d'ouvrir la base de données.
        </p>
        <p style={{ color: 'var(--color-muted)', fontSize: '13px' }}>
          {error.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '8px',
            padding: '10px 24px',
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          Réessayer
        </button>
      </div>
    )
  }

  if (!ready) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: 'var(--color-bg)',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div className="loading-ring" />
        <span style={{ color: 'var(--color-muted)', fontSize: '14px', fontFamily: 'var(--font-body)' }}>
          Initialisation…
        </span>
      </div>
    )
  }

  return (
    <AuthProvider>
      <SyncBridge />
      <DndProvider backend={backend} options={{ enableMouseEvents: true }}>
        {children}
      </DndProvider>
    </AuthProvider>
  )
}
