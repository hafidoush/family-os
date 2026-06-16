/**
 * FAMILY OS — SouvenirForm
 * Formulaire création / édition d'un souvenir
 */

import { useState, useEffect, useRef } from 'react';
import { db } from '@core/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { souvenirService } from '../../services/souvenirService';
import type { SouvenirFormData } from '../../types/familleTypes';
import type { Souvenir } from '@shared/types/modules';

interface Props {
  editId?: string | null;
  onSave: (id: string) => void;
  onCancel: () => void;
}

const TYPES: { value: Souvenir['type']; label: string; icon: string }[] = [
  { value: 'moment_fort', label: 'Moment fort', icon: '⭐' },
  { value: 'reussite', label: 'Réussite', icon: '🏆' },
  { value: 'sortie', label: 'Sortie', icon: '🎡' },
  { value: 'autre', label: 'Autre', icon: '💫' },
];

const today = new Date().toISOString().slice(0, 10);

export default function SouvenirForm({ editId, onSave, onCancel }: Props) {
  const membres = useLiveQuery(() => db.membres.filter((m) => m.actif).toArray(), []);
  const souvenirExistant = useLiveQuery(
    () => editId ? db.souvenirs.get(editId) : undefined,
    [editId]
  );

  const [form, setForm] = useState<SouvenirFormData>({
    titre: '',
    description: '',
    date: today,
    membresAssocies: [],
    tags: [],
    type: 'moment_fort',
    photosBase64: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (souvenirExistant) {
      setForm({
        titre: souvenirExistant.titre,
        description: souvenirExistant.description ?? '',
        date: souvenirExistant.date,
        membresAssocies: souvenirExistant.membresAssocies ?? [],
        tags: souvenirExistant.tags ?? [],
        type: souvenirExistant.type,
        photosBase64: souvenirExistant.photosBase64 ?? [],
      });
    }
  }, [souvenirExistant]);

  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const b64 = ev.target?.result as string;
        if (b64) setForm(f => ({ ...f, photosBase64: [...(f.photosBase64 ?? []), b64] }));
      };
      reader.readAsDataURL(file);
    });
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const removePhoto = (idx: number) => {
    setForm(f => ({ ...f, photosBase64: (f.photosBase64 ?? []).filter((_, i) => i !== idx) }));
  };

  const toggleMembre = (id: string) => {
    setForm(f => ({
      ...f,
      membresAssocies: f.membresAssocies.includes(id)
        ? f.membresAssocies.filter(m => m !== id)
        : [...f.membresAssocies, id],
    }));
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !(form.tags ?? []).includes(tag)) {
      setForm(f => ({ ...f, tags: [...(f.tags ?? []), tag] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm(f => ({ ...f, tags: (f.tags ?? []).filter(t => t !== tag) }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.titre.trim()) e.titre = 'Titre requis';
    if (!form.date) e.date = 'Date requise';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let id: string;
      if (editId) {
        await souvenirService.update(editId, form);
        id = editId;
      } else {
        id = await souvenirService.create(form);
      }
      onSave(id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="famille-form">
      {/* Titre */}
      <div className="famille-form-group">
        <label className="famille-form-label">Titre *</label>
        <input
          className={`input${errors.titre ? ' input--error' : ''}`}
          type="text"
          placeholder="Ex: Première journée à la mer"
          value={form.titre}
          onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
        />
        {errors.titre && <span style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{errors.titre}</span>}
      </div>

      {/* Type */}
      <div className="famille-form-group">
        <label className="famille-form-label">Type</label>
        <div className="type-selector">
          {TYPES.map(t => (
            <button
              key={t.value}
              className={`type-btn${form.type === t.value ? ' selected' : ''}`}
              onClick={() => setForm(f => ({ ...f, type: t.value }))}
            >
              <span className="type-btn-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="famille-form-group">
        <label className="famille-form-label">Date *</label>
        <input
          className={`input${errors.date ? ' input--error' : ''}`}
          type="date"
          value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
        />
      </div>

      {/* Description */}
      <div className="famille-form-group">
        <label className="famille-form-label">Description</label>
        <textarea
          className="input"
          rows={3}
          placeholder="Décrivez ce souvenir..."
          value={form.description ?? ''}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          style={{ resize: 'vertical', minHeight: 80 }}
        />
      </div>

      {/* Membres */}
      <div className="famille-form-group">
        <label className="famille-form-label">Membres présents</label>
        <div className="membres-checkboxes">
          {membres?.map(m => (
            <button
              key={m.id}
              className={`membre-check-btn${form.membresAssocies.includes(m.id) ? ' selected' : ''}`}
              onClick={() => toggleMembre(m.id)}
            >
              {m.prenom}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="famille-form-group">
        <label className="famille-form-label">Tags</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            type="text"
            placeholder="Ajouter un tag..."
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
            style={{ flex: 1 }}
          />
          <button
            className="btn"
            style={{ padding: '0 16px', background: 'rgba(201,184,232,0.2)', border: '1.5px solid rgba(201,184,232,0.4)', borderRadius: 10, color: '#5B4A82', fontWeight: 600 }}
            onClick={addTag}
          >
            +
          </button>
        </div>
        {(form.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {(form.tags ?? []).map(tag => (
              <span
                key={tag}
                style={{
                  padding: '4px 10px',
                  background: 'rgba(201,184,232,0.2)',
                  border: '1px solid rgba(201,184,232,0.4)',
                  borderRadius: 20,
                  fontSize: 12,
                  color: '#5B4A82',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                #{tag}
                <span
                  style={{ cursor: 'pointer', color: '#9CA3AF', fontSize: 14, lineHeight: 1 }}
                  onClick={() => removeTag(tag)}
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Photos */}
      <div className="famille-form-group">
        <label className="famille-form-label">Photos</label>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleAddPhotos}
        />
        {(form.photosBase64 ?? []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {(form.photosBase64 ?? []).map((src, idx) => (
              <div key={idx} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => removePhoto(idx)}
                  style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', fontSize: 12, lineHeight: '18px', textAlign: 'center', cursor: 'pointer', padding: 0 }}
                >×</button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn btn--ghost"
          style={{ width: '100%', fontSize: 13 }}
          onClick={() => photoInputRef.current?.click()}
        >
          + Ajouter des photos
        </button>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onCancel}>
          Annuler
        </button>
        <button
          className="btn btn--primary"
          style={{ flex: 2 }}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}
