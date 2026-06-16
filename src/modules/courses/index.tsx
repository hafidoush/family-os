/**
 * FAMILY OS — Module Courses (catégorie principale)
 * Centralise : Liste de courses + Catalogue produits
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePersistedTab } from '../../shared/hooks/usePersistedTab'
import { CoursesModule } from '../cuisine/components/courses/CoursesModule'
import { CatalogueProduits } from '../cuisine/produit/components/CatalogueProduits'

type CoursesTab = 'liste' | 'produits'

const TABS: { key: CoursesTab; label: string }[] = [
  { key: 'liste',    label: 'Liste de courses' },
  { key: 'produits', label: 'Produits'         },
]

export default function CoursesPage() {
  const [activeTab, setActiveTab] = usePersistedTab<CoursesTab>('courses', 'liste')
  const location = useLocation()

  useEffect(() => {
    const state = location.state as { tab?: CoursesTab } | null
    if (state?.tab) setActiveTab(state.tab)
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ display: 'flex', gap: 4, padding: '12px 16px 0', borderBottom: '1px solid rgba(201,184,232,0.2)' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px 10px 0 0',
              border: 'none',
              background: activeTab === tab.key ? 'rgba(201,184,232,0.25)' : 'transparent',
              color: activeTab === tab.key ? '#7C5CBF' : '#9B8DB5',
              fontWeight: activeTab === tab.key ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, padding: '16px' }}>
        {activeTab === 'liste'    && <CoursesModule />}
        {activeTab === 'produits' && <CatalogueProduits />}
      </div>
    </div>
  )
}
