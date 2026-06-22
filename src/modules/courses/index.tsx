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
      <nav style={{
        display: 'flex',
        gap: 0,
        background: '#F7F6F4',
        borderRadius: 999,
        margin: '12px 16px 0',
        padding: 4,
        flexShrink: 0,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '9px 8px',
              borderRadius: 999,
              border: 'none',
              background: activeTab === tab.key ? '#D2ADEB' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#A9A6B8',
              fontWeight: activeTab === tab.key ? 600 : 500,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.18s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, padding: '16px', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'liste'    && <CoursesModule />}
        {activeTab === 'produits' && <CatalogueProduits />}
      </div>
    </div>
  )
}
