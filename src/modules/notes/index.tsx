import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../core/db/database'
import { newEntity, withUpdate, softDeleteFields } from '../../core/db/helpers'
import { useNotificationsStore } from '../../shared/stores/notificationsStore'
import { ConfirmModal } from '../../shared/components/ui/ConfirmModal'
import type { Note, ContexteNote } from '../../shared/types'
import './notes.css'

// ─── Types ─────────────────────────────────────────────────────────────────────

const CONTEXTES: { key: ContexteNote; label: string; icon: string }[] = [
  { key: 'global',   label: 'Général',  icon: '📝' },
  { key: 'cuisine',  label: 'Cuisine',  icon: '🍳' },
  { key: 'enfants',  label: 'Enfants',  icon: '👧' },
  { key: 'myself',   label: 'Myself',   icon: '💜' },
  { key: 'maison',   label: 'Maison',   icon: '🏠' },
  { key: 'famille',  label: 'Famille',  icon: '👨‍👩‍👧' },
  { key: 'achats',   label: 'Achats',   icon: '🛒' },
]

// ─── Formulaire ────────────────────────────────────────────────────────────────

interface NoteFormProps {
  editNote?: Note
  defaultContexte?: ContexteNote
  onClose: () => void
}

function NoteForm({ editNote, defaultContexte = 'global', onClose }: NoteFormProps) {
  const [titre, setTitre] = useState(editNote?.titre ?? '')
  const [contenu, setContenu] = useState(editNote?.contenu ?? '')
  const [contexte, setContexte] = useState<ContexteNote>(editNote?.contexte ?? defaultContexte)
  const [tags, setTags] = useState((editNote?.tags ?? []).join(', '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { addToast } = useNotificationsStore()

  async function handleSave() {
    if (!contenu.trim()) { setError('Le contenu est obligatoire'); return }
    setSaving(true)
    try {
      const data = {
        titre: titre.trim() || undefined,
        contenu: contenu.trim(),
        contexte,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      }
      if (editNote) {
        await db.notes.update(editNote.id, withUpdate<Note>(data))
        addToast({ message: 'Note modifiée', type: 'success', duration: 2000 })
      } else {
        await db.notes.add(newEntity<Note>({ ...data, archive: false }))
        addToast({ message: 'Note ajoutée', type: 'success', duration: 2000 })
      }
      onClose()
    } catch {
      addToast({ message: 'Erreur lors de la sauvegarde', type: 'error', duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  async function doDelete() {
    if (!editNote) return
    try {
      await db.notes.update(editNote.id, softDeleteFields())
      addToast({ message: 'Note supprimée', type: 'info', duration: 2000 })
      onClose()
    } catch {
      addToast({ message: 'Erreur lors de la suppression', type: 'error', duration: 3000 })
    }
  }

  return (
    <>
    <div className="notes-modal-backdrop" onClick={onClose}>
      <div className="notes-modal" onClick={e => e.stopPropagation()}>
        <div className="notes-modal__handle" onClick={onClose} style={{ cursor: 'pointer' }} />

        <div className="notes-form">
          {/* Titre (optionnel) */}
          <input
            className="notes-form__titre"
            value={titre}
            onChange={e => setTitre(e.target.value)}
            placeholder="Titre (optionnel)"
          />

          {/* Contenu */}
          <textarea
            className="notes-form__contenu"
            value={contenu}
            onChange={e => { setContenu(e.target.value); setError('') }}
            placeholder="Écris ta note…"
            rows={6}
            autoFocus
          />
          {error && <p className="notes-form__error">{error}</p>}

          {/* Contexte */}
          <div className="notes-form__field">
            <label className="notes-form__label">Contexte</label>
            <div className="notes-form__contexte-grid">
              {CONTEXTES.map(c => (
                <button
                  key={c.key}
                  className={`notes-form__contexte-btn${contexte === c.key ? ' notes-form__contexte-btn--active' : ''}`}
                  onClick={() => setContexte(c.key)}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="notes-form__field">
            <label className="notes-form__label">Tags (séparés par des virgules)</label>
            <input
              className="notes-form__input"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="idée, urgent, liste…"
            />
          </div>
        </div>

        <div className="notes-form__actions">
          {editNote && (
            <button className="notes-form__btn-delete" onClick={() => setConfirmDelete(true)}>Supprimer</button>
          )}
          <button className="notes-form__btn-cancel" onClick={onClose}>Annuler</button>
          <button
            className="notes-form__btn-save"
            onClick={handleSave}
            disabled={saving || !contenu.trim()}
          >
            {saving ? '…' : editNote ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>

    <ConfirmModal
      open={confirmDelete}
      title="Supprimer cette note ?"
      message="Cette action est irréversible."
      confirmLabel="Supprimer"
      danger
      onConfirm={() => { setConfirmDelete(false); doDelete(); }}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  )
}

// ─── Carte note ─────────────────────────────────────────────────────────────────

function NoteCard({ note, onEdit }: { note: Note; onEdit: () => void }) {
  const ctx = CONTEXTES.find(c => c.key === note.contexte)
  const preview = note.contenu.length > 120 ? note.contenu.slice(0, 120) + '…' : note.contenu

  return (
    <div className="note-card" onClick={onEdit}>
      {note.titre && <p className="note-card__titre">{note.titre}</p>}
      <p className="note-card__contenu">{preview}</p>
      <div className="note-card__footer">
        {ctx && (
          <span className="note-card__contexte">{ctx.icon} {ctx.label}</span>
        )}
        {note.tags && note.tags.length > 0 && note.tags.map(tag => (
          <span key={tag} className="note-card__tag">#{tag}</span>
        ))}
        <span className="note-card__date">
          {new Date(note.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  )
}

// ─── Module principal ───────────────────────────────────────────────────────────

export default function Notes() {
  const [showForm, setShowForm] = useState(false)
  const [editNote, setEditNote] = useState<Note | undefined>()
  const [filtreContexte, setFiltreContexte] = useState<ContexteNote | 'tous'>('tous')
  const [recherche, setRecherche] = useState('')

  const notes = useLiveQuery(
    () => db.notes
      .filter(n => !n.archive && !n.deletedAt)
      .toArray()
      .then(list => list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())),
    []
  )

  const filtered = (notes ?? []).filter(n => {
    const matchContexte = filtreContexte === 'tous' || n.contexte === filtreContexte
    const q = recherche.toLowerCase()
    const matchRecherche = !q ||
      n.titre?.toLowerCase().includes(q) ||
      n.contenu.toLowerCase().includes(q) ||
      n.tags?.some(t => t.toLowerCase().includes(q))
    return matchContexte && matchRecherche
  })

  function openCreate() { setEditNote(undefined); setShowForm(true) }
  function openEdit(note: Note) { setEditNote(note); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditNote(undefined) }

  return (
    <div className="notes-module">
      {/* En-tête */}
      <div className="notes-header">
        <h1 className="notes-title">Notes</h1>
        {notes && notes.length > 0 && (
          <span className="notes-count">{notes.length}</span>
        )}
      </div>

      {/* Recherche */}
      <div className="notes-search">
        <span className="notes-search__icon">🔍</span>
        <input
          className="notes-search__input"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher…"
        />
        {recherche && (
          <button className="notes-search__clear" onClick={() => setRecherche('')}>✕</button>
        )}
      </div>

      {/* Filtres contexte */}
      <div className="notes-filtres">
        <button
          className={`notes-filtre${filtreContexte === 'tous' ? ' notes-filtre--active' : ''}`}
          onClick={() => setFiltreContexte('tous')}
        >
          Tous
        </button>
        {CONTEXTES.map(c => (
          <button
            key={c.key}
            className={`notes-filtre${filtreContexte === c.key ? ' notes-filtre--active' : ''}`}
            onClick={() => setFiltreContexte(c.key)}
          >
            {c.icon}
          </button>
        ))}
      </div>

      {/* État vide */}
      {notes === undefined && (
        <>
          <div className="notes-skeleton" />
          <div className="notes-skeleton" style={{ height: 80 }} />
        </>
      )}

      {notes !== undefined && filtered.length === 0 && (
        <div className="notes-empty">
          <span className="notes-empty__icon">📝</span>
          <p className="notes-empty__title">
            {recherche || filtreContexte !== 'tous' ? 'Aucun résultat' : 'Aucune note pour l\'instant'}
          </p>
          {!recherche && filtreContexte === 'tous' && (
            <button className="notes-empty__btn" onClick={openCreate}>
              Créer une note
            </button>
          )}
        </div>
      )}

      {/* Liste */}
      <div className="notes-list">
        {filtered.map(note => (
          <NoteCard key={note.id} note={note} onEdit={() => openEdit(note)} />
        ))}
      </div>

      {/* FAB */}
      <button className="notes-fab" onClick={openCreate} aria-label="Nouvelle note">+</button>

      {showForm && (
        <NoteForm editNote={editNote} onClose={closeForm} />
      )}
    </div>
  )
}
