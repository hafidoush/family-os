import { useState, useCallback } from 'react'
import { useRecettes, useCategoriesRecettes } from '../../hooks/useRecettes'
import { RecetteCard } from './RecetteCard'
import { MenuService as menuService } from '../../services/MenuService'
import { db } from '../../../../core/db/database'
import { newEntity } from '../../../../core/db/helpers'
import type { SessionPreparation } from '../../../../shared/types'
import { ImportRecetteSheet } from './ImportRecetteSheet'
import { IconHeart, IconStarShine, IconStarMinimalistic, IconBookBookmark, IconMagnifier } from '@shared/components/ui/Icon/Icon'
import './RecettesList.css'

interface Props {
  onSelectRecette: (id: string) => void
  onCreateRecette: () => void
}

// ─── Helper : ajoute une recette au menu de la semaine courante ───────────────

async function addToMenuSemaine(recetteId: string): Promise<void> {
  const today = new Date()
  const diff = today.getDay() === 0 ? -6 : 1 - today.getDay()
  const lundi = new Date(today)
  lundi.setDate(today.getDate() + diff)
  lundi.setHours(0, 0, 0, 0)
  const dateDebut = lundi.toISOString().split('T')[0]

  let menu = await db.menus
    .filter((m) => m.dateDebut === dateDebut && !m.archive && !m.deletedAt)
    .first()
  if (!menu) {
    menu = await menuService.createMenu({ dateReference: today })
  }
  await menuService.addSlot({ menuId: menu.id, recetteId })
}

// ─── Helper : crée une session batch cooking ──────────────────────────────────

