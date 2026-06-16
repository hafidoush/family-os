import type { SportState } from '../sportTypes';
import { calcScore, getNiveau, isTrophyUnlocked, getBestHipThrust, getDayCount } from '../sportUtils';
import { TROPHIES } from '../sportConstants';
import './VueAnalyse.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
}

export function VueAnalyse({ state, sessions }: Props) {
  const score = calcScore(state, sessions);
  const niveau = getNiveau(score);
  const bestHT = getBestHipThrust(sessions);
  const days = getDayCount(state.profil.dateDepart);

  const sorted = [...state.mensurations].sort((a, b) => a.date.localeCompare(b.date));
  const firstPoids = sorted[0]?.poids ?? state.profil.poidsInitial;
  const lastPoids = sorted[sorted.length - 1]?.poids;
  const poidsPerdu = lastPoids != null ? Math.max(0, firstPoids - lastPoids) : 0;

  // Insights auto-générés
  const insights: { icon: string; text: string }[] = [];

  if (sessions.length === 0) {
    insights.push({ icon: '🌱', text: 'Enregistre ta première séance pour commencer le suivi !' });
  } else if (sessions.length < 5) {
    insights.push({ icon: '🔥', text: `${sessions.length} séance${sessions.length > 1 ? 's' : ''} complétée${sessions.length > 1 ? 's' : ''} — tu es sur la bonne voie !` });
  } else {
    insights.push({ icon: '💪', text: `Impressionnant ! ${sessions.length} séances complétées en ${days} jours — soit ${(sessions.length / Math.max(1, days / 7)).toFixed(1)} séances/semaine en moyenne.` });
  }

  if (bestHT > 0) {
    insights.push({ icon: '🍑', text: `Ton record Hip Thrust est de ${bestHT} kg — chaque kilo supplémentaire = des fessiers plus développés.` });
  }

  if (state.mensurations.length >= 2) {
    const lastH = sorted[sorted.length - 1]?.hanches;
    const firstH = sorted[0]?.hanches ?? state.profil.hanchesInitiales;
    if (lastH != null) {
      const delta = lastH - firstH;
      insights.push({ icon: '📏', text: delta >= 0 ? `+${delta.toFixed(1)} cm de hanches depuis le départ — la croissance musculaire est là !` : `${delta.toFixed(1)} cm de tour de hanches — continue !` });
    }
  }

  if (state.journalEntries.length >= 7) {
    const avgEnergie = state.journalEntries.slice(-7).reduce((s, e) => s + e.energie, 0) / 7;
    insights.push({ icon: '⚡', text: `Ton énergie moyenne sur les 7 derniers jours : ${avgEnergie.toFixed(1)}/10.` });
  }

  if (days >= 30 && sessions.length >= 10) {
    insights.push({ icon: '🌟', text: `${days} jours de transformation — ta régularité est ta plus grande force.` });
  }

  // Niveau suivant
  const NIVEAUX_SCORES = [0, 10, 25, 45, 65, 85, 100];
  const nextScoreIdx = NIVEAUX_SCORES.findIndex(s => s > score);
  const nextScore = nextScoreIdx !== -1 ? NIVEAUX_SCORES[nextScoreIdx] : 100;
  const prevScore = nextScoreIdx > 0 ? NIVEAUX_SCORES[nextScoreIdx - 1] : 0;
  const levelPct = Math.min(100, ((score - prevScore) / (nextScore - prevScore)) * 100);

  return (
    <div className="vue-analyse">
      <div className="vue-analyse__title">📊 Analyse & Trophées</div>

      {/* Insights */}
      <div className="analyse-card">
        <div className="analyse-card__title">✨ Auto-insights</div>
        <div className="analyse-insights">
          {insights.map((ins, i) => (
            <div key={i} className="analyse-insight">
              <span className="analyse-insight__icon">{ins.icon}</span>
              <span>{ins.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Niveau */}
      <div className="analyse-card">
        <div className="analyse-card__title">Ton niveau actuel</div>
        <div className="analyse-niveau">
          <div className="analyse-niveau__icon">{niveau.icon}</div>
          <div className="analyse-niveau__info">
            <div className="analyse-niveau__name">{niveau.name}</div>
            <div className="analyse-niveau__desc">{niveau.desc}</div>
            <div className="analyse-niveau__bar">
              <div className="analyse-niveau__bar-fill" style={{ width: `${levelPct}%` }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--bp-muted)', marginTop: 4 }}>
              Score {score}/100 — vers le niveau suivant ({nextScore})
            </div>
          </div>
        </div>
      </div>

      {/* Stats globales */}
      <div className="analyse-card">
        <div className="analyse-card__title">Stats globales</div>
        <div className="analyse-stats-grid">
          <div className="analyse-stat">
            <div className="analyse-stat__val">{sessions.length}</div>
            <div className="analyse-stat__label">Séances totales</div>
          </div>
          <div className="analyse-stat">
            <div className="analyse-stat__val">{poidsPerdu > 0 ? `-${poidsPerdu.toFixed(1)}` : '—'} kg</div>
            <div className="analyse-stat__label">Poids perdu</div>
          </div>
          <div className="analyse-stat">
            <div className="analyse-stat__val">{days}</div>
            <div className="analyse-stat__label">Jours actifs</div>
          </div>
          <div className="analyse-stat">
            <div className="analyse-stat__val">{state.journalEntries.length}</div>
            <div className="analyse-stat__label">Entrées journal</div>
          </div>
          <div className="analyse-stat">
            <div className="analyse-stat__val">{state.mensurations.length}</div>
            <div className="analyse-stat__label">Mensurations</div>
          </div>
          <div className="analyse-stat">
            <div className="analyse-stat__val">{bestHT > 0 ? `${bestHT}kg` : '—'}</div>
            <div className="analyse-stat__label">Record Hip Thrust</div>
          </div>
        </div>
      </div>

      {/* Trophées */}
      <div className="analyse-card">
        <div className="analyse-card__title">🏆 Trophées</div>
        <div className="analyse-trophies">
          {TROPHIES.map(t => {
            const unlocked = isTrophyUnlocked(t.id, state, sessions);
            return (
              <div key={t.id} className={`trophy-item${unlocked ? ' trophy-item--unlocked' : ' trophy-item--locked'}`}>
                <div className="trophy-item__icon">{t.icon}</div>
                <div className="trophy-item__name">{t.name}</div>
                <div className="trophy-item__desc">{t.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
