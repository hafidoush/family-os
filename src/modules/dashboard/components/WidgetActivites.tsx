/**
 * FAMILY OS — WidgetActivites
 * Card dashboard enrichie + modal glassmorphique.
 * Même logique que WidgetMenage, adaptée aux activités Montessori.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../core/db/database';
import { withUpdate } from '../../../core/db/helpers';
import { useTodayActivites } from '../hooks/useTodayActivites';
import type { Activite, DifficulteActivite } from '@shared/types';
import './WidgetActivites.css';

// ─── Constantes ────────────────────────────────────────────────────────────────

const CAT_EMOJI: Record<string, string> = {
  'Sensoriel': '🪣',
  'Motricité fine': '🖐️',
  'Pré-écriture': '✏️',
  'Construction et logique': '🧱',
  'Mathématiques': '🔢',
  'Langage et prélecture': '📖',
  'Motricité globale': '🤸',
  'Nature et découverte': '🌍',
  'Vie pratique': '🏠',
  'Créativité': '🎨',
};

const DIFF_STYLE: Record<DifficulteActivite, { bg: string; color: string; label: string }> = {
  facile:    { bg: 'rgba(46,125,50,0.12)',   color: '#2E7D32', label: 'Facile' },
  moyen:     { bg: 'rgba(245,124,0,0.12)',   color: '#E65100', label: 'Moyen' },
  difficile: { bg: 'rgba(183,28,28,0.10)',   color: '#B71C1C', label: 'Difficile' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayKey() {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `activites_materiel_pret_${ymd}`;
}

type PlanifWithActivite = ReturnType<typeof useTodayActivites> extends (infer T)[] | undefined ? T : never;
type ActiviteEtendue = Activite & {
  preparationDelaiJours?: number;
  preparationTexte?: string;
  preparationUrgence?: 'immediate' | 'veille' | 'plusieurs_jours';
};

// ─── Modal flottante ───────────────────────────────────────────────────────────

export function ActivitesModal({ onClose, onPret }: { onClose: () => void; onPret?: () => void }) {
  const navigate = useNavigate();
  const rawItems = useTodayActivites();
  const items = rawItems ?? [];

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [materielOpen, setMaterielOpen] = useState(false);
  const [materielCoche, setMaterielCoche] = useState<Set<string>>(new Set());
  const [pret, setPret] = useState(() => !!localStorage.getItem(todayKey()));

  const realisees = items.filter(i => i.statut === 'realisee').length;
  const total = items.length;
  const restantes = total - realisees;
  const progPct = total > 0 ? (realisees / total) * 100 : 0;

  // Matériel consolidé — dédupliqué sur toutes les activités du jour
  const allMateriel: string[] = [...new Set(
    items.flatMap(i => (i.activite as ActiviteEtendue | undefined)?.materiel ?? [])
  )];

  // Groupement par catégorie
  const grouped = items.reduce<Record<string, PlanifWithActivite[]>>((acc, item) => {
    const cat = (item.activite as ActiviteEtendue | undefined)?.categorie ?? 'Autre';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const handleToggle = async (item: PlanifWithActivite) => {
    const newStatut = item.statut === 'realisee' ? 'planifiee' : 'realisee';
    await db.planificationsActivites.update(item.id, withUpdate({ statut: newStatut }));
  };

  const handlePret = () => {
    localStorage.setItem(todayKey(), new Date().toISOString());
    setPret(true);
    setMaterielOpen(false);
    onPret?.();
  };

  return (
    <div className="wa-modal-overlay" onClick={onClose}>
      <div className="wa-modal" onClick={e => e.stopPropagation()}>

        {/* ── En-tête fixe ── */}
        <div className="wa-modal__top">
          <button className="wa-modal__close" onClick={onClose} aria-label="Fermer">✕</button>
          <div className="wa-modal__header">
            <span className="wa-modal__title">Activités du jour</span>
            <span className="wa-modal__meta">
              {total === 0 ? 'Journée tranquille' : `${restantes} restante${restantes !== 1 ? 's' : ''} · ${realisees} faite${realisees !== 1 ? 's' : ''}`}
            </span>
          </div>
          {total > 0 && (
            <div className="wa-modal__prog-bar">
              <div
                className="wa-modal__prog-fill"
                style={{ width: `${progPct}%`, background: realisees === total ? '#2E7D32' : '#6F7ED6' }}
              />
            </div>
          )}
        </div>

        {/* ── Zone scrollable ── */}
        <div className="wa-modal__scroll">

          {/* ── Matériel du jour ── */}
          <div className="wa-materiel-section">
            <button
              className={`wa-materiel-btn${materielOpen ? ' open' : ''}`}
              onClick={() => setMaterielOpen(v => !v)}
            >
              <span>Matériel du jour</span>
              <span className="wa-materiel-btn__chevron">{materielOpen ? '▴' : '▾'}</span>
            </button>

            {materielOpen && (
              <div className="wa-materiel-panel">
                {allMateriel.length === 0 ? (
                  <p className="wa-materiel-empty">Aucun matériel requis</p>
                ) : (
                  allMateriel.map(mat => (
                    <label key={mat} className="wa-materiel-item">
                      <input
                        type="checkbox"
                        checked={materielCoche.has(mat)}
                        onChange={() => setMaterielCoche(prev => {
                          const next = new Set(prev);
                          if (next.has(mat)) next.delete(mat); else next.add(mat);
                          return next;
                        })}
                      />
                      <span>{mat}</span>
                    </label>
                  ))
                )}
              </div>
            )}

            <button
              className={`wa-pret-btn${pret ? ' pret' : ''}`}
              onClick={handlePret}
              disabled={pret}
            >
              {pret ? 'Matériel prêt !' : 'Tout est prêt'}
            </button>
          </div>

          {/* ── Activités par catégorie ── */}
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} className="wa-cat-section">
              <div className="wa-cat-title">
                <span>{CAT_EMOJI[cat] ?? '📌'}</span>
                <span>{cat}</span>
              </div>

              {catItems.map(item => {
                const act = item.activite as ActiviteEtendue | undefined;
                const done = item.statut === 'realisee';
                const expanded = expandedId === item.id;
                const diff = act?.difficulte ? DIFF_STYLE[act.difficulte] : null;

                return (
                  <div key={item.id} className={`wa-pill${done ? ' done' : ''}${expanded ? ' expanded' : ''}`}>
                    <div className="wa-pill__row">
                      <button
                        className="wa-pill__check"
                        onClick={() => handleToggle(item)}
                        aria-label={done ? 'Marquer comme non faite' : 'Marquer comme faite'}
                        style={done ? { background: '#6F7ED6', borderColor: '#6F7ED6' } : {}}
                      >
                        {done && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>

                      <span
                        className={`wa-pill__nom${done ? ' done' : ''}`}
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                      >
                        {act?.nom ?? '–'}
                      </span>

                      {diff && (
                        <span className="wa-pill__tag" style={{ background: diff.bg, color: diff.color }}>
                          {diff.label}
                        </span>
                      )}

                      {act?.dureeEstimee ? (
                        <span className="wa-pill__tag wa-pill__dur">
                          {act.dureeEstimee} min
                        </span>
                      ) : null}

                      <button
                        className="wa-pill__expand-btn"
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        aria-label={expanded ? 'Réduire' : 'Voir les détails'}
                      >
                        {expanded ? '▴' : '▾'}
                      </button>
                    </div>

                    {expanded && (
                      <div className="wa-pill__detail">
                        {act?.objectifPedagogique && (
                          <div className="wa-pill__section">
                            <span className="wa-pill__section-label">Objectif</span>
                            <p>{act.objectifPedagogique}</p>
                          </div>
                        )}
                        {act?.materiel && act.materiel.length > 0 && (
                          <div className="wa-pill__section">
                            <span className="wa-pill__section-label">Matériel</span>
                            <ul>
                              {act.materiel.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                          </div>
                        )}
                        {act?.preparationDelaiJours != null && act.preparationDelaiJours > 0 && act.preparationTexte && (
                          <div className="wa-pill__section">
                            <span className="wa-pill__section-label">Préparation</span>
                            <p>{act.preparationTexte}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {total === 0 && (
            <p className="wa-modal__empty">Aucune activité planifiée aujourd'hui</p>
          )}

          {/* ── CTA bas ── */}
          <div className="wa-modal__cta-wrap">
            <button
              className="wa-modal__cta"
              onClick={() => { onClose(); navigate('/activites'); }}
            >
              Voir le module complet
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Widget card ───────────────────────────────────────────────────────────────

export function WidgetActivites() {
  const [modalOpen, setModalOpen] = useState(false);
  const [pret, setPret] = useState(() => !!localStorage.getItem(todayKey()));
  const rawItems = useTodayActivites();

  // Sync état "prêt" au retour de focus (modal fermée)
  useEffect(() => {
    const check = () => setPret(!!localStorage.getItem(todayKey()));
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);

  if (rawItems === undefined) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <span className="wa-badge">ACTIVITÉ</span>
        </div>
        <div className="widget-skeleton" />
      </div>
    );
  }

  const items = rawItems;
  const total = items.length;
  const realisees = items.filter(i => i.statut === 'realisee').length;
  const restantes = total - realisees;
  const progPct = total > 0 ? (realisees / total) * 100 : 0;
  const allDone = total > 0 && realisees === total;

  const dureeMin = items
    .filter(i => i.statut !== 'realisee')
    .reduce((s, i) => s + ((i.activite as ActiviteEtendue | undefined)?.dureeEstimee ?? 15), 0);

  // Catégories uniques pour les tags
  const cats = [...new Set(
    items.map(i => (i.activite as ActiviteEtendue | undefined)?.categorie).filter(Boolean) as string[]
  )];

  return (
    <>
      <div
        className={`widget-card wa-card${pret ? ' wa-card--pret' : ''}`}
        onClick={() => total > 0 && setModalOpen(true)}
        style={{ cursor: total > 0 ? 'pointer' : 'default' }}
        role={total > 0 ? 'button' : undefined}
        tabIndex={total > 0 ? 0 : undefined}
        onKeyDown={e => total > 0 && e.key === 'Enter' && setModalOpen(true)}
      >
        {/* Ligne 1 : Badge */}
        <span className="wa-badge">ACTIVITÉ</span>

        {/* Ligne 2 : tags catégories + compteur + badge Prêt */}
        <div className="wa-card__tags-row">
          {cats.slice(0, 3).map(cat => (
            <span key={cat} className="wa-cat-tag">{cat}</span>
          ))}
          {cats.length > 3 && <span className="wa-cat-tag">+{cats.length - 3}</span>}
          {total > 0 && (
            <span className={`wa-count-tag${allDone ? ' done' : ''}`}>{realisees}/{total}</span>
          )}
          {pret && <span className="wa-pret-badge">Prêt</span>}
        </div>

        {total === 0 ? (
          <div className="widget-empty">
            <span>Journée tranquille</span>
          </div>
        ) : (
          <>
            <p className="wa-card__title">Activités du jour</p>

            <div className="wa-card__prog-bar">
              <div
                className="wa-card__prog-fill"
                style={{
                  width: `${progPct}%`,
                  background: allDone ? '#2E7D32' : '#6F7ED6',
                }}
              />
            </div>

            <p className="wa-card__meta">
              ~{dureeMin} min · {restantes} restante{restantes !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>

      {modalOpen && (
        <ActivitesModal
          onClose={() => { setModalOpen(false); setPret(!!localStorage.getItem(todayKey())); }}
          onPret={() => setPret(true)}
        />
      )}
    </>
  );
}
