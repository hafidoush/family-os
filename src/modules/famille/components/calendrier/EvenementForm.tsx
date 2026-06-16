/**
 * FAMILY OS — EvenementForm
 * Formulaire création + édition d'un événement familial.
 * Inclut : récurrence avancée, alertes, couleur, sous-tâches sync Todo.
 */

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { db } from '@core/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { evenementService } from '../../services/evenementService';
import type { EvenementFormData } from '../../types/familleTypes';
import type { Evenement, RegleRecurrence } from '@shared/types/entities';
import { IconCalendar } from '@shared/components/ui/Icon/Icon';

interface Props {
  editId?: string | null;
  defaultDate?: string;
  onSave: (id: string) => void;
  onCancel: () => void;
}

const TYPES: { value: Evenement['type']; label: string; emoji: ReactNode; color: string }[] = [
  { value: 'evenement',    label: 'Évènement', emoji: '🎉', color: '#A78BFA' },
  { value: 'rendez_vous',  label: 'Rdv',       emoji: <IconCalendar size={16} />, color: '#60A5FA' },
  { value: 'anniversaire', label: 'Anniv.',    emoji: '🎂', color: '#F472B6' },
  { value: 'sortie',       label: 'Sortie',    emoji: '🎡', color: '#34D399' },
  { value: 'rappel',       label: 'Rappel',    emoji: '⏰', color: '#FBBF24' },
  { value: 'medical',      label: 'Médical',   emoji: '🏥', color: '#F87171' },
];

const RECURRENCE_OPTIONS = [
  { value: 'aucune',         label: 'Aucune' },
  { value: 'quotidienne',    label: 'Chaque jour' },
  { value: 'hebdomadaire',   label: 'Chaque semaine' },
  { value: 'bihebdomadaire', label: 'Toutes les 2 semaines' },
  { value: 'mensuelle',      label: 'Chaque mois' },
  { value: 'annuelle',       label: 'Chaque année' },
] as const;

type RecurrenceMode = typeof RECURRENCE_OPTIONS[number]['value'];

const JOURS = [
  { n: 1, label: 'Lu' }, { n: 2, label: 'Ma' }, { n: 3, label: 'Me' },
  { n: 4, label: 'Je' }, { n: 5, label: 'Ve' }, { n: 6, label: 'Sa' }, { n: 0, label: 'Di' },
];

const ALERTES = [
  { value: -1,   label: 'Aucune alerte' },
  { value: 0,    label: 'À l\'heure de l\'évènement' },
  { value: 15,   label: '15 minutes avant' },
  { value: 30,   label: '30 minutes avant' },
  { value: 60,   label: '1 heure avant' },
  { value: 1440, label: '1 jour avant' },
];

const COULEURS = [
  '#A78BFA', '#60A5FA', '#34D399', '#F472B6',
  '#FBBF24', '#F87171', '#818CF8', '#FB923C',
];

