/**
 * FAMILY OS — Module Budget
 * Enveloppes budgétaires + transactions
 */

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/database';
import { newEntity, withUpdate, softDeleteFields } from '../../core/db/helpers';
import { emit } from '../../core/automation/engine';
import { useNotificationsStore } from '../../shared/stores/notificationsStore';
import { ConfirmModal } from '../../shared/components/ui/ConfirmModal';
import type { Enveloppe, Transaction, CategorieEnveloppe, PeriodeEnveloppe, TypeTransaction } from '@shared/types';
import './BudgetModule.css';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIES: { value: CategorieEnveloppe; label: string; icon: string }[] = [
  { value: 'alimentation', label: 'Alimentation', icon: '🛒' },
  { value: 'maison', label: 'Maison', icon: '🏠' },
  { value: 'enfants', label: 'Enfants', icon: '👶' },
  { value: 'myself', label: 'Moi', icon: '💆' },
  { value: 'loisirs', label: 'Loisirs', icon: '🎉' },
  { value: 'sante', label: 'Santé', icon: '🏥' },
  { value: 'autre', label: 'Autre', icon: '📦' },
];

const PERIODES: { value: PeriodeEnveloppe; label: string }[] = [
  { value: 'mensuelle', label: 'Mensuelle' },
  { value: 'trimestrielle', label: 'Trimestrielle' },
  { value: 'annuelle', label: 'Annuelle' },
  { value: 'ponctuelle', label: 'Ponctuelle' },
];

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function catIcon(cat: CategorieEnveloppe) {
  return CATEGORIES.find((c) => c.value === cat)?.icon ?? '📦';
}

