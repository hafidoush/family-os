import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../core/db/database'
import { useRecette, useRecetteIngredients, useCategoriesRecettes } from '../../hooks/useRecettes'
import { createRecette, updateRecette, compressImageToBase64 } from '../../services/recetteService'
import type { IngredientFormData } from '../../services/recetteService'
import { IconCameraAdd, IconClose } from '@shared/components/ui/Icon/Icon'
import './RecetteForm.css'

interface Props {
  recetteId?: string        // undefined = création, string = édition
  onSave: (id: string) => void
  onCancel: () => void
}

type DifficulteRecette = 'facile' | 'moyen' | 'difficile'

interface IngredientRow extends IngredientFormData {
  _key: string   // clé locale stable pour React
  _nomRecherche: string
}

const DIFFICULTE_OPTIONS: { value: DifficulteRecette; label: string; icon: string }[] = [
  { value: 'facile',    label: 'Facile',    icon: '🟢' },
  { value: 'moyen',     label: 'Moyen',     icon: '🟡' },
  { value: 'difficile', label: 'Difficile', icon: '🔴' },
]

function newIngredientRow(): IngredientRow {
  return {
    _key: Math.random().toString(36).slice(2),
    _nomRecherche: '',
    produit: '',
    quantite: 1,
    unite: '',
    optionnel: false,
  }
}

