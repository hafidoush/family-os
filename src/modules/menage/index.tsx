/**
 * FAMILY OS — Module Ménage v2
 * Séparation quotidiennes / périodiques avec cartes visuelles.
 */

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/database';
import { newEntity } from '../../core/db/helpers';
import { TacheService } from '../maison/services/TacheService';
import { MaisonService, etatColor, etatLabel, scoreToEtat } from '../maison/services/MaisonService';
import { useMaisonStore } from '../maison/stores/maisonStore';
import { TacheForm } from '../maison/components/taches';
import { usePieces } from '../maison/hooks';
import type { Tache, FrequenceTache } from '@shared/types/entities';
import type { Piece } from '@shared/types/modules';
import './menage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type OngletMenage = 'quotidien' | 'periodique' | 'grand_menage';

interface FreqConfig {
  value: FrequenceTache;
  label: string;
  emoji: string;
  description: string;
  color: string;
}

const FREQUENCES_PERIODIQUES: FreqConfig[] = [
  { value: 'hebdomadaire',   label: 'Hebdomadaire',     emoji: '📅', description: 'Chaque semaine',          color: '#60A5FA' },
  { value: 'bihebdomadaire', label: 'Toutes les 2 sem', emoji: '🗓', description: 'Toutes les 2 semaines',   color: '#818CF8' },
  { value: 'mensuelle',      label: 'Mensuel',           emoji: '🌙', description: 'Chaque mois',            color: '#A78BFA' },
  { value: 'trimestrielle',  label: 'Trimestriel',       emoji: '🍂', description: 'Tous les 3 mois',        color: '#FB923C' },
  { value: 'semestrielle',   label: 'Semestriel',        emoji: '☀️', description: 'Tous les 6 mois',       color: '#FBBF24' },
  { value: 'annuelle',       label: 'Annuel',            emoji: '🎆', description: 'Une fois par an',        color: '#F472B6' },
];

const SUGGESTIONS_QUOTIDIENNES = [
  { titre: 'Faire les lits', emoji: '🛏' },
  { titre: 'Ranger la cuisine', emoji: '🍽' },
  { titre: 'Lancer une machine', emoji: '🫧' },
  { titre: 'Sortir les poubelles', emoji: '🗑' },
  { titre: 'Passer l\'aspirateur', emoji: '🌀' },
  { titre: 'Nettoyer les surfaces', emoji: '🧽' },
];

