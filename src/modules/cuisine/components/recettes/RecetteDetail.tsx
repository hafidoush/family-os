import { useState, useEffect, useCallback } from 'react'
import { useRecette, useRecetteIngredients, useCategoriesRecettes } from '../../hooks/useRecettes'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../core/db/database'
import { toggleFavori, deleteRecette } from '../../services/recetteService'
import { MenuService as menuService } from '../../services/MenuService'
import { IconHeart, IconPen, IconTrash, IconLadle, IconFlame } from '@shared/components/ui/Icon/Icon'
import './RecetteDetail.css'

interface Props {
  recetteId: string
  onBack: () => void
  onEdit: (id: string) => void
}

const DIFFICULTE_CONFIG: Record<string, { label: string; color: string }> = {
  facile:    { label: 'Facile',    color: '#86EFAC' },
  moyen:     { label: 'Moyen',     color: '#FCD34D' },
  difficile: { label: 'Difficile', color: '#FCA5A5' },
}

export function RecetteDetail({ recetteId, onBack, onEdit }: Props) {
  const recette = useRecette(recetteId)
  const ingredients = useRecetteIngredients(recetteId)
  const categories = useCategoriesRecettes()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [portionsMultiplier, setPortionsMultiplier] = useState(1)
  const [etapeActive, setEtapeActive] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [menuAdding, setMenuAdding] = useState(false)
  const [menuAdded, setMenuAdded] = useState(false)

  const handleAddToMenu = useCallback(async () => {
    if (menuAdding || menuAdded) return
    setMenuAdding(true)
    try {
      // Récupère ou crée le menu de la semaine courante
      const today = new Date()
      const lundi = new Date(today)
      const diff = today.getDay() === 0 ? -6 : 1 - today.getDay()
      lundi.setDate(today.getDate() + diff)
      lundi.setHours(0, 0, 0, 0)
      const dateDebut = lundi.toISOString().split('T')[0]

      let menu = await db.menus
        .filter((m) => m.dateDebut === dateDebut && !m.archive && !m.deletedAt)
        .first()
      if (!menu) {
        menu = await menuService.createMenu({ dateReference: today })
      }
      await menuService.addSlot({ menuId: menu.id, recetteId: recetteId })
      setMenuAdded(true)
      setTimeout(() => setMenuAdded(false), 3000)
    } catch {
      // silencieux
    } finally {
      setMenuAdding(false)
    }
  }, [recetteId, menuAdding, menuAdded])

  // Charger les produits pour afficher leurs noms
  const produitsIds = ingredients?.map((i) => i.produit) ?? []
  const produits = useLiveQuery(
    async () => {
      if (produitsIds.length === 0) return []
      return db.produits.where('id').anyOf(produitsIds).toArray()
    },
    [JSON.stringify(produitsIds)]
  )

  // Préférer imageData (base64 stable iOS) ; fallback Blob legacy avec cleanup
  useEffect(() => {
    if (recette?.imageData) {
      setImageUrl(recette.imageData)
      return
    }
    if (!recette?.image) { setImageUrl(null); return }
    const url = URL.createObjectURL(recette.image)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [recette?.imageData, recette?.image])

  const produitsMap = new Map(produits?.map((p) => [p.id, p]))
  const categoriesMap = new Map(categories?.map((c) => [c.id, c]))

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (recette === undefined) {
    return (
      <div className="recette-detail recette-detail--loading">
        <div className="recette-detail__skeleton-hero" />
        <div className="recette-detail__skeleton-body">
          {[80, 60, 70, 50].map((w, i) => (
            <div key={i} className="recette-detail__skeleton-line" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    )
  }

  // ─── Not found / archived ─────────────────────────────────────────────────
  if (!recette || recette.archive) {
    return (
      <div className="recette-detail recette-detail--empty">
        <span>🍽️</span>
        <p>Recette introuvable</p>
        <button onClick={onBack}>Retour</button>
      </div>
    )
  }

  const categorie = categoriesMap.get(recette.categorie)
  const portionsBase = recette.portions ?? 4
  const portionsAffichees = Math.max(1, Math.round(portionsBase * portionsMultiplier))
  const tempsTotal = (recette.tempsPreparation ?? 0) + (recette.tempsCuisson ?? 0)

  const handleDelete = async () => {
    try {
      await deleteRecette(recetteId)
      onBack()
    } catch (e) {
      console.error('[RecetteDetail] Erreur suppression :', e)
    }
  }

  return (
    <div className="recette-detail">
      {/* Hero */}
      <div className="recette-detail__hero">
        {imageUrl ? (
          <img src={imageUrl} alt={recette.nom} className="recette-detail__hero-img" />
        ) : (
          <div className="recette-detail__hero-placeholder">
            <span>🍽️</span>
          </div>
        )}

        {/* Actions flottantes sur le hero */}
        <div className="recette-detail__hero-actions">
          <button
            className={`recette-detail__action-btn ${recette.favori ? 'recette-detail__action-btn--active' : ''}`}
            onClick={() => toggleFavori(recetteId, !recette.favori)}
            aria-label="Favori"
          >
            <IconHeart size={18} style={{ opacity: recette.favori ? 1 : 0.5 }} />
          </button>
          <button
            className="recette-detail__action-btn"
            onClick={() => onEdit(recetteId)}
            aria-label="Modifier"
          >
            <IconPen size={18} />
          </button>
          <button
            className="recette-detail__action-btn recette-detail__action-btn--danger"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Supprimer"
          >
            <IconTrash size={18} />
          </button>
        </div>

        {/* Bouton Ajouter au menu */}
        <button
          className={`recette-detail__add-menu-btn${menuAdded ? ' recette-detail__add-menu-btn--done' : ''}`}
          onClick={handleAddToMenu}
          disabled={menuAdding}
          aria-label="Ajouter au menu de la semaine"
        >
          {menuAdded ? '✓ Ajouté au menu !' : menuAdding ? '…' : '＋ Ajouter au menu'}
        </button>
      </div>

      {/* En-tête */}
      <div className="recette-detail__header">
        <div className="recette-detail__meta-row">
          {categorie && (
            <span className="recette-detail__badge">
              {categorie.nom}
            </span>
          )}
          {recette.difficulte && (
            <span
              className="recette-detail__badge"
              style={{ background: DIFFICULTE_CONFIG[recette.difficulte]?.color + '33',
                       color: 'var(--color-text)' }}
            >
              {DIFFICULTE_CONFIG[recette.difficulte]?.label}
            </span>
          )}
          {recette.favori && (
            <span className="recette-detail__badge recette-detail__badge--favori">Favori</span>
          )}
        </div>

        <h1 className="recette-detail__titre">{recette.nom}</h1>

        {/* Stats rapides */}
        <div className="recette-detail__stats">
          {recette.tempsPreparation && (
            <div className="recette-detail__stat">
              <span className="recette-detail__stat-icon"><IconLadle size={18} /></span>
              <span className="recette-detail__stat-value">{recette.tempsPreparation} min</span>
              <span className="recette-detail__stat-label">Prep.</span>
            </div>
          )}
          {recette.tempsCuisson && (
            <div className="recette-detail__stat">
              <span className="recette-detail__stat-icon"><IconFlame size={18} /></span>
              <span className="recette-detail__stat-value">{recette.tempsCuisson} min</span>
              <span className="recette-detail__stat-label">Cuisson</span>
            </div>
          )}
          {tempsTotal > 0 && (
            <div className="recette-detail__stat">
              <span className="recette-detail__stat-icon">⏱</span>
              <span className="recette-detail__stat-value">{tempsTotal} min</span>
              <span className="recette-detail__stat-label">Total</span>
            </div>
          )}
        </div>
      </div>

      {/* Ingrédients */}
      {ingredients && ingredients.length > 0 && (
        <section className="recette-detail__section">
          <div className="recette-detail__section-header">
            <h2 className="recette-detail__section-title">Ingrédients</h2>
            {recette.portions && (
              <div className="recette-detail__portions">
                <button
                  className="recette-detail__portions-btn"
                  onClick={() => setPortionsMultiplier((m) => Math.max(0.25, m - 0.25))}
                  aria-label="Moins"
                >−</button>
                <span className="recette-detail__portions-value">
                  {portionsAffichees} pers.
                </span>
                <button
                  className="recette-detail__portions-btn"
                  onClick={() => setPortionsMultiplier((m) => m + 0.25)}
                  aria-label="Plus"
                >+</button>
              </div>
            )}
          </div>

          <ul className="recette-detail__ingredients">
            {ingredients.map((ing) => {
              const produit = produitsMap.get(ing.produit)
              const qte = ing.quantite * portionsMultiplier
              const qteAffichee = Number.isInteger(qte) ? qte : qte.toFixed(1)
              return (
                <li key={ing.id} className={`recette-detail__ingredient ${ing.optionnel ? 'recette-detail__ingredient--optionnel' : ''}`}>
                  <span className="recette-detail__ingredient-dot" />
                  <span className="recette-detail__ingredient-nom">
                    {produit?.nom ?? '—'}
                    {ing.optionnel && <em> (optionnel)</em>}
                  </span>
                  <span className="recette-detail__ingredient-qte">
                    {qteAffichee}{ing.unite ? ` ${ing.unite}` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Étapes */}
      {recette.etapes && recette.etapes.length > 0 && (
        <section className="recette-detail__section">
          <h2 className="recette-detail__section-title">Préparation</h2>

          <ol className="recette-detail__etapes">
            {recette.etapes.map((etape, index) => (
              <li
                key={index}
                className={`recette-detail__etape ${etapeActive === index ? 'recette-detail__etape--active' : ''} ${etapeActive !== null && etapeActive > index ? 'recette-detail__etape--done' : ''}`}
                onClick={() => setEtapeActive(etapeActive === index ? null : index)}
              >
                <div className="recette-detail__etape-numero">
                  {etapeActive !== null && etapeActive > index ? '✓' : index + 1}
                </div>
                <p className="recette-detail__etape-texte">{etape}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Tags */}
      {recette.tags && recette.tags.length > 0 && (
        <section className="recette-detail__section recette-detail__section--tags">
          {recette.tags.map((tag) => (
            <span key={tag} className="recette-detail__tag">{tag}</span>
          ))}
        </section>
      )}

      {/* Spacer pour le FAB */}
      <div style={{ height: 80 }} />

      {/* Modal de confirmation suppression */}
      {showDeleteConfirm && (
        <div className="recette-detail__overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="recette-detail__confirm" onClick={(e) => e.stopPropagation()}>
            <p>Supprimer <strong>{recette.nom}</strong> ?</p>
            <p className="recette-detail__confirm-sub">Cette action est irréversible.</p>
            <div className="recette-detail__confirm-actions">
              <button className="recette-detail__confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>
                Annuler
              </button>
              <button className="recette-detail__confirm-delete" onClick={handleDelete}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
