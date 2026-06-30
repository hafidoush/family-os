import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import './ImportRecetteSheet.css'
import { db } from '../../../../core/db/database'
import { useImportWorkflow } from '../../hooks/useImportRecetteIA'
import { compressImageToBase64 } from '../../services/recetteService'
import type { RecetteExtractee, IngredientExtrait } from '../../../../shared/types'
import type { RecetteValideeFormData, IngredientValideFormData } from '../../services/importRecetteIAService'
import { IconLink, IconClipboard, IconCamera, IconCameraAdd, IconClose, IconShieldWarning } from '@shared/components/ui/Icon/Icon'
import type { Produit } from '../../../../shared/types'

// ─── Autocomplétion ingrédient ────────────────────────────────────────────────

interface IngredientNomInputProps {
  value: string
  produitId: string | undefined
  tousLesProduits: Produit[]
  onChange: (nomLibre: string, produitId: string | undefined) => void
}

function normaliser(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function IngredientNomInput({ value, produitId, tousLesProduits, onChange }: IngredientNomInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const suggestions = value.trim().length >= 1
    ? tousLesProduits
        .filter(p => normaliser(p.nom).includes(normaliser(value)))
        .slice(0, 6)
    : []

  const updateDropdownPos = () => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 2000,
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value, undefined)
    setShowSuggestions(true)
    updateDropdownPos()
  }

  const handleFocus = () => {
    setShowSuggestions(true)
    updateDropdownPos()
  }

  const handleSelect = (produit: Produit) => {
    onChange(produit.nom, produit.id)
    setShowSuggestions(false)
  }

  return (
    <div className="import-ingredient__nom-wrap">
      <input
        ref={inputRef}
        className="import-ingredient__nom"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder="Ingrédient"
      />
      {showSuggestions && suggestions.length > 0 && createPortal(
        <ul className="import-ingredient__suggestions" style={dropdownStyle}>
          {suggestions.map(p => (
            <li
              key={p.id}
              className="import-ingredient__suggestion"
              onMouseDown={() => handleSelect(p)}
            >
              {p.nom}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  )
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

const TAGS_GROUPES = [
  { groupe: 'Cuisine', tags: [
    { id: 'française', label: 'Française' }, { id: 'italienne', label: 'Italienne' },
    { id: 'espagnole', label: 'Espagnole' }, { id: 'grecque', label: 'Grecque' },
    { id: 'marocaine', label: 'Marocaine' }, { id: 'asiatique', label: 'Asiatique' },
    { id: 'indienne', label: 'Indienne' },   { id: 'mexicaine', label: 'Mexicaine' },
    { id: 'fast-food', label: 'Fast-food' }, { id: 'autre', label: 'Autre' },
  ]},
  { groupe: 'Goût', tags: [
    { id: 'salé', label: 'Salé' }, { id: 'sucré', label: 'Sucré' },
    { id: 'réconfortant', label: 'Réconfortant' }, { id: 'frais & léger', label: 'Frais & léger' },
  ]},
  { groupe: 'Rapidité', tags: [
    { id: 'rapide', label: 'Rapide' }, { id: 'batch cooking', label: 'Batch cooking' },
  ]},
  { groupe: 'Occasion', tags: [
    { id: 'apéro', label: 'Apéro' },       { id: 'barbecue', label: 'Barbecue' },
    { id: 'fête', label: 'Fête' },         { id: 'réception', label: 'Réception' },
    { id: 'ramadan', label: 'Ramadan' },   { id: 'pizza & tartes', label: 'Pizza & tartes' },
  ]},
  { groupe: 'Saison', tags: [
    { id: 'printemps', label: 'Printemps' }, { id: 'été', label: 'Été' },
    { id: 'automne', label: 'Automne' },     { id: 'hiver', label: 'Hiver' },
  ]},
  { groupe: 'Profil', tags: [
    { id: 'enfant', label: 'Enfant' },           { id: 'bébé', label: 'Bébé' },
    { id: 'sans viande', label: 'Sans viande' }, { id: 'économique', label: 'Économique' },
    { id: 'hyperprotéiné', label: 'Hyperprotéiné' },
  ]},
]

// ─── Types internes ───────────────────────────────────────────────────────────

type ModeImport = 'url' | 'texte' | 'image'

interface IngredientEditable extends IngredientValideFormData {
  _key: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newIngredientEditable(): IngredientEditable {
  return { _key: crypto.randomUUID(), nomLibre: '', optionnel: false }
}

function fromExtrait(ing: IngredientExtrait): IngredientEditable {
  return {
    _key:       crypto.randomUUID(),
    nomLibre:   ing.nom,
    produitId:  ing.produitMatchId,
    quantite:   ing.quantite,
    unite:      ing.unite,
    optionnel:  ing.optionnel,
    groupe:     ing.groupe,
  }
}

function scoreLabel(score: number): { level: 'high' | 'mid' | 'low'; text: string } {
  if (score >= 0.8) return { level: 'high', text: 'Extraction de bonne qualité — vérifiez rapidement' }
  if (score >= 0.5) return { level: 'mid',  text: 'Extraction partielle — vérifiez les ingrédients et étapes' }
  return              { level: 'low',  text: 'Extraction incomplète — corrections probablement nécessaires' }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
  onSuccess: (recetteId: string) => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function ImportRecetteSheet({ onClose, onSuccess }: Props) {
  const { etat, importerTexte, importerURL, importerImage, valider, reessayer, reinitialiser } = useImportWorkflow()

  // ── Saisie ──
  const [mode, setMode] = useState<ModeImport>('url')
  const [url, setUrl]           = useState('')
  const [texte, setTexte]       = useState('')
  const [imageB64, setImageB64] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Formulaire de validation ──
  const [nom, setNom]           = useState('')
  const [categorieId, setCategorieId] = useState('')
  const [difficulte, setDifficulte]   = useState<'facile' | 'moyen' | 'difficile' | ''>('')
  const [tempsPrep, setTempsPrep]     = useState('')
  const [tempsCuisson, setTempsCuisson] = useState('')
  const [portions, setPortions]       = useState('')
  const [etapes, setEtapes]           = useState<string[]>([])
  const [ingredients, setIngredients] = useState<IngredientEditable[]>([])
  const [notes, setNotes]             = useState('')
  const [tags, setTags]               = useState<string[]>([])
  const [photoB64, setPhotoB64]       = useState<string | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving]           = useState(false)

  const categories = useLiveQuery(() => db.categoriesRecettes.orderBy('ordre').toArray(), [], [])
  const tousLesProduits = useLiveQuery(
    () => db.produits.filter(p => !p.archive && !p.deletedAt).toArray(),
    [],
    [] as Produit[]
  )

  // Pré-remplir le formulaire quand l'extraction arrive
  const initialiserFormulaire = useCallback((recette: RecetteExtractee) => {
    setNom(recette.nom)
    setDifficulte(recette.difficulte ?? '')
    setTempsPrep(recette.tempsPreparation?.toString() ?? '')
    setTempsCuisson(recette.tempsCuisson?.toString() ?? '')
    setPortions(recette.portions?.toString() ?? '')
    setEtapes(recette.etapes.length > 0 ? recette.etapes : [''])
    setIngredients(recette.ingredients.map(fromExtrait))
    setNotes(recette.notes ?? '')
    // Catégorie : auto-sélectionner "Autre" si une seule catégorie disponible
    if (categories && categories.length === 1) setCategorieId(categories[0].id)
  }, [categories])

  // Déclenché quand l'extraction passe à 'validation'
  const prevEtape = useRef(etat.etape)
  useEffect(() => {
    if (etat.etape === 'validation' && prevEtape.current !== 'validation' && etat.recetteExtractee) {
      initialiserFormulaire(etat.recetteExtractee)
    }
    prevEtape.current = etat.etape
  }, [etat.etape, etat.recetteExtractee, initialiserFormulaire])

  // ── Handlers image ────────────────────────────────────────────────────────

  const handleImageFile = async (file: File) => {
    const b64 = await compressImageToBase64(file, 1200, 0.85)
    setImageB64(b64)
  }

  // ── Lancer extraction ─────────────────────────────────────────────────────

  const lancer = useCallback(async () => {
    if (mode === 'url')    await importerURL(url.trim(), texte.trim())
    if (mode === 'texte')  await importerTexte(texte.trim())
    if (mode === 'image' && imageB64) await importerImage(imageB64, url.trim() || undefined)
  }, [mode, url, texte, imageB64, importerURL, importerTexte, importerImage])

  const canLancer = (
    (mode === 'url'   && url.trim().length > 5 && texte.trim().length > 20) ||
    (mode === 'texte' && texte.trim().length > 20) ||
    (mode === 'image' && imageB64 !== null)
  )

  // ── Ingrédients ──────────────────────────────────────────────────────────

  const updateIngredient = (key: string, patch: Partial<IngredientEditable>) => {
    setIngredients(prev => prev.map(i => i._key === key ? { ...i, ...patch } : i))
  }

  const removeIngredient = (key: string) => {
    setIngredients(prev => prev.filter(i => i._key !== key))
  }

  // ── Étapes ───────────────────────────────────────────────────────────────

  const updateEtape = (idx: number, val: string) =>
    setEtapes(prev => prev.map((e, i) => i === idx ? val : e))

  const removeEtape = (idx: number) =>
    setEtapes(prev => prev.filter((_, i) => i !== idx))

  // ── Sauvegarder ──────────────────────────────────────────────────────────

  const handlePhotoFile = async (file: File) => {
    const b64 = await compressImageToBase64(file, 900, 0.78)
    setPhotoB64(b64)
  }

  const sauvegarder = async () => {
    if (!categorieId || !nom.trim()) return
    setSaving(true)
    try {
      const data: RecetteValideeFormData = {
        nom:              nom.trim(),
        categorieId,
        difficulte:       difficulte || undefined,
        tempsPreparation: tempsPrep ? parseInt(tempsPrep) : undefined,
        tempsCuisson:     tempsCuisson ? parseInt(tempsCuisson) : undefined,
        portions:         portions ? parseInt(portions) : undefined,
        etapes:           etapes.filter(e => e.trim()),
        tags:             tags.length > 0 ? tags : undefined,
        notes:            notes.trim() || undefined,
        ingredients:      ingredients.filter(i => i.nomLibre.trim()),
        imageData:        photoB64 ?? undefined,
      }
      await valider(data)
    } finally {
      setSaving(false)
    }
  }

  // Succès → remonter l'id (dans un effet pour éviter setState pendant le rendu)
  useEffect(() => {
    if (etat.etape === 'succes' && etat.recetteId) {
      onSuccess(etat.recetteId)
    }
  }, [etat.etape, etat.recetteId, onSuccess])

  // ── Render ────────────────────────────────────────────────────────────────

  const renderSaisie = () => (
    <>
      {/* Choix du mode */}
      <div className="import-modes">
        {([
          { id: 'url'   as const, icon: <IconLink size={20} /> as ReactNode, label: 'Depuis un lien', sub: 'Instagram, blog, site recette…' },
          { id: 'texte' as const, icon: <IconClipboard size={20} /> as ReactNode, label: 'Coller du texte', sub: 'Copier-coller le contenu de la page' },
          { id: 'image' as const, icon: <IconCamera size={20} /> as ReactNode, label: 'Screenshot', sub: 'Photo, capture d\'écran, image' },
        ]).map(m => (
          <button
            key={m.id}
            className={`import-mode-btn${mode === m.id ? ' import-mode-btn--active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            <span className="import-mode-btn__icon">{m.icon}</span>
            <span className="import-mode-btn__text">
              <span className="import-mode-btn__label">{m.label}</span>
              <span className="import-mode-btn__sub">{m.sub}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Champs selon le mode */}
      {mode === 'url' && (
        <>
          <div className="import-field">
            <label className="import-field__label">URL de la recette</label>
            <input
              className="import-field__input"
              type="url"
              placeholder="https://…"
              value={url}
              onChange={e => setUrl(e.target.value)}
              autoFocus
            />
          </div>
          <div className="import-field">
            <label className="import-field__label">Contenu de la page (copier-coller)</label>
            <textarea
              className="import-field__textarea"
              placeholder="Ouvrez la page, sélectionnez tout (Cmd+A), copiez (Cmd+C) et collez ici…"
              value={texte}
              onChange={e => setTexte(e.target.value)}
              rows={6}
            />
          </div>
        </>
      )}

      {mode === 'texte' && (
        <div className="import-field">
          <label className="import-field__label">Texte de la recette</label>
          <textarea
            className="import-field__textarea"
            placeholder="Collez ici le texte complet de la recette…"
            value={texte}
            onChange={e => setTexte(e.target.value)}
            rows={10}
            autoFocus
          />
        </div>
      )}

      {mode === 'image' && (
        <>
          {url !== '' || mode === 'image' ? null : null}
          <div
            className="import-image-zone"
            onClick={() => fileRef.current?.click()}
          >
            {imageB64 ? (
              <>
                <img src={imageB64} alt="Aperçu" className="import-image-preview" />
                <button
                  className="import-image-remove"
                  onClick={e => { e.stopPropagation(); setImageB64(null) }}
                ><IconClose size={16} /></button>
              </>
            ) : (
              <>
                <span className="import-image-zone__icon"><IconCameraAdd size={28} /></span>
                <span className="import-image-zone__label">Toucher pour choisir une image</span>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }}
          />
          {imageB64 && (
            <div className="import-field" style={{ marginTop: 12 }}>
              <label className="import-field__label">URL source (optionnel)</label>
              <input
                className="import-field__input"
                type="url"
                placeholder="https://instagram.com/…"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>
          )}
        </>
      )}
    </>
  )

  const renderExtraction = () => (
    <div className="import-extracting">
      <div className="import-extracting__spinner" />
      <p className="import-extracting__label">
        {mode === 'image' ? 'Analyse de l\'image en cours…' : 'Extraction de la recette en cours…'}
      </p>
    </div>
  )

  const renderValidation = () => {
    const recette = etat.recetteExtractee!
    const { level, text: scoreText } = scoreLabel(recette.confidenceScore)

    return (
      <>
        {/* Score de confiance */}
        <div className={`import-confidence import-confidence--${level}`}>
          <span className="import-confidence__dot" />
          <span className="import-confidence__text">{scoreText}</span>
        </div>

        {/* Photo */}
        <div className="import-section">
          <p className="import-section__title">Photo (optionnel)</p>
          <div
            className="import-image-zone"
            onClick={() => photoRef.current?.click()}
          >
            {photoB64 ? (
              <>
                <img src={photoB64} alt="Photo recette" className="import-image-preview" />
                <button
                  className="import-image-remove"
                  onClick={e => { e.stopPropagation(); setPhotoB64(null) }}
                >✕</button>
              </>
            ) : (
              <>
                <span className="import-image-zone__icon"><IconCameraAdd size={28} /></span>
                <span className="import-image-zone__label">Ajouter une photo</span>
              </>
            )}
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f) }}
          />
        </div>

        {/* Infos de base */}
        <div className="import-section">
          <p className="import-section__title">Informations</p>

          <div className="import-field">
            <label className="import-field__label">Nom de la recette *</label>
            <input
              className="import-field__input"
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Nom de la recette"
            />
          </div>

          <div className="import-field">
            <label className="import-field__label">Catégorie *</label>
            <select
              className="import-field__input"
              value={categorieId}
              onChange={e => setCategorieId(e.target.value)}
            >
              <option value="">Choisir…</option>
              {(categories ?? []).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icone} {cat.nom}</option>
              ))}
            </select>
          </div>

          <div className="import-field">
            <label className="import-field__label">Difficulté</label>
            <div className="import-diff-group">
              {(['facile', 'moyen', 'difficile'] as const).map(d => (
                <button
                  key={d}
                  className={`import-diff-btn${difficulte === d ? ' import-diff-btn--active' : ''}`}
                  onClick={() => setDifficulte(difficulte === d ? '' : d)}
                >
                  {d === 'facile' ? '🟢 Facile' : d === 'moyen' ? '🟡 Moyen' : '🔴 Difficile'}
                </button>
              ))}
            </div>
          </div>

          <div className="import-row">
            <div className="import-field">
              <label className="import-field__label">Prépa (min)</label>
              <input
                className="import-field__input"
                type="number" min="0"
                value={tempsPrep}
                onChange={e => setTempsPrep(e.target.value)}
                placeholder="15"
              />
            </div>
            <div className="import-field">
              <label className="import-field__label">Cuisson (min)</label>
              <input
                className="import-field__input"
                type="number" min="0"
                value={tempsCuisson}
                onChange={e => setTempsCuisson(e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="import-field">
              <label className="import-field__label">Portions</label>
              <input
                className="import-field__input"
                type="number" min="1"
                value={portions}
                onChange={e => setPortions(e.target.value)}
                placeholder="4"
              />
            </div>
          </div>
        </div>

        {/* Ingrédients */}
        <div className="import-section">
          <p className="import-section__title">
            Ingrédients — {ingredients.filter(i => i.produitId).length}/{ingredients.length} liés au catalogue
          </p>

          {ingredients.map(ing => {
            const hasValue    = ing.nomLibre.trim().length > 0
            const isMatched   = hasValue && !!ing.produitId
            const isUnmatched = hasValue && !ing.produitId
            return (
            <div
              key={ing._key}
              className={`import-ingredient-row${isMatched ? ' import-ingredient-row--matched' : isUnmatched ? ' import-ingredient-row--unmatched' : ''}`}
            >
              <span className="import-ingredient__status">
                {isMatched ? '✓' : isUnmatched ? <IconShieldWarning size={14} /> : null}
              </span>
              <IngredientNomInput
                value={ing.nomLibre}
                produitId={ing.produitId}
                tousLesProduits={tousLesProduits}
                onChange={(nomLibre, produitId) => updateIngredient(ing._key, { nomLibre, produitId })}
              />
              <input
                className="import-ingredient__qte"
                type="number" min="0" step="0.5"
                value={ing.quantite ?? ''}
                onChange={e => updateIngredient(ing._key, { quantite: parseFloat(e.target.value) || undefined })}
                placeholder="Qté"
              />
              <input
                className="import-ingredient__unite"
                value={ing.unite ?? ''}
                onChange={e => updateIngredient(ing._key, { unite: e.target.value || undefined })}
                placeholder="g, ml…"
              />
              <button
                className="import-ingredient__remove"
                onClick={() => removeIngredient(ing._key)}
              ><IconClose size={14} /></button>
            </div>
            )
          })}

          <button
            className="import-add-btn"
            onClick={() => setIngredients(prev => [...prev, newIngredientEditable()])}
          >
            + Ajouter un ingrédient
          </button>
        </div>

        {/* Étapes */}
        <div className="import-section">
          <p className="import-section__title">Étapes ({etapes.filter(e => e.trim()).length})</p>

          {etapes.map((etape, idx) => (
            <div key={idx} className="import-etape-row">
              <span className="import-etape-num">{idx + 1}</span>
              <textarea
                className="import-etape-textarea"
                value={etape}
                onChange={e => updateEtape(idx, e.target.value)}
                rows={2}
                placeholder={`Étape ${idx + 1}…`}
              />
              <button
                className="import-etape-remove"
                onClick={() => removeEtape(idx)}
                disabled={etapes.length <= 1}
              ><IconClose size={14} /></button>
            </div>
          ))}

          <button
            className="import-add-btn"
            onClick={() => setEtapes(prev => [...prev, ''])}
          >
            + Ajouter une étape
          </button>
        </div>

        {/* Tags */}
        <div className="import-section">
          <p className="import-section__title">Tags</p>
          {TAGS_GROUPES.map(({ groupe, tags: groupeTags }) => (
            <div key={groupe} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{groupe}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {groupeTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => setTags(prev => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      border: tags.includes(tag.id) ? '1.5px solid #6F7ED6' : '1px solid var(--color-border-tertiary)',
                      background: tags.includes(tag.id) ? 'rgba(111,126,214,0.12)' : 'var(--color-background-primary)',
                      color: tags.includes(tag.id) ? '#6F7ED6' : 'var(--color-text-secondary)',
                      fontSize: 13,
                      fontWeight: tags.includes(tag.id) ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Astuces & variantes */}
        <div className="import-section">
          <p className="import-section__title">Notes &amp; conseils</p>
          <textarea
            className="import-field__textarea import-field__textarea--notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="Astuces, variantes ou conseils détectés par l'IA — modifiable"
          />
        </div>

        {/* Espace bas */}
        <div style={{ height: 8 }} />
      </>
    )
  }

  const renderErreur = () => (
    <div className="import-error">
      <p className="import-error__title">Extraction impossible</p>
      <p className="import-error__msg">{etat.erreur}</p>
    </div>
  )

  const isValidation = etat.etape === 'validation' || etat.etape === 'sauvegarde'
  const canSave = nom.trim().length > 0 && categorieId.length > 0 && !saving

  return createPortal(
    <div className="import-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="import-sheet">
        <div className="import-handle" />

        {/* Header */}
        <div className="import-header">
          <span className="import-header__title">
            {etat.etape === 'saisie'     && 'Importer une recette'}
            {etat.etape === 'extraction' && 'Analyse en cours…'}
            {isValidation                && 'Vérifier la recette'}
            {etat.etape === 'erreur'     && 'Erreur d\'extraction'}
          </span>
          {etat.etape !== 'extraction' && (
            <button className="import-header__close" onClick={onClose}><IconClose size={18} /></button>
          )}
        </div>

        {/* Corps */}
        <div className="import-body">
          {etat.etape === 'saisie'     && renderSaisie()}
          {etat.etape === 'extraction' && renderExtraction()}
          {isValidation                && renderValidation()}
          {etat.etape === 'erreur'     && (
            <>
              {renderErreur()}
              {renderSaisie()}
            </>
          )}
        </div>

        {/* Footer */}
        {etat.etape === 'saisie' && (
          <div className="import-footer">
            <button className="import-btn-secondary" onClick={onClose}>Annuler</button>
            <button
              className="import-btn-primary"
              disabled={!canLancer}
              onClick={lancer}
            >
              Analyser avec l'IA
            </button>
          </div>
        )}

        {etat.etape === 'erreur' && (
          <div className="import-footer">
            <button className="import-btn-secondary" onClick={reinitialiser}>Recommencer</button>
            <button className="import-btn-primary" disabled={!canLancer} onClick={lancer}>
              Réessayer
            </button>
          </div>
        )}

        {isValidation && (
          <div className="import-footer">
            <button className="import-btn-secondary" onClick={reinitialiser}>Recommencer</button>
            <button
              className="import-btn-primary"
              disabled={!canSave}
              onClick={sauvegarder}
            >
              {saving ? 'Enregistrement…' : 'Sauvegarder la recette'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