function localDateStr(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

export default function EvenementForm({ editId, defaultDate, onSave, onCancel }: Props) {
  const todayDate = defaultDate ?? localDateStr();
  const membres = useLiveQuery(() => db.membres.filter(m => m.actif).toArray(), []);
  const evenementExistant = useLiveQuery(
    () => editId ? db.evenements.get(editId) : undefined, [editId]
  );
  const sousTachesExistantes = useLiveQuery(
    () => editId ? evenementService.getSousTaches(editId) : Promise.resolve([]),
    [editId]
  );

  const [form, setForm] = useState<EvenementFormData>({
    titre: '', description: '', type: 'evenement', couleur: '#A78BFA',
    dateDebut: todayDate, dateFin: '', journeeEntiere: true, lieu: '',
    recurrence: false, personnesAssociees: [], notes: '',
    contexteMedical: false, alerteMinutes: -1, sousTaches: [],
  });
  const [heure, setHeure] = useState('');
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>('aucune');
  const [joursHebdo, setJoursHebdo] = useState<number[]>([]);
  const [nouvelleST, setNouvelleST] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  useEffect(() => {
    if (!evenementExistant) return;
    const d = new Date(evenementExistant.dateDebut);
    const p = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
    const heureStr = evenementExistant.journeeEntiere ? '' : `${p(d.getHours())}:${p(d.getMinutes())}`;

    let mode: RecurrenceMode = 'aucune';
    if (evenementExistant.recurrence) {
      const rr = evenementExistant.regleRecurrence;
      if (rr) {
        if (rr.frequence === 'quotidienne') mode = 'quotidienne';
        else if (rr.frequence === 'hebdomadaire' && rr.intervalle === 2) mode = 'bihebdomadaire';
        else if (rr.frequence === 'hebdomadaire') mode = 'hebdomadaire';
        else if (rr.frequence === 'mensuelle') mode = 'mensuelle';
        else if (rr.frequence === 'annuelle') mode = 'annuelle';
        if (rr.joursHebdo) setJoursHebdo(rr.joursHebdo);
      }
    }
    setRecurrenceMode(mode);
    setHeure(heureStr);
    setForm({
      titre: evenementExistant.titre,
      description: evenementExistant.description ?? '',
      type: evenementExistant.type,
      couleur: evenementExistant.couleur ?? '#A78BFA',
      dateDebut: dateStr, dateFin: '',
      journeeEntiere: evenementExistant.journeeEntiere,
      lieu: evenementExistant.lieu ?? '',
      recurrence: evenementExistant.recurrence,
      personnesAssociees: evenementExistant.personnesAssociees ?? [],
      notes: evenementExistant.notes ?? '',
      contexteMedical: evenementExistant.contexteMedical,
      alerteMinutes: evenementExistant.alerteMinutes ?? -1,
      sousTaches: [],
    });
  }, [evenementExistant]);

  useEffect(() => {
    if (sousTachesExistantes && sousTachesExistantes.length > 0) {
      setForm(f => ({
        ...f,
        sousTaches: sousTachesExistantes.map(t => ({ id: t.id, titre: t.titre, fait: t.statut === 'fait' })),
      }));
    }
  }, [sousTachesExistantes?.length]);

  const toggle = (key: string) => setOpenSection(s => s === key ? null : key);

  const buildRegle = (): RegleRecurrence | undefined => {
    if (recurrenceMode === 'aucune') return undefined;
    const base = { intervalle: 1, dateDebutRecurrence: form.dateDebut };
    if (recurrenceMode === 'quotidienne')    return { ...base, frequence: 'quotidienne' as const };
    if (recurrenceMode === 'hebdomadaire')   return { ...base, frequence: 'hebdomadaire' as const, intervalle: 1, joursHebdo };
    if (recurrenceMode === 'bihebdomadaire') return { ...base, frequence: 'hebdomadaire' as const, intervalle: 2, joursHebdo };
    if (recurrenceMode === 'mensuelle')      return { ...base, frequence: 'mensuelle' as const, typeMensuel: 'jourFixe' as const };
    if (recurrenceMode === 'annuelle')       return { ...base, frequence: 'annuelle' as const };
    return undefined;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.titre.trim()) e.titre = 'Titre requis';
    if (!form.dateDebut) e.dateDebut = 'Date requise';
    if (form.dateFin && form.dateFin < form.dateDebut) e.dateFin = 'La date de fin doit être après le début';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const regle = buildRegle();
      const final: EvenementFormData = {
        ...form,
        dateDebut: heure ? `${form.dateDebut}T${heure}:00` : `${form.dateDebut}T00:00:00`,
        journeeEntiere: !heure,
        recurrence: recurrenceMode !== 'aucune',
        regleRecurrence: regle,
      };
      let id: string;
      if (editId) { await evenementService.update(editId, final); id = editId; }
      else        { id = await evenementService.create(final); }
      onSave(id);
    } finally {
      setSaving(false);
    }
  };

  const typeInfo = TYPES.find(t => t.value === form.type) ?? TYPES[0];
  const couleur = form.couleur ?? typeInfo.color;
  const sts = form.sousTaches ?? [];
  const stDone = sts.filter(s => s.fait).length;

  return (
    <div className="evt-form">

      {/* Type pills */}
      <div className="evt-form__group">
        <div className="evt-form__type-grid">
          {TYPES.map(t => (
            <button key={t.value}
              className={`evt-form__type-btn${form.type === t.value ? ' active' : ''}`}
              style={form.type === t.value ? { borderColor: t.color, background: t.color + '22', color: t.color } : {}}
              onClick={() => setForm(f => ({ ...f, type: t.value, contexteMedical: t.value === 'medical', couleur: t.color }))}
            >
              <span>{t.emoji}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Titre */}
      <div className="evt-form__group">
        <label className="evt-form__label">Titre *</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 22 }}>{typeInfo.emoji}</span>
          <input
            className={`evt-form__input${errors.titre ? ' evt-form__input--error' : ''}`}
            type="text" placeholder="Nom de l'événement"
            value={form.titre}
            onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
          />
        </div>
        {errors.titre && <span className="evt-form__error">{errors.titre}</span>}
      </div>

      {/* Description */}
      <div className="evt-form__group">
        <label className="evt-form__label">Description <span className="evt-form__optional">(opt.)</span></label>
        <textarea className="evt-form__input evt-form__textarea" rows={2}
          placeholder="Notes sur cet événement…"
          value={form.description ?? ''}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>

      {/* Date + Heure */}
      <div className="evt-form__row">
        <div className="evt-form__group">
          <label className="evt-form__label">Date *</label>
          <input className={`evt-form__input${errors.dateDebut ? ' evt-form__input--error' : ''}`}
            type="date" value={form.dateDebut}
            onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))}
          />
          {errors.dateDebut && <span className="evt-form__error">{errors.dateDebut}</span>}
        </div>
        <div className="evt-form__group">
          <label className="evt-form__label">Heure <span className="evt-form__optional">(opt.)</span></label>
          <input className="evt-form__input" type="time" value={heure} onChange={e => setHeure(e.target.value)} />
        </div>
      </div>

      {/* Lieu */}
      <div className="evt-form__group">
        <label className="evt-form__label">Lieu <span className="evt-form__optional">(opt.)</span></label>
        <input className="evt-form__input" type="text" placeholder="📍 Adresse ou lieu"
          value={form.lieu ?? ''} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))}
        />
      </div>

      {/* Couleur */}
      <div className="evt-form__group">
        <label className="evt-form__label">Couleur</label>
        <div className="evt-form__colors">
          {COULEURS.map(c => (
            <button key={c} className={`evt-form__color-dot${couleur === c ? ' active' : ''}`}
              style={{ background: c }} onClick={() => setForm(f => ({ ...f, couleur: c }))}
            />
          ))}
        </div>
      </div>

      {/* Participants */}
      <div className="evt-form__group">
        <label className="evt-form__label">Participants</label>
        <div className="evt-form__membres">
          {membres?.map(m => (
            <button key={m.id}
              className={`evt-form__membre-btn${form.personnesAssociees.includes(m.id) ? ' active' : ''}`}
              style={form.personnesAssociees.includes(m.id) ? { background: (m.couleur ?? '#A78BFA') + '22', borderColor: m.couleur ?? '#A78BFA' } : {}}
              onClick={() => setForm(f => ({
                ...f,
                personnesAssociees: f.personnesAssociees.includes(m.id)
                  ? f.personnesAssociees.filter(x => x !== m.id)
                  : [...f.personnesAssociees, m.id],
              }))}
            >
              <span className="evt-form__membre-av" style={{ background: m.couleur ?? '#E5E7EB' }}>{m.prenom[0]}</span>
              {m.prenom}
            </button>
          ))}
        </div>
      </div>

      {/* Récurrence */}
      <div className="evt-form__card">
        <button className="evt-form__card-header" onClick={() => toggle('rec')}>
          <span>🔁</span>
          <span className="evt-form__card-title">Répéter</span>
          <span className="evt-form__card-value">{RECURRENCE_OPTIONS.find(r => r.value === recurrenceMode)?.label ?? 'Aucune'}</span>
          <span className="evt-form__chevron">{openSection === 'rec' ? '▲' : '▼'}</span>
        </button>
        {openSection === 'rec' && (
          <div className="evt-form__card-body evt-form__rec-list">
            {RECURRENCE_OPTIONS.map((opt, i) => (
              <button key={opt.value}
                className={`evt-form__rec-row${recurrenceMode === opt.value ? ' active' : ''}${i === RECURRENCE_OPTIONS.length - 1 ? ' last' : ''}`}
                onClick={() => setRecurrenceMode(opt.value)}
              >
                <span className="evt-form__rec-row-label">{opt.label}</span>
                {recurrenceMode === opt.value && <span className="evt-form__rec-check">✓</span>}
              </button>
            ))}
            {(recurrenceMode === 'hebdomadaire' || recurrenceMode === 'bihebdomadaire') && (
              <div className="evt-form__jours-wrap">
                <label className="evt-form__label">Jours de la semaine</label>
                <div className="evt-form__jours">
                  {JOURS.map(j => (
                    <button key={j.n}
                      className={`evt-form__jour-btn${joursHebdo.includes(j.n) ? ' active' : ''}`}
                      onClick={() => setJoursHebdo(prev => prev.includes(j.n) ? prev.filter(x => x !== j.n) : [...prev, j.n])}
                    >{j.label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alerte */}
      <div className="evt-form__card">
        <button className="evt-form__card-header" onClick={() => toggle('alerte')}>
          <span>🔔</span>
          <span className="evt-form__card-title">Alerte</span>
          <span className="evt-form__card-value">{ALERTES.find(a => a.value === form.alerteMinutes)?.label ?? 'Aucune alerte'}</span>
          <span className="evt-form__chevron">{openSection === 'alerte' ? '▲' : '▼'}</span>
        </button>
        {openSection === 'alerte' && (
          <div className="evt-form__card-body">
            {ALERTES.map(a => (
              <button key={a.value}
                className={`evt-form__alerte-btn${form.alerteMinutes === a.value ? ' active' : ''}`}
                onClick={() => setForm(f => ({ ...f, alerteMinutes: a.value }))}
              >{a.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Sous-tâches */}
      <div className="evt-form__card">
        <button className="evt-form__card-header" onClick={() => toggle('st')}>
          <span>✅</span>
          <span className="evt-form__card-title">Sous-tâches</span>
          <span className="evt-form__card-value">{sts.length > 0 ? `${stDone}/${sts.length}` : 'Aucune'}</span>
          <span className="evt-form__chevron">{openSection === 'st' ? '▲' : '▼'}</span>
        </button>
        {openSection === 'st' && (
          <div className="evt-form__card-body">
            {sts.map((st, idx) => (
              <div key={idx} className="evt-form__st-item">
                <button className={`evt-form__st-check${st.fait ? ' done' : ''}`}
                  onClick={() => setForm(f => ({ ...f, sousTaches: (f.sousTaches ?? []).map((s, i) => i === idx ? { ...s, fait: !s.fait } : s) }))}
                >
                  {st.fait ? '✓' : ''}
                </button>
                <span className={`evt-form__st-titre${st.fait ? ' done' : ''}`}>{st.titre}</span>
                <button className="evt-form__st-del" onClick={() => setForm(f => ({ ...f, sousTaches: (f.sousTaches ?? []).filter((_, i) => i !== idx) }))}>✕</button>
              </div>
            ))}
            <div className="evt-form__st-add">
              <input className="evt-form__input" placeholder="Nouvelle sous-tâche…"
                value={nouvelleST}
                onChange={e => setNouvelleST(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { const t = nouvelleST.trim(); if (t) { setForm(f => ({ ...f, sousTaches: [...(f.sousTaches ?? []), { titre: t, fait: false }] })); setNouvelleST(''); } } }}
              />
              <button className="evt-form__st-add-btn" onClick={() => { const t = nouvelleST.trim(); if (t) { setForm(f => ({ ...f, sousTaches: [...(f.sousTaches ?? []), { titre: t, fait: false }] })); setNouvelleST(''); } }}>+</button>
            </div>
            <p className="evt-form__hint">Ces sous-tâches apparaissent aussi dans votre To-Do.</p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="evt-form__group">
        <label className="evt-form__label">Notes <span className="evt-form__optional">(opt.)</span></label>
        <textarea className="evt-form__input evt-form__textarea" rows={2}
          placeholder="Informations complémentaires…"
          value={form.notes ?? ''}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </div>

      {/* Actions */}
      <div className="evt-form__actions">
        <button className="evt-form__btn ghost" onClick={onCancel}>Annuler</button>
        <button className="evt-form__btn primary" style={{ background: couleur }} onClick={handleSubmit} disabled={saving}>
          {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer l\'événement'}
        </button>
      </div>
    </div>
  );
}
