import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { newEntity, softDeleteFields } from '../../../core/db/helpers';
import { emit } from '../../../core/automation/engine';
import type { WishlistItem, StatutWishlist, PrioriteWishlist } from '../../../shared/types';

const CATEGORIES = ['Beauty', 'Skincare', 'Hair Care', 'Body Care', 'Compléments', 'Vêtements', 'Autre'];

const STATUTS: { key: StatutWishlist; label: string; color: string }[] = [
  { key: 'a_decider', label: 'À décider', color: '#9CA3AF' },
  { key: 'approuve',  label: 'Approuvé',  color: '#A78BFA' },
  { key: 'achete',    label: 'Acheté',    color: '#22C55E' },
  { key: 'archive',   label: 'Archivé',   color: '#D1D5DB' },
];

const PRIORITES: { key: PrioriteWishlist; label: string }[] = [
  { key: 'basse',   label: 'Basse' },
  { key: 'normale', label: 'Normale' },
  { key: 'haute',   label: 'Haute' },
];

const STATUT_FILTERS: (StatutWishlist | 'tous')[] = ['tous', 'a_decider', 'approuve', 'achete'];

// ── Hook ─────────────────────────────────────────────────────────────────────

function useWishlist() {
  const items = useLiveQuery(
    () => db.wishlistItems
      .where('contexte').equals('myself')
      .filter(w => !w.deletedAt && w.statut !== 'archive')
      .toArray(),
    []
  );
  return { items: items ?? [], isLoading: items === undefined };
}

// ── Formulaire ────────────────────────────────────────────────────────────────

interface FormProps {
  editItem?: WishlistItem;
  onClose: () => void;
}

