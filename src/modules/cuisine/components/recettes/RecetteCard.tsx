import { useState, useEffect } from 'react'
import { toggleFavori, toggleKidsFavorite } from '../../services/recetteService'
import type { Recette, CategorieRecette } from '../../../../shared/types'
import { IconHeart, IconCalendar, IconStarMinimalistic } from '@shared/components/ui/Icon/Icon'
import './RecetteCard.css'

interface Props {
  recette: Recette
  categorie?: CategorieRecette
  onClick: (id: string) => void
  /** Mode "batch cooking" : affiche une checkbox à la place du bouton menu */
  batchMode?: boolean
  batchSelected?: boolean
  onToggleBatch?: (id: string) => void
  /** Mode normal : bouton rapide "ajouter au menu" */
  onAddToMenu?: (id: string) => void
}

const DIFFICULTE_LABELS: Record<string, string> = {
  facile: '🟢 Facile',
  moyen: '🟡 Moyen',
  difficile: '🔴 Difficile',
}

export function RecetteCard({
  recette, categorie, onClick,
  batchMode, batchSelected, onToggleBatch, onAddToMenu,
}: Props) {
  const [menuDone, setMenuDone] = useState(false)
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

  const handleAddToMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (menuDone) return
    setMenuDone(true)
    onAddToMenu?.(recette.id)
    setTimeout(() => setMenuDone(false), 2500)
  }

  const handleClick = () => {
    if (batchMode) {
      onToggleBatch?.(recette.id)
    } else {
      onClick(recette.id)
    }
  }

  return (
    <article
      className={`recette-card${batchMode && batchSelected ? ' recette-card--batch-selected' : ''}`}
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

      {/* Panneau glass flouté, apparaît progressivement vers le bas */}
      <div className="recette-card__glass" />

      {/* Bouton favori */}
      <button
        className={`recette-card__favori ${recette.favori ? 'recette-card__favori--active' : ''}`}
        onClick={handleFavori}
        aria-label={recette.favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      >
        <IconHeart size={16} />
      </button>

      {/* Bouton kids favorite */}
      <button
        className={`recette-card__kids-favori ${recette.kidsFavorite ? 'recette-card__kids-favori--active' : ''}`}
        onClick={handleKidsFavorite}
        aria-label={recette.kidsFavorite ? 'Retirer des favoris enfants' : 'Ajouter aux favoris enfants'}
        title="Favori enfants"
      >
        <IconStarMinimalistic size={16} />
      </button>

      {/* Bouton "Ajouter au menu" (mode normal) OU checkbox (mode batch) */}
      {batchMode ? (
        <>
          <div className="recette-card__batch-overlay" />
          <div className="recette-card__batch-check" aria-hidden="true">
            {batchSelected ? '✓' : ''}
          </div>
        </>
      ) : onAddToMenu ? (
        <button
          className={`recette-card__add-menu${menuDone ? ' recette-card__add-menu--done' : ''}`}
          onClick={handleAddToMenu}
          aria-label="Ajouter au menu de la semaine"
          title={menuDone ? 'Ajouté au menu ✓' : 'Ajouter au menu'}
        >
          {menuDone
            ? <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor"><polygon points="200.359 382.269 61.057 251.673 82.943 228.327 199.641 337.731 428.686 108.687 451.314 131.313 200.359 382.269"/></svg>
            : <IconCalendar size={14} />
          }
        </button>
      ) : null}

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