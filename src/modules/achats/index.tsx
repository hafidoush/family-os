import { useState } from 'react'
import { usePersistedTab } from '../../shared/hooks/usePersistedTab'
import { useLiveQuery } from 'dexie-react-hooks'
import './achats.css'
import { db } from '../../core/db/database'
import { newEntity, withUpdate, softDeleteFields } from '../../core/db/helpers'
import { emit } from '../../core/automation/engine'
import { useNotificationsStore } from '../../shared/stores/notificationsStore'
import { ConfirmModal } from '../../shared/components/ui/ConfirmModal'
import type { WishlistItem, ContexteWishlist, PrioriteWishlist, StatutWishlist } from '../../shared/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Onglet = 'besoins' | 'envies'

const ONGLET_CONTEXTE: Record<Onglet, ContexteWishlist> = {
  besoins: 'achats_besoins',
  envies:  'achats_envies',
}

const PRIORITE_LABEL: Record<PrioriteWishlist, string> = {
  haute:   'Cette semaine',
  normale: 'Ce mois',
  basse:   'Bientôt',
}

const CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: 'enfants', label: 'Enfants',  emoji: '👧' },
  { key: 'maison',  label: 'Maison',   emoji: '🏠' },
  { key: 'sante',   label: 'Santé',    emoji: '💊' },
  { key: 'myself',  label: 'Moi',      emoji: '🌸' },
  { key: 'autre',   label: 'Autre',    emoji: '📦' },
]

const CAT_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.key, c.emoji])
)


// ─── Formulaire ────────────────────────────────────────────────────────────────

interface AchatFormProps {
  onglet: Onglet
  editItem?: WishlistItem
  onClose: () => void
}