function catLabel(cat: CategorieEnveloppe) {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

// ─── Hook — enveloppes avec dépenses calculées ────────────────────────────────

function useEnveloppes() {
  return useLiveQuery(async () => {
    const envs = await db.enveloppes.filter((e) => !e.archive && !e.deletedAt).toArray();
    const txs = await db.transactions.filter((t) => !t.archive && !t.deletedAt).toArray();

    return envs.map((env) => {
      const depenses = txs
        .filter((t) => t.enveloppeAssociee === env.id && t.type === 'depense')
        .reduce((sum, t) => sum + t.montant, 0);
      const entrees = txs
        .filter((t) => t.enveloppeAssociee === env.id && t.type === 'entree')
        .reduce((sum, t) => sum + t.montant, 0);
      const montantDepense = depenses - entrees;
      const montantRestant = env.montantPrevu - montantDepense;
      const pct = env.montantPrevu > 0 ? Math.round((montantDepense / env.montantPrevu) * 100) : 0;
      return { ...env, montantDepense, montantRestant, pct };
    });
  }, []);
}

function useTransactions(enveloppeId: string | null) {
  return useLiveQuery(
    async () => {
      if (!enveloppeId) return [] as Transaction[];
      return db.transactions
        .where('enveloppeAssociee')
        .equals(enveloppeId)
        .filter((t) => !t.archive && !t.deletedAt)
        .sortBy('date');
    },
    [enveloppeId]
  ) ?? ([] as Transaction[]);
}

// ─── EnveloppeForm ────────────────────────────────────────────────────────────

interface EnveloppeFormProps {
  editId?: string | null;
  onClose: () => void;
}

function EnveloppeForm({ editId, onClose }: EnveloppeFormProps) {
  const existing = useLiveQuery(
    () => editId ? db.enveloppes.get(editId) : undefined,
    [editId]
  );

  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState<CategorieEnveloppe>('autre');
  const [montant, setMontant] = useState('');
  const [periode, setPeriode] = useState<PeriodeEnveloppe>('mensuelle');
  const [dateDebut, setDateDebut] = useState(() => getToday().slice(0, 7) + '-01');
  const [alerteSeuil, setAlerteSeuil] = useState('80');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { addToast } = useNotificationsStore();

  useEffect(() => {
    if (!existing) return;
    setNom(existing.nom);
    setCategorie(existing.categorie);
    setMontant(String(existing.montantPrevu));
    setPeriode(existing.periode);
    setDateDebut(existing.dateDebut);
    setAlerteSeuil(existing.alerteSeuil ? String(existing.alerteSeuil) : '80');
  }, [existing]);

  async function handleSave() {
    if (!nom.trim() || !montant) return;
    setSaving(true);
    try {
      if (editId && existing) {
        await db.enveloppes.update(editId, withUpdate<Enveloppe>({
          nom: nom.trim(),
          categorie,
          montantPrevu: Number(montant),
          periode,
          dateDebut,
          alerteSeuil: alerteSeuil ? Number(alerteSeuil) : undefined,
        }));
        addToast({ message: 'Enveloppe modifiée', type: 'success', duration: 2000 });
      } else {
        const env = newEntity<Enveloppe>({
          nom: nom.trim(),
          categorie,
          montantPrevu: Number(montant),
          montantDepense: 0,
          montantRestant: Number(montant),
          periode,
          dateDebut,
          alerteSeuil: alerteSeuil ? Number(alerteSeuil) : undefined,
          archive: false,
        });
        await db.enveloppes.add(env);
        addToast({ message: 'Enveloppe créée', type: 'success', duration: 2000 });
      }
      onClose();
    } catch {
      addToast({ message: 'Erreur lors de la sauvegarde', type: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!editId) return;
    try {
      const txs = await db.transactions.where('enveloppeAssociee').equals(editId).toArray();
      await Promise.all(txs.map((t) => db.transactions.update(t.id, softDeleteFields())));
      await db.enveloppes.update(editId, softDeleteFields());
      addToast({ message: 'Enveloppe supprimée', type: 'info', duration: 2000 });
      onClose();
    } catch {
      addToast({ message: 'Erreur lors de la suppression', type: 'error', duration: 3000 });
    }
  }

  return (
    <>
    <div className="budget-form">
      <h3 className="budget-form__title">{editId ? 'Modifier l\'enveloppe' : 'Nouvelle enveloppe'}</h3>

      <div className="budget-form__field">
        <label>Nom</label>
        <input className="budget-form__input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Courses semaine" autoFocus />
      </div>

      <div className="budget-form__field">
        <label>Catégorie</label>
        <div className="budget-form__cat-grid">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              className={`budget-form__cat-btn${categorie === c.value ? ' budget-form__cat-btn--active' : ''}`}
              onClick={() => setCategorie(c.value)}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="budget-form__row">
        <div className="budget-form__field">
          <label>Montant prévu (€)</label>
          <input className="budget-form__input" type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0.00" />
        </div>
        <div className="budget-form__field">
          <label>Période</label>
          <select className="budget-form__select" value={periode} onChange={(e) => setPeriode(e.target.value as PeriodeEnveloppe)}>
            {PERIODES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className="budget-form__row">
        <div className="budget-form__field">
          <label>Date début</label>
          <input className="budget-form__input" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
        </div>
        <div className="budget-form__field">
          <label>Alerte à (%)</label>
          <input className="budget-form__input" type="number" min="0" max="100" value={alerteSeuil} onChange={(e) => setAlerteSeuil(e.target.value)} placeholder="80" />
        </div>
      </div>

      <div className="budget-form__actions">
        {editId && (
          <button className="budget-form__btn-delete" onClick={() => setConfirmDelete(true)}>Supprimer</button>
        )}
        <button className="budget-form__btn-cancel" onClick={onClose}>Annuler</button>
        <button className="budget-form__btn-save" onClick={handleSave} disabled={saving || !nom.trim() || !montant}>
          {saving ? '…' : editId ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </div>

    <ConfirmModal
      open={confirmDelete}
      title="Supprimer cette enveloppe ?"
      message="Toutes les transactions associées seront également supprimées."
      confirmLabel="Supprimer"
      danger
      onConfirm={() => { setConfirmDelete(false); doDelete(); }}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  );
}

// ─── TransactionForm ──────────────────────────────────────────────────────────

interface TransactionFormProps {
  enveloppeId: string;
  editId?: string | null;
  onClose: () => void;
}

function TransactionForm({ enveloppeId, editId, onClose }: TransactionFormProps) {
  const existing = useLiveQuery(
    () => editId ? db.transactions.get(editId) : undefined,
    [editId]
  );

  const [libelle, setLibelle] = useState('');
  const [montant, setMontant] = useState('');
  const [type, setType] = useState<TypeTransaction>('depense');
  const [date, setDate] = useState(getToday);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { addToast } = useNotificationsStore();

  useEffect(() => {
    if (!existing) return;
    setLibelle(existing.libelle);
    setMontant(String(existing.montant));
    setType(existing.type);
    setDate(existing.date);
  }, [existing]);

  async function handleSave() {
    if (!libelle.trim() || !montant) return;
    setSaving(true);
    try {
      if (editId && existing) {
        await db.transactions.update(editId, withUpdate<Transaction>({
          libelle: libelle.trim(),
          montant: Number(montant),
          type,
          date,
        }));
        addToast({ message: 'Transaction modifiée', type: 'success', duration: 2000 });
      } else {
        const tx = newEntity<Transaction>({
          libelle: libelle.trim(),
          montant: Number(montant),
          type,
          date,
          enveloppeAssociee: enveloppeId,
          source: 'manuelle',
          archive: false,
        });
        await db.transactions.add(tx);
        emit('transaction.created_or_modified', { transactionId: tx.id });
        addToast({ message: 'Transaction ajoutée', type: 'success', duration: 2000 });
      }
      onClose();
    } catch {
      addToast({ message: 'Erreur lors de la sauvegarde', type: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!editId) return;
    try {
      await db.transactions.update(editId, softDeleteFields());
      addToast({ message: 'Transaction supprimée', type: 'info', duration: 2000 });
      onClose();
    } catch {
      addToast({ message: 'Erreur lors de la suppression', type: 'error', duration: 3000 });
    }
  }

  return (
    <>
    <div className="budget-form">
      <h3 className="budget-form__title">{editId ? 'Modifier' : 'Nouvelle transaction'}</h3>

      <div className="budget-form__field">
        <label>Type</label>
        <div className="budget-form__type-btns">
          {(['depense', 'entree', 'previsionnel'] as TypeTransaction[]).map((t) => (
            <button
              key={t}
              className={`budget-form__type-btn${type === t ? ' budget-form__type-btn--active' : ''}`}
              onClick={() => setType(t)}
            >
              {t === 'depense' ? '💸 Dépense' : t === 'entree' ? '💰 Entrée' : '📋 Prévisionnel'}
            </button>
          ))}
        </div>
      </div>

      <div className="budget-form__field">
        <label>Libellé</label>
        <input className="budget-form__input" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. : Courses Lidl" autoFocus />
      </div>

      <div className="budget-form__row">
        <div className="budget-form__field">
          <label>Montant (€)</label>
          <input className="budget-form__input" type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0.00" />
        </div>
        <div className="budget-form__field">
          <label>Date</label>
          <input className="budget-form__input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="budget-form__actions">
        {editId && (
          <button className="budget-form__btn-delete" onClick={() => setConfirmDelete(true)}>Supprimer</button>
        )}
        <button className="budget-form__btn-cancel" onClick={onClose}>Annuler</button>
        <button className="budget-form__btn-save" onClick={handleSave} disabled={saving || !libelle.trim() || !montant}>
          {saving ? '…' : editId ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>

    <ConfirmModal
      open={confirmDelete}
      title="Supprimer cette transaction ?"
      confirmLabel="Supprimer"
      danger
      onConfirm={() => { setConfirmDelete(false); doDelete(); }}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  );
}

// ─── EnveloppeDetail ──────────────────────────────────────────────────────────

interface EnveloppeDetailProps {
  env: Enveloppe & { montantDepense: number; montantRestant: number; pct: number };
  onBack: () => void;
  onEditEnveloppe: () => void;
}

function EnveloppeDetail({ env, onBack, onEditEnveloppe }: EnveloppeDetailProps) {
  const transactions = useTransactions(env.id);
  const [showTxForm, setShowTxForm] = useState(false);
  const [editTxId, setEditTxId] = useState<string | null>(null);

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const isOver = env.pct >= 100;
  const isAlert = env.alerteSeuil && env.pct >= env.alerteSeuil;

  return (
    <div className="budget-module">
      <div className="budget-detail__header">
        <button className="budget-back-btn" onClick={onBack}>← Retour</button>
        <div className="budget-detail__title">
          <span className="budget-detail__icon">{catIcon(env.categorie)}</span>
          <span>{env.nom}</span>
        </div>
        <button className="budget-edit-btn" onClick={onEditEnveloppe}>Modifier</button>
      </div>

      <div className={`budget-detail__card${isOver ? ' budget-detail__card--over' : isAlert ? ' budget-detail__card--alert' : ''}`}>
        <div className="budget-detail__amounts">
          <div>
            <span className="budget-label">Prévu</span>
            <span className="budget-amount">{env.montantPrevu.toFixed(2)} €</span>
          </div>
          <div>
            <span className="budget-label">Dépensé</span>
            <span className={`budget-amount${isOver ? ' budget-amount--over' : ''}`}>{env.montantDepense.toFixed(2)} €</span>
          </div>
          <div>
            <span className="budget-label">Restant</span>
            <span className={`budget-amount${env.montantRestant < 0 ? ' budget-amount--over' : ' budget-amount--ok'}`}>
              {env.montantRestant.toFixed(2)} €
            </span>
          </div>
        </div>
        <div className="budget-bar-wrap">
          <div
            className={`budget-bar${isOver ? ' budget-bar--over' : isAlert ? ' budget-bar--alert' : ''}`}
            style={{ width: `${Math.min(env.pct, 100)}%` }}
          />
        </div>
        <span className="budget-pct">{env.pct}%</span>
      </div>

      <div className="budget-section-header">
        <h3 className="budget-section-title">Transactions</h3>
        <button className="budget-add-btn" onClick={() => { setEditTxId(null); setShowTxForm(true); }}>+ Ajouter</button>
      </div>

      {showTxForm && (
        <TransactionForm
          enveloppeId={env.id}
          editId={editTxId}
          onClose={() => { setShowTxForm(false); setEditTxId(null); }}
        />
      )}

      {sorted.length === 0 ? (
        <p className="budget-empty">Aucune transaction. Commencez par en ajouter une.</p>
      ) : (
        <div className="budget-tx-list">
          {sorted.map((tx) => (
            <div
              key={tx.id}
              className={`budget-tx-item budget-tx-item--${tx.type}`}
              onClick={() => { setEditTxId(tx.id); setShowTxForm(true); }}
            >
              <div className="budget-tx-info">
                <span className="budget-tx-libelle">{tx.libelle}</span>
                <span className="budget-tx-date">{new Date(tx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              </div>
              <span className={`budget-tx-montant budget-tx-montant--${tx.type}`}>
                {tx.type === 'depense' ? '−' : '+'}{tx.montant.toFixed(2)} €
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BudgetModule (vue liste) ─────────────────────────────────────────────────

export default function BudgetModule() {
  const enveloppes = useEnveloppes() ?? [];
  const [showEnvForm, setShowEnvForm] = useState(false);
  const [editEnvId, setEditEnvId] = useState<string | null>(null);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);

  const activeEnv = enveloppes.find((e) => e.id === activeEnvId) ?? null;

  if (activeEnv) {
    return (
      <>
        <EnveloppeDetail
          env={activeEnv}
          onBack={() => setActiveEnvId(null)}
          onEditEnveloppe={() => { setEditEnvId(activeEnv.id); setShowEnvForm(true); }}
        />
        {showEnvForm && (
          <div className="budget-overlay" onClick={() => setShowEnvForm(false)}>
            <div className="budget-drawer" onClick={(e) => e.stopPropagation()}>
              <EnveloppeForm
                editId={editEnvId}
                onClose={() => { setShowEnvForm(false); setEditEnvId(null); if (editEnvId) setActiveEnvId(null); }}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  const totalPrevu = enveloppes.reduce((s, e) => s + e.montantPrevu, 0);
  const totalDepense = enveloppes.reduce((s, e) => s + e.montantDepense, 0);

  return (
    <div className="budget-module">
      <div className="budget-header">
        <div>
          <h1 className="budget-title">Budget</h1>
          <p className="budget-subtitle">
            {totalDepense.toFixed(2)} € / {totalPrevu.toFixed(2)} € dépensés
          </p>
        </div>
        <button className="budget-add-btn" onClick={() => { setEditEnvId(null); setShowEnvForm(true); }}>
          + Enveloppe
        </button>
      </div>

      {showEnvForm && (
        <div className="budget-overlay" onClick={() => setShowEnvForm(false)}>
          <div className="budget-drawer" onClick={(e) => e.stopPropagation()}>
            <EnveloppeForm editId={editEnvId} onClose={() => { setShowEnvForm(false); setEditEnvId(null); }} />
          </div>
        </div>
      )}

      {enveloppes.length === 0 ? (
        <div className="budget-empty-state">
          <span className="budget-empty-state__icon">💰</span>
          <p>Aucune enveloppe budgétaire.</p>
          <p className="budget-empty-state__hint">Créez une enveloppe pour commencer à suivre vos dépenses.</p>
        </div>
      ) : (
        <div className="budget-grid">
          {enveloppes.map((env) => {
            const isOver = env.pct >= 100;
            const isAlert = env.alerteSeuil && env.pct >= env.alerteSeuil;
            return (
              <div
                key={env.id}
                className={`budget-card${isOver ? ' budget-card--over' : isAlert ? ' budget-card--alert' : ''}`}
                onClick={() => setActiveEnvId(env.id)}
              >
                <div className="budget-card__top">
                  <span className="budget-card__icon">{catIcon(env.categorie)}</span>
                  <div className="budget-card__info">
                    <span className="budget-card__nom">{env.nom}</span>
                    <span className="budget-card__cat">{catLabel(env.categorie)}</span>
                  </div>
                  <span className={`budget-card__pct${isOver ? ' budget-card__pct--over' : ''}`}>{env.pct}%</span>
                </div>
                <div className="budget-bar-wrap">
                  <div
                    className={`budget-bar${isOver ? ' budget-bar--over' : isAlert ? ' budget-bar--alert' : ''}`}
                    style={{ width: `${Math.min(env.pct, 100)}%` }}
                  />
                </div>
                <div className="budget-card__amounts">
                  <span>{env.montantDepense.toFixed(2)} € dépensés</span>
                  <span className={env.montantRestant < 0 ? 'budget-amount--over' : ''}>
                    {env.montantRestant >= 0
                      ? `${env.montantRestant.toFixed(2)} € restants`
                      : `${Math.abs(env.montantRestant).toFixed(2)} € dépassés`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
