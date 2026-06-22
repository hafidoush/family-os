import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { newEntity, softDeleteFields } from '../../../core/db/helpers';
import { ConfirmModal } from '../../../shared/components/ui/ConfirmModal';
import type { SelfCareItem } from '../../../shared/types';

function isFaitAujourdhui(item: SelfCareItem): boolean {
  if (!item.derniereExecution) return false;
  const d = new Date(item.derniereExecution);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

type TypeSelfCare = 'visage' | 'corps' | 'cheveux' | 'complement';

const TYPES: { key: TypeSelfCare; label: string }[] = [
  { key: 'visage',     label: 'Visage'      },
  { key: 'corps',      label: 'Corps'       },
  { key: 'cheveux',    label: 'Cheveux'     },
  { key: 'complement', label: 'Compléments' },
];

// ── Hook ─────────────────────────────────────────────────────────────────────

function useSelfCare() {
  const items = useLiveQuery(
    () => db.selfCareItems.filter((s) => !s.deletedAt).toArray(),
    []
  );
  return { items: items ?? [], isLoading: items === undefined };
}

// ── Formulaire ────────────────────────────────────────────────────────────────

interface FormProps {
  editItem?: SelfCareItem;
  onClose: () => void;
}

function SelfCareForm({ editItem, onClose }: FormProps) {
  const [nom, setNom] = useState(editItem?.tache ?? '');
  const [type, setType] = useState<TypeSelfCare>((editItem?.type as TypeSelfCare) ?? 'visage');
  const [produits, setProduits] = useState((editItem?.produitsUtilises ?? []).join(', '));
  const [instructions, setInstructions] = useState(editItem?.instructions ?? '');
  const [dashboard, setDashboard] = useState(editItem?.remonteDashboard ?? false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    if (!nom.trim()) return;
    setSaving(true);
    try {
      const data = {
        tache: nom.trim(),
        type,
        produitsUtilises: produits.split(',').map(p => p.trim()).filter(Boolean),
        instructions: instructions.trim() || undefined,
        remonteDashboard: dashboard,
      };
      if (editItem) {
        await db.selfCareItems.update(editItem.id, { ...data, updatedAt: new Date() });
      } else {
        await db.selfCareItems.add(newEntity<SelfCareItem>(data));
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editItem) return;
    await db.selfCareItems.update(editItem.id, softDeleteFields());
    onClose();
  }

  async function handleDeleteConfirmed() {
    setConfirmDelete(false);
    await handleDelete();
  }

  return (
    <>
    <div className="myself-modal-backdrop" onClick={onClose}>
      <div className="myself-modal" onClick={e => e.stopPropagation()}>
        <div className="myself-modal__handle" />
        <p className="myself-modal__title">{editItem ? 'Modifier la routine' : 'Nouvelle routine'}</p>

        <div className="myself-form">
          <div className="myself-form__field">
            <label className="myself-form__label">Nom</label>
            <input
              className="myself-form__input"
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Ex : Sérum vitamine C, Crème hydratante…"
              autoFocus
            />
          </div>

          <div className="myself-form__field">
            <label className="myself-form__label">Type</label>
            <div className="myself-form__type-grid">
              {TYPES.map(t => (
                <button
                  key={t.key}
                  className={`myself-type-btn${type === t.key ? ' myself-type-btn--active' : ''}`}
                  onClick={() => setType(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="myself-form__field">
            <label className="myself-form__label">Produits utilisés <span className="myself-form__hint">(séparés par des virgules)</span></label>
            <input
              className="myself-form__input"
              value={produits}
              onChange={e => setProduits(e.target.value)}
              placeholder="Sérum, crème, huile…"
            />
          </div>

          <div className="myself-form__field">
            <label className="myself-form__label">Instructions</label>
            <textarea
              className="myself-form__textarea"
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="Comment l'appliquer, dans quel ordre…"
              rows={2}
            />
          </div>

          <label className="myself-form__toggle">
            <input
              type="checkbox"
              checked={dashboard}
              onChange={e => setDashboard(e.target.checked)}
            />
            <span className="myself-form__toggle-label">Afficher dans le Todo du jour</span>
          </label>

          <div className="myself-form__actions">
            {editItem && (
              <button className="myself-form__btn-delete" onClick={() => setConfirmDelete(true)}>Supprimer</button>
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

    <ConfirmModal
      open={confirmDelete}
      title="Supprimer cette routine ?"
      message="Cette action est irréversible."
      confirmLabel="Supprimer"
      cancelLabel="Annuler"
      danger
      onConfirm={handleDeleteConfirmed}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function SectionSelfCare() {
  const { items, isLoading } = useSelfCare();
  const [activeType, setActiveType] = useState<TypeSelfCare>('visage');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<SelfCareItem | undefined>();

  const filtered = items.filter(i => i.type === activeType);

  function openCreate() { setEditItem(undefined); setShowForm(true); }
  function openEdit(item: SelfCareItem) { setEditItem(item); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditItem(undefined); }

  async function toggleFait(e: React.MouseEvent, item: SelfCareItem) {
    e.stopPropagation();
    const fait = isFaitAujourdhui(item);
    await db.selfCareItems.update(item.id, {
      derniereExecution: fait ? undefined : new Date(),
      updatedAt: new Date(),
    });
  }

  return (
    <div className="myself-section">
      {/* Onglets type */}
      <div className="myself-type-tabs">
        {TYPES.map(t => (
          <button
            key={t.key}
            className={`myself-type-tab${activeType === t.key ? ' myself-type-tab--active' : ''}`}
            onClick={() => setActiveType(t.key)}
          >
            {t.label}
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
          <p className="myself-empty__title">Aucune routine {TYPES.find(t => t.key === activeType)?.label.toLowerCase()}</p>
          <button className="myself-empty__btn" onClick={openCreate}>Ajouter une routine</button>
        </div>
      )}

      {!isLoading && filtered.map(item => {
        const fait = isFaitAujourdhui(item);
        return (
          <div key={item.id} className={`myself-card${fait ? ' myself-card--fait' : ''}`} onClick={() => openEdit(item)}>
            <button
              className={`myself-card__check${fait ? ' myself-card__check--actif' : ''}`}
              onClick={(e) => toggleFait(e, item)}
              aria-label={fait ? 'Marquer comme non fait' : 'Marquer comme fait'}
              title={fait ? 'Fait aujourd\'hui — cliquer pour annuler' : 'Marquer comme fait aujourd\'hui'}
            >
              {fait ? '✓' : '○'}
            </button>
            <div className="myself-card__main">
              <p className="myself-card__nom">{item.tache}</p>
              {item.produitsUtilises && item.produitsUtilises.length > 0 && (
                <p className="myself-card__produits">{item.produitsUtilises.join(' · ')}</p>
              )}
              {item.instructions && (
                <p className="myself-card__instructions">{item.instructions}</p>
              )}
            </div>
            <div className="myself-card__right">
              {item.remonteDashboard && (
                <span className="myself-card__badge myself-card__badge--dashboard">Dashboard</span>
              )}
              <span className="myself-card__chevron">›</span>
            </div>
          </div>
        );
      })}

      <button className="myself-fab" onClick={openCreate} aria-label="Ajouter une routine">+</button>

      {showForm && (
        <SelfCareForm editItem={editItem} onClose={closeForm} />
      )}
    </div>
  );
}
