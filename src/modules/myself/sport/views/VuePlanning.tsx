import { useState } from 'react';
import type { SportState, PlanMonth } from '../sportTypes';
import { getMonthCount } from '../sportUtils';
import './VuePlanning.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
}

export function VuePlanning({ state, update }: Props) {
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<PlanMonth>({});

  const currentMonth = getMonthCount(state.profil.dateDepart);

  function startEdit(mois: number) {
    setEditingMonth(mois);
    setEditForm(state.planning[mois] ?? {});
  }

  function saveEdit(mois: number) {
    update({ planning: { ...state.planning, [mois]: editForm } });
    setEditingMonth(null);
  }

  const months = Array.from({ length: 25 }, (_, i) => i + 1);

  return (
    <div className="vue-planning">
      <div className="vue-planning__title">📅 Planificateur 24 Mois</div>

      <div className="planning-timeline">
        {months.map(mois => {
          const isPast = mois < currentMonth;
          const isCurrent = mois === currentMonth;
          const status = isPast ? 'past' : isCurrent ? 'current' : 'future';
          const plan = state.planning[mois];

          return (
            <div key={mois} className="plan-month">
              <div className={`plan-month__dot plan-month__dot--${status}`}>
                {isPast ? '✓' : mois}
              </div>
              <div className="plan-month__body">
                <div className="plan-month__header">
                  <div className="plan-month__label">Mois {mois}</div>
                  <button className="plan-month__edit-btn" onClick={() => editingMonth === mois ? setEditingMonth(null) : startEdit(mois)}>
                    {editingMonth === mois ? 'Fermer' : 'Éditer'}
                  </button>
                </div>

                {plan && (
                  <div className="plan-month__data">
                    {plan.poids != null && <span className="plan-month__stat">⚖️ <strong>{plan.poids}kg</strong></span>}
                    {plan.taille != null && <span className="plan-month__stat">👗 <strong>{plan.taille}cm</strong></span>}
                    {plan.hanches != null && <span className="plan-month__stat">🍑 <strong>{plan.hanches}cm</strong></span>}
                    {plan.hipThrust != null && <span className="plan-month__stat">🏋️ <strong>{plan.hipThrust}kg</strong></span>}
                  </div>
                )}

                {plan?.notes && <div className="plan-month__notes">{plan.notes}</div>}

                {editingMonth === mois && (
                  <div className="plan-edit-form">
                    <div className="plan-edit-form__field">
                      <label>Poids cible (kg)</label>
                      <input type="number" step="0.5" value={editForm.poids ?? ''} onChange={e => setEditForm(p => ({ ...p, poids: parseFloat(e.target.value) || undefined }))} />
                    </div>
                    <div className="plan-edit-form__field">
                      <label>Taille (cm)</label>
                      <input type="number" step="0.5" value={editForm.taille ?? ''} onChange={e => setEditForm(p => ({ ...p, taille: parseFloat(e.target.value) || undefined }))} />
                    </div>
                    <div className="plan-edit-form__field">
                      <label>Hanches (cm)</label>
                      <input type="number" step="0.5" value={editForm.hanches ?? ''} onChange={e => setEditForm(p => ({ ...p, hanches: parseFloat(e.target.value) || undefined }))} />
                    </div>
                    <div className="plan-edit-form__field">
                      <label>Hip Thrust cible (kg)</label>
                      <input type="number" step="2.5" value={editForm.hipThrust ?? ''} onChange={e => setEditForm(p => ({ ...p, hipThrust: parseFloat(e.target.value) || undefined }))} />
                    </div>
                    <div className="plan-edit-form__field plan-edit-form__field--full">
                      <label>Notes / Objectifs</label>
                      <textarea rows={2} value={editForm.notes ?? ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                    <div className="plan-edit-form__actions">
                      <button className="plan-edit-cancel" onClick={() => setEditingMonth(null)}>Annuler</button>
                      <button className="plan-edit-save" onClick={() => saveEdit(mois)}>Enregistrer</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
