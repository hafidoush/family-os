import { useState, useEffect } from 'react';
import { useMeteo } from '../hooks/useMeteo';
import './WidgetContextuel.css';

const JOURS_COURT = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
const MOIS_COURT = [
  'JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN',
  'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC',
];

function getWmoIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '🌨️';
  if (code <= 82) return '⛈️';
  return '⛈️';
}

export function WidgetContextuel() {
  const [now, setNow] = useState(new Date());
  const { data: meteo, loading: meteoLoading } = useMeteo();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const jourCourt = JOURS_COURT[now.getDay()];
  const moisCourt = MOIS_COURT[now.getMonth()];
  const dateLabel = `${jourCourt} ${now.getDate()} ${moisCourt}`;
  const heure = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="widget-contextuel-topbar">
      {/* Gauche : date + heure + météo */}
      <div className="widget-contextuel-topbar__left">
        <div className="widget-contextuel-topbar__time-block">
          <div className="widget-contextuel-topbar__date-row">
            <span className="widget-contextuel-topbar__date">{dateLabel}</span>
            {meteo && (
              <span className="widget-contextuel-topbar__meteo-icon">
                {getWmoIcon(meteo.iconCode)}
              </span>
            )}
          </div>
          <span className="widget-contextuel-topbar__heure">{heure}</span>
        </div>
      </div>

      {/* Droite : toggle light mode */}
      <div className="widget-contextuel-topbar__right">
        <div className="widget-contextuel-topbar__mode-toggle">
          <span className="widget-contextuel-topbar__mode-btn widget-contextuel-topbar__mode-btn--active">☀</span>
          <span className="widget-contextuel-topbar__mode-btn">☽</span>
        </div>
        <span className="widget-contextuel-topbar__mode-label">light<br/>mode</span>
      </div>
    </div>
  );
}
