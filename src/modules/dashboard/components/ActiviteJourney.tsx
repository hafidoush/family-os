/**
 * FAMILY OS — ActiviteJourney
 * Vue "aventure du jour" : toutes les activités sous forme de cartes visuelles.
 * Remplace la simple liste du widget par une expérience immersive.
 */

import { useState, useRef } from 'react';
import { db } from '../../../core/db/database';
import { withUpdate } from '../../../core/db/helpers';
import { emit } from '../../../core/automation/engine';
import { useTodayActivites } from '../hooks/useTodayActivites';
import type { PlanificationActivite } from '../../../shared/types';
import './ActiviteJourney.css';

const CATEGORIE_EMOJIS: Record<string, string> = {
  'Sensoriel': '🪣',
  'Motricité fine': '✂️',
  'Pré-écriture': '✏️',
  'Construction et logique': '🧱',
  'Mathématiques': '🔢',
  'Langage et prélecture': '📖',
  'Motricité globale': '🤸',
  'Nature et découverte': '🌿',
  'Vie pratique': '🏠',
  'Créativité': '🎨',
};

const CATEGORIE_COLORS: Record<string, string> = {
  'Sensoriel': '#FB923C',
  'Motricité fine': '#A78BFA',
  'Pré-écriture': '#60A5FA',
  'Construction et logique': '#FBBF24',
  'Mathématiques': '#34D399',
  'Langage et prélecture': '#F472B6',
  'Motricité globale': '#F87171',
  'Nature et découverte': '#6EE7B7',
  'Vie pratique': '#C4B5FD',
  'Créativité': '#FCA5A5',
};

const FEEDBACK_MESSAGES = [
  'Bravo, continuez sur cette lancée !',
  'Quelle belle journée qui se construit !',
  'Excellent travail, maman est fière !',
  'Une activité de plus, vous êtes fantastiques !',
];

// ─── Swipe gestuel ────────────────────────────────────────────────────────────
// Droite (> 80px)  → terminer   🟢
// Gauche (< -80px) → reporter   🟡

interface SwipeCardProps {
  children: React.ReactNode;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  disabled?: boolean;
}

