import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePersistedTab } from '../../shared/hooks/usePersistedTab'
import { RecettesList } from './components/recettes/RecettesList'
import { RecetteDetail } from './components/recettes/RecetteDetail'
import { RecetteForm } from './components/recettes/RecetteForm'
import { MenusModule } from './components/menus/MenusModule'
import { SweetBatch } from './components/preparation/SweetBatch'
import { DinerHeader } from './components/DinerHeader'
import './Cuisine.css'
import './components/DinerHeader.css'

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
      window.history.replaceState({}, '')
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  // Intercepte le bouton retour browser quand on est en vue détail
  // pour rester dans /cuisine au lieu de partir vers la route précédente
  useEffect(() => {
    if (view.type !== 'detail') return
    window.history.pushState({ cuisineInternal: true }, '')
    const handlePop = () => setView({ type: 'list' })
    window.addEventListener('popstate', handlePop)
    return () => {
      window.removeEventListener('popstate', handlePop)
    }
  }, [view.type]) // eslint-disable-line react-hooks/exhaustive-deps

  const TABS: { key: CuisineTab; label: string }[] = [
    { key: 'recettes', label: 'Recettes'      },
    { key: 'menus',    label: 'Menus'         },
    { key: 'batch',    label: 'Batch Cooking' },
  ]

  // Retour depuis le bouton "← Recettes" dans la barre de navigation interne
  const goToList   = ()           => {
    if (view.type === 'detail') {
      window.history.back() // consomme l'entrée fantôme → popstate → setView(list)
    } else {
      setView({ type: 'list' })
    }
  }
  const goToDetail = (id: string) => setView({ type: 'detail', id })
  const goToCreate = ()           => setView({ type: 'form' })
  const goToEdit   = (id: string) => setView({ type: 'form', id })
  const handleSave = (id: string) => setView({ type: 'detail', id })

  const handleTabChange = (tab: CuisineTab) => {
    setActiveTab(tab)
    if (view.type === 'detail') {
      // consomme l'entrée fantôme puis change de tab
      const onPop = () => { setView({ type: 'list' }); window.removeEventListener('popstate', onPop) }
      window.addEventListener('popstate', onPop)
      window.history.back()
    } else {
      setView({ type: 'list' })
    }
  }


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
    >
      {view.type !== 'form' && (
        <DinerHeader onVoirRecette={(id) => { setActiveTab('recettes' as CuisineTab); goToDetail(id) }} />
      )}
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
