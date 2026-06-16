import { useState, useEffect, useRef } from 'react';
import type { SportState, Mensuration } from '../sportTypes';
import { genId, getTodayStr } from '../sportUtils';
import './VueMensurations.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
}

const FIELDS: { key: keyof Omit<Mensuration, 'id' | 'date'>; label: string }[] = [
  { key: 'poids',    label: 'Poids (kg)' },
  { key: 'taille',   label: 'Taille (cm)' },
  { key: 'hanches',  label: 'Hanches (cm)' },
  { key: 'cuisses',  label: 'Cuisses (cm)' },
  { key: 'poitrine', label: 'Poitrine (cm)' },
  { key: 'bras',     label: 'Bras (cm)' },
  { key: 'mollets',  label: 'Mollets (cm)' },
];

export function VueMensurations({ state, update }: Props) {
  const [date, setDate] = useState(getTodayStr());
  const [vals, setVals] = useState<Record<string, string>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sorted = [...state.mensurations].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last  = sorted[sorted.length - 1];

  function handleSave() {
    const m: Mensuration = { id: genId(), date };
    for (const f of FIELDS) {
      const v = parseFloat(vals[f.key]);
      if (!isNaN(v)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m as any)[f.key] = v;
      }
    }
    update({ mensurations: [...state.mensurations, m] });
    setVals({});
  }

  function delta(key: keyof Omit<Mensuration, 'id' | 'date'>): string {
    if (!first || !last) return '—';
    const a = first[key] as number | undefined;
    const b = last[key] as number | undefined;
    if (a == null || b == null) return '—';
    const d = b - a;
    return d >= 0 ? `+${d.toFixed(1)}` : `${d.toFixed(1)}`;
  }

  function deltaClass(key: keyof Omit<Mensuration, 'id' | 'date'>): string {
    if (!first || !last) return 'mens-delta--neu';
    const a = first[key] as number | undefined;
    const b = last[key] as number | undefined;
    if (a == null || b == null) return 'mens-delta--neu';
    const d = b - a;
    if (d === 0) return 'mens-delta--neu';
    // Pour taille et poids: hausse = mauvais, pour hanches/cuisses: hausse = bon
    const isGoodIncrease = ['hanches', 'cuisses', 'poitrine', 'bras', 'mollets'].includes(key);
    const up = d > 0;
    return (up === isGoodIncrease) ? 'mens-delta--pos' : 'mens-delta--neg';
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const pad = 24;

    const poidsList = sorted.filter(m => m.poids != null).map(m => m.poids as number);
    const hanchList = sorted.filter(m => m.hanches != null).map(m => m.hanches as number);

    ctx.clearRect(0, 0, W, H);

    if (poidsList.length < 2 && hanchList.length < 2) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#A78BFA';
      ctx.textAlign = 'center';
      ctx.fillText('Pas encore de données', W / 2, H / 2);
      return;
    }

    function drawLine(data: number[], color: string) {
      if (!ctx || data.length < 2) return;
      const min = Math.min(...data) - 2;
      const max = Math.max(...data) + 2;
      const toX = (i: number) => pad + (i / (data.length - 1)) * (W - pad * 2);
      const toY = (v: number) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(data[0]));
      for (let i = 1; i < data.length; i++) ctx.lineTo(toX(i), toY(data[i]));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    drawLine(poidsList, '#8B5CF6');
    drawLine(hanchList, '#F472B6');
  }, [state.mensurations]);

  return (
    <div className="vue-mensurations">
      <div className="vue-mensurations__title">📏 Mensurations</div>

      {/* Form */}
      <div className="mens-card">
        <div className="mens-card__title">Nouvelle mesure</div>
        <div className="mens-form">
          <div className="mens-form__field mens-form__field--full">
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {FIELDS.map(f => (
            <div key={f.key} className="mens-form__field">
              <label>{f.label}</label>
              <input
                type="number"
                step="0.1"
                placeholder="—"
                value={vals[f.key] ?? ''}
                onChange={e => setVals(p => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <button className="mens-save-btn" onClick={handleSave}>✓ Enregistrer</button>
      </div>

      {/* Comparaison */}
      {first && last && first.id !== last.id && (
        <div className="mens-card">
          <div className="mens-card__title">Départ vs Dernière mesure</div>
          <table className="mens-compare-table">
            <thead>
              <tr>
                <th>Mesure</th>
                <th>Départ ({first.date})</th>
                <th>Actuel ({last.date})</th>
                <th>Évolution</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(f => (
                <tr key={f.key}>
                  <td>{f.label}</td>
                  <td>{first[f.key] != null ? `${first[f.key]}` : '—'}</td>
                  <td>{last[f.key] != null ? `${last[f.key]}` : '—'}</td>
                  <td className={deltaClass(f.key)}>{delta(f.key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Graph */}
      <div className="mens-card mens-chart">
        <div className="mens-card__title">Évolution Poids (violet) & Hanches (rose)</div>
        <canvas ref={canvasRef} width={600} height={160} />
      </div>

      {/* Historique */}
      {sorted.length > 0 && (
        <div className="mens-card">
          <div className="mens-card__title">Historique (10 dernières)</div>
          <table className="mens-compare-table">
            <thead>
              <tr>
                <th>Date</th>
                {FIELDS.map(f => <th key={f.key}>{f.label.split(' ')[0]}</th>)}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(-10).reverse().map(m => (
                <tr key={m.id}>
                  <td>{m.date}</td>
                  {FIELDS.map(f => <td key={f.key}>{m[f.key] != null ? `${m[f.key]}` : '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
