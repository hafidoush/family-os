import { useEffect, useRef } from 'react';
import type { SportState, DiastasisChecklist } from '../sportTypes';
import type { SportNavId } from '../sportTypes';
import { getBestHipThrust, getDayCount, calcScore } from '../sportUtils';
import { PROGRAMME } from '../sportConstants';
import './VueDashboard.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
  onNav: (id: SportNavId) => void;
  onStartSeance: (jourId: number) => void;
}

export function VueDashboard({ state, update, sessions, onNav }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const days = getDayCount(state.profil.dateDepart);
  const score = calcScore(state, sessions);
  const bestHT = getBestHipThrust(sessions);

  const latest = state.mensurations.length > 0
    ? state.mensurations[state.mensurations.length - 1]
    : null;

  // SVG ring
  const R = 50;
  const circumference = 2 * Math.PI * R;
  const offset = circumference - (score / 100) * circumference;

  // Draw poids chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = state.mensurations
      .filter(m => m.poids != null)
      .slice(-12)
      .map(m => m.poids as number);

    if (data.length < 2) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#A78BFA';
      ctx.textAlign = 'center';
      ctx.fillText('Pas encore de données', canvas.width / 2, canvas.height / 2);
      return;
    }

    const W = canvas.width;
    const H = canvas.height;
    const pad = 20;
    const min = Math.min(...data) - 1;
    const max = Math.max(...data) + 1;
    const toX = (i: number) => pad + (i / (data.length - 1)) * (W - pad * 2);
    const toY = (v: number) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);

    ctx.clearRect(0, 0, W, H);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(167,139,250,0.3)');
    grad.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(toX(i), toY(data[i]));
    ctx.lineTo(toX(data.length - 1), H);
    ctx.lineTo(toX(0), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(toX(i), toY(data[i]));
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
    data.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(toX(i), toY(v), 4, 0, Math.PI * 2);
      ctx.fillStyle = '#F472B6';
      ctx.fill();
    });
  }, [state.mensurations]);

  function toggleDiast(key: keyof DiastasisChecklist) {
    update({ diastasisToday: { ...state.diastasisToday, [key]: !state.diastasisToday[key] } });
  }

  const diast = state.diastasisToday;
  const diastItems: { key: keyof DiastasisChecklist; label: string }[] = [
    { key: 'vacuum',       label: 'Vacuum' },
    { key: 'respiration',  label: 'Respiration diaphragmatique' },
    { key: 'deadBug',      label: 'Dead Bug' },
    { key: 'birdDog',      label: 'Bird Dog' },
    { key: 'heelSlides',   label: 'Heel Slides' },
  ];

  const recentSessions = sessions.slice(0, 3);

  return (
    <div className="vue-dashboard">
      {/* Hero */}
      <div className="dash-hero">
        <div className="dash-hero__text">
          <div className="dash-hero__greeting">Bonjour,</div>
          <div className="dash-hero__name">{state.profil.nom} ✦</div>
          <div className="dash-hero__days">
            Jour <strong>{days}</strong> de ta transformation
          </div>
        </div>
        <div className="dash-hero__ring">
          <svg width="110" height="110" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F472B6" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
            </defs>
            <circle className="dash-ring-bg" cx="60" cy="60" r={R} strokeWidth="10" />
            <circle
              className="dash-ring-fg"
              cx="60" cy="60" r={R}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="dash-ring-text">
            <div className="dash-ring-pct">{score}</div>
            <div className="dash-ring-label">score</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="dash-stats">
        <div className="dash-stat">
          <div className="dash-stat__icon">📏</div>
          <div className="dash-stat__val">{latest?.hanches != null ? `${latest.hanches}cm` : '—'}</div>
          <div className="dash-stat__label">Hanches</div>
        </div>
        <div className="dash-stat">
          <div className="dash-stat__icon">👗</div>
          <div className="dash-stat__val">{latest?.taille != null ? `${latest.taille}cm` : '—'}</div>
          <div className="dash-stat__label">Taille</div>
        </div>
        <div className="dash-stat">
          <div className="dash-stat__icon">🦵</div>
          <div className="dash-stat__val">{latest?.cuisses != null ? `${latest.cuisses}cm` : '—'}</div>
          <div className="dash-stat__label">Cuisses</div>
        </div>
        <div className="dash-stat">
          <div className="dash-stat__icon">🏋️</div>
          <div className="dash-stat__val">{sessions.length}</div>
          <div className="dash-stat__label">Séances</div>
        </div>
      </div>

      {/* Chart poids */}
      <div className="dash-chart-card">
        <div className="dash-chart-card__title">Évolution du poids (kg)</div>
        <canvas ref={canvasRef} width={600} height={120} />
      </div>

      {/* Grid 2 cols: diastasis + HT */}
      <div className="dash-grid2">
        <div className="dash-diast">
          <div className="dash-diast__title">🫁 Diastasis du jour</div>
          <div className="dash-diast__checks">
            {diastItems.map(item => (
              <button
                key={item.key}
                className="dash-diast__check"
                onClick={() => toggleDiast(item.key)}
              >
                <div className={`dash-diast__checkbox${diast[item.key] ? ' dash-diast__checkbox--checked' : ''}`}>
                  {diast[item.key] ? '✓' : ''}
                </div>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dash-ht">
          <div className="dash-ht__label">Record Hip Thrust</div>
          <div className="dash-ht__val">{bestHT > 0 ? `${bestHT} kg` : '— kg'}</div>
          <div className="dash-ht__sub">Personnel</div>
        </div>
      </div>

      {/* Sessions récentes */}
      <div className="dash-sessions">
        <div className="dash-sessions__title">Séances récentes</div>
        {recentSessions.length === 0 ? (
          <div className="dash-empty">Aucune séance — commence dès aujourd'hui !</div>
        ) : (
          recentSessions.map((s: any) => {
            const m = s.metriques as { jourId?: number } | undefined;
            const jour = PROGRAMME.find(j => j.id === m?.jourId);
            const date = new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
            return (
              <div key={s.id} className="dash-session-row">
                <span className="dash-session-row__icon">{jour?.icon ?? '🏋️'}</span>
                <div className="dash-session-row__info">
                  <div className="dash-session-row__name">{s.typeEntrainement}</div>
                  <div className="dash-session-row__meta">{date} · {s.duree ?? '—'} min</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CTA */}
      <button className="dash-seance-btn" onClick={() => { onNav('programme'); }}>
        ▶ Commencer une séance
      </button>
    </div>
  );
}