async function planifierBatchCooking(recetteIds: string[]): Promise<void> {
  const dateSession = new Date().toISOString().split('T')[0]
  await db.sessionsPreparation.add(
    newEntity<SessionPreparation>({
      dateSession,
      recetteIds,
      statut: 'planifiee',
      notes: 'Batch cooking — sélection manuelle',
    })
  )
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function RecettesList({ onSelectRecette, onCreateRecette }: Props) {
  const [categorieId, setCategorieId] = useState<string | undefined>(undefined)
  const [favoriSeulement, setFavoriSeulement] = useState(false)
  const [kidsFavoriteSeulement, setKidsFavoriteSeulement] = useState(false)
  const [recherche, setRecherche] = useState('')

  // Mode batch cooking
  const [batchMode, setBatchMode] = useState(false)
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set())
  const [batchDone, setBatchDone] = useState(false)

  const [importOuvert, setImportOuvert] = useState(false)

  const recettes = useRecettes({ categorieId, favoriSeulement, kidsFavoriteSeulement, recherche })
  const categories = useCategoriesRecettes()

  const categoriesMap = new Map(categories?.map((c) => [c.id, c]))
  const isLoading = recettes === undefined || categories === undefined

  const handleAddToMenu = useCallback(async (recetteId: string) => {
    try {
      await addToMenuSemaine(recetteId)
    } catch { /* silencieux */ }
  }, [])

  const toggleBatchSelect = useCallback((recetteId: string) => {
    setBatchSelected(prev => {
      const next = new Set(prev)
      next.has(recetteId) ? next.delete(recetteId) : next.add(recetteId)
      return next
    })
  }, [])

  const handlePlanifierBatch = async () => {
    if (batchSelected.size === 0) return
    await planifierBatchCooking([...batchSelected])
    setBatchDone(true)
    setBatchMode(false)
    setBatchSelected(new Set())
    setTimeout(() => setBatchDone(false), 4000)
  }

  const exitBatchMode = () => {
    setBatchMode(false)
    setBatchSelected(new Set())
  }

  return (
    <div className="recettes-list">

      {/* Bannière confirmation batch */}
      {batchDone && (
        <div className="recettes-list__batch-confirm">
          ✅ Session batch cooking planifiée dans l'onglet Hebdo
        </div>
      )}

      {/* Barre de recherche + filtres */}
      <div className="recettes-list__toolbar">
        <div className="recettes-list__search">
          <span className="recettes-list__search-icon"><IconMagnifier size={16} /></span>
          <input
            type="search"
            placeholder="Rechercher une recette…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="recettes-list__search-input"
          />
        </div>

        <button
          className={`recettes-list__filter-btn ${favoriSeulement ? 'recettes-list__filter-btn--active' : ''}`}
          onClick={() => setFavoriSeulement((v) => !v)}
          aria-pressed={favoriSeulement}
          title="Favoris"
        >
          <IconHeart size={18} />
        </button>

        <button
          className={`recettes-list__filter-btn ${kidsFavoriteSeulement ? 'recettes-list__filter-btn--active' : ''}`}
          onClick={() => setKidsFavoriteSeulement((v) => !v)}
          aria-pressed={kidsFavoriteSeulement}
          title="Kids Favorite"
        >
          <IconStarMinimalistic size={18} />
        </button>

        <button
          className={`recettes-list__filter-btn ${batchMode ? 'recettes-list__filter-btn--active' : ''}`}
          onClick={() => batchMode ? exitBatchMode() : setBatchMode(true)}
          title="Mode batch cooking — sélectionner plusieurs recettes"
          aria-pressed={batchMode}
        >
          <IconBookBookmark size={18} />
        </button>

        <button
          className="recettes-list__filter-btn"
          onClick={() => setImportOuvert(true)}
          title="Importer depuis Instagram, blog, image…"
        >
          <IconStarShine size={18} />
        </button>
      </div>

      {/* Bandeau mode batch */}
      {batchMode && (
        <div className="recettes-list__batch-bar">
          <span>
            {batchSelected.size === 0
              ? 'Sélectionne les recettes à préparer en batch'
              : `${batchSelected.size} recette${batchSelected.size > 1 ? 's' : ''} sélectionnée${batchSelected.size > 1 ? 's' : ''}`}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="recettes-list__batch-cancel" onClick={exitBatchMode}>
              Annuler
            </button>
            <button
              className="recettes-list__batch-confirm-btn"
              onClick={handlePlanifierBatch}
              disabled={batchSelected.size === 0}
            >
              Planifier ({batchSelected.size})
            </button>
          </div>
        </div>
      )}

      {/* Chips catégories */}
      {categories && categories.length > 0 && (
        <div className="recettes-list__categories">
          <button
            className={`recettes-list__chip ${!categorieId ? 'recettes-list__chip--active' : ''}`}
            onClick={() => setCategorieId(undefined)}
          >
            Toutes
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`recettes-list__chip ${categorieId === cat.id ? 'recettes-list__chip--active' : ''}`}
              onClick={() => setCategorieId(cat.id === categorieId ? undefined : cat.id)}
            >
              {cat.nom}
            </button>
          ))}
        </div>
      )}

      {/* Contenu */}
      {isLoading ? (
        <div className="recettes-list__grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="recettes-list__skeleton" />
          ))}
        </div>
      ) : recettes.length === 0 ? (
        <div className="recettes-list__empty">
          <span className="recettes-list__empty-icon">🍽️</span>
          <p>
            {recherche || categorieId || favoriSeulement || kidsFavoriteSeulement
              ? 'Aucune recette ne correspond à ces filtres'
              : 'Aucune recette pour l\'instant'}
          </p>
          {!recherche && !categorieId && !favoriSeulement && !kidsFavoriteSeulement && (
            <button className="recettes-list__cta" onClick={onCreateRecette}>
              Créer ma première recette
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="recettes-list__count">
            {batchMode
              ? `Mode batch — sélectionne les recettes à préparer`
              : `${recettes.length} recette${recettes.length > 1 ? 's' : ''}`}
          </p>
          <div className="recettes-list__grid">
            {recettes.map((r) => (
              <RecetteCard
                key={r.id}
                recette={r}
                categorie={categoriesMap.get(r.categorie)}
                onClick={onSelectRecette}
                batchMode={batchMode}
                batchSelected={batchSelected.has(r.id)}
                onToggleBatch={toggleBatchSelect}
                onAddToMenu={batchMode ? undefined : handleAddToMenu}
              />
            ))}
          </div>
        </>
      )}
      {importOuvert && (
        <ImportRecetteSheet
          onClose={() => setImportOuvert(false)}
          onSuccess={id => { setImportOuvert(false); onSelectRecette(id) }}
        />
      )}
    </div>
  )
}
