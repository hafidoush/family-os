/**
 * FAMILY OS — ActiviteSession
 * Bottom sheet : détails d'une activité + timer silencieux.
 *
 * Flux :
 *   1. S'ouvre au tap sur une activité dans WidgetActivites
 *   2. Affiche : nom, objectif, matériel, instructions, durée
 *   3. Bouton "On commence" → timer silencieux (barre de progression)
 *   4. À la fin du temps → marque automatiquement "réalisée"
 *   5. Bouton "Terminé" pour finir avant la fin
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../../core/db/database';
import { withUpdate } from '../../../core/db/helpers';
import type { Activite, PlanificationActivite } from '../../../shared/types';
import './ActiviteSession.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiviteSessionItem {
  planifId: string;
  statut: string;
  heurePrevue?: string;
  activite: Activite | undefined;
  membre?: { prenom: string; couleur?: string } | undefined;
}

interface Props {
  item: ActiviteSessionItem;
  onClose: () => void;
  onDone: (planifId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const DIFF_LABELS: Record<string, string> = {
  facile: '🟢 Facile',
  moyen:  '🟡 Moyen',
  difficile: '🔴 Difficile',
};

// ─── Timer interne ────────────────────────────────────────────────────────────

function useTimer(totalSeconds: number, onComplete: () => void) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => setRunning(true), []);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        if (totalSeconds > 0 && next >= totalSeconds) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          setCompleted(true);
          onComplete();
        }
        return next;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, totalSeconds, onComplete]);

  const progress = totalSeconds > 0
    ? Math.min((elapsed / totalSeconds) * 100, 100)
    : 0;

  return { elapsed, running, completed, start, stop, progress };
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function ActiviteSession({ item, onClose, onDone }: Props) {
  const { activite, planifId, heurePrevue, membre } = item;
  const [isDone, setIsDone] = useState(false);

  const totalSeconds = (activite?.dureeEstimee ?? 0) * 60;

  const handleComplete = useCallback(async () => {
    if (isDone) return;
    setIsDone(true);
    await db.planificationsActivites.update(planifId, withUpdate({ statut: 'realisee' } as Partial<PlanificationActivite>));
    onDone(planifId);
  }, [isDone, planifId, onDone]);

  const { elapsed, running, completed, start, progress } = useTimer(totalSeconds, handleComplete);

  // Fermeture au clic backdrop
  const handleBackdropClick = () => {
    if (!running) onClose();
  };

  return (
    <>
      <div className="act-session-backdrop" onClick={handleBackdropClick} />
      <div className="act-session" role="dialog" aria-modal="true">
        <div className="act-session__handle" />

        {/* Header */}
        <div className="act-session__header">
          <div className="act-session__title-block">
            <h2 className="act-session__nom">{activite?.nom ?? 'Activité'}</h2>
            <div className="act-session__meta">
              {membre && (
                <span className="act-session__badge" style={{ background: membre.couleur ? `${membre.couleur}33` : undefined }}>
                  👧 {membre.prenom}
                </span>
              )}
              {activite?.dureeEstimee && (
                <span className="act-session__badge">⏱ {activite.dureeEstimee} min</span>
              )}
              {activite?.difficulte && (
                <span className="act-session__badge">{DIFF_LABELS[activite.difficulte] ?? activite.difficulte}</span>
              )}
              {activite?.ageMin && (
                <span className="act-session__badge">
                  {activite.ageMin}–{activite.ageMax ?? '+'} mois
                </span>
              )}
              {heurePrevue && (
                <span className="act-session__badge">🕐 {heurePrevue}</span>
              )}
            </div>
          </div>
          <button className="act-session__close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {/* Corps */}
        <div className="act-session__body">

          {activite?.objectifPedagogique && (
            <div className="act-session__section">
              <span className="act-session__section-label">Objectif</span>
              <p className="act-session__section-text">{activite.objectifPedagogique}</p>
            </div>
          )}

          {activite?.materiel && activite.materiel.length > 0 && (
            <div className="act-session__section">
              <span className="act-session__section-label">Matériel</span>
              <div className="act-session__materiel">
                {activite.materiel.map((m, i) => (
                  <span key={i} className="act-session__materiel-item">📦 {m}</span>
                ))}
              </div>
            </div>
          )}

          {activite?.instructions && (
            <div className="act-session__section">
              <span className="act-session__section-label">Comment faire</span>
              <p className="act-session__section-text">{activite.instructions}</p>
            </div>
          )}

        </div>

        {/* Timer zone */}
        <div className="act-session__timer-zone" style={{ margin: '16px 20px 0' }}>

          {isDone || completed ? (
            <div className="act-session__done-state">
              <span className="act-session__done-icon">✅</span>
              <p className="act-session__done-label">Activité réalisée</p>
              <p className="act-session__done-sub">
                {elapsed > 0 ? `Durée : ${formatElapsed(elapsed)}` : 'Bien joué !'}
              </p>
            </div>
          ) : running ? (
            <div className="act-timer">
              <div className="act-timer__top">
                <span className="act-timer__elapsed">{formatElapsed(elapsed)}</span>
                {activite?.dureeEstimee && (
                  <span className="act-timer__total">sur {activite.dureeEstimee} min</span>
                )}
              </div>

              {totalSeconds > 0 && (
                <div className="act-timer__bar-track">
                  <div
                    className="act-timer__bar-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <button className="act-timer__done-btn" onClick={handleComplete}>
                Terminé — marquer comme fait
              </button>
            </div>
          ) : (
            <button className="act-session__start-btn" onClick={start}>
              ▶ On commence
            </button>
          )}

        </div>

      </div>
    </>
  );
}

export default ActiviteSession;