function SwipeCard({ children, onSwipeRight, onSwipeLeft, disabled }: SwipeCardProps) {
  const startX = useRef<number>(0);
  const currentOffset = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const bgRightRef = useRef<HTMLDivElement>(null);
  const bgLeftRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80;

  // Met à jour le DOM directement (sans re-render) pour performances maximales
  const applyOffset = (dx: number) => {
    if (!innerRef.current) return;
    innerRef.current.style.transform = `translateX(${dx}px)`;
    if (bgRightRef.current) bgRightRef.current.style.opacity = dx > 20 ? String(Math.min(dx / THRESHOLD, 1)) : '0';
    if (bgLeftRef.current)  bgLeftRef.current.style.opacity  = dx < -20 ? String(Math.min(-dx / THRESHOLD, 1)) : '0';
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    currentOffset.current = 0;
    isSwiping.current = true;
    if (innerRef.current) innerRef.current.style.transition = 'none';
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping.current || disabled) return;
    const dx = Math.max(-140, Math.min(140, e.touches[0].clientX - startX.current));
    currentOffset.current = dx;
    applyOffset(dx);
  };

  const onTouchEnd = () => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    if (innerRef.current) innerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
    if (currentOffset.current > THRESHOLD)  { onSwipeRight(); }
    else if (currentOffset.current < -THRESHOLD) { onSwipeLeft(); }
    applyOffset(0);
    currentOffset.current = 0;
  };

  return (
    <div className="aj-swipe-wrap" style={{ position: 'relative', borderRadius: 14 }}>
      {/* Fond vert (terminer) */}
      <div ref={bgRightRef} className="aj-swipe-bg aj-swipe-bg--right" style={{ opacity: 0 }}>
        <span>✓</span><span>Terminé</span>
      </div>
      {/* Fond orange (reporter) */}
      <div ref={bgLeftRef} className="aj-swipe-bg aj-swipe-bg--left" style={{ opacity: 0 }}>
        <span>Reporter</span><span>↩</span>
      </div>
      {/* Carte */}
      <div
        ref={innerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

interface Props {
  onClose: () => void;
  onStartActivity?: (planifId: string) => void;
}

export function ActiviteJourney({ onClose, onStartActivity }: Props) {
  const activites = useTodayActivites();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  const items = activites ?? [];
  const sorted = [...items].sort((a, b) => {
    const aDone = a.statut === 'realisee' || doneIds.has(a.id);
    const bDone = b.statut === 'realisee' || doneIds.has(b.id);
    if (aDone !== bDone) return Number(aDone) - Number(bDone);
    // Trier par heure prévue
    if (a.heurePrevue && b.heurePrevue) return a.heurePrevue.localeCompare(b.heurePrevue);
    if (a.heurePrevue) return -1;
    if (b.heurePrevue) return 1;
    return 0;
  });

  const totalFaites = items.filter(a => a.statut === 'realisee' || doneIds.has(a.id)).length;
  const total = items.length;
  const progression = total > 0 ? totalFaites / total : 0;

  const handleComplete = async (planifId: string) => {
    if (doneIds.has(planifId)) return;
    setCelebratingId(planifId);
    await db.planificationsActivites.update(planifId, withUpdate({ statut: 'realisee' } as Partial<PlanificationActivite>));
    emit('planification.status_changed', { planifId, statut: 'realisee' });
    setDoneIds(prev => new Set([...prev, planifId]));
    setTimeout(() => setCelebratingId(null), 1500);
  };

  const handlePostpone = async (planifId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await db.planificationsActivites.update(planifId, withUpdate({
      datePrevue: `${tomorrowStr}T00:00:00.000Z`,
      statut: 'planifiee',
    } as Partial<PlanificationActivite>));
  };

  const etatJournee = () => {
    if (total === 0) return { label: 'Journée libre', emoji: '☀️', color: '#FBBF24' };
    if (totalFaites === 0) return { label: 'La journée commence', emoji: '🌅', color: '#60A5FA' };
    if (totalFaites === total) return { label: 'Toutes les activités réalisées', emoji: '🏆', color: '#34D399' };
    if (progression >= 0.6) return { label: 'Presque terminé', emoji: '✨', color: '#A78BFA' };
    return { label: 'En bonne progression', emoji: '🌿', color: '#6EE7B7' };
  };

  const etat = etatJournee();

  const prochaine = sorted.find(a => a.statut !== 'realisee' && !doneIds.has(a.id));

  return (
    <>
      <div className="aj-backdrop" onClick={onClose} />
      <div className="aj-sheet" role="dialog" aria-modal="true">
        <div className="aj-handle" />

        {/* Header avec progression */}
        <div className="aj-header">
          <div className="aj-progress-ring">
            <svg viewBox="0 0 60 60" width="60" height="60">
              <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(201,184,232,0.25)" strokeWidth="5" />
              <circle cx="30" cy="30" r="24" fill="none"
                stroke={totalFaites === total && total > 0 ? '#34D399' : '#A78BFA'}
                strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${progression * 150.8} 150.8`}
                transform="rotate(-90 30 30)"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            </svg>
            <span className="aj-progress-text">{totalFaites}/{total}</span>
          </div>
          <div className="aj-header-info">
            <h2 className="aj-title">Activités du jour</h2>
            <span className="aj-etat" style={{ color: etat.color }}>
              {etat.emoji} {etat.label}
            </span>
            {prochaine && (
              <span className="aj-prochaine">
                Prochain : {(prochaine.activite as any)?.nom ?? '–'}
                {prochaine.heurePrevue && ` · ${prochaine.heurePrevue}`}
              </span>
            )}
          </div>
          <button className="aj-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {/* Liste de cartes */}
        <div className="aj-cards">
          {sorted.length === 0 && (
            <div className="aj-empty">
              <span>☀️</span>
              <p>Aucune activité planifiée aujourd'hui</p>
            </div>
          )}

          {sorted.map(a => {
            const isDone = a.statut === 'realisee' || doneIds.has(a.id);
            const isCelebrating = celebratingId === a.id;
            const cat = (a.activite as any)?.categorie ?? '';
            const catEmoji = CATEGORIE_EMOJIS[cat] ?? '🎯';
            const catColor = CATEGORIE_COLORS[cat] ?? '#A78BFA';
            const membre = a.membre as any;
            const activite = a.activite as any;

            return (
              <SwipeCard key={a.id}
                disabled={isDone}
                onSwipeRight={() => handleComplete(a.id)}
                onSwipeLeft={() => handlePostpone(a.id)}
              >
              <div
                className={[
                  'aj-card',
                  isDone ? 'aj-card--done' : 'aj-card--active',
                  isCelebrating ? 'aj-card--celebrate' : '',
                ].filter(Boolean).join(' ')}
                onClick={!isDone && onStartActivity ? () => onStartActivity(a.id) : undefined}
                role={!isDone && onStartActivity ? 'button' : undefined}
                tabIndex={!isDone && onStartActivity ? 0 : undefined}
              >
                {/* Icône catégorie */}
                <div className="aj-card__icon" style={{ background: catColor + '22', color: catColor }}>
                  {isCelebrating ? '🎉' : catEmoji}
                </div>

                {/* Contenu */}
                <div className="aj-card__content">
                  <div className="aj-card__top">
                    <span className="aj-card__nom" style={isDone ? { textDecoration: 'line-through', opacity: 0.55 } : {}}>
                      {activite?.nom ?? 'Activité'}
                    </span>
                    {isDone && <span className="aj-card__done-badge">✓ Réalisée</span>}
                  </div>

                  <div className="aj-card__meta">
                    {membre && (
                      <span className="aj-card__membre" style={{ background: (membre.couleur ?? '#E5E7EB') + '33', color: membre.couleur ?? '#7C6FA0' }}>
                        {membre.prenom}
                      </span>
                    )}
                    {a.heurePrevue && (
                      <span className="aj-card__pill">🕐 {a.heurePrevue}</span>
                    )}
                    {activite?.dureeEstimee && (
                      <span className="aj-card__pill">⏱ {activite.dureeEstimee} min</span>
                    )}
                    {cat && (
                      <span className="aj-card__pill" style={{ background: catColor + '15', color: catColor }}>
                        {cat}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!isDone && (
                  <div className="aj-card__actions" onClick={e => e.stopPropagation()}>
                    {onStartActivity && (
                      <button className="aj-card__btn aj-card__btn--start"
                        onClick={() => onStartActivity(a.id)}
                        title="Commencer"
                      >
                        ▶
                      </button>
                    )}
                    <button className="aj-card__btn aj-card__btn--done"
                      onClick={() => handleComplete(a.id)}
                      title="Marquer comme fait"
                    >
                      ✓
                    </button>
                    <button className="aj-card__btn aj-card__btn--postpone"
                      onClick={() => handlePostpone(a.id)}
                      title="Reporter à demain"
                    >
                      ↩
                    </button>
                  </div>
                )}
              </div>
              </SwipeCard>
            );
          })}
        </div>

        {/* Message de célébration */}
        {totalFaites === total && total > 0 && (
          <div className="aj-celebration">
            🏆 {FEEDBACK_MESSAGES[totalFaites % FEEDBACK_MESSAGES.length]}
          </div>
        )}
      </div>
    </>
  );
}
