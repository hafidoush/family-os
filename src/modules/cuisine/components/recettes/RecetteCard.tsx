import { useState, useEffect } from 'react'
import { toggleFavori, toggleKidsFavorite, toggleAProgrammer } from '../../services/recetteService'
import type { Recette, CategorieRecette } from '../../../../shared/types'
import { IconHeart, IconStarMinimalistic, IconArchiveDown, IconArchiveCheck } from '@shared/components/ui/Icon/Icon'
import './RecetteCard.css'

interface Props {
  recette: Recette
  categorie?: CategorieRecette
  onClick: (id: string) => void
  /** Mode "batch cooking" : affiche une checkbox */
  batchMode?: boolean
  batchSelected?: boolean
  onToggleBatch?: (id: string) => void
  /** Mode sélection menu : bouton "+" au lieu de naviguer */
  selectMode?: boolean
  alreadyAdded?: boolean
  onSelect?: (id: string) => void
}

const DIFFICULTE_LABELS: Record<string, string> = {
  facile: '🟢 Facile',
  moyen: '🟡 Moyen',
  difficile: '🔴 Difficile',
}

export function RecetteCard({
  recette, categorie, onClick,
  batchMode, batchSelected, onToggleBatch,
  selectMode, alreadyAdded, onSelect,
}: Props) {
  const [selectDone, setSelectDone] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Préférer imageData (base64 stable iOS) ; fallback Blob legacy avec cleanup propre
  useEffect(() => {
    if (recette.imageData) {
      setImageUrl(recette.imageData)
      return
    }
    if (!recette.image) { setImageUrl(null); return }
    const url = URL.createObjectURL(recette.image)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [recette.imageData, recette.image])

  const handleFavori = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavori(recette.id, !recette.favori)
  }

  const handleKidsFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleKidsFavorite(recette.id, !recette.kidsFavorite)
  }

  const handleToggleAProgrammer = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleAProgrammer(recette.id, !recette.aProgrammer)
  }

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (alreadyAdded || selectDone) return
    setSelectDone(true)
    onSelect?.(recette.id)
    setTimeout(() => setSelectDone(false), 2000)
  }

  const handleClick = () => {
    if (batchMode) {
      onToggleBatch?.(recette.id)
    } else if (selectMode) {
      if (!alreadyAdded) handleSelect({ stopPropagation: () => {} } as React.MouseEvent)
    } else {
      onClick(recette.id)
    }
  }

  return (
    <article
      className={`recette-card${batchMode && batchSelected ? ' recette-card--batch-selected' : ''}${selectMode && alreadyAdded ? ' recette-card--already-added' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      {/* Image plein cadre */}
      <div className="recette-card__image">
        {imageUrl ? (
          <img src={imageUrl} alt={recette.nom} loading="lazy" />
        ) : (
          <div className="recette-card__image-placeholder">
            <span>🍽️</span>
          </div>
        )}
      </div>

      {/* Panneau glass flouté */}
      <div className="recette-card__glass" />

      {/* Boutons visibles uniquement hors mode sélection */}
      {!selectMode && (
        <>
          <button
            className={`recette-card__favori ${recette.favori ? 'recette-card__favori--active' : ''}`}
            onClick={handleFavori}
            aria-label={recette.favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <IconHeart size={16} />
          </button>

          <button
            className={`recette-card__kids-favori ${recette.kidsFavorite ? 'recette-card__kids-favori--active' : ''}`}
            onClick={handleKidsFavorite}
            aria-label="Favori enfants"
          >
            <IconStarMinimalistic size={16} />
          </button>

          {/* Bouton 📥 À programmer */}
          <button
            className={`recette-card__a-programmer${recette.aProgrammer ? ' recette-card__a-programmer--active' : ''}`}
            onClick={handleToggleAProgrammer}
            aria-label={recette.aProgrammer ? 'Retirer de "À programmer"' : 'Ajouter à "À programmer"'}
            title={recette.aProgrammer ? 'Dans ta liste' : 'Ajouter à ma liste'}
          >
            {recette.aProgrammer ? <IconArchiveCheck size={15} /> : <IconArchiveDown size={15} />}
          </button>
        </>
      )}

      {/* Mode batch */}
      {batchMode && (
        <>
          <div className="recette-card__batch-overlay" />
          <div className="recette-card__batch-check" aria-hidden="true">
            {batchSelected ? '✓' : ''}
          </div>
        </>
      )}

      {/* Mode sélection menu */}
      {selectMode && (
        <button
          className={`recette-card__select-btn${alreadyAdded ? ' recette-card__select-btn--done' : selectDone ? ' recette-card__select-btn--done' : ''}`}
          onClick={handleSelect}
          aria-label={alreadyAdded ? 'Déjà dans le menu' : 'Ajouter au menu'}
          disabled={alreadyAdded}
        >
          {alreadyAdded || selectDone ? '✓' : '+'}
        </button>
      )}

      {/* Texte sur la photo */}
      <div className="recette-card__body">
        <h3 className="recette-card__nom">{recette.nom}</h3>

        {categorie && (
          <span className="recette-card__categorie">
            {categorie.nom}
          </span>
        )}

        <div className="recette-card__meta">
          {recette.tempsPreparation && (
            <span className="recette-card__meta-item">
              ⏱ {recette.tempsPreparation}min
            </span>
          )}
          {recette.portions && (
            <span className="recette-card__meta-item">
              👥 {recette.portions}
            </span>
          )}
          {recette.difficulte && (
            <span className="recette-card__meta-item">
              {DIFFICULTE_LABELS[recette.difficulte]}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}