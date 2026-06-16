import React from 'react';
import { useMeteo } from '../hooks/useMeteo';
import './WidgetMeteo.css';

// ─── Icônes SVG météo ─────────────────────────────────────────────────────────

const SunIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.15"/>
    <line x1="12" y1="1" x2="12" y2="4"/>
    <line x1="12" y1="20" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/>
    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="4" y2="12"/>
    <line x1="20" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/>
    <line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
  </svg>
);

const CloudSunIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M17.66 5.34l-1.41 1.41" opacity="0.7"/>
    <circle cx="12" cy="7" r="3" fill="currentColor" fillOpacity="0.12"/>
    <path d="M16 14a4 4 0 0 0-8 0H6a3 3 0 0 0 0 6h11a3 3 0 0 0 0-6h-1z" fill="currentColor" fillOpacity="0.12"/>
  </svg>
);

const CloudIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="currentColor" fillOpacity="0.12"/>
  </svg>
);

const RainIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 13a4 4 0 0 0-8 0H6a3 3 0 0 0 0 6h11a3 3 0 0 0 0-6h-1z" fill="currentColor" fillOpacity="0.12"/>
    <line x1="8" y1="19" x2="8" y2="22"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="16" y1="19" x2="16" y2="22"/>
  </svg>
);

const SnowIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 13a4 4 0 0 0-8 0H6a3 3 0 0 0 0 6h11a3 3 0 0 0 0-6h-1z" fill="currentColor" fillOpacity="0.12"/>
    <line x1="8" y1="19" x2="8" y2="21"/>
    <line x1="12" y1="19" x2="12" y2="21"/>
    <line x1="16" y1="19" x2="16" y2="21"/>
    <line x1="8" y1="20" x2="7" y2="21"/>
    <line x1="12" y1="20" x2="11" y2="21"/>
    <line x1="16" y1="20" x2="15" y2="21"/>
  </svg>
);

const StormIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" fill="currentColor" fillOpacity="0.12"/>
    <polyline points="13 11 9 17 15 17 11 23"/>
  </svg>
);

const FogIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="3" y1="14" x2="21" y2="14"/>
    <line x1="5" y1="18" x2="19" y2="18"/>
    <path d="M8 6a4 4 0 0 1 8 0" fill="currentColor" fillOpacity="0.12"/>
  </svg>
);

const WindIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
  </svg>
);

function getWeatherIcon(code: number): React.ReactNode {
  if (code === 0)       return <SunIcon />;
  if (code <= 2)        return <CloudSunIcon />;
  if (code === 3)       return <CloudIcon />;
  if (code <= 48)       return <FogIcon />;
  if (code <= 67)       return <RainIcon />;
  if (code <= 77)       return <SnowIcon />;
  if (code <= 82)       return <RainIcon />;
  return <StormIcon />;
}

function getWeatherColor(code: number): string {
  if (code === 0)  return 'hsl(40, 85%, 56%)';
  if (code <= 2)   return 'hsl(40, 75%, 58%)';
  if (code <= 3)   return 'hsl(220, 20%, 62%)';
  if (code <= 48)  return 'hsl(220, 15%, 58%)';
  if (code <= 67)  return 'hsl(210, 60%, 58%)';
  if (code <= 77)  return 'hsl(200, 50%, 70%)';
  if (code <= 82)  return 'hsl(210, 55%, 55%)';
  return 'hsl(262, 45%, 55%)';
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function WidgetMeteo() {
  const { data, loading } = useMeteo();

  if (loading) {
    return (
      <div className="widget-card area-meteo widget-meteo">
        <div className="widget-meteo__inner">
          <div className="widget-meteo__left">
            <div className="widget-skeleton" style={{ height: 44, width: 80, borderRadius: 8 }} />
            <div className="widget-skeleton" style={{ height: 13, width: 100, marginTop: 8 }} />
            <div className="widget-skeleton" style={{ height: 11, width: 64, marginTop: 6 }} />
          </div>
          <div className="widget-skeleton" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="widget-card area-meteo widget-meteo">
        <div className="widget-empty">
          <span className="widget-empty-icon">
            <SunIcon />
          </span>
          <span>Météo indisponible</span>
        </div>
      </div>
    );
  }

  const iconColor = getWeatherColor(data.iconCode);

  return (
    <div className="widget-card area-meteo widget-meteo">
      <div className="widget-meteo__inner">

        {/* Bloc gauche — température + infos */}
        <div className="widget-meteo__left">
          <div className="widget-meteo__temp">
            {data.temperature}<span className="widget-meteo__deg">°</span>
          </div>
          <p className="widget-meteo__condition">{data.condition}</p>
          <p className="widget-meteo__vent">
            <WindIcon />
            {data.vent} km/h
          </p>
        </div>

        {/* Bloc droit — icône SVG */}
        <div className="widget-meteo__icon" style={{ color: iconColor }}>
          {getWeatherIcon(data.iconCode)}
        </div>

      </div>

      {data.isStale && (
        <p className="widget-meteo__stale">Données en cache</p>
      )}
    </div>
  );
}
