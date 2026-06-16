/**
 * FAMILY OS — WidgetRushMatin
 * Bannière "Rush matinal" visible entre 6h et 9h.
 * Affiche en une ligne : activités du jour + tâches ménagères + prochain événement.
 * L'objectif : zéro charge mentale le matin, tout est visible d'un coup d'œil.
 */

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { IconCalendar } from '@shared/components/ui/Icon/Icon';
import { useTodayActivites } from '../hooks/useTodayActivites';
import { useTodayEvents } from '../hooks/useTodayEvents';
import './WidgetRushMatin.css';

function useRushVisible() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => {
      const h = new Date().getHours();
      setVisible(h >= 6 && h < 9);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);

  return { visible: visible && !dismissed, dismiss: () => setDismissed(true) };
}

function useTachesQuotidiennesCount() {
  return useLiveQuery(async () => {
    const all = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison' && t.frequence === 'quotidienne')
      .toArray();
    return { total: all.length, restantes: all.filter(t => t.statut !== 'fait').length };
  }, []);
}

export function WidgetRushMatin() {
  const { visible, dismiss } = useRushVisible();
  const activites = useTodayActivites();
  const events = useTodayEvents();
  const menage = useTachesQuotidiennesCount();

  if (!visible) return null;

  const nbActivites = activites?.filter(a => a.statut !== 'realisee').length ?? 0;
  const nbMenage = menage?.restantes ?? 0;

  // Prochain événement du jour avec heure
  const prochainEvt = events
    ?.filter(e => !e.journeeEntiere && e.heureDebut)
    .sort((a, b) => (a.heureDebut ?? '').localeCompare(b.heureDebut ?? ''))[0];

  const items: { emoji: ReactNode; label: string; color: string }[] = [];
  if (nbActivites > 0) items.push({ emoji: '🎨', label: `${nbActivites} activité${nbActivites > 1 ? 's' : ''}`, color: '#A78BFA' });
  if (nbMenage > 0)    items.push({ emoji: '🧹', label: `${nbMenage} tâche${nbMenage > 1 ? 's' : ''} ménage`, color: '#60A5FA' });
  if (prochainEvt)     items.push({ emoji: <IconCalendar size={16} />, label: `${prochainEvt.titre} · ${prochainEvt.heureDebut}`, color: '#34D399' });

  if (items.length === 0) return null;

  return (
    <div className="wrm-banner">
      <div className="wrm-header">
        <span className="wrm-icon">🌅</span>
        <span className="wrm-title">Bonjour — voici ta matinée</span>
        <button className="wrm-close" onClick={dismiss} aria-label="Fermer">✕</button>
      </div>
      <div className="wrm-items">
        {items.map((item, i) => (
          <div key={i} className="wrm-item" style={{ borderColor: item.color + '40', background: item.color + '12' }}>
            <span>{item.emoji}</span>
            <span className="wrm-item__label" style={{ color: item.color }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
