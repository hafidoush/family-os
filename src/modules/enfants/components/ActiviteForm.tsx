import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { newEntity, softDeleteFields } from '../../../core/db/helpers'
import { ConfirmModal } from '../../../shared/components/ui/ConfirmModal'
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

  async function handleSave() {
    if (!nom.trim() || !categorie) return
    setSaving(true)
    try {
      const data: Partial<Activite> = {
        nom:                  nom.trim(),
        categorie,
        difficulte:           difficulte || undefined,
        ageMin:               ageMin ? parseInt(ageMin) : undefined,
        ageMax:               ageMax ? parseInt(ageMax) : undefined,
        dureeEstimee:         duree  ? parseInt(duree)  : undefined,
        materiel:             materielTxt.split('\n').map(l => l.trim()).filter(Boolean),
        objectifPedagogique:  objectif.trim() || undefined,
        instructions:         instructions.trim() || undefined,
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
            {/* Nom */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Nom *</label>
              <input
                className="enfants-form__input"
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="Ex : Bac sensoriel riz coloré"
                autoFocus
              />
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
              <label className="enfants-form__label">Matériel <span className="enfants-form__hint">(un élément par ligne)</span></label>
              <textarea
                className="enfants-form__textarea"
                rows={3}
                value={materielTxt}
                onChange={e => setMaterielTxt(e.target.value)}
                placeholder={"Bac en plastique\nRiz coloré\nPetits objets"}
              />
            </div>

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
