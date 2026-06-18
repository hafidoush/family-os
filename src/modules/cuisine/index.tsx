import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { usePersistedTab } from '../../shared/hooks/usePersistedTab'
import { RecettesList } from './components/recettes/RecettesList'
import { RecetteDetail } from './components/recettes/RecetteDetail'
import { RecetteForm } from './components/recettes/RecetteForm'
import { MenusModule } from './components/menus/MenusModule'
import { SweetBatch } from './components/preparation/SweetBatch'
import './Cuisine.css'

type CuisineTab = 'recettes' | 'menus' | 'batch'

type CuisineView =
  | { type: 'list' }
  | { type: 'detail'; id: string }
  | { type: 'form'; id?: string }

export default function Cuisine() {
  const location = useLocation()
  const [activeTab, setActiveTab] = usePersistedTab<CuisineTab>('cuisine-v2', 'recettes')
  const [view, setView] = useState<CuisineView>({ type: 'list' })

  // Ouverture directe d'une recette depuis le dashboard (state.openRecette)
  useEffect(() => {
    const state = location.state as { openRecette?: string } | null
    if (state?.openRecette) {
      setActiveTab('recettes' as CuisineTab)
      setView({ type: 'detail', id: state.openRecette })
      // Nettoyer le state pour éviter de re-ouvrir au prochain render
      window.history.replaceState({}, '')
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  const TABS: { key: CuisineTab; label: string }[] = [
    { key: 'recettes', label: 'Recettes'      },
    { key: 'menus',    label: 'Menus'         },
    { key: 'batch',    label: 'Batch Cooking' },
  ]

  const goToList   = ()           => setView({ type: 'list' })
  const goToDetail = (id: string) => setView({ type: 'detail', id })
  const goToCreate = ()           => setView({ type: 'form' })
  const goToEdit   = (id: string) => setView({ type: 'form', id })
  const handleSave = (id: string) => goToDetail(id)

  const handleTabChange = (tab: CuisineTab) => {
    setActiveTab(tab)
    setView({ type: 'list' })
  }

  // ── Swipe horizontal entre tabs ──────────────────────────────────────────────
  const TAB_ORDER: CuisineTab[] = ['recettes', 'menus', 'batch']
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || view.type !== 'list') return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(deltaX) < 60) return // seuil minimum
    const currentIdx = TAB_ORDER.indexOf(activeTab)
    if (deltaX < 0 && currentIdx < TAB_ORDER.length - 1) {
      handleTabChange(TAB_ORDER[currentIdx + 1])
    } else if (deltaX > 0 && currentIdx > 0) {
      handleTabChange(TAB_ORDER[currentIdx - 1])
    }
  }, [activeTab, view.type]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderBackBar = (label: string, onBack: () => void) => (
    <div className="cuisine-module__back-bar">
      <button className="cuisine-module__back" onClick={onBack}>
        ← {label}
      </button>
    </div>
  )

  const renderRecettes = () => {
    if (view.type === 'detail') {
      return (
        <>
          {renderBackBar('Recettes', goToList)}
          <div className="cuisine-module__content">
            <RecetteDetail recetteId={view.id} onBack={goToList} onEdit={goToEdit} />
          </div>
        </>
      )
    }
    if (view.type === 'form') {
      return (
        <>
          {renderBackBar(view.id ? 'Recette' : 'Recettes', () =>
            view.id ? goToDetail(view.id) : goToList()
          )}
          <div className="cuisine-module__content cuisine-module__content--form">
            <RecetteForm
              recetteId={view.id}
              onSave={handleSave}
              onCancel={() => (view.id ? goToDetail(view.id) : goToList())}
            />
          </div>
        </>
      )
    }
    return (
      <>
        <button className="cuisine-module__fab" onClick={goToCreate} aria-label="Nouvelle recette">+</button>
        <div className="cuisine-module__content">
          <RecettesList onSelectRecette={goToDetail} onCreateRecette={goToCreate} />
        </div>
      </>
    )
  }

  return (
    <div
      className="cuisine-module"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {view.type !== 'form' && (
        <nav className="cuisine-module__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`cuisine-module__tab ${activeTab === tab.key ? 'cuisine-module__tab--active' : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {activeTab === 'recettes' && renderRecettes()}
      {activeTab === 'menus'    && <div className="cuisine-module__content"><MenusModule /></div>}
      {activeTab === 'batch'    && <div className="cuisine-module__content"><SweetBatch /></div>}
    </div>
  )
}
