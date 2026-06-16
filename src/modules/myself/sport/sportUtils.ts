import type { SportState } from './sportTypes';
import { TROPHIES } from './sportConstants';

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getDayCount(dateDepart: string): number {
  const start = new Date(dateDepart).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / 86400000));
}

export function getMonthCount(dateDepart: string): number {
  const start = new Date(dateDepart);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, months);
}

export function getBestHipThrust(sessions: any[]): number {
  let best = 0;
  for (const s of sessions) {
    const m = s.metriques as { exercises?: { name: string; sets: { weight: string }[] }[] } | undefined;
    if (!m?.exercises) continue;
    for (const ex of m.exercises) {
      if (!ex.name.toLowerCase().includes('hip thrust')) continue;
      for (const set of ex.sets) {
        const w = parseFloat(set.weight);
        if (!isNaN(w) && w > best) best = w;
      }
    }
  }
  return best;
}

export function calcScore(state: SportState, sessions: any[]): number {
  let score = 0;
  // Séances: max 40pts (1pt par séance, max 40)
  score += Math.min(40, sessions.length);
  // Mensurations: max 20pts
  score += Math.min(20, state.mensurations.length * 2);
  // Journal: max 20pts
  score += Math.min(20, state.journalEntries.length);
  // Diastasis: max 10pts
  score += Math.min(10, state.diastasisLogs.length);
  // Objectifs cochés: max 10pts
  const totalObj = Object.values(state.objectifs).flat();
  const doneObj = totalObj.filter(o => o.done).length;
  score += Math.min(10, doneObj * 2);
  return Math.min(100, score);
}

export function getNiveau(score: number): { icon: string; name: string; desc: string } {
  if (score < 10) return { icon: '🌱', name: 'Débutante',       desc: 'Tu commences ton aventure' };
  if (score < 25) return { icon: '🌸', name: 'En route',        desc: 'La routine se met en place' };
  if (score < 45) return { icon: '💪', name: 'Déterminée',      desc: 'La régularité paie' };
  if (score < 65) return { icon: '🔥', name: 'Athlète',         desc: 'Tu es dans le flow' };
  if (score < 85) return { icon: '✨', name: 'Transformée',     desc: 'Résultats remarquables' };
  return                 { icon: '👑', name: 'Championne',      desc: 'Potentiel naturel atteint' };
}

export function isTrophyUnlocked(id: string, state: SportState, sessions: any[]): boolean {
  const months = getMonthCount(state.profil.dateDepart);
  const days = getDayCount(state.profil.dateDepart);
  const bestHT = getBestHipThrust(sessions);
  switch (id) {
    case 'first_session':   return sessions.length >= 1;
    case 'week1':           return days >= 7;
    case 'sessions10':      return sessions.length >= 10;
    case 'sessions25':      return sessions.length >= 25;
    case 'sessions50':      return sessions.length >= 50;
    case 'hip_thrust_40':   return bestHT >= 40;
    case 'hip_thrust_60':   return bestHT >= 60;
    case 'hip_thrust_80':   return bestHT >= 80;
    case 'mensuration1':    return state.mensurations.length >= 1;
    case 'mensuration5':    return state.mensurations.length >= 5;
    case 'journal7':        return state.journalEntries.length >= 7;
    case 'diastasis10':     return state.diastasisLogs.length >= 10;
    case 'month3':          return months >= 3;
    case 'month6':          return months >= 6;
    case 'month12':         return months >= 12;
    case 'month24':         return months >= 24;
    default:                return false;
  }
}

export async function compressImage(file: File, maxPx = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export { TROPHIES };
