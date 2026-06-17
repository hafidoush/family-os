/**
 * FAMILY OS — Router
 * HashRouter est dans App.tsx (D-09).
 * Ce fichier exporte uniquement <Routes> — jamais de HashRouter ici.
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AppLayout from '../AppLayout'
import { useAuth } from '../core/auth/AuthContext'
import LoginPage from '../modules/auth/LoginPage'

// ── Lazy imports — chaque module est un chunk séparé ─────────────────────────
const Dashboard        = lazy(() => import('../modules/dashboard'))
const Cuisine          = lazy(() => import('../modules/cuisine'))
const Enfants          = lazy(() => import('../modules/enfants'))
const Myself           = lazy(() => import('../modules/myself'))
const Famille          = lazy(() => import('../modules/famille'))
const Calendrier       = lazy(() => import('../modules/calendrier'))
const Courses          = lazy(() => import('../modules/courses'))
const Menage           = lazy(() => import('../modules/menage'))
const MaisonDeco       = lazy(() => import('../modules/maison-deco'))
const Achats           = lazy(() => import('../modules/achats'))
const Budget           = lazy(() => import('../modules/budget'))
const Parametres       = lazy(() => import('../modules/parametres'))
// F1+F2 — Pensées
const Pensees          = lazy(() => import('../modules/pensees'))
// Hubs navigation
const Foyer            = lazy(() => import('../modules/foyer'))
const Nous             = lazy(() => import('../modules/nous'))
// Dashboard pages dédiées
const ActivitesDuJour  = lazy(() => import('../modules/dashboard/pages/ActivitesPlanifieesPage'))
const ProgrammeDuJour  = lazy(() => import('../modules/dashboard/pages/ProgrammeDuJourPage'))
const MenageDuJour     = lazy(() => import('../modules/dashboard/pages/MenageDuJourPage'))
const PagePartage      = lazy(() => import('../modules/partage/PagePartage'))

function ModuleFallback() {
  return (
    <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: i === 1 ? 120 : 72,
            borderRadius: 16,
            background: 'linear-gradient(90deg, rgba(201,184,232,0.18) 25%, rgba(201,184,232,0.32) 50%, rgba(201,184,232,0.18) 75%)',
            backgroundSize: '200% 100%',
            animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes skeleton-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

const S = (C: React.ComponentType) => (
  <Suspense fallback={<ModuleFallback />}><C /></Suspense>
)

/**
 * AppRouter — Routes uniquement.
 * Structure :
 *   /#/              → /#/dashboard
 *   /#/dashboard     → Dashboard
 *   /#/cuisine/*     → Cuisine
 *   /#/enfants/*     → Enfants
 *   /#/myself/*      → Myself
 *   /#/famille/*     → Famille (Membres · Réunions · Souvenirs)
 *   /#/calendrier/*  → Calendrier (ex-Planning de Famille)
 *   /#/courses/*     → Courses (Liste + Produits)
 *   /#/menage/*      → Ménage (ex-Maison)
 *   /#/maison-deco/* → Maison & Déco
 *   /#/maison/*      → redirect vers /menage
 *   /#/achats/*      → Achats
 *   /#/budget/*      → Budget
 *   /#/parametres/*  → Paramètres
 *   /#/pensees/*     → Pensées
 *   /#/*             → Dashboard (fallback)
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <LoginPage />
  return <>{children}</>
}

export function AppRouter() {
  return (
    <Routes>
      {/* Route publique — sans AppLayout, accessible par Élies sans compte */}
      <Route path="partage/:token" element={<Suspense fallback={<ModuleFallback />}><PagePartage /></Suspense>} />

      <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
        <Route index element={<Navigate to="/dashboard" replace />} />

        <Route path="dashboard"    element={S(Dashboard)}  />
        <Route path="cuisine/*"    element={S(Cuisine)}    />
        <Route path="enfants/*"    element={S(Enfants)}    />
        <Route path="myself/*"     element={S(Myself)}     />
        <Route path="famille/*"    element={S(Famille)}    />
        <Route path="calendrier/*" element={S(Calendrier)} />
        <Route path="courses/*"    element={S(Courses)}    />
        <Route path="menage/*"     element={S(Menage)}     />
        <Route path="maison-deco/*" element={S(MaisonDeco)} />
        <Route path="maison/*"     element={<Navigate to="/menage" replace />} />
        <Route path="achats/*"     element={S(Achats)}     />
        <Route path="budget/*"     element={S(Budget)}     />
        <Route path="parametres/*" element={S(Parametres)} />
        <Route path="pensees/*"         element={S(Pensees)}         />
        <Route path="foyer/*"           element={S(Foyer)}           />
        <Route path="nous/*"            element={S(Nous)}            />
        <Route path="activites-du-jour" element={S(ActivitesDuJour)} />
        <Route path="programme-du-jour" element={S(ProgrammeDuJour)} />
        <Route path="menage-du-jour"    element={S(MenageDuJour)}    />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