export function RecetteForm({ recetteId, onSave, onCancel }: Props) {
  const isEditing = Boolean(recetteId)

  // Données existantes si édition
  const recetteExistante = useRecette(recetteId ?? null)
  const ingredientsExistants = useRecetteIngredients(recetteId ?? null)
  const categories = useCategoriesRecettes()
  const tousLesProduits = useLiveQuery(() =>
    db.produits.filter((p) => !p.archive).toArray()
  )

  // ─── Champs du formulaire ─────────────────────────────────────────────────
  const [nom, setNom] = useState('')
  const [categorieId, setCategorieId] = useState('')
  const [difficulte, setDifficulte] = useState<DifficulteRecette | ''>('')
  const [tempsPrep, setTempsPrep] = useState('')
  const [tempsCuisson, setTempsCuisson] = useState('')
  const [portions, setPortions] = useState('')
  const [etapes, setEtapes] = useState<string[]>([''])
  const [tags, setTags] = useState('')
  const [portionsBase, setPortionsBase] = useState<number | null>(null)
  const [typePreparation, setTypePreparation] = useState<'plat' | 'gouter' | 'dessert' | 'petit_dejeuner' | 'snack' | ''>('')
  const [modeConservation, setModeConservation] = useState('')
  const [dureeConservation, setDureeConservation] = useState('')
  const [imageData, setImageData] = useState<string | undefined>(undefined) // base64
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [ingredients, setIngredients] = useState<IngredientRow[]>([newIngredientRow()])

  // ─── Erreurs ──────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // ─── Pré-remplissage en mode édition ─────────────────────────────────────
  const [initialized, setInitialized] = useState(false)
  useEffect(() => {
    if (!isEditing || initialized) return
    if (!recetteExistante || !ingredientsExistants || !tousLesProduits) return

    setNom(recetteExistante.nom)
    setCategorieId(recetteExistante.categorie)
    setDifficulte(recetteExistante.difficulte ?? '')
    setTempsPrep(recetteExistante.tempsPreparation?.toString() ?? '')
    setTempsCuisson(recetteExistante.tempsCuisson?.toString() ?? '')
    const portionsVal = recetteExistante.portions ?? null
    setPortions(portionsVal?.toString() ?? '')
    setPortionsBase(portionsVal)
    setEtapes(recetteExistante.etapes.length > 0 ? recetteExistante.etapes : [''])
    setTags(recetteExistante.tags?.join(', ') ?? '')
    setTypePreparation(recetteExistante.typePreparation ?? '')
    setModeConservation(recetteExistante.modeConservation ?? '')
    setDureeConservation(recetteExistante.dureeConservation?.toString() ?? '')

    // Préférer imageData (base64) ; fallback vers Blob legacy
    if (recetteExistante.imageData) {
      setImageData(recetteExistante.imageData)
      setImagePreview(recetteExistante.imageData)
    } else if (recetteExistante.image) {
      // Recette ancienne format : convertir en base64 pour mise à jour propre
      compressImageToBase64(
        new File([recetteExistante.image], 'legacy.jpg', { type: recetteExistante.image.type })
      ).then((b64) => {
        setImageData(b64)
        setImagePreview(b64)
      }).catch(() => {
        setImagePreview(URL.createObjectURL(recetteExistante.image!))
      })
    }

    if (ingredientsExistants.length > 0) {
      const rows: IngredientRow[] = ingredientsExistants.map((ing) => {
        const produit = tousLesProduits.find((p) => p.id === ing.produit)
        return {
          _key: Math.random().toString(36).slice(2),
          _nomRecherche: produit?.nom ?? '',
          produit: ing.produit,
          quantite: ing.quantite,
          unite: ing.unite ?? '',
          optionnel: ing.optionnel,
        }
      })
      setIngredients(rows)
    }
    setInitialized(true)
  }, [isEditing, initialized, recetteExistante, ingredientsExistants, tousLesProduits])

  // imagePreview est maintenant une data URL — aucun cleanup blob nécessaire

  // ─── Calcul temps total ───────────────────────────────────────────────────
  const tempsTotal = (parseInt(tempsPrep) || 0) + (parseInt(tempsCuisson) || 0)

  // ─── Ajustement portions ──────────────────────────────────────────────────
  const handlePortionsChange = (value: string) => {
    const newVal = parseInt(value) || 0
    const base = portionsBase ?? (parseInt(portions) || 0)
    if (base > 0 && newVal > 0 && newVal !== base) {
      const ratio = newVal / base
      setIngredients(prev =>
        prev.map(ing => ({ ...ing, quantite: Math.round(ing.quantite * ratio * 100) / 100 }))
      )
    }
    if (portionsBase === null && parseInt(portions) > 0) setPortionsBase(parseInt(portions))
    setPortions(value)
  }

  // ─── Gestion image ────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const b64 = await compressImageToBase64(file)
      setImageData(b64)
      setImagePreview(b64)
    } catch {
      // Fallback sans compression
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        setImageData(result)
        setImagePreview(result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageData(undefined)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Gestion étapes ───────────────────────────────────────────────────────
  const updateEtape = (index: number, value: string) => {
    setEtapes((prev) => prev.map((e, i) => (i === index ? value : e)))
  }

  const addEtape = () => setEtapes((prev) => [...prev, ''])

  const removeEtape = (index: number) => {
    if (etapes.length <= 1) return
    setEtapes((prev) => prev.filter((_, i) => i !== index))
  }

  const moveEtape = (index: number, direction: 'up' | 'down') => {
    const newEtapes = [...etapes]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= newEtapes.length) return
    ;[newEtapes[index], newEtapes[target]] = [newEtapes[target], newEtapes[index]]
    setEtapes(newEtapes)
  }

  // ─── Gestion ingrédients ──────────────────────────────────────────────────
  const updateIngredient = (key: string, field: keyof IngredientRow, value: unknown) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing._key === key ? { ...ing, [field]: value } : ing))
    )
  }

  const addIngredient = () => {
    setIngredients((prev) => [...prev, newIngredientRow()])
  }

  const removeIngredient = (key: string) => {
    if (ingredients.length <= 1) return
    setIngredients((prev) => prev.filter((ing) => ing._key !== key))
  }

  // Recherche produit dans la liste
  const getProduitsFiltered = (search: string) => {
    if (!tousLesProduits || search.length < 1) return []
    const q = search.toLowerCase()
    return tousLesProduits.filter((p) => p.nom.toLowerCase().includes(q)).slice(0, 6)
  }

  // ─── Validation + soumission ──────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!nom.trim()) newErrors.nom = 'Le nom est requis'
    if (!categorieId) newErrors.categorie = 'La catégorie est requise'
    if (etapes.filter((e) => e.trim()).length === 0) {
      newErrors.etapes = 'Au moins une étape est requise'
    }
    const ingredientsValides = ingredients.filter((i) => i.produit)
    if (ingredientsValides.some((i) => i.quantite <= 0)) {
      newErrors.ingredients = 'La quantité doit être supérieure à 0'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)

    try {
      const etapesFiltrees = etapes.filter((e) => e.trim())
      const ingredientsFiltres: IngredientFormData[] = ingredients
        .filter((i) => i.produit)
        .map(({ produit, quantite, unite, optionnel }) => ({
          produit,
          quantite,
          unite: unite || undefined,
          optionnel,
        }))

      const tagsArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const formData = {
        nom: nom.trim(),
        categorie: categorieId,
        difficulte: difficulte || undefined,
        tempsPreparation: tempsPrep ? parseInt(tempsPrep) : undefined,
        tempsCuisson: tempsCuisson ? parseInt(tempsCuisson) : undefined,
        portions: portions ? parseInt(portions) : undefined,
        etapes: etapesFiltrees,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        imageData,
        image: undefined, // on efface le Blob legacy si présent
        typePreparation: typePreparation || undefined,
        modeConservation: modeConservation.trim() || undefined,
        dureeConservation: dureeConservation ? parseInt(dureeConservation) : undefined,
      }

      let savedId: string
      if (isEditing && recetteId) {
        await updateRecette(recetteId, formData, ingredientsFiltres)
        savedId = recetteId
      } else {
        savedId = await createRecette(formData, ingredientsFiltres)
      }

      onSave(savedId)
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="recette-form">
      <div className="recette-form__header">
        <h2 className="recette-form__title">
          {isEditing ? 'Modifier la recette' : 'Nouvelle recette'}
        </h2>
      </div>

      <div className="recette-form__body">

        {/* ── Image ── */}
        <section className="recette-form__section">
          <div
            className="recette-form__image-zone"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Aperçu" className="recette-form__image-preview" />
                <button
                  className="recette-form__image-remove"
                  onClick={(e) => { e.stopPropagation(); removeImage() }}
                  aria-label="Supprimer l'image"
                >
                  <IconClose size={16} />
                </button>
              </>
            ) : (
              <div className="recette-form__image-placeholder">
                <IconCameraAdd size={28} />
                <span>Ajouter une photo</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: 'none' }}
          />
        </section>

        {/* ── Infos de base ── */}
        <section className="recette-form__section">
          <h3 className="recette-form__section-title">Informations</h3>

          <div className="recette-form__field">
            <label className="recette-form__label">Nom de la recette *</label>
            <input
              type="text"
              className={`recette-form__input ${errors.nom ? 'recette-form__input--error' : ''}`}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Tajine de poulet aux olives"
              autoFocus
            />
            {errors.nom && <span className="recette-form__error">{errors.nom}</span>}
          </div>

          <div className="recette-form__field">
            <label className="recette-form__label">Catégorie *</label>
            <select
              className={`recette-form__input recette-form__select ${errors.categorie ? 'recette-form__input--error' : ''}`}
              value={categorieId}
              onChange={(e) => setCategorieId(e.target.value)}
            >
              <option value="">Choisir une catégorie…</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icone} {cat.nom}
                </option>
              ))}
            </select>
            {errors.categorie && <span className="recette-form__error">{errors.categorie}</span>}
          </div>

          <div className="recette-form__field">
            <label className="recette-form__label">Difficulté</label>
            <div className="recette-form__difficulte-group">
              {DIFFICULTE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`recette-form__difficulte-btn ${difficulte === opt.value ? 'recette-form__difficulte-btn--active' : ''}`}
                  onClick={() => setDifficulte(difficulte === opt.value ? '' : opt.value)}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="recette-form__row">
            <div className="recette-form__field">
              <label className="recette-form__label">Préparation (min)</label>
              <input
                type="number"
                className="recette-form__input"
                value={tempsPrep}
                onChange={(e) => setTempsPrep(e.target.value)}
                min="0"
                placeholder="15"
              />
            </div>
            <div className="recette-form__field">
              <label className="recette-form__label">Cuisson (min)</label>
              <input
                type="number"
                className="recette-form__input"
                value={tempsCuisson}
                onChange={(e) => setTempsCuisson(e.target.value)}
                min="0"
                placeholder="30"
              />
            </div>
            <div className="recette-form__field">
              <label className="recette-form__label">Portions</label>
              <input
                type="number"
                className="recette-form__input"
                value={portions}
                onChange={(e) => handlePortionsChange(e.target.value)}
                min="1"
                placeholder="4"
              />
            </div>
          </div>

          {tempsTotal > 0 && (
            <div className="recette-form__temps-total">
              ⏱ Temps total : <strong>{tempsTotal} min</strong>
            </div>
          )}

          <div className="recette-form__field">
            <label className="recette-form__label">Tags (séparés par des virgules)</label>
            <input
              type="text"
              className="recette-form__input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="rapide, végétarien, sans gluten…"
            />
          </div>
        </section>

        {/* ── Ingrédients ── */}
        <section className="recette-form__section">
          <h3 className="recette-form__section-title">Ingrédients</h3>
          {errors.ingredients && (
            <span className="recette-form__error">{errors.ingredients}</span>
          )}

          <div className="recette-form__ingredients">
            {ingredients.map((ing, index) => (
              <IngredientRow
                key={ing._key}
                ing={ing}
                index={index}
                produitsSuggeres={getProduitsFiltered(ing._nomRecherche)}
                onUpdate={updateIngredient}
                onRemove={removeIngredient}
                canRemove={ingredients.length > 1}
              />
            ))}
          </div>

          <button type="button" className="recette-form__add-btn" onClick={addIngredient}>
            + Ajouter un ingrédient
          </button>
        </section>

        {/* ── Étapes ── */}
        <section className="recette-form__section">
          <h3 className="recette-form__section-title">Étapes de préparation</h3>
          {errors.etapes && (
            <span className="recette-form__error">{errors.etapes}</span>
          )}

          <div className="recette-form__etapes">
            {etapes.map((etape, index) => (
              <div key={index} className="recette-form__etape-row">
                <div className="recette-form__etape-numero">{index + 1}</div>
                <textarea
                  className="recette-form__textarea"
                  value={etape}
                  onChange={(e) => updateEtape(index, e.target.value)}
                  placeholder={`Étape ${index + 1}…`}
                  rows={2}
                />
                <div className="recette-form__etape-actions">
                  <button
                    type="button"
                    className="recette-form__etape-btn"
                    onClick={() => moveEtape(index, 'up')}
                    disabled={index === 0}
                    aria-label="Monter"
                  >↑</button>
                  <button
                    type="button"
                    className="recette-form__etape-btn"
                    onClick={() => moveEtape(index, 'down')}
                    disabled={index === etapes.length - 1}
                    aria-label="Descendre"
                  >↓</button>
                  <button
                    type="button"
                    className="recette-form__etape-btn recette-form__etape-btn--remove"
                    onClick={() => removeEtape(index)}
                    disabled={etapes.length <= 1}
                    aria-label="Supprimer"
                  ><IconClose size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="recette-form__add-btn" onClick={addEtape}>
            + Ajouter une étape
          </button>
        </section>

        {/* ── Conservation ── */}
        <section className="recette-form__section">
          <h3 className="recette-form__section-title">Préparation &amp; conservation</h3>

          <div className="recette-form__field">
            <label className="recette-form__label">Type de préparation</label>
            <div className="recette-form__difficulte-group">
              {([
                { value: 'plat', label: 'Plat' },
                { value: 'gouter', label: 'Goûter' },
                { value: 'dessert', label: 'Dessert' },
                { value: 'petit_dejeuner', label: 'Petit-déj.' },
                { value: 'snack', label: 'Snack' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`recette-form__difficulte-btn ${typePreparation === opt.value ? 'recette-form__difficulte-btn--active' : ''}`}
                  onClick={() => setTypePreparation(typePreparation === opt.value ? '' : opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="recette-form__row">
            <div className="recette-form__field">
              <label className="recette-form__label">Conservation</label>
              <select
                className="recette-form__input recette-form__select"
                value={modeConservation}
                onChange={(e) => setModeConservation(e.target.value)}
              >
                <option value="">Non précisé</option>
                <option value="frigo">Frigo</option>
                <option value="congélateur">Congélateur</option>
                <option value="température ambiante">Température ambiante</option>
              </select>
            </div>
            <div className="recette-form__field">
              <label className="recette-form__label">Durée (jours)</label>
              <input
                type="number"
                className="recette-form__input"
                value={dureeConservation}
                onChange={(e) => setDureeConservation(e.target.value)}
                min="1"
                max="365"
                placeholder="3"
              />
            </div>
          </div>

        </section>

      </div>

      {/* ── Footer actions ── */}
      <div className="recette-form__footer">
        <button type="button" className="recette-form__btn-cancel" onClick={onCancel}>
          Annuler
        </button>
        <button
          type="button"
          className="recette-form__btn-save"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Enregistrement…' : isEditing ? 'Enregistrer' : 'Créer la recette'}
        </button>
      </div>
    </div>
  )
}

// ─── Sub-component : ligne ingrédient ─────────────────────────────────────────

interface IngredientRowProps {
  ing: IngredientRow
  index: number
  produitsSuggeres: Array<{ id: string; nom: string }>
  onUpdate: (key: string, field: keyof IngredientRow, value: unknown) => void
  onRemove: (key: string) => void
  canRemove: boolean
}

function IngredientRow({ ing, index, produitsSuggeres, onUpdate, onRemove, canRemove }: IngredientRowProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)

  const selectProduit = (id: string, nom: string) => {
    onUpdate(ing._key, 'produit', id)
    onUpdate(ing._key, '_nomRecherche', nom)
    setShowSuggestions(false)
  }

  return (
    <div className="recette-form__ingredient-row">
      <span className="recette-form__ingredient-num">{index + 1}</span>

      {/* Nom du produit avec autocomplete */}
      <div className="recette-form__ingredient-produit">
        <input
          type="text"
          className="recette-form__input recette-form__input--sm"
          value={ing._nomRecherche}
          onChange={(e) => {
            onUpdate(ing._key, '_nomRecherche', e.target.value)
            onUpdate(ing._key, 'produit', '') // reset sélection
            setShowSuggestions(true)
          }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => ing._nomRecherche && setShowSuggestions(true)}
          placeholder="Produit…"
        />
        {showSuggestions && produitsSuggeres.length > 0 && (
          <ul className="recette-form__suggestions">
            {produitsSuggeres.map((p) => (
              <li
                key={p.id}
                className="recette-form__suggestion"
                onMouseDown={() => selectProduit(p.id, p.nom)}
              >
                {p.nom}
              </li>
            ))}
          </ul>
        )}
        {ing._nomRecherche && !ing.produit && (
          <span className="recette-form__ingredient-warning" title="Produit non trouvé dans la base">⚠️</span>
        )}
      </div>

      {/* Quantité */}
      <input
        type="number"
        className="recette-form__input recette-form__input--xs"
        value={ing.quantite}
        onChange={(e) => onUpdate(ing._key, 'quantite', parseFloat(e.target.value) || 0)}
        min="0"
        step="0.5"
        placeholder="Qté"
      />

      {/* Unité */}
      <input
        type="text"
        className="recette-form__input recette-form__input--xs"
        value={ing.unite}
        onChange={(e) => onUpdate(ing._key, 'unite', e.target.value)}
        placeholder="g, ml…"
      />

      {/* Optionnel */}
      <label className="recette-form__optionnel" title="Optionnel">
        <input
          type="checkbox"
          checked={ing.optionnel}
          onChange={(e) => onUpdate(ing._key, 'optionnel', e.target.checked)}
        />
        <span>Opt.</span>
      </label>

      {/* Supprimer */}
      <button
        type="button"
        className="recette-form__ingredient-remove"
        onClick={() => onRemove(ing._key)}
        disabled={!canRemove}
        aria-label="Supprimer l'ingrédient"
      >
        <IconClose size={14} />
      </button>
    </div>
  )
}