function AchatForm({ onglet, editItem, onClose }: AchatFormProps) {
  const [nom, setNom] = useState(editItem?.nom ?? '')
  const [prix, setPrix] = useState(editItem?.prix != null ? String(editItem.prix) : '')
  const [lienUrl, setLienUrl] = useState(editItem?.lienUrl ?? '')
  const [priorite, setPriorite] = useState<PrioriteWishlist>(editItem?.priorite ?? 'haute')
  const [categorie, setCategorie] = useState<string>(editItem?.sousContexte ?? '')
  const [notes, setNotes] = useState(editItem?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { addToast } = useNotificationsStore()

  async function handleSave() {
    if (!nom.trim()) { setError('Le nom est obligatoire'); return }
    setSaving(true)
    try {
      const data = {
        nom: nom.trim(),
        prix: prix !== '' ? parseFloat(prix) : undefined,
        lienUrl: lienUrl.trim() || undefined,
        priorite,
        sousContexte: categorie || undefined,
        notes: notes.trim() || undefined,
      }
      if (editItem) {
        await db.wishlistItems.update(editItem.id, withUpdate<WishlistItem>(data))
        addToast({ message: 'Achat modifié', type: 'success', duration: 2000 })
      } else {
        await db.wishlistItems.add(newEntity<WishlistItem>({
          ...data,
          contexte: ONGLET_CONTEXTE[onglet],
          statut: 'a_decider',
          archive: false,
        }))
        addToast({ message: 'Achat ajouté', type: 'success', duration: 2000 })
      }
      onClose()
    } catch {
      addToast({ message: 'Erreur lors de la sauvegarde', type: 'error', duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  async function doDelete() {
    if (!editItem) return
    try {
      await db.wishlistItems.update(editItem.id, softDeleteFields())
      addToast({ message: 'Achat supprimé', type: 'info', duration: 2000 })
      onClose()
    } catch {
      addToast({ message: 'Erreur lors de la suppression', type: 'error', duration: 3000 })
    }
  }

  return (
    <>
    <div className="achats-modal-backdrop" onClick={onClose}>
      <div className="achats-modal" onClick={e => e.stopPropagation()}>
        <div className="achats-modal__handle" />
        <p className="achats-modal__title">
          {editItem ? 'Modifier' : onglet === 'besoins' ? 'Nouveau besoin' : 'Nouvelle envie'}
        </p>

        <div className="achats-form">
          <div className="achats-form__field">
            <label className="achats-form__label">Nom *</label>
            <input
              className="achats-form__input"
              value={nom}
              onChange={e => { setNom(e.target.value); setError('') }}
              placeholder={onglet === 'besoins' ? 'Ex : Aspirateur, Chaussures…' : 'Ex : Sac, Bijou…'}
              autoFocus
            />
            {error && <p className="achats-form__error">{error}</p>}
          </div>

          {/* Catégorie */}
          <div className="achats-form__field">
            <label className="achats-form__label">Catégorie</label>
            <div className="achats-form__cats">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  type="button"
                  className={`achats-form__cat-btn${categorie === c.key ? ' achats-form__cat-btn--active' : ''}`}
                  onClick={() => setCategorie(v => v === c.key ? '' : c.key)}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="achats-form__row">
            <div className="achats-form__field">
              <label className="achats-form__label">Prix estimé (€)</label>
              <input
                className="achats-form__input"
                type="number"
                min="0"
                step="0.01"
                value={prix}
                onChange={e => setPrix(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="achats-form__field">
              <label className="achats-form__label">Horizon</label>
              <select
                className="achats-form__select"
                value={priorite}
                onChange={e => setPriorite(e.target.value as PrioriteWishlist)}
              >
                {(Object.keys(PRIORITE_LABEL) as PrioriteWishlist[]).map(p => (
                  <option key={p} value={p}>{PRIORITE_LABEL[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="achats-form__field">
            <label className="achats-form__label">Lien URL</label>
            <input
              className="achats-form__input"
              type="url"
              value={lienUrl}
              onChange={e => setLienUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="achats-form__field">
            <label className="achats-form__label">Notes</label>
            <textarea
              className="achats-form__textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Taille, couleur, magasin préféré…"
            />
          </div>
        </div>

        <div className="achats-form__actions">
          {editItem && (
            <button className="achats-form__btn-delete" onClick={() => setConfirmDelete(true)}>Supprimer</button>
          )}
          <button className="achats-form__btn-cancel" onClick={onClose}>Annuler</button>
          <button
            className="achats-form__btn-save"
            onClick={handleSave}
            disabled={saving || !nom.trim()}
          >
            {saving ? '…' : editItem ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>

    <ConfirmModal
      open={confirmDelete}
      title="Supprimer cet achat ?"
      message="Cette action est irréversible."
      confirmLabel="Supprimer"
      danger
      onConfirm={() => { setConfirmDelete(false); doDelete(); }}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  )
}

// ─── Item card ──────────────────────────────────────────────────────────────────

interface AchatItemProps {
  item: WishlistItem
  onEdit: () => void
  onToggleAchete: () => void
}

function AchatItem({ item, onEdit, onToggleAchete }: AchatItemProps) {
  const achete = item.statut === 'achete'

  return (
    <div className={`achat-item${achete ? ' achat-item--achete' : ''}`}>
      <button
        className={`achat-item__check${achete ? ' achat-item__check--actif' : ''}`}
        onClick={onToggleAchete}
        aria-label={achete ? 'Marquer comme non acheté' : 'Marquer comme acheté'}
      >
        {achete ? '✓' : '○'}
      </button>

      <div className="achat-item__content" onClick={onEdit}>
        <span className={`achat-item__nom${achete ? ' achat-item__nom--barre' : ''}`}>
          {item.sousContexte && CAT_EMOJI[item.sousContexte] && (
            <span className="achat-item__cat-emoji">{CAT_EMOJI[item.sousContexte]} </span>
          )}
          {item.nom}
        </span>
        <div className="achat-item__meta">
          {item.prix != null && (
            <span className="achat-item__badge achat-item__badge--prix">
              {item.prix.toFixed(2)} €
            </span>
          )}
          {item.priorite && item.priorite !== 'normale' && (
            <span className={`achat-item__badge achat-item__badge--prio-${item.priorite}`}>
              {PRIORITE_LABEL[item.priorite]}
            </span>
          )}
          {item.lienUrl && (
            <a
              className="achat-item__badge achat-item__badge--lien"
              href={item.lienUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              🔗
            </a>
          )}
        </div>
        {item.notes && <p className="achat-item__notes">{item.notes}</p>}
      </div>
    </div>
  )
}

// ─── Module principal ───────────────────────────────────────────────────────────

export default function Achats() {
  const [onglet, setOnglet] = usePersistedTab<Onglet>('achats', 'besoins')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<WishlistItem | undefined>()
  const [showAchetes, setShowAchetes] = useState(false)

  const items = useLiveQuery(
    () => db.wishlistItems
      .filter(i => i.contexte === ONGLET_CONTEXTE[onglet] && !i.archive && !i.deletedAt)
      .toArray(),
    [onglet]
  )

  const aAcheter = (items ?? []).filter(i => i.statut !== 'achete')
  const achetes  = (items ?? []).filter(i => i.statut === 'achete')

  const totalEstime = aAcheter.reduce((s, i) => s + (i.prix ?? 0), 0)

  function openCreate() { setEditItem(undefined); setShowForm(true) }
  function openEdit(item: WishlistItem) { setEditItem(item); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditItem(undefined) }

  async function toggleAchete(item: WishlistItem) {
    const newStatut: StatutWishlist = item.statut === 'achete' ? 'approuve' : 'achete'
    await db.wishlistItems.update(item.id, withUpdate<WishlistItem>({ statut: newStatut }))
    const updated = { ...item, statut: newStatut }
    emit('wishlist_item.status_changed', { item: updated })
  }

  return (
    <div className="achats-module">
      {/* En-tête */}
      <div className="achats-header">
        <h1 className="achats-title">Achats</h1>
        {totalEstime > 0 && (
          <span className="achats-total">~{totalEstime.toFixed(2)} €</span>
        )}
      </div>

      {/* Onglets */}
      <div className="achats-tabs">
        {(['besoins', 'envies'] as Onglet[]).map(tab => (
          <button
            key={tab}
            className={`achats-tab${onglet === tab ? ' achats-tab--active' : ''}`}
            onClick={() => setOnglet(tab)}
          >
            {tab === 'besoins' ? 'Besoins' : 'Envies'}
            {tab === onglet && aAcheter.length > 0 && (
              <span className="achats-tab__count">{aAcheter.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Liste à acheter */}
      {items === undefined && (
        <div className="achats-skeleton" />
      )}

      {items !== undefined && aAcheter.length === 0 && achetes.length === 0 && (
        <div className="achats-empty">
          <span className="achats-empty__icon">{onglet === 'besoins' ? '🛒' : '✨'}</span>
          <p className="achats-empty__title">
            {onglet === 'besoins' ? 'Aucun besoin en attente' : 'Aucune envie listée'}
          </p>
          <button className="achats-empty__btn" onClick={openCreate}>
            Ajouter
          </button>
        </div>
      )}

      <div className="achats-list">
        {aAcheter.map(item => (
          <AchatItem
            key={item.id}
            item={item}
            onEdit={() => openEdit(item)}
            onToggleAchete={() => toggleAchete(item)}
          />
        ))}
      </div>

      {/* Section achetés */}
      {achetes.length > 0 && (
        <details
          className="achats-achetes"
          open={showAchetes}
          onToggle={e => setShowAchetes((e.target as HTMLDetailsElement).open)}
        >
          <summary className="achats-achetes__toggle">
            Achetés ({achetes.length})
          </summary>
          <div className="achats-list">
            {achetes.map(item => (
              <AchatItem
                key={item.id}
                item={item}
                onEdit={() => openEdit(item)}
                onToggleAchete={() => toggleAchete(item)}
              />
            ))}
          </div>
        </details>
      )}

      {/* FAB */}
      <button className="achats-fab" onClick={openCreate} aria-label="Ajouter">+</button>

      {showForm && (
        <AchatForm onglet={onglet} editItem={editItem} onClose={closeForm} />
      )}
    </div>
  )
}
