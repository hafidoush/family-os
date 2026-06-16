import { useState } from 'react';
import type { SportState } from '../sportTypes';
import { PROGRAMME } from '../sportConstants';
import './VueProgramme.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
  onStartSeance: (jourId: number) => void;
}

export function VueProgramme({ onStartSeance }: Props) {
  const [selected, setSelected] = useState(0);
  const jour = PROGRAMME[selected];

  return (
    <div className="vue-programme">
      <div className="vue-programme__title">🏋️ Programme 6 jours</div>

      {/* Sélecteur jours */}
      <div className="prog-days-scroll">
        {PROGRAMME.map(j => (
          <button
            key={j.id}
            className={`prog-day-pill${selected === j.id ? ' prog-day-pill--active' : ''}`}
            onClick={() => setSelected(j.id)}
          >
            <span>{j.icon}</span>
            <span>J{j.id + 1}</span>
          </button>
        ))}
      </div>

      {/* Détail */}
      <div className="prog-day-card">
        <div className="prog-day-card__header">
          <span className="prog-day-card__icon">{jour.icon}</span>
          <div>
            <div className="prog-day-card__name">{jour.name}</div>
            <div className="prog-day-card__type">Jour {jour.id + 1} · {jour.exercises.length} exercices</div>
          </div>
        </div>

        {jour.type === 'repos' ? (
          <div className="prog-repos">
            <div>🌿 Journée de repos actif</div>
            <div className="prog-repos__sub">Marche légère, étirements, récupération.</div>
          </div>
        ) : (
          <>
            <div className="prog-exercises-list">
              {jour.exercises.map((ex, i) => (
                <div key={i} className="prog-exercise-row">
                  <div className="prog-exercise-row__num">{i + 1}</div>
                  <div className="prog-exercise-row__info">
                    <div className="prog-exercise-row__name">{ex.name}</div>
                    <div className="prog-exercise-row__meta">{ex.sets} séries × {ex.reps}</div>
                  </div>
                  <span className={`prog-cat prog-cat--${ex.category}`}>
                    {ex.category === 'compound' ? 'Poly' : ex.category === 'unilateral' ? 'Uni' : ex.category === 'core' ? 'Core' : ex.category === 'cardio' ? 'Cardio' : 'Iso'}
                  </span>
                </div>
              ))}
            </div>
            <button className="prog-start-btn" onClick={() => onStartSeance(jour.id)}>
              ▶ Commencer la séance
            </button>
          </>
        )}
      </div>
    </div>
  );
}
