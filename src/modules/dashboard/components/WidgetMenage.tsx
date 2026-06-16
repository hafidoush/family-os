/**
 * FAMILY OS — WidgetMenage
 * Dashboard card : tâches ménagères du jour + prochaine périodique + pièces à entretenir.
 */

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../core/db/database';
import { TacheService } from '../../maison/services/TacheService';
import { etatColor, etatLabel } from '../../maison/services/MaisonService';
import './WidgetMenage.css';

function useMenuTaches() {
  return useLiveQuery(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const all = await db.taches
      .filter(t =>
        !t.archive && !t.deletedAt &&
        t.moduleOrigine === 'maison' &&
        (t.frequence === 'quotidienne' || t.frequence === 'hebdomadaire')
      )
      .toArray();

    // Pour les quotidiennes, toujours afficher
    const quotidiennes = all.filter(t => t.frequence === 'quotidienne');

    // Trier par statut
    quotidiennes.sort((a, b) => {
      const af = a.statut === 'fait' ? 1 : 0;
      const bf = b.statut === 'fait' ? 1 : 0;
      return af - bf;
    });

    return quotidiennes;
  }, []);
}

function usePiecesAlerte() {
  return useLiveQuery(async () => {
    const pieces = await db.pieces
      .filter(p => p.actif && !p.deletedAt && (p.scoreProprety ?? 100) < 55)
      .toArray();
    pieces.sort((a, b) => (a.scoreProprety ?? 0) - (b.scoreProprety ?? 0));
    return pieces.slice(0, 3);
  }, []);
}

function useProchainePeriodique() {
  return useLiveQuery(async () => {
    const periodiques = await db.taches
      .filter(t =>
        !t.archive && !t.deletedAt &&
        t.moduleOrigine === 'maison' &&
        t.statut !== 'fait' &&
        (t.frequence === 'mensuelle' || t.frequence === 'trimestrielle' ||
         t.frequence === 'semestrielle' || t.frequence === 'bihebdomadaire' ||
         t.frequence === 'annuelle')
      )
      .toArray();

    // Trier par échéance
    periodiques.sort((a, b) => {
      if (a.dateEcheance && b.dateEcheance) {
        return new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime();
      }
      if (a.dateEcheance) return -1;
      if (b.dateEcheance) return 1;
      return 0;
    });

    return periodiques[0] ?? null;
  }, []);
}

export function WidgetMenage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const taches = useMenuTaches();
  const prochainePeriodique = useProchainePeriodique();
  const piecesAlerte = usePiecesAlerte();

  if (taches === undefined) {
    return (
      <div className="widget-card">
        <div className="widget-header"><span className="widget-title">Ménage</span></div>
        <div className="widget-skeleton" />
      </div>
    );
  }

  const faites = taches.filter(t => t.statut === 'fait').length;
  const total = taches.length;
  const allDone = total > 0 && faites === total;

  const toggleTache = async (id: string, done: boolean) => {
    if (done) await TacheService.rouvrir(id);
    else await TacheService.completerTache(id);
  };

  return (
    <div className="widget-card widget-menage">
      <div
        className="widget-header"
        onClick={() => total > 0 && setExpanded(e => !e)}
        style={{ cursor: total > 0 ? 'pointer' : 'default' }}
      >
        <span className="widget-title">🧹 Ménage</span>
        {total > 0 && (
          <span className={`wm-score${allDone ? ' wm-score--done' : ''}`}>
            {faites}/{total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="widget-empty">
          <span>✨</span>
          <span>Pas de tâches aujourd'hui</span>
        </div>
      ) : (
        <>
          {/* Barre de progression */}
          <div className="wm-progress-bar">
            <div
              className="wm-progress-fill"
              style={{
                width: `${total > 0 ? (faites / total) * 100 : 0}%`,
                background: allDone ? '#34D399' : '#A78BFA',
              }}
            />
          </div>

          {/* Résumé ou liste dépliée */}
          {!expanded ? (
            <div className="wm-summary">
              <span className="wm-summary__label">
                {allDone ? '✓ Tout est fait !' : `${total - faites} tâche${total - faites > 1 ? 's' : ''} restante${total - faites > 1 ? 's' : ''}`}
              </span>
              {prochainePeriodique && (
                <span className="wm-summary__next">
                  À venir : {prochainePeriodique.titre}
                </span>
              )}
            </div>
          ) : (
            <ul className="wm-list">
              {taches.map(t => (
                <li key={t.id} className={`wm-item${t.statut === 'fait' ? ' wm-item--done' : ''}`}>
                  <button
                    className={`wm-check${t.statut === 'fait' ? ' done' : ''}`}
                    onClick={() => toggleTache(t.id, t.statut === 'fait')}
                  >
                    {t.statut === 'fait' ? '✓' : ''}
                  </button>
                  <span className="wm-titre">{t.titre}</span>
                </li>
              ))}
            </ul>
          )}

          {total > 0 && (
            <button className="wm-toggle" onClick={() => setExpanded(e => !e)}>
              {expanded ? 'Réduire ▲' : 'Voir les tâches ▼'}
            </button>
          )}
        </>
      )}
      {/* Pièces à entretenir */}
      {piecesAlerte && piecesAlerte.length > 0 && (
        <div className="wm-pieces-alerte">
          <span className="wm-pieces-alerte__titre">Pièces à entretenir</span>
          <ul className="wm-pieces-list">
            {piecesAlerte.map(p => (
              <li
                key={p.id}
                className="wm-piece-item"
                onClick={() => navigate('/maison-deco')}
              >
                <span
                  className="wm-piece-dot"
                  style={{ background: etatColor(p.etatGeneral) }}
                />
                <span className="wm-piece-nom">{p.icone ? `${p.icone} ` : ''}{p.nom}</span>
                <span className="wm-piece-etat" style={{ color: etatColor(p.etatGeneral) }}>
                  {etatLabel(p.etatGeneral)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
