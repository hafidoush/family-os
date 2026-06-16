import { useState, useCallback } from 'react';
import { db } from '../../../../core/db/database';
import { newEntity } from '../../../../core/db/helpers';
import type { SportSession } from '../../../../shared/types';
import type { SetLog, ExerciceLog, WorkoutMetriques } from '../sportTypes';
import { PROGRAMME } from '../sportConstants';
import './VueSeance.css';

interface Props {
  jourId: number;
  onFinish: () => void;
  onCancel: () => void;
}

function buildLogs(jourId: number): ExerciceLog[] {
  const jour = PROGRAMME.find(j => j.id === jourId);
  if (!jour) return [];
  return jour.exercises.map(ex => ({
    name: ex.name,
    sets: Array.from({ length: ex.sets }, () => ({
      reps: String(ex.reps),
      weight: '',
      done: false,
    })),
  }));
}

export function VueSeance({ jourId, onFinish, onCancel }: Props) {
  const jour = PROGRAMME.find(j => j.id === jourId) ?? PROGRAMME[0];
  const [logs, setLogs] = useState<ExerciceLog[]>(() => buildLogs(jourId));
  const [saving, setSaving] = useState(false);
  const [startTime] = useState(Date.now());

  const updateSet = useCallback((exIdx: number, setIdx: number, field: keyof SetLog, value: string | boolean) => {
    setLogs(prev => {
      const next = prev.map(ex => ({ ...ex, sets: ex.sets.map(s => ({ ...s })) }));
      (next[exIdx].sets[setIdx] as Record<string, string | boolean>)[field] = value;
      return next;
    });
  }, []);

  const totalSets = logs.reduce((acc, ex) => acc + ex.sets.length, 0);
  const doneSets  = logs.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0);
  const progress  = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;
  const dureeSec  = Math.round((Date.now() - startTime) / 1000);

  async function handleFinish() {
    setSaving(true);
    try {
      const membres = await db.membres.toArray();
      const membreId = membres[0]?.id ?? 'default';
      const duree = Math.round(dureeSec / 60);
      const metriques: WorkoutMetriques = { jourId: jour.id, exercises: logs, dureeSec };
      await db.sportSessions.add(
        newEntity<SportSession>({
          membre: membreId,
          typeEntrainement: jour.name,
          date: new Date(),
          duree,
          metriques: metriques as unknown as Record<string, unknown>,
        })
      );
      onFinish();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="vue-seance">
      <div className="seance-header">
        <div>
          <div className="seance-header__jour">{jour.icon} {jour.name}</div>
          <div className="seance-header__sub">{doneSets}/{totalSets} séries · {Math.round(dureeSec / 60)} min</div>
        </div>
        <button className="seance-header__cancel" onClick={onCancel}>Annuler</button>
      </div>

      <div className="seance-progress">
        <div className="seance-progress__fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="seance-exercises">
        {logs.map((ex, exIdx) => (
          <div key={exIdx} className="seance-ex-card">
            <div className="seance-ex-card__name">{ex.name}</div>
            <div className="seance-sets-header">
              <span>Série</span>
              <span>Kg</span>
              <span>Reps</span>
              <span>✓</span>
            </div>
            {ex.sets.map((set, setIdx) => (
              <div key={setIdx} className={`seance-set-row${set.done ? ' seance-set-row--done' : ''}`}>
                <span className="seance-set-row__num">{setIdx + 1}</span>
                <input
                  className="seance-set-row__input"
                  type="number"
                  min="0"
                  step="2.5"
                  placeholder="kg"
                  value={set.weight}
                  onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                />
                <input
                  className="seance-set-row__input"
                  type="number"
                  min="0"
                  placeholder="reps"
                  value={set.reps}
                  onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                />
                <button
                  className={`seance-set-check${set.done ? ' seance-set-check--done' : ''}`}
                  onClick={() => updateSet(exIdx, setIdx, 'done', !set.done)}
                >
                  {set.done ? '✓' : '○'}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <button className="seance-finish-btn" onClick={handleFinish} disabled={saving}>
        {saving ? '…' : `✓ Terminer la séance (${Math.round(dureeSec / 60)} min)`}
      </button>
    </div>
  );
}
