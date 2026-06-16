import { useState } from 'react';
import type { SportState, Objectif } from '../sportTypes';
import { genId } from '../sportUtils';
import './VueObjectifs.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
}

type Horizon = '3' | '6' | '12' | '24';

const HORIZONS: { key: Horizon; label: string }[] = [
  { key: '3',  label: '3 Mois' },
  { key: '6',  label: '6 Mois' },
  { key: '12', label: '12 Mois' },
  { key: '24', label: '24 Mois' },
];

export function VueObjectifs({ state, update }: Props) {
  const [newText, setNewText] = useState('');
  const [newHorizon, setNewHorizon] = useState<Horizon>('3');

  function toggleObj(horizon: Horizon, id: string) {
    const list = state.objectifs[horizon].map(o =>
      o.id === id ? { ...o, done: !o.done } : o
    );
    update({ objectifs: { ...state.objectifs, [horizon]: list } });
  }

  function deleteObj(horizon: Horizon, id: string) {
    const list = state.objectifs[horizon].filter(o => o.id !== id);
    update({ objectifs: { ...state.objectifs, [horizon]: list } });
  }

  function addObj() {
    if (!newText.trim()) return;
    const obj: Objectif = { id: genId(), text: newText.trim(), done: false };
    update({ objectifs: { ...state.objectifs, [newHorizon]: [...state.objectifs[newHorizon], obj] } });
    setNewText('');
  }

  return (
    <div className="vue-objectifs">
      <div className="vue-objectifs__title">🎯 Objectifs Transformation</div>

      <div className="obj-grid">
        {HORIZONS.map(({ key, label }) => {
          const list = state.objectifs[key];
          const done = list.filter(o => o.done).length;
          return (
            <div key={key} className="obj-column">
              <div className="obj-column__header">
                <span className="obj-column__badge">{label}</span>
                <span className="obj-column__count">{done}/{list.length}</span>
              </div>
              <div className="obj-list">
                {list.map(obj => (
                  <div key={obj.id} className="obj-item">
                    <button
                      className={`obj-item__check${obj.done ? ' obj-item__check--done' : ''}`}
                      onClick={() => toggleObj(key, obj.id)}
                    >
                      {obj.done ? '✓' : ''}
                    </button>
                    <span className={`obj-item__text${obj.done ? ' obj-item__text--done' : ''}`}>
                      {obj.text}
                    </span>
                    <button className="obj-item__del" onClick={() => deleteObj(key, obj.id)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="obj-add-form">
        <input
          type="text"
          placeholder="Nouvel objectif..."
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addObj()}
        />
        <select value={newHorizon} onChange={e => setNewHorizon(e.target.value as Horizon)}>
          {HORIZONS.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
        </select>
        <button className="obj-add-btn" onClick={addObj}>＋ Ajouter</button>
      </div>
    </div>
  );
}
