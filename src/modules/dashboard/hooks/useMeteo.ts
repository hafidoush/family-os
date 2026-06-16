import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../core/db/database';
import { newEntity } from '../../../core/db/helpers';
import type { Pensee } from '../../../shared/types';

export interface MeteoData {
  temperature: number;
  temperatureApparente: number;
  condition: string;
  iconCode: number;
  vent: number;
  phaseLunaire: string;
  phaseLunaireIcone: string;
  isStale: boolean;
}

const WMO_CODES: Record<number, string> = {
  0: 'Ciel dégagé', 1: 'Principalement dégagé', 2: 'Partiellement nuageux',
  3: 'Couvert', 45: 'Brouillard', 48: 'Brouillard givrant',
  51: 'Bruine légère', 53: 'Bruine modérée', 55: 'Bruine dense',
  61: 'Pluie légère', 63: 'Pluie modérée', 65: 'Pluie forte',
  71: 'Neige légère', 73: 'Neige modérée', 75: 'Neige forte',
  80: 'Averses légères', 81: 'Averses modérées', 82: 'Averses violentes',
  95: 'Orage', 96: 'Orage avec grêle', 99: 'Orage avec grêle forte',
};

function getPhaseLunaire(): { label: string; icon: string } {
  const knownNewMoon = new Date('2024-01-11').getTime();
  const cycleMs = 29.53 * 24 * 3600 * 1000;
  const elapsed = (Date.now() - knownNewMoon) % cycleMs;
  const pct = elapsed / cycleMs;
  if (pct < 0.0625) return { label: 'Nouvelle lune', icon: '🌑' };
  if (pct < 0.1875) return { label: 'Premier croissant', icon: '🌒' };
  if (pct < 0.3125) return { label: 'Premier quartier', icon: '🌓' };
  if (pct < 0.4375) return { label: 'Gibbeuse croissante', icon: '🌔' };
  if (pct < 0.5625) return { label: 'Pleine lune', icon: '🌕' };
  if (pct < 0.6875) return { label: 'Gibbeuse décroissante', icon: '🌖' };
  if (pct < 0.8125) return { label: 'Dernier quartier', icon: '🌗' };
  return { label: 'Dernier croissant', icon: '🌘' };
}

const CACHE_KEY = 'family_os_meteo_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 min
const COLD_ALERT_KEY = 'family_os_meteo_cold_alert';

function isTransitionSeason(): boolean {
  const month = new Date().getMonth() + 1; // 1-12
  return (month >= 3 && month <= 5) || (month >= 9 && month <= 11);
}

async function maybeCreateVetementsAlerte(temperature: number): Promise<void> {
  if (temperature >= 10 || !isTransitionSeason()) return;
  const today = new Date().toISOString().slice(0, 10);
  const lastAlert = localStorage.getItem(COLD_ALERT_KEY);
  if (lastAlert === today) return;
  localStorage.setItem(COLD_ALERT_KEY, today);
  const pensee = newEntity<Pensee>({
    contenu: `Vérifier les vêtements chauds — il fait ${temperature}°C aujourd'hui`,
    categorie: 'enfants',
    statut: 'active',
    archive: false,
  });
  await db.pensees.add(pensee);
}

// Lyon par défaut — peut être paramétré plus tard
const LAT = 45.75;
const LON = 4.85;

export function useMeteo() {
  const [data, setData] = useState<MeteoData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMeteo = useCallback(async () => {
    // Vérifier le cache d'abord
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          setData({ ...cached.data, isStale: false });
          setLoading(false);
          return;
        }
      }
    } catch {}

    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
        `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
        `&wind_speed_unit=kmh&timezone=Europe%2FParis`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('open-meteo error');
      const json = await res.json();
      const c = json.current;
      const lune = getPhaseLunaire();

      const meteo: MeteoData = {
        temperature: Math.round(c.temperature_2m),
        temperatureApparente: Math.round(c.apparent_temperature),
        condition: WMO_CODES[c.weather_code] ?? 'Inconnu',
        iconCode: c.weather_code,
        vent: Math.round(c.wind_speed_10m),
        phaseLunaire: lune.label,
        phaseLunaireIcone: lune.icon,
        isStale: false,
      };

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ timestamp: Date.now(), data: meteo })
      );
      setData(meteo);
      await maybeCreateVetementsAlerte(meteo.temperature);
    } catch {
      // Dégradation : dernières données connues
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          setData({ ...cached.data, isStale: true });
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeteo();
    const interval = setInterval(fetchMeteo, CACHE_TTL);
    return () => clearInterval(interval);
  }, [fetchMeteo]);

  return { data, loading };
}