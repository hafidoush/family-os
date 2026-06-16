import { useState } from 'react';
import type { SportState, Victoire } from '../sportTypes';
import { getBestHipThrust, getMonthCount, genId, getTodayStr } from '../sportUtils';
import { GLUTE_TIMELINE } from '../sportConstants';
import './VueGlutes.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
}

export function VueGlutes({ state, update, sessions }: Props) {
  const [showInput, setShowInput] = useState(false);
  const [newVictoire, setNewVictoire] = useState('');

  const latest = state.mensurations.length > 0 ? state.mensurations[state.mensurations.length - 1] : null;
  const bestHT = getBestHipThrust(sessions);
  const currentMonth = getMonthCount(state.profil.dateDepart);

  function addVictoire() {
    if (!newVictoire.trim()) return;
    const v: Victoire = { id: genId(), date: getTodayStr(), text: newVictoire.trim() };
    update({ victoires: [...state.victoires, v] });
    setNewVictoire('');
    setShowInput(false);
  }

  return (
    <div className="vue-glutes">
      {/* Hero */}
      <div className="glutes-hero">
        <div className="glutes-hero__stat">
          <div className="glutes-hero__label">Hanches actuelles</div>
          <div className="glutes-hero__val">{latest?.hanches != null ? `${latest.hanches}cm` : '—'}</div>
          <div className="glutes-hero__sub">Objectif: 115 cm</div>
        </div>
        <div className="glutes-hero__stat">
          <div className="glutes-hero__label">Record Hip Thrust</div>
          <div className="glutes-hero__val">{bestHT > 0 ? `${bestHT}kg` : '—'}</div>
          <div className="glutes-hero__sub">Personnel</div>
        </div>
        <div className="glutes-hero__stat">
          <div className="glutes-hero__label">Mois en cours</div>
          <div className="glutes-hero__val">M{currentMonth}</div>
          <div className="glutes-hero__sub">/ 24 mois</div>
        </div>
      </div>

      {/* Sliders */}
      <div className="glutes-sliders">
        <div className="glutes-sliders__title">✨ Développement musculaire (auto-évaluation)</div>
        {(
          [
            { key: 'grand',     label: 'Grand Fessier' },
            { key: 'moyen',     label: 'Moyen Fessier' },
            { key: 'superieur', label: 'Galbe Supérieur' },
          ] as const
        ).map(({ key, label }) => (
          <div key={key} className="glute-slider-row">
            <div className="glute-slider-row__label">{label}</div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={state.gluteMetrics[key]}
              onChange={e => update({ gluteMetrics: { ...state.gluteMetrics, [key]: Number(e.target.value) } })}
            />
            <div className="glute-slider-row__val">{state.gluteMetrics[key]}/10</div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="glutes-timeline">
        <div className="glutes-timeline__title">📅 Timeline fessiers 24 mois</div>
        {GLUTE_TIMELINE.map(step => {
          const isPast = currentMonth > step.mois;
          const isCurrent = currentMonth === step.mois || (currentMonth < step.mois && (GLUTE_TIMELINE.find(s => s.mois > currentMonth)?.mois === step.mois));
          const status = isPast ? 'done' : isCurrent ? 'current' : 'future';
          return (
            <div key={step.mois} className="timeline-item">
              <div className={`timeline-dot timeline-dot--${status}`}>
                {isPast ? '✓' : step.mois}
              </div>
              <div className="timeline-content">
                <div className="timeline-month">Mois {step.mois}</div>
                <div className="timeline-label">{step.label}</div>
                <div className="timeline-desc">{step.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Victoires */}
      <div className="glutes-victoires">
        <div className="glutes-victoires__header">
          <div className="glutes-victoires__title">🏆 Victoires & Progrès</div>
          <button className="glutes-victoires__add" onClick={() => setShowInput(v => !v)}>＋ Victoire</button>
        </div>
        {showInput && (
          <div className="glutes-new-victoire">
            <input
              type="text"
              placeholder="Décris ta victoire..."
              value={newVictoire}
              onChange={e => setNewVictoire(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addVictoire()}
              autoFocus
            />
            <button onClick={addVictoire}>OK</button>
          </div>
        )}
        {state.victoires.length === 0 && (
          <div style={{ color: 'var(--bp-muted)', fontSize: 13, padding: '12px 0' }}>
            Aucune victoire enregistrée. Ajoute ta première !
          </div>
        )}
        {state.victoires.slice().reverse().map(v => (
          <div key={v.id} className="victoire-item">
            <span className="victoire-item__icon">⭐</span>
            <div style={{ flex: 1 }}>
              <div className="victoire-item__text">{v.text}</div>
              <div className="victoire-item__date">{v.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
