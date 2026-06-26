import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { newEntity, softDeleteFields } from '../../../core/db/helpers'
import { ConfirmModal } from '../../../shared/components/ui/ConfirmModal'
import { genererFicheActivite } from '../../../core/ai/preparationActiviteService'
import { hasClaudeKey } from '../../../core/ai/claudeService'
import type { Activite, DifficulteActivite } from '../../../shared/types'

interface ActiviteFormProps {
  editItem?: Activite
  onClose: () => void
}

const DIFFICULTES: { key: DifficulteActivite; label: string }[] = [
  { key: 'facile',    label: 'Facile'    },
  { key: 'moyen',     label: 'Moyen'     },
  { key: 'difficile', label: 'Difficile' },
]

// Map label IA → clé interne
const DIFF_MAP: Record<string, DifficulteActivite> = {
  Facile: 'facile', Moyen: 'moyen', Difficile: 'difficile',
}

export function ActiviteForm({ editItem, onClose }: ActiviteFormProps) {
  const categories = useLiveQuery(() => db.categoriesActivites.toArray(), []) ?? []

  const [nom,           setNom]           = useState(editItem?.nom ?? '')
  const [categorie,     setCategorie]     = useState(editItem?.categorie ?? '')
  const [difficulte,    setDifficulte]    = useState<DifficulteActivite | ''>(editItem?.difficulte ?? '')
  const [ageMin,        setAgeMin]        = useState(editItem?.ageMin?.toString() ?? '')
  const [ageMax,        setAgeMax]        = useState(editItem?.ageMax?.toString() ?? '')
  const [duree,         setDuree]         = useState(editItem?.dureeEstimee?.toString() ?? '')
  const [materielTxt,   setMaterielTxt]   = useState((editItem?.materiel ?? []).join('\n'))
  const [objectif,      setObjectif]      = useState(editItem?.objectifPedagogique ?? '')
  const [instructions,  setInstructions]  = useState(editItem?.instructions ?? '')
  const [saving,        setSaving]        = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ─── Préparation IA ────────────────────────────────────────────────────────
  const [prepTexte,   setPrepTexte]   = useState(editItem?.preparationTexte ?? '')
  const [prepDelai,   setPrepDelai]   = useState<number>(editItem?.preparationDelaiJours ?? 0)
  const [prepUrgence, setPrepUrgence] = useState<'immediate' | 'veille' | 'plusieurs_jours'>(
    editItem?.preparationUrgence ?? 'immediate'
  )
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError,   setAiError]   = useState<string | null>(null)

  const showAiBtn = nom.trim().length > 0

  async function handleIA() {
    if (!hasClaudeKey()) {
      setAiError('Clé Claude manquante — configure-la dans Paramètres → Intelligence artificielle.')
      return
    }
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await genererFicheActivite(nom.trim())

      // Auto-remplissage de tous les champs
      setObjectif(result.objectifPedagogique)
      setMaterielTxt(result.materiel)
      setInstructions(result.instructions)
      setDuree(result.dureeEstimee.toString())
      setAgeMin(result.ageMin.toString())
      setAgeMax(result.ageMax.toString())
      if (DIFF_MAP[result.difficulte]) setDifficulte(DIFF_MAP[result.difficulte])
      setPrepTexte(result.preparationTexte)
      setPrepDelai(result.preparationDelaiJours)
      setPrepUrgence(result.preparationUrgence)
    } catch {
      setAiError('Erreur lors de la génération. Vérifiez votre clé Claude dans les paramètres.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSave() {
    if (!nom.trim() || !categorie) return
    setSaving(true)
    try {
      const materielItems = materielTxt.split('\n').map(l => l.trim()).filter(Boolean)
      const data: Partial<Activite> = {
        nom:                  nom.trim(),
        categorie,
        difficulte:           difficulte || undefined,
        ageMin:               ageMin ? parseInt(ageMin) : undefined,
        ageMax:               ageMax ? parseInt(ageMax) : undefined,
        dureeEstimee:         duree  ? parseInt(duree)  : undefined,
        materiel:             materielItems,
        objectifPedagogique:  objectif.trim() || undefined,
        instructions:         instructions.trim() || undefined,
        preparationTexte:     prepTexte.trim() || undefined,
        preparationDelaiJours: prepDelai,
        preparationUrgence:   prepDelai > 0 ? prepUrgence : undefined,
        statutBibliotheque:   editItem?.statutBibliotheque ?? 'a_faire',
        archive:              false,
      }
      if (editItem) {
        await db.activites.update(editItem.id, { ...data, updatedAt: new Date() })
      } else {
        await db.activites.add(newEntity<Activite>(data as Omit<Activite, 'id' | 'createdAt' | 'updatedAt' | 'deviceId'>))
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editItem) return
    await db.activites.update(editItem.id, softDeleteFields())
    onClose()
  }

  return (
    <>
      <div className="enfants-form-backdrop" onClick={onClose}>
        <div className="enfants-form-sheet" onClick={e => e.stopPropagation()}>
          <div className="enfants-form-sheet__handle" />
          <p className="enfants-form-sheet__title">
            {editItem ? 'Modifier l\'activité' : 'Nouvelle activité'}
          </p>

          <div className="enfants-form-body">
            {/* Nom + bouton IA */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Nom *</label>
              <input
                className="enfants-form__input"
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="Ex : Bac sensoriel riz coloré"
                autoFocus
              />
              {showAiBtn && (
                <button
                  type="button"
                  className="enfants-form__btn-ia"
                  onClick={handleIA}
                  disabled={aiLoading}
                >
                  {aiLoading ? 'Génération en cours…' : '✨ Compléter avec l\'IA'}
                </button>
              )}
              {aiError && <p className="enfants-form__ia-error">{aiError}</p>}
            </div>

            {/* Catégorie */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Catégorie *</label>
              <select
                className="enfants-form__input"
                value={categorie}
                onChange={e => setCategorie(e.target.value)}
              >
                <option value="">Choisir une catégorie…</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>
                ))}
              </select>
            </div>

            {/* Difficulté */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Difficulté</label>
              <div className="enfants-form__btn-group">
                {DIFFICULTES.map(d => (
                  <button
                    key={d.key}
                    type="button"
                    className={`enfants-form__btn-choice${difficulte === d.key ? ' enfants-form__btn-choice--active' : ''}`}
                    onClick={() => setDifficulte(prev => prev === d.key ? '' : d.key)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Âge */}
            <div className="enfants-form__row">
              <div className="enfants-form__field">
                <label className="enfants-form__label">Âge min (mois)</label>
                <input
                  className="enfants-form__input"
                  type="number"
                  min="0"
                  value={ageMin}
                  onChange={e => setAgeMin(e.target.value)}
                  placeholder="12"
                />
              </div>
              <div className="enfants-form__field">
                <label className="enfants-form__label">Âge max (mois)</label>
                <input
                  className="enfants-form__input"
                  type="number"
                  min="0"
                  value={ageMax}
                  onChange={e => setAgeMax(e.target.value)}
                  placeholder="60"
                />
              </div>
            </div>

            {/* Durée */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Durée estimée (min)</label>
              <input
                className="enfants-form__input"
                type="number"
                min="1"
                value={duree}
                onChange={e => setDuree(e.target.value)}
                placeholder="20"
              />
            </div>

            {/* Matériel */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">
                Matériel <span className="enfants-form__hint">(un élément par ligne)</span>
              </label>
              <textarea
                className="enfants-form__textarea"
                rows={3}
                value={materielTxt}
                onChange={e => setMaterielTxt(e.target.value)}
                placeholder={"Bac en plastique\nRiz coloré\nPetits objets"}
              />
            </div>

            {/* Résultat préparation IA */}
            {prepDelai > 0 && prepTexte && (
              <div className="enfants-form__prep-result">
                <div className="enfants-form__prep-result__header">
                  <span className="enfants-form__prep-result__label">
                    Préparation — {prepDelai === 1 ? 'la veille' : `${prepDelai} jours avant`}
                  </span>
                  <button
                    type="button"
                    className="enfants-form__prep-result__clear"
                    onClick={() => { setPrepTexte(''); setPrepDelai(0); }}
                  >
                    ✕
                  </button>
                </div>
                <p className="enfants-form__prep-result__text">{prepTexte}</p>
              </div>
            )}

            {/* Objectif pédagogique */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Objectif pédagogique</label>
              <textarea
                className="enfants-form__textarea"
                rows={2}
                value={objectif}
                onChange={e => setObjectif(e.target.value)}
                placeholder="Développer la motricité fine, stimuler les sens…"
              />
            </div>

            {/* Instructions */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Instructions</label>
              <textarea
                className="enfants-form__textarea"
                rows={3}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="1. Préparer le bac…&#10;2. Verser le riz…"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="enfants-form__actions">
            {editItem && (
              <button className="enfants-form__btn-delete" onClick={() => setConfirmDelete(true)}>
                Supprimer
              </button>
            )}
            <button className="enfants-form__btn-cancel" onClick={onClose}>Annuler</button>
            <button
              className="enfants-form__btn-save"
              onClick={handleSave}
              disabled={!nom.trim() || !categorie || saving}
            >
              {saving ? '…' : editItem ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Supprimer cette activité ?"
        message="Elle sera retirée du catalogue et du planning."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={async () => { setConfirmDelete(false); await handleDelete() }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