const SUGGESTIONS_PERIODIQUES: Record<string, { titre: string; emoji: string }[]> = {
  hebdomadaire:   [{ titre: 'Changer les draps', emoji: '🛏' }, { titre: 'Nettoyer la salle de bain', emoji: '🚿' }],
  bihebdomadaire: [{ titre: 'Passer la serpillière', emoji: '🧹' }, { titre: 'Nettoyer les vitres', emoji: '🪟' }],
  mensuelle:      [{ titre: 'Nettoyer le four', emoji: '🔥' }, { titre: 'Détartrer la cafetière', emoji: '☕' }],
  trimestrielle:  [{ titre: 'Trier les vêtements', emoji: '👗' }, { titre: 'Nettoyer le frigo', emoji: '🧊' }],
  semestrielle:   [{ titre: 'Laver les rideaux', emoji: '🪟' }, { titre: 'Vérifier détecteurs fumée', emoji: '🔔' }],
  annuelle:       [{ titre: 'Grand nettoyage de printemps', emoji: '🌸' }, { titre: 'Révision chaudière', emoji: '🔧' }],
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useTachesParFrequence(frequence: FrequenceTache) {
  return useLiveQuery(async () => {
    const all = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison' && t.frequence === frequence)
      .toArray();
    all.sort((a, b) => {
      const af = a.statut === 'fait' ? 1 : 0;
      const bf = b.statut === 'fait' ? 1 : 0;
      if (af !== bf) return af - bf;
      if (a.dateEcheance && b.dateEcheance) return new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime();
      return 0;
    });
    return all;
  }, [frequence]);
}

// ─── Carte Tâche ─────────────────────────────────────────────────────────────

interface TacheCardProps {
  tache: Tache;
  color?: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TacheCard({ tache, color = '#A78BFA', onToggle, onEdit, onDelete }: TacheCardProps) {
  const done = tache.statut === 'fait';
  const derniereFois = tache.completeeLe ?? (tache.statut === 'fait' ? tache.updatedAt : undefined);
  const joursDepuis = derniereFois
    ? Math.floor((Date.now() - new Date(derniereFois).getTime()) / 86400000)
    : null;
  const [confirmDel, setConfirmDel] = useState(false);

  const echeanceBadge = () => {
    if (!tache.dateEcheance) return null;
    const d = new Date(tache.dateEcheance);
    const diff = Math.round((d.getTime() - Date.now()) / 86400000);
    if (diff < 0) return { label: 'En retard', urgent: true };
    if (diff === 0) return { label: "Aujourd'hui", urgent: true };
    if (diff <= 7) return { label: `Dans ${diff}j`, urgent: false };
    return { label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), urgent: false };
  };

  const ech = echeanceBadge();

  return (
    <div
      className={`mc-card${done ? ' mc-card--done' : ''}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onToggle()}
    >
      <div className="mc-card__accent" style={{ background: done ? '#34D399' : color }} />

      {/* Indicateur visuel de statut (non interactif, le clic est sur la carte entière) */}
      <div className={`mc-card__check${done ? ' done' : ''}`}
        style={done ? {} : { borderColor: color + 'AA' }}
        aria-hidden="true"
      >
        {done && '✓'}
      </div>

      <div className="mc-card__body">
        <span className={`mc-card__titre${done ? ' done' : ''}`}>{tache.titre}</span>
        <div className="mc-card__meta">
          {tache.priorite === 'urgente' && <span className="mc-card__badge mc-card__badge--urgent">🔴 Urgent</span>}
          {tache.priorite === 'haute' && <span className="mc-card__badge mc-card__badge--high">🟡 Priorité</span>}
          {ech && (
            <span className={`mc-card__badge${ech.urgent ? ' mc-card__badge--urgent' : ''}`}>
              📅 {ech.label}
            </span>
          )}
          {joursDepuis !== null && joursDepuis > 0 && (
            <span className="mc-card__badge mc-card__badge--history">
              🕐 il y a {joursDepuis}j
            </span>
          )}
          {joursDepuis === 0 && <span className="mc-card__badge mc-card__badge--today">✓ Fait aujourd'hui</span>}
        </div>
      </div>

      <div className="mc-card__actions" onClick={e => e.stopPropagation()}>
        <button className="mc-card__act" onClick={onEdit}>✏️</button>
        <button className={`mc-card__act${confirmDel ? ' confirming' : ''}`}
          onClick={() => { if (!confirmDel) { setConfirmDel(true); return; } onDelete(); setConfirmDel(false); }}
          onBlur={() => setConfirmDel(false)}
        >
          {confirmDel ? '⚠️' : '🗑'}
        </button>
      </div>
    </div>
  );
}

// ─── Section Quotidiennes ─────────────────────────────────────────────────────

function SectionQuotidiennes() {
  const taches = useTachesParFrequence('quotidienne') ?? [];
  const store = useMaisonStore();
  const [showSugg, setShowSugg] = useState(false);

  const faites = taches.filter(t => t.statut === 'fait').length;
  const total = taches.length;
  const allDone = total > 0 && faites === total;
  const progPct = total > 0 ? (faites / total) * 100 : 0;

  const addSugg = async (titre: string) => {
    await db.taches.add(newEntity<Tache>({
      titre, statut: 'a_faire', moduleOrigine: 'maison',
      frequence: 'quotidienne', recurrence: true, archive: false,
    }));
    setShowSugg(false);
  };

  return (
    <div className="mc-section">
      <div className="mc-section__header">
        <div className="mc-section__title-row">
          <span className="mc-section__icon">☀️</span>
          <div>
            <h3 className="mc-section__title">Tâches quotidiennes</h3>
            <p className="mc-section__sub">À faire chaque jour, automatiquement récurrentes</p>
          </div>
        </div>
        {total > 0 && (
          <div className="mc-section__score-col">
            <span className={`mc-section__score${allDone ? ' done' : ''}`}>{faites}/{total}</span>
            <div className="mc-prog-bar">
              <div className="mc-prog-fill" style={{ width: `${progPct}%`, background: allDone ? '#34D399' : '#A78BFA' }} />
            </div>
          </div>
        )}
      </div>

      {taches.length === 0 ? (
        <div className="mc-empty">
          <span>✨</span><p>Ajoutez vos tâches du quotidien</p>
        </div>
      ) : (
        <div className="mc-cards">
          {taches.map(t => (
            <TacheCard key={t.id} tache={t} color="#A78BFA"
              onToggle={() => t.statut === 'fait' ? TacheService.rouvrir(t.id) : TacheService.completerTache(t.id)}
              onEdit={() => store.openDrawerTache({ editId: t.id })}
              onDelete={() => TacheService.deleteTache(t.id)}
            />
          ))}
        </div>
      )}

      {showSugg && (
        <div className="mc-suggestions">
          {SUGGESTIONS_QUOTIDIENNES.map(s => (
            <button key={s.titre} className="mc-sugg-btn" onClick={() => addSugg(s.titre)}>
              {s.emoji} {s.titre}
            </button>
          ))}
        </div>
      )}

      <div className="mc-actions">
        <button className="mc-btn mc-btn--primary" onClick={() => store.openDrawerTache({ frequence: 'quotidienne' })}>+ Ajouter</button>
        <button className="mc-btn mc-btn--ghost" onClick={() => setShowSugg(s => !s)}>💡 Suggestions</button>
      </div>
    </div>
  );
}

// ─── Section Périodique ───────────────────────────────────────────────────────

function SectionPeriodique({ cfg }: { cfg: FreqConfig }) {
  const taches = useTachesParFrequence(cfg.value) ?? [];
  const store = useMaisonStore();
  const [open, setOpen] = useState(true);
  const [showSugg, setShowSugg] = useState(false);

  const faites = taches.filter(t => t.statut === 'fait').length;
  const total = taches.length;

  const addSugg = async (titre: string) => {
    await db.taches.add(newEntity<Tache>({
      titre, statut: 'a_faire', moduleOrigine: 'maison',
      frequence: cfg.value, recurrence: true, archive: false,
    }));
    setShowSugg(false);
  };

  return (
    <div className="mc-periodik">
      <button className="mc-periodik__header" onClick={() => setOpen(o => !o)}>
        <span className="mc-periodik__icon" style={{ background: cfg.color + '20', color: cfg.color }}>{cfg.emoji}</span>
        <div className="mc-periodik__titles">
          <span className="mc-periodik__label">{cfg.label}</span>
          <span className="mc-periodik__desc">{cfg.description}</span>
        </div>
        <div className="mc-periodik__right">
          {total > 0 && (
            <span className="mc-periodik__badge" style={{ background: cfg.color + '18', color: cfg.color }}>
              {faites}/{total}
            </span>
          )}
          <span className="mc-periodik__chevron">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="mc-periodik__body">
          {taches.length === 0 ? (
            <p className="mc-periodik__empty">Aucune tâche. Ajoutez-en ci-dessous.</p>
          ) : (
            <div className="mc-cards">
              {taches.map(t => (
                <TacheCard key={t.id} tache={t} color={cfg.color}
                  onToggle={() => t.statut === 'fait' ? TacheService.rouvrir(t.id) : TacheService.completerTache(t.id)}
                  onEdit={() => store.openDrawerTache({ editId: t.id })}
                  onDelete={() => TacheService.deleteTache(t.id)}
                />
              ))}
            </div>
          )}

          {showSugg && SUGGESTIONS_PERIODIQUES[cfg.value] && (
            <div className="mc-suggestions">
              {SUGGESTIONS_PERIODIQUES[cfg.value].map(s => (
                <button key={s.titre} className="mc-sugg-btn" onClick={() => addSugg(s.titre)}>
                  {s.emoji} {s.titre}
                </button>
              ))}
            </div>
          )}

          <div className="mc-actions" style={{ marginTop: 8 }}>
            <button className="mc-btn mc-btn--primary"
              style={{ background: cfg.color + '20', color: cfg.color, borderColor: cfg.color + '44' }}
              onClick={() => store.openDrawerTache({ frequence: cfg.value })}
            >+ Ajouter</button>
            {SUGGESTIONS_PERIODIQUES[cfg.value] && (
              <button className="mc-btn mc-btn--ghost" onClick={() => setShowSugg(s => !s)}>💡</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Grand Ménage : carte pièce ──────────────────────────────────────────────

function GrandMenagePieceCard({ piece, onClick }: { piece: Piece; onClick: () => void }) {
  const etat = piece.etatGeneral ?? scoreToEtat(piece.scoreProprety);
  const couleur = etatColor(etat);
  return (
    <button
      className={`piece-card piece-card--${etat}`}
      onClick={onClick}
      style={{ '--couleur-etat': couleur } as React.CSSProperties}
    >
      <div className="piece-card__header">
        <span className="piece-card__icone">{piece.icone ?? '🏠'}</span>
        <span className="piece-card__nom">{piece.nom}</span>
      </div>
      <div className="piece-card__jauge-wrapper">
        <div className="piece-card__jauge" style={{ width: `${piece.scoreProprety}%`, background: couleur }} />
      </div>
      <div className="piece-card__footer">
        <span className="piece-card__score">{piece.scoreProprety}%</span>
        <span className="piece-card__etat">{etatLabel(etat)}</span>
      </div>
    </button>
  );
}

// ─── Grand Ménage : détail pièce avec tâches ─────────────────────────────────

function GrandMenagePieceDetail({ piece, onBack }: { piece: Piece; onBack: () => void }) {
  const store = useMaisonStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const etat = piece.etatGeneral ?? scoreToEtat(piece.scoreProprety);
  const couleur = etatColor(etat);

  const taches = useLiveQuery(async () => {
    const all = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison' && t.pieceAssociee === piece.id)
      .toArray();
    all.sort((a, b) => {
      const af = a.statut === 'fait' ? 1 : 0;
      const bf = b.statut === 'fait' ? 1 : 0;
      return af - bf;
    });
    return all;
  }, [piece.id]) ?? [];

  const faites = taches.filter(t => t.statut === 'fait').length;
  const total = taches.length;
  const progPct = total > 0 ? (faites / total) * 100 : piece.scoreProprety;

  return (
    <div className="mc-section">
      <button className="piece-detail__back" onClick={onBack} style={{ marginBottom: 12 }}>
        ← Toutes les pièces
      </button>

      <div className="piece-detail__header" style={{ '--couleur-etat': couleur } as React.CSSProperties}>
        <span className="piece-detail__icone">{piece.icone ?? '🏠'}</span>
        <div className="piece-detail__titre">
          <h2 className="piece-detail__nom">{piece.nom}</h2>
          <span className="piece-detail__etat-label">{etatLabel(etat)}</span>
        </div>
      </div>

      <div className="mc-section__header" style={{ marginTop: 12 }}>
        <div className="mc-section__title-row">
          <div>
            <h3 className="mc-section__title">Tâches de la pièce</h3>
            <p className="mc-section__sub">{total > 0 ? `${faites}/${total} effectuées` : 'Aucune tâche'}</p>
          </div>
        </div>
        {total > 0 && (
          <div className="mc-section__score-col">
            <span className={`mc-section__score${faites === total && total > 0 ? ' done' : ''}`}>{Math.round(progPct)}%</span>
            <div className="mc-prog-bar">
              <div className="mc-prog-fill" style={{ width: `${progPct}%`, background: faites === total && total > 0 ? '#34D399' : couleur }} />
            </div>
          </div>
        )}
      </div>

      {taches.length === 0 ? (
        <div className="mc-empty">
          <span>✨</span><p>Aucune tâche pour cette pièce</p>
        </div>
      ) : (
        <div className="mc-cards">
          {taches.map(t => (
            <TacheCard key={t.id} tache={t} color={couleur}
              onToggle={() => t.statut === 'fait' ? TacheService.rouvrir(t.id) : TacheService.completerTache(t.id)}
              onEdit={() => store.openDrawerTache({ editId: t.id })}
              onDelete={() => TacheService.deleteTache(t.id)}
            />
          ))}
        </div>
      )}

      <div className="mc-actions" style={{ marginTop: 12 }}>
        <button className="mc-btn mc-btn--primary"
          onClick={() => store.openDrawerTache({ pieceId: piece.id })}>
          + Ajouter une tâche
        </button>
        {etat !== 'tres_propre' && (
          <button className="mc-btn mc-btn--ghost"
            onClick={() => MaisonService.marquerEntretenue(piece.id)}>
            ✨ Tout propre
          </button>
        )}
      </div>

      {/* Reset pièce */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        {confirmReset ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Décocher toutes les tâches de cette pièce ?</span>
            <button className="gm-btn gm-btn--danger"
              onClick={async () => { await MaisonService.resetPiece(piece.id); setConfirmReset(false); }}>
              Confirmer
            </button>
            <button className="gm-btn gm-btn--ghost" onClick={() => setConfirmReset(false)}>Annuler</button>
          </div>
        ) : (
          <button className="gm-btn gm-btn--ghost" onClick={() => setConfirmReset(true)}>
            🔄 Réinitialiser cette pièce
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Grand Ménage : vue principale ───────────────────────────────────────────

function SectionGrandMenage() {
  const pieces = usePieces() ?? [];
  const store = useMaisonStore();
  const [pieceSelectId, setPieceSelectId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const dernierLancement = useLiveQuery(async () => {
    const p = await db.parametresSync.where('cle').equals('grandMenage.dernierLancement').first();
    return p?.valeur ?? null;
  });

  const pieceSelect = pieces.find(p => p.id === pieceSelectId) ?? null;

  if (pieceSelect) {
    return (
      <GrandMenagePieceDetail
        piece={pieceSelect}
        onBack={() => setPieceSelectId(null)}
      />
    );
  }

  const scoreMoyen = pieces.length > 0
    ? Math.round(pieces.reduce((s, p) => s + p.scoreProprety, 0) / pieces.length)
    : 0;

  const labelDernierLancement = (() => {
    if (!dernierLancement) return 'Jamais lancé';
    const jours = Math.floor((Date.now() - new Date(dernierLancement).getTime()) / 86400000);
    if (jours === 0) return "Lancé aujourd'hui";
    if (jours === 1) return 'Lancé hier';
    if (jours < 7) return `Il y a ${jours} jours`;
    const semaines = Math.floor(jours / 7);
    if (semaines < 5) return `Il y a ${semaines} semaine${semaines > 1 ? 's' : ''}`;
    return `Il y a ${Math.floor(jours / 30)} mois`;
  })();

  const handleLancer = async () => {
    setLoading(true);
    await MaisonService.lancerGrandMenage();
    setLoading(false);
    setConfirm(false);
  };

  return (
    <div className="mc-section">

      {/* Bannière de lancement */}
      <div className="gm-banner">
        <div className="gm-banner__info">
          <span className="gm-banner__title">Grand ménage</span>
          <span className="gm-banner__sub">{labelDernierLancement} · Score moyen {scoreMoyen}%</span>
        </div>

        {confirm ? (
          <div className="gm-banner__confirm">
            <span className="gm-banner__confirm-label">Tout décocher et remettre à zéro ?</span>
            <div className="gm-banner__confirm-btns">
              <button className="gm-btn gm-btn--danger" onClick={handleLancer} disabled={loading}>
                {loading ? '…' : 'Confirmer'}
              </button>
              <button className="gm-btn gm-btn--ghost" onClick={() => setConfirm(false)}>Annuler</button>
            </div>
          </div>
        ) : (
          <button className="gm-btn gm-btn--launch" onClick={() => setConfirm(true)}>
            🚀 Lancer
          </button>
        )}
      </div>

      {/* Grille des pièces */}
      {pieces.length === 0 ? (
        <div className="mc-empty"><span>🏠</span><p>Aucune pièce configurée</p></div>
      ) : (
        <div className="pieces-grid" style={{ padding: '0 0 12px' }}>
          {pieces.map(p => (
            <GrandMenagePieceCard key={p.id} piece={p} onClick={() => setPieceSelectId(p.id)} />
          ))}
        </div>
      )}

      <TacheForm
        isOpen={store.drawerTacheOpen}
        onClose={store.closeDrawerTache}
        editId={store.drawerTacheEditId}
        piecePrefill={store.drawerTachePiecePrefill}
      />
    </div>
  );
}

// ─── Module principal ─────────────────────────────────────────────────────────

export default function MenageModule() {
  const [onglet, setOnglet] = useState<OngletMenage>('quotidien');
  const store = useMaisonStore();
  const pieces = usePieces();

  return (
    <div className="mc-module">
      <nav className="mc-tabs">
        <button className={`mc-tab${onglet === 'quotidien' ? ' active' : ''}`} onClick={() => setOnglet('quotidien')}>
          ☀️ Quotidien
        </button>
        <button className={`mc-tab${onglet === 'periodique' ? ' active' : ''}`} onClick={() => setOnglet('periodique')}>
          📆 Périodique
        </button>
        <button className={`mc-tab${onglet === 'grand_menage' ? ' active' : ''}`} onClick={() => setOnglet('grand_menage')}>
          🏠 Pièces
        </button>
      </nav>

      <div className="mc-content">
        {onglet === 'quotidien' && <SectionQuotidiennes />}
        {onglet === 'periodique' && (
          <div className="mc-periodiques">
            {FREQUENCES_PERIODIQUES.map(cfg => <SectionPeriodique key={cfg.value} cfg={cfg} />)}
          </div>
        )}
        {onglet === 'grand_menage' && <SectionGrandMenage />}
      </div>

      {onglet !== 'grand_menage' && (
        <TacheForm
          isOpen={store.drawerTacheOpen}
          onClose={store.closeDrawerTache}
          editId={store.drawerTacheEditId}
          piecePrefill={store.drawerTachePiecePrefill}
          frequencePrefill={store.drawerTacheFrequencePrefill as import('@shared/types/entities').FrequenceTache | null}
        />
      )}
    </div>
  );
}
