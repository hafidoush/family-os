import { useState, useCallback } from 'react'
import { useRecettes, useCategoriesRecettes } from '../../hooks/useRecettes'
import { softDeleteFields } from '../../../../core/db/helpers'
import { ConfirmModal } from '../../../../shared/components/ui/ConfirmModal'

const TAGS_RECETTES = [
  { id: 'française',   label: 'Française' },
  { id: 'italienne',   label: 'Italienne' },
  { id: 'espagnole',   label: 'Espagnole' },
  { id: 'grecque',     label: 'Grecque' },
  { id: 'marocaine',   label: 'Marocaine' },
  { id: 'asiatique',   label: 'Asiatique' },
  { id: 'indienne',    label: 'Indienne' },
  { id: 'fast-food',   label: 'Fast-food' },
  { id: 'mexicaine',   label: 'Mexicaine' },
  { id: 'autre',       label: 'Autre' },
  { id: 'réception',   label: 'Réception' },
  { id: 'batch cooking', label: 'Batch cooking' },
  { id: 'ramadan',     label: 'Ramadan' },
  { id: 'enfant',        label: 'Enfant' },
  { id: 'bébé',          label: 'Bébé' },
  { id: 'réconfortant',  label: 'Réconfortant' },
  { id: 'frais & léger', label: 'Frais & léger' },
  { id: 'apéro',           label: 'Apéro' },
  { id: 'pizza & tartes',  label: 'Pizza & tartes' },
] as const
import { RecetteCard } from './RecetteCard'
import { db } from '../../../../core/db/database'
import { newEntity } from '../../../../core/db/helpers'
import type { SessionPreparation } from '../../../../shared/types'
import { ImportRecetteSheet } from './ImportRecetteSheet'
import { IconHeart, IconStarMinimalistic, IconBookBookmark, IconMagnifier, IconStarShine } from '@shared/components/ui/Icon/Icon'
import './RecettesList.css'

interface Props {
  onSelectRecette: (id: string) => void
  onCreateRecette: () => void
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

const STORAGE_KEY_CATEGORIE = 'recettes-categorie-active'

export function RecettesList({ onSelectRecette, onCreateRecette }: Props) {
  const [categorieId, setCategorieIdRaw] = useState<string | undefined>(() => {
    return sessionStorage.getItem(STORAGE_KEY_CATEGORIE) ?? undefined
  })

  const setCategorieId = useCallback((id: string | undefined) => {
    setCategorieIdRaw(id)
    if (id) sessionStorage.setItem(STORAGE_KEY_CATEGORIE, id)
    else sessionStorage.removeItem(STORAGE_KEY_CATEGORIE)
  }, [])
  const [favoriSeulement, setFavoriSeulement] = useState(false)
  const [kidsFavoriteSeulement, setKidsFavoriteSeulement] = useState(false)
  const [aProgrammerSeulement, setAProgrammerSeulement] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [tagsActifs, setTagsActifs] = useState<string[]>([])

  // Mode batch cooking
  const [batchMode, setBatchMode] = useState(false)
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set())
  const [batchDone, setBatchDone] = useState(false)
  const [showMoveSheet, setShowMoveSheet] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')

  const [importOuvert, setImportOuvert] = useState(false)