function WishlistForm({ editItem, onClose }: FormProps) {
  const [nom, setNom] = useState(editItem?.nom ?? '');
  const [categorie, setCategorie] = useState(editItem?.sousContexte ?? '');
  const [prix, setPrix] = useState(editItem?.prix?.toString() ?? '');
  const [priorite, setPriorite] = useState<PrioriteWishlist>(editItem?.priorite ?? 'normale');
  const [statut, setStatut] = useState<StatutWishlist>(editItem?.statut ?? 'a_decider');
  const [lienUrl, setLienUrl] = useState(editItem?.lienUrl ?? '');
  const [notes, setNotes] = useState(editItem?.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nom.trim()) return;
    setSaving(true);
    try {
      const data = {
        nom: nom.trim(),
        contexte: 'myself' as const,
        sousContexte: categorie || undefined,
        prix: prix ? parseFloat(prix) : undefined,
        priorite,
        statut,
        lienUrl: lienUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        archive: false,
        estConsommable: false,
      };
      if (editItem) {
        await db.wishlistItems.update(editItem.id, { ...data, updatedAt: new Date() });
        // Émettre si le statut a changé
        if (data.statut !== editItem.statut) {
          emit('wishlist_item.status_changed', { item: { ...editItem, ...data } })
        }
      } else {
        await db.wishlistItems.add(newEntity<WishlistItem>(data));
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!editItem) return;
    await db.wishlistItems.update(editItem.id, softDeleteFields());
    onClose();
  }

  return (
    <div className="myself-modal-backdrop" onClick={onClose}>
      <div className="myself-modal" onClick={e => e.stopPropagation()}>
        <div className="myself-modal__handle" />
        <p className="myself-modal__title">{editItem ? 'Modifier l\'article' : 'Nouvel article'}</p>

        <div className="myself-form">
          <div className="myself-form__field">
            <label className="myself-form__label">Nom *</label>
            <input
              className="myself-form__input"
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Ex : Crème SPF50, Sérum rétinol…"
              autoFocus
            />
          </div>

          <div className="myself-form__field">
            <label className="myself-form__label">Catégorie</label>
            <select
              className="myself-form__select"
              value={categorie}
              onChange={e => setCategorie(e.target.value)}
            >
              <option value="">Sans catégorie</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="myself-form__row">
            <div className="myself-form__field">
              <label className="myself-form__label">Prix (€)</label>
              <input
                className="myself-form__input"
                type="number"
                min="0"
                step="0.01"
                value={prix}
                onChange={e => setPrix(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="myself-form__field">
              <label className="myself-form__label">Priorité</label>
              <select
                className="myself-form__select"
                value={priorite}
                onChange={e => setPriorite(e.target.value as PrioriteWishlist)}
              >
                {PRIORITES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="myself-form__field">
            <label className="myself-form__label">Statut</label>
            <div className="myself-statut-grid">
              {STATUTS.filter(s => s.key !== 'archive').map(s => (
                <button
                  key={s.key}
                  className={`myself-statut-btn${statut === s.key ? ' myself-statut-btn--active' : ''}`}
                  style={statut === s.key ? { borderColor: s.color, background: `${s.color}18`, color: s.color } : {}}
                  onClick={() => setStatut(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="myself-form__field">
            <label className="myself-form__label">Lien URL</label>
            <input
              className="myself-form__input"
              type="url"
              value={lienUrl}
              onChange={e => setLienUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="myself-form__field">
            <label className="myself-form__label">Notes</label>
            <textarea
              className="myself-form__textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Avis, où acheter, couleur…"
              rows={2}
            />
          </div>

          <div className="myself-form__actions">
            {editItem && (
              <button className="myself-form__btn-delete" onClick={handleArchive}>Archiver</button>
            )}
            <button className="myself-form__btn-cancel" onClick={onClose}>Annuler</button>
            <button
              className="myself-form__btn-save"
              onClick={handleSave}
              disabled={!nom.trim() || saving}
            >
              {saving ? '…' : editItem ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function SectionWishlist() {
  const { items, isLoading } = useWishlist();
  const [filterStatut, setFilterStatut] = useState<StatutWishlist | 'tous'>('tous');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<WishlistItem | undefined>();

  const filtered = filterStatut === 'tous'
    ? items
    : items.filter(i => i.statut === filterStatut);

  function openCreate() { setEditItem(undefined); setShowForm(true); }
  function openEdit(item: WishlistItem) { setEditItem(item); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditItem(undefined); }

  const statutCfg = (key: StatutWishlist) => STATUTS.find(s => s.key === key)!;

  return (
    <div className="myself-section">
      {/* Filtres statut */}
      <div className="myself-filter-bar">
        {STATUT_FILTERS.map(s => (
          <button
            key={s}
            className={`myself-filter-btn${filterStatut === s ? ' myself-filter-btn--active' : ''}`}
            onClick={() => setFilterStatut(s)}
          >
            {s === 'tous' ? 'Tout' : STATUTS.find(st => st.key === s)?.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <>
          <div className="myself-skeleton" />
          <div className="myself-skeleton" />
        </>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="myself-empty">
          <span className="myself-empty__icon">✨</span>
          <p className="myself-empty__title">Wishlist vide</p>
          <button className="myself-empty__btn" onClick={openCreate}>Ajouter un article</button>
        </div>
      )}

      {!isLoading && filtered.map(item => {
        const cfg = statutCfg(item.statut);
        return (
          <div key={item.id} className="myself-card" onClick={() => openEdit(item)}>
            <div className="myself-card__main">
              <div className="myself-card__top-row">
                <p className="myself-card__nom">{item.nom}</p>
                <span
                  className="myself-card__badge"
                  style={{ background: `${cfg.color}18`, color: cfg.color }}
                >
                  {cfg.label}
                </span>
              </div>
              {item.sousContexte && (
                <p className="myself-card__meta">{item.sousContexte}</p>
              )}
              {item.prix !== undefined && (
                <p className="myself-card__prix">{item.prix.toFixed(2)} €</p>
              )}
              {item.notes && (
                <p className="myself-card__notes">{item.notes}</p>
              )}
            </div>
            <div className="myself-card__right">
              {item.lienUrl && (
                <a
                  href={item.lienUrl}
                  className="myself-card__link"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  aria-label="Ouvrir le lien"
                >
                  🔗
                </a>
              )}
              <span className="myself-card__chevron">›</span>
            </div>
          </div>
        );
      })}

      <button className="myself-fab" onClick={openCreate} aria-label="Ajouter un article">+</button>

      {showForm && (
        <WishlistForm editItem={editItem} onClose={closeForm} />
      )}
    </div>
  );
}
