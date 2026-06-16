/**
 * FAMILY OS — ReunionForm
 * Formulaire de planification d'une réunion famille
 */

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';
import { reunionService } from '../../services/reunionService';
import type { ReunionFormData } from '../../types/familleTypes';

interface Props {
  onSave: (id: string) => void;
  onCancel: () => void;
}

const today = new Date().toISOString().slice(0, 10);

export default function ReunionForm({ onSave, onCancel }: Props) {
  const [form, setForm] = useState<ReunionFormData>({
    date: today,
    heure: '',
    agenda: '',
    participantIds: [],
    resume: '',
  });
  const [saving, setSaving] = useState(false);

  const membres = useLiveQuery(
    () => db.membres.filter((m) => !m.deletedAt && m.actif !== false).toArray(),
    [],
    []
  );

  function toggleParticipant(id: string) {
    setForm((f) => {
      const prev = f.participantIds ?? [];
      return {
        ...f,
        participantIds: prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
      };
    });
  }

  const handleSubmit = async () => {
    if (!form.date) return;
    setSaving(true);
    try {
      const id = await reunionService.create({
        ...form,
        heure: form.heure || undefined,
        agenda: form.agenda?.trim() || undefined,
        participantIds: form.participantIds?.length ? form.participantIds : undefined,
        resume: form.resume?.trim() || undefined,
      });
      onSave(id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="famille-form">

      {/* Bandeau icône */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 36, lineHeight: 1 }}>🤝</span>
      </div>

      {/* Date + heure sur une ligne bien aérée */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
        <div className="famille-form-group" style={{ margin: 0 }}>
          <label className="famille-form-label">Date *</label>
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
        </div>
        <div className="famille-form-group" style={{ margin: 0, minWidth: 100 }}>
          <label className="famille-form-label">Heure</label>
          <input
            className="input"
            type="time"
            value={form.heure ?? ''}
            onChange={e => setForm(f => ({ ...f, heure: e.target.value }))}
          />
        </div>
      </div>

      {/* Participants */}
      {membres && membres.length > 0 && (
        <div className="famille-form-group">
          <label className="famille-form-label">Participants</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {membres.map((m) => {
              const selected = (form.participantIds ?? []).includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleParticipant(m.id)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 24,
                    border: '1.5px solid',
                    borderColor: selected ? 'var(--color-lavender-500)' : 'rgba(201,184,232,0.4)',
                    background: selected ? 'var(--color-lavender-500)' : 'rgba(201,184,232,0.1)',
                    color: selected ? '#fff' : '#5B4A82',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  {m.prenom}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ordre du jour */}
      <div className="famille-form-group">
        <label className="famille-form-label">Ordre du jour</label>
        <textarea
          className="input"
          rows={4}
          placeholder="Sujets à aborder, objectifs de la réunion..."
          value={form.agenda ?? ''}
          onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))}
          style={{ resize: 'vertical', minHeight: 90, lineHeight: 1.6 }}
        />
      </div>

      {/* Notes */}
      <div className="famille-form-group">
        <label className="famille-form-label">Notes libres</label>
        <textarea
          className="input"
          rows={2}
          placeholder="Informations complémentaires..."
          value={form.resume ?? ''}
          onChange={e => setForm(f => ({ ...f, resume: e.target.value }))}
          style={{ resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onCancel}>
          Annuler
        </button>
        <button
          className="btn btn--primary"
          style={{ flex: 2, background: 'var(--color-lavender-500)', borderRadius: 12 }}
          onClick={handleSubmit}
          disabled={saving || !form.date}
        >
          {saving ? 'Planification…' : 'Planifier la réunion'}
        </button>
      </div>
    </div>
  );
}