  const toggleTag = useCallback((tagId: string) => {
    setTagsActifs((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    )
  }, [])

  const recettes = useRecettes({ categorieId, favoriSeulement, kidsFavoriteSeulement, aProgrammerSeulement, recherche, tags: tagsActifs.length > 0 ? tagsActifs : undefined })
  const categories = useCategoriesRecettes()

  const categoriesMap = new Map(categories?.map((c) => [c.id, c]))
  const isLoading = recettes === undefined || categories === undefined

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

  const exporterRecettes = useCallback(async () => {
    const toutes = await db.recettes.filter(r => !r.deletedAt && !r.archive).toArray()
    const tousIngredients = await db.recettesIngredients.filter((i: import('../../../../shared/types').RecetteIngredient) => !i.deletedAt).toArray()

    const blobToBase64 = (b: Blob): Promise<string> =>
      new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(b) })

    const recettesExport = await Promise.all(toutes.map(async r => {
      const ingredients = tousIngredients.filter((i: import('../../../../shared/types').RecetteIngredient) => i.recette === r.id)
      // Convertit le Blob legacy en base64 si imageData absent
      let imageData = r.imageData
      if (!imageData && r.image) {
        try { imageData = await blobToBase64(r.image) } catch { /* ignore */ }
      }
      return { ...r, image: undefined, imageData, ingredients }
    }))

    const blob = new Blob([JSON.stringify(recettesExport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `family-os-recettes-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const exitBatchMode = () => {
    setBatchMode(false)
    setBatchSelected(new Set())
  }

  const handleBulkMove = useCallback(async (newCategorieId: string) => {
    const now = new Date()
    await Promise.all(
      [...batchSelected].map(id => db.recettes.update(id, { categorie: newCategorieId, updatedAt: now }))
    )
    const n = batchSelected.size
    exitBatchMode()
    setShowMoveSheet(false)
    setBulkMsg(`${n} recette${n > 1 ? 's' : ''} déplacée${n > 1 ? 's' : ''}`)
    setTimeout(() => setBulkMsg(''), 3000)
  }, [batchSelected])

  const handleBulkDelete = useCallback(async () => {
    const now = new Date()
    await Promise.all(
      [...batchSelected].map(id => db.recettes.update(id, { ...softDeleteFields(), updatedAt: now }))
    )
    const n = batchSelected.size
    exitBatchMode()
    setShowDeleteConfirm(false)
    setBulkMsg(`${n} recette${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''}`)
    setTimeout(() => setBulkMsg(''), 3000)
  }, [batchSelected])

  return (
    <div className="recettes-list">

      {/* Bannières confirmation */}
      {batchDone && (
        <div className="recettes-list__batch-confirm">
          ✅ Session batch cooking planifiée dans l'onglet Hebdo
        </div>
      )}
      {bulkMsg && (
        <div className="recettes-list__batch-confirm">
          ✅ {bulkMsg}
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
          title="Favoris enfants"
        >
          <IconStarMinimalistic size={18} />
        </button>

        <button
          className={`recettes-list__filter-btn ${aProgrammerSeulement ? 'recettes-list__filter-btn--active' : ''}`}
          onClick={() => setAProgrammerSeulement(v => !v)}
          aria-pressed={aProgrammerSeulement}
          title="À programmer"
          style={{ fontSize: '1rem' }}
        >
          📥
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

        <button
          className="recettes-list__filter-btn"
          onClick={exporterRecettes}
          title="Exporter toutes mes recettes (sauvegarde JSON)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Bandeau mode sélection */}
      {batchMode && (
        <div className="recettes-list__batch-bar">
          <span className="recettes-list__batch-label">
            {batchSelected.size === 0
              ? 'Sélectionne des recettes'
              : `${batchSelected.size} sélectionnée${batchSelected.size > 1 ? 's' : ''}`}
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="recettes-list__batch-cancel" onClick={exitBatchMode}>Annuler</button>
            <button
              className="recettes-list__batch-confirm-btn"
              onClick={handlePlanifierBatch}
              disabled={batchSelected.size === 0}
              title="Planifier en batch cooking"
            >
              🍳 Batch
            </button>
            <button
              className="recettes-list__batch-move-btn"
              onClick={() => setShowMoveSheet(true)}
              disabled={batchSelected.size === 0}
            >
              📁 Déplacer
            </button>
            <button
              className="recettes-list__batch-delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={batchSelected.size === 0}
            >
              🗑
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

      {/* Chips tags */}
      <div className="recettes-list__tags">
        {TAGS_RECETTES.map((tag) => (
          <button
            key={tag.id}
            className={`recettes-list__tag-chip ${tagsActifs.includes(tag.id) ? 'recettes-list__tag-chip--active' : ''}`}
            onClick={() => toggleTag(tag.id)}
            aria-pressed={tagsActifs.includes(tag.id)}
          >
            {tag.label}
          </button>
        ))}
      </div>

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
            {recherche || categorieId || favoriSeulement || kidsFavoriteSeulement || tagsActifs.length > 0
              ? 'Aucune recette ne correspond à ces filtres'
              : 'Aucune recette pour l\'instant'}
          </p>
          {!recherche && !categorieId && !favoriSeulement && !kidsFavoriteSeulement && tagsActifs.length === 0 && (
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

      {/* Sheet déplacer vers catégorie */}
      {showMoveSheet && (
        <div className="recettes-list__sheet-backdrop" onClick={() => setShowMoveSheet(false)}>
          <div className="recettes-list__sheet" onClick={e => e.stopPropagation()}>
            <div className="recettes-list__sheet-handle" />
            <p className="recettes-list__sheet-title">
              Déplacer {batchSelected.size} recette{batchSelected.size > 1 ? 's' : ''} vers…
            </p>
            <div className="recettes-list__sheet-cats">
              {categories?.map(cat => (
                <button
                  key={cat.id}
                  className="recettes-list__sheet-cat"
                  onClick={() => handleBulkMove(cat.id)}
                >
                  {cat.icone && <span>{cat.icone}</span>}
                  <span>{cat.nom}</span>
                </button>
              ))}
            </div>
            <button className="recettes-list__batch-cancel" style={{ width: '100%', marginTop: 8 }} onClick={() => setShowMoveSheet(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        title={`Supprimer ${batchSelected.size} recette${batchSelected.size > 1 ? 's' : ''} ?`}
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={handleBulkDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
