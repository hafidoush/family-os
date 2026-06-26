/**
 * FAMILY OS — WidgetMenage
 * Card dashboard + modal flottante glassmorphique.
 * La modal utilise useTachesDuJourEngine() — même source de vérité que SectionDuJour.
 */

import { useState, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../core/db/database';
import { TacheService } from '../../maison/services/TacheService';
import { useTachesDuJourEngine } from '../../menage/hooks/useTachesDuJourEngine';
import type { MenageMode, MenageTask } from '../../menage/hooks/useTachesDuJourEngine';
import type { FrequenceTache } from '@shared/types/entities';
import './WidgetMenage.css';

// ─── Fréquence → couleur dot ──────────────────────────────────────────────────

const FREQ_COLOR: Partial<Record<FrequenceTache, string>> = {
  quotidienne:    '#1D9E75',
  hebdomadaire:   '#378ADD',
  bihebdomadaire: '#378ADD',
  mensuelle:      '#7F77DD',
  trimestrielle:  '#BA7517',
  semestrielle:   '#BA7517',
  annuelle:       '#BA7517',
};

function freqColor(t: MenageTask): string {
  return FREQ_COLOR[t.frequence ?? 'ponctuelle'] ?? '#9B8DB5';
}

// ─── Modes ────────────────────────────────────────────────────────────────────

const MODES: { value: MenageMode; label: string }[] = [
  { value: 'normal',           label: 'Aujourd\'hui' },
  { value: 'grandMenage',      label: 'Grand ménage' },
  { value: 'receptionInvites', label: 'Invités' },
  { value: 'rattrapage',       label: 'Express' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isCompletedToday(t: MenageTask): boolean {
  if (t.statut !== 'fait' || !t.completeeLe) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const c = new Date(t.completeeLe); c.setHours(0, 0, 0, 0);
  return c.getTime() === today.getTime();
}

// ─── Card summary (data pour widget) ─────────────────────────────────────────

function useWidgetData() {
  return useLiveQuery(async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const all = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison')
      .toArray();
    const quotidiennes = all.filter(t => t.frequence === 'quotidienne');
    const faites = quotidiennes.filter(t => {
      if (t.statut !== 'fait' || !t.completeeLe) return false;
      const c = new Date(t.completeeLe); c.setHours(0, 0, 0, 0);
      return c.getTime() === today.getTime();
    }).length;
    const durMin = quotidiennes.reduce((s, t) => s + (t.dureeEstimee ?? 10), 0);
    return { total: quotidiennes.length, faites, durMin };
  });
}

// ─── Modal flottante ──────────────────────────────────────────────────────────

export function MenageModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<MenageMode>('normal');
  const tasks = useTachesDuJourEngine(mode) ?? [];

  const faites  = tasks.filter(isCompletedToday).length;
  const total   = tasks.length;
  const progPct = total > 0 ? (faites / total) * 100 : 0;
  const allDone = total > 0 && faites === total;
  const durMin  = tasks.reduce((s, t) => s + (t.dureeEstimee ?? 10), 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [thumbPct, setThumbPct] = useState(0);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const max = scrollHeight - clientHeight;
    setScrolled(scrollTop > 40);
    setThumbPct(max > 0 ? scrollTop / max : 0);
  }, []);

  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const handleToggle = async (t: MenageTask) => {
    if (isCompletedToday(t)) await TacheService.rouvrir(t.id);
    else await TacheService.completerTache(t.id);
  };

  return (
    <div className="wm-modal-overlay" onClick={onClose}>
      <div className="wm-modal" onClick={e => e.stopPropagation()}>

        {/* ── En-tête fixe ── */}
        <div className="wm-modal__top">
          <button className="wm-modal__close" onClick={onClose} aria-label="Fermer">✕</button>
          <div className="wm-modal__header">
            <span className="wm-modal__title">Ménage du jour</span>
            <span className="wm-modal__meta">{total > 0 ? `${faites}/${total} · ~${durMin} min` : 'Maison à jour'}</span>
          </div>
          {total > 0 && (
            <div className="wm-modal__prog-bar">
              <div className="wm-modal__prog-fill" style={{ width: `${progPct}%`, background: allDone ? '#34D399' : '#C69CE2' }} />
            </div>
          )}
          <div className="wm-modal__modes">
            {MODES.map(m => (
              <button key={m.value} className={`wm-modal__mode-pill${mode === m.value ? ' active' : ''}`} onClick={() => setMode(m.value)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Zone scrollable ── */}
        <div className="wm-modal__scroll-wrap">
          <div className="wm-modal__scroll" ref={scrollRef} onScroll={onScroll}>
            <div className="wm-modal__tasks">
              {tasks.length === 0 ? (
                <p className="wm-modal__empty">Maison à jour</p>
              ) : (
                tasks.map(t => {
                  const done = isCompletedToday(t);
                  return (
                    <button key={t.id} className={`wm-modal__task${done ? ' done' : ''}`} onClick={() => handleToggle(t)}>
                      <span className="wm-modal__task-check" style={done ? { background: '#C69CE2', borderColor: '#C69CE2' } : {}}>
                        {done && '✓'}
                      </span>
                      <span className="wm-modal__task-titre">{t.titre}</span>
                      <span className="wm-modal__task-dot" style={{ background: freqColor(t) }} />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Indicateur de scroll */}
          {tasks.length > 4 && (
            <div className="wm-scroll-track">
              <div className="wm-scroll-thumb" style={{ top: `${thumbPct * 70}%` }} />
            </div>
          )}

          {/* Bouton retour en haut */}
          {scrolled && (
            <button className="wm-scroll-top" onClick={scrollToTop} aria-label="Retour en haut">↑</button>
          )}
        </div>

        {/* ── CTA fixe en bas ── */}
        <div className="wm-modal__bottom">
          <button className="wm-modal__cta" onClick={() => { onClose(); navigate('/menage'); }}>
            Voir le module complet
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Widget card ──────────────────────────────────────────────────────────────

export function WidgetMenage() {
  const [modalOpen, setModalOpen] = useState(false);
  const data = useWidgetData();

  if (data === undefined) {
    return (
      <div className="widget-card">
        <div className="widget-header"><span className="widget-title">Ménage</span></div>
        <div className="widget-skeleton" />
      </div>
    );
  }

  const { total, faites, durMin } = data;
  const allDone = total > 0 && faites === total;
  const progPct = total > 0 ? (faites / total) * 100 : 0;

  return (
    <>
      <div className="widget-card widget-menage" onClick={() => total > 0 && setModalOpen(true)} style={{ cursor: total > 0 ? 'pointer' : 'default' }}>
        <div className="widget-header">
          <span className="wm-badge">MÉNAGE</span>
          {total > 0 && (
            <span className={`wm-score${allDone ? ' wm-score--done' : ''}`}>
              {faites}/{total}
            </span>
          )}
        </div>

        {total === 0 ? (
          <div className="widget-empty">
            <span>✨</span>
            <span>Maison à jour</span>
          </div>
        ) : (
          <>
            <div className="wm-card__meta">
              <span className="wm-card__dur">~{durMin} min</span>
            </div>
            <div className="wm-progress-bar">
              <div
                className="wm-progress-fill"
                style={{ width: `${progPct}%`, background: allDone ? '#34D399' : '#C69CE2' }}
              />
            </div>
            <p className="wm-card__hint">
              {allDone ? '✓ Tout est fait' : `${total - faites} tâche${total - faites > 1 ? 's' : ''} restante${total - faites > 1 ? 's' : ''} · tap pour voir`}
            </p>
          </>
        )}
      </div>

      {modalOpen && <MenageModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
