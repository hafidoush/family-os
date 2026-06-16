import { useState } from 'react';
import type { SportState, DiastasisChecklist, DiastasisLog } from '../sportTypes';
import { genId, getTodayStr } from '../sportUtils';
import './VueDiastasis.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
}

const CHECK_ITEMS: { key: keyof DiastasisChecklist; label: string }[] = [
  { key: 'vacuum',      label: '🌬 Vacuum' },
  { key: 'respiration', label: '🫁 Respiration diaphragmatique' },
  { key: 'deadBug',     label: '🐛 Dead Bug' },
  { key: 'birdDog',     label: '🐦 Bird Dog' },
  { key: 'heelSlides',  label: '🦶 Heel Slides' },
];

export function VueDiastasis({ state, update }: Props) {
  const [stabilite, setStabilite] = useState(5);
  const [posture, setPosture] = useState(5);
  const [largeur, setLargeur] = useState('');
  const [note, setNote] = useState('');

  const checked = Object.values(state.diastasisToday).filter(Boolean).length;
  const progress = (checked / 5) * 100;

  function toggleCheck(key: keyof DiastasisChecklist) {
    update({ diastasisToday: { ...state.diastasisToday, [key]: !state.diastasisToday[key] } });
  }

  function handleSave() {
    const log: DiastasisLog = {
      id: genId(),
      date: getTodayStr(),
      checklist: { ...state.diastasisToday },
      largeur: largeur ? parseFloat(largeur) : undefined,
      stabilite,
      posture,
      note,
    };
    update({
      diastasisLogs: [...state.diastasisLogs, log],
      diastasisToday: { vacuum: false, respiration: false, deadBug: false, birdDog: false, heelSlides: false },
    });
    setLargeur('');
    setNote('');
    setStabilite(5);
    setPosture(5);
  }

  return (
    <div className="vue-diastasis">
      <div className="vue-diastasis__title">🫁 Diastasis & Posture</div>

      <div className="diast-card">
        <div className="diast-card__title">Séance du jour ({checked}/5)</div>

        <div className="diast-progress">
          <div className="diast-progress__fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="diast-checks">
          {CHECK_ITEMS.map(item => (
            <button
              key={item.key}
              className={`diast-check${state.diastasisToday[item.key] ? ' diast-check--done' : ''}`}
              onClick={() => toggleCheck(item.key)}
            >
              <div className={`diast-checkbox${state.diastasisToday[item.key] ? ' diast-checkbox--done' : ''}`}>
                {state.diastasisToday[item.key] ? '✓' : ''}
              </div>
              {item.label}
            </button>
          ))}
        </div>

        <div className="diast-sliders">
          <div className="diast-slider-row">
            <div className="diast-slider-row__label">Stabilité tronc</div>
            <input type="range" min="0" max="10" value={stabilite} onChange={e => setStabilite(Number(e.target.value))} />
            <div className="diast-slider-row__val">{stabilite}/10</div>
          </div>
          <div className="diast-slider-row">
            <div className="diast-slider-row__label">Posture</div>
            <input type="range" min="0" max="10" value={posture} onChange={e => setPosture(Number(e.target.value))} />
            <div className="diast-slider-row__val">{posture}/10</div>
          </div>
        </div>

        <div className="diast-fields">
          <div className="diast-field">
            <label>Largeur diastasis (cm)</label>
            <input
              type="number"
              step="0.5"
              placeholder="ex: 2.5"
              value={largeur}
              onChange={e => setLargeur(e.target.value)}
            />
          </div>
          <div className="diast-field diast-field--full">
            <label>Ressenti / Notes</label>
            <textarea
              placeholder="Comment tu te sens aujourd'hui..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <button className="diast-save-btn" onClick={handleSave}>
          ✓ Enregistrer la séance
        </button>
      </div>

      {state.diastasisLogs.length > 0 && (
        <div className="diast-card">
          <div className="diast-card__title">Historique (5 derniers)</div>
          <div className="diast-logs">
            {state.diastasisLogs.slice(-5).reverse().map(log => (
              <div key={log.id} className="diast-log-item">
                <div className="diast-log-item__date">{log.date}</div>
                <div className="diast-log-item__checks">
                  {CHECK_ITEMS.map(item => (
                    <span
                      key={item.key}
                      className={`diast-log-check${log.checklist[item.key] ? ' diast-log-check--done' : ' diast-log-check--miss'}`}
                    >
                      {item.label.split(' ').slice(1).join(' ')}
                    </span>
                  ))}
                </div>
                <div className="diast-log-item__scores">
                  Stabilité {log.stabilite}/10 · Posture {log.posture}/10
                  {log.largeur != null && ` · Diastasis ${log.largeur}cm`}
                </div>
                {log.note && <div style={{ fontSize: 12, color: 'var(--bp-muted)', marginTop: 4 }}>{log.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
