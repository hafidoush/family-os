/**
 * FAMILY OS — Module Ménage v2
 * Séparation quotidiennes / périodiques avec cartes visuelles.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/database';
import { newEntity } from '../../core/db/helpers';
import { TacheService } from '../maison/services/TacheService';
import { MaisonService, etatColor, etatLabel, scoreToEtat } from '../maison/services/MaisonService';
import { useMaisonStore } from '../maison/stores/maisonStore';
import { TacheForm } from '../maison/components/taches';
import { usePieces } from '../maison/hooks';
import { useRappelMenageNatif } from './hooks/useRappelMenageNatif';
import { useTachesDuJourEngine } from './hooks/useTachesDuJourEngine';
import {
  enrichTask,
  computeSkipPatch,
  type MenageMode,
  type MenageTask,
} from './engine/menageEngine';
import type { Tache, FrequenceTache } from '@shared/types/entities';
import type { Piece } from '@shared/types/modules';
import './menage.css';
import '../maison/MaisonModule.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type OngletMenage = 'du_jour' | 'mes_taches' | 'grand_menage';

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
  { value: 'mensuelle',      label: 'Mensuel',           emoji: '🌙', description: 'Chaque mois',            color: '#C69CE2' },
  { value: 'trimestrielle',  label: 'Trimestriel',       emoji: '🍂', description: 'Tous les 3 mois',        color: '#FB923C' },
  { value: 'semestrielle',   label: 'Semestriel',        emoji: '☀️', description: 'Tous les 6 mois',       color: '#FBBF24' },
  { value: 'annuelle',       label: 'Annuel',            emoji: '🎆', description: 'Une fois par an',        color: '#F472B6' },
];

const SUGGESTIONS_QUOTIDIENNES = [
  { titre: 'Faire les lits', emoji: '🛏' },
  { titre: 'Aérer les pièces 10 min', emoji: '💨' },
  { titre: 'Ranger la cuisine après le petit-déj', emoji: '🍽' },
  { titre: 'Essuyer le plan de travail', emoji: '🧽' },
  { titre: 'Lancer une machine', emoji: '🫧' },
  { titre: 'Vider le lave-vaisselle', emoji: '🥣' },
  { titre: 'Passer l\'aspirateur', emoji: '🌀' },
  { titre: 'Sortir les poubelles', emoji: '🗑' },
  { titre: 'Ranger les affaires traînantes', emoji: '📦' },
  { titre: 'Nettoyer les plaques de cuisson', emoji: '🔥' },
  { titre: 'Plier et ranger le linge', emoji: '👕' },
  { titre: 'Tour rapide des pièces communes', emoji: '🏠' },
  { titre: 'Vider le filtre de la machine à café', emoji: '☕' },
  { titre: 'Nettoyer les poignées de portes', emoji: '🚪' },
  { titre: 'Fermer les volets le soir', emoji: '🌙' },
];

const SUGGESTIONS_PERIODIQUES: Record<string, { titre: string; emoji: string }[]> = {
  hebdomadaire: [
    { titre: 'Changer les draps', emoji: '🛏' },
    { titre: 'Nettoyer la salle de bain complète', emoji: '🚿' },
    { titre: 'Passer la serpillière cuisine et salon', emoji: '🧹' },
    { titre: 'Nettoyer les lavabos', emoji: '🪥' },
    { titre: 'Laver les torchons et éponges', emoji: '🧽' },
    { titre: 'Aspirer les canapés et fauteuils', emoji: '🛋' },
    { titre: 'Nettoyer la plaque de cuisson en profondeur', emoji: '🍳' },
    { titre: 'Laver le sol salle de bain', emoji: '💧' },
    { titre: 'Vider et laver les poubelles', emoji: '🗑' },
    { titre: 'Nettoyer les interrupteurs', emoji: '💡' },
    { titre: 'Passer l\'aspirateur dans toutes les pièces', emoji: '🌀' },
    { titre: 'Changer les serviettes de bain', emoji: '🏊' },
  ],
  bihebdomadaire: [
    { titre: 'Nettoyer les miroirs', emoji: '🪞' },
    { titre: 'Désinfecter les toilettes (extérieur compris)', emoji: '🚽' },
    { titre: 'Nettoyer les vitres intérieures', emoji: '🪟' },
    { titre: 'Décrasser le joint de baignoire / douche', emoji: '🚿' },
    { titre: 'Laver les tapis de bain', emoji: '🧼' },
    { titre: 'Nettoyer le dessus du réfrigérateur', emoji: '🧊' },
    { titre: 'Dépoussiérer les meubles TV et étagères', emoji: '📺' },
    { titre: 'Nettoyer la hotte (surface extérieure)', emoji: '💨' },
  ],
  mensuelle: [
    { titre: 'Nettoyer le four', emoji: '🔥' },
    { titre: 'Détartrer la cafetière', emoji: '☕' },
    { titre: 'Nettoyer les filtres de la hotte', emoji: '💨' },
    { titre: 'Nettoyer le tiroir à lessive', emoji: '🫧' },
    { titre: 'Nettoyer le frigo (intérieur)', emoji: '🧊' },
    { titre: 'Désinfecter les joints du frigo', emoji: '🫙' },
    { titre: 'Dépoussiérer les plinthes', emoji: '🧹' },
    { titre: 'Nettoyer l\'intérieur du micro-ondes', emoji: '📡' },
    { titre: 'Laver les housses de coussins', emoji: '🛋' },
    { titre: 'Nettoyer les prises et interrupteurs', emoji: '🔌' },
    { titre: 'Dépoussiérer les stores et jalousies', emoji: '🪟' },
    { titre: 'Nettoyer la bonde de douche et siphon', emoji: '🌊' },
    { titre: 'Détartrer le pommeau de douche', emoji: '🚿' },
    { titre: 'Nettoyer le filtre du lave-vaisselle', emoji: '🥣' },
  ],
  trimestrielle: [
    { titre: 'Laver les couettes et oreillers', emoji: '🛏' },
    { titre: 'Aspirer et retourner les matelas', emoji: '💤' },
    { titre: 'Nettoyer le dessous du lit', emoji: '🧹' },
    { titre: 'Trier les vêtements (donner / jeter)', emoji: '👗' },
    { titre: 'Dégraisser les placards de cuisine', emoji: '🍳' },
    { titre: 'Nettoyer les rails de portes coulissantes', emoji: '🚪' },
    { titre: 'Nettoyer les conduits de ventilation', emoji: '💨' },
    { titre: 'Laver les rideaux de douche', emoji: '🚿' },
    { titre: 'Vider et nettoyer les tiroirs de cuisine', emoji: '🥄' },
    { titre: 'Nettoyer les radiateurs (entre les lamelles)', emoji: '🌡' },
    { titre: 'Laver les vitres extérieures', emoji: '🪟' },
    { titre: 'Désinfecter les télécommandes et téléphones', emoji: '📱' },
  ],
  semestrielle: [
    { titre: 'Retourner le matelas', emoji: '💤' },
    { titre: 'Laver les rideaux', emoji: '🪟' },
    { titre: 'Vérifier les détecteurs de fumée et CO', emoji: '🔔' },
    { titre: 'Purger les radiateurs', emoji: '🌡' },
    { titre: 'Nettoyer les caissons de volets roulants', emoji: '🏠' },
    { titre: 'Nettoyer la ventilation de la sèche-linge', emoji: '🌬' },
    { titre: 'Vérifier les joints de fenêtres', emoji: '🪟' },
    { titre: 'Dépoussiérer livres et étagères en profondeur', emoji: '📚' },
    { titre: 'Nettoyer le fond des armoires', emoji: '🚪' },
    { titre: 'Vider et trier la pharmacie', emoji: '💊' },
    { titre: 'Laver les coussins extérieurs', emoji: '🌿' },
    { titre: 'Nettoyer les gouttières', emoji: '🌧' },
  ],
  annuelle: [
    { titre: 'Grand nettoyage de printemps', emoji: '🌸' },
    { titre: 'Révision chaudière (obligatoire)', emoji: '🔧' },
    { titre: 'Désencombrement général (une pièce à la fois)', emoji: '📦' },
    { titre: 'Trier et archiver les documents', emoji: '📁' },
    { titre: 'Nettoyer derrière les gros électroménagers', emoji: '🧺' },
    { titre: 'Nettoyer la hotte en profondeur (démonter les grilles)', emoji: '💨' },
    { titre: 'Nettoyer les canalisations (produit enzymatique)', emoji: '🌊' },
    { titre: 'Vérifier l\'état des joints de baignoire', emoji: '🛁' },
    { titre: 'Tester les extincteurs', emoji: '🧯' },
    { titre: 'Traitement anti-moisissures préventif', emoji: '🍄' },
    { titre: 'Nettoyer les volets (lames)', emoji: '🏠' },
    { titre: 'Inventaire et rotation du stock cuisine', emoji: '🥫' },
    { titre: 'Nettoyer derrière et sous les meubles', emoji: '🧹' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isCompletedToday(tache: Tache): boolean {
  if (tache.statut !== 'fait' || !tache.completeeLe) return false;
  const t = startOfToday();
  const c = new Date(tache.completeeLe);
  c.setHours(0, 0, 0, 0);
  return c.getTime() === t.getTime();
}

// ─── Tâches saisonnières ──────────────────────────────────────────────────────

interface DefSaisonniere {
  titre: string;
  emoji: string;
  mois: number[]; // 1 = janvier … 12 = décembre
  description?: string;
}

// Identifiant stable pour retrouver une tâche saisonnière en DB
function cléSaisonniere(titre: string, annee: number) {
  return `saisonniere::${annee}::${titre.trim().toLowerCase()}`;
}

const TACHES_SAISONNIERES: DefSaisonniere[] = [
  { titre: 'Grand nettoyage de printemps', emoji: '🌸', mois: [3, 4], description: 'Désencombrement, fond des placards, derrière les meubles' },
  { titre: 'Laver les rideaux et voilages', emoji: '🪟', mois: [4], description: 'Avant l\'été, profiter de la lumière' },
  { titre: 'Rentrer le mobilier extérieur', emoji: '🪑', mois: [10], description: 'Avant les premières gelées' },
  { titre: 'Laver les couettes d\'hiver', emoji: '🛏', mois: [5], description: 'Ranger propres pour l\'été' },
  { titre: 'Sortir les couettes d\'hiver', emoji: '🛏', mois: [9], description: 'Avant les nuits fraîches' },
  { titre: 'Traitement anti-moisissures préventif', emoji: '🍄', mois: [10], description: 'Pièces humides avant l\'hiver' },
  { titre: 'Vérifier les joints de fenêtres avant l\'hiver', emoji: '🪟', mois: [9, 10], description: 'Isolation thermique' },
  { titre: 'Nettoyer les gouttières', emoji: '🌧', mois: [11], description: 'Après la chute des feuilles' },
  { titre: 'Purger les radiateurs', emoji: '🌡', mois: [10], description: 'Avant de rallumer le chauffage' },
  { titre: 'Révision de la chaudière', emoji: '🔧', mois: [9, 10], description: 'Contrat annuel obligatoire' },
  { titre: 'Laver le mobilier extérieur', emoji: '🌿', mois: [4], description: 'Préparer la terrasse pour l\'été' },
  { titre: 'Trier les vêtements hiver → été', emoji: '👗', mois: [4, 5], description: 'Rangement saisonnier' },
  { titre: 'Trier les vêtements été → hiver', emoji: '🧥', mois: [9, 10], description: 'Rangement saisonnier' },
  { titre: 'Tester les détecteurs de fumée', emoji: '🔔', mois: [3], description: 'Test annuel recommandé' },
  { titre: 'Vider et nettoyer les placards de cuisine', emoji: '🍳', mois: [1], description: 'Bonne résolution de janvier' },
  { titre: 'Inventaire et rotation du stock cuisine', emoji: '🥫', mois: [1, 7], description: 'Vérifier les dates de péremption' },
];

export interface TacheSaisonniereLive {
  def: DefSaisonniere;
  tache: Tache | null;      // null = pas encore en DB
  faiteAnnee: boolean;      // cochée cette année
}

// ─── Hooks moteur ─────────────────────────────────────────────────────────────

function useSaisonnieres() {
  return useLiveQuery(async () => {
    const all = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison')
      .toArray();
    const moisActuel   = new Date().getMonth() + 1;
    const anneeActuelle = new Date().getFullYear();
    return TACHES_SAISONNIERES
      .filter(def => def.mois.includes(moisActuel))
      .map(def => {
        const clé   = cléSaisonniere(def.titre, anneeActuelle);
        const tache = all.find(t => t.contexteLibre === clé) ?? null;
        const faiteAnnee = tache !== null && (
          tache.statut === 'fait' ||
          (!!tache.completeeLe && new Date(tache.completeeLe).getFullYear() === anneeActuelle)
        );
        return { def, tache, faiteAnnee } as TacheSaisonniereLive;
      });
  });
}


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
  done?: boolean;
  hideCheck?: boolean;
  onToggle?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TacheCard({ tache, color = '#C69CE2', done: doneProp, hideCheck, onToggle, onEdit, onDelete }: TacheCardProps) {
  const done = doneProp !== undefined ? doneProp : tache.statut === 'fait';
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
      className={`mc-card${done && !hideCheck ? ' mc-card--done' : ''}`}
      onClick={hideCheck ? undefined : onToggle}
      role={hideCheck ? undefined : 'button'}
      tabIndex={hideCheck ? undefined : 0}
      onKeyDown={hideCheck ? undefined : (e => e.key === 'Enter' && onToggle?.())}
    >
      {!hideCheck && (
        <div className={`mc-card__check${done ? ' done' : ''}`}
          style={done ? {} : { borderColor: color + 'AA' }}
          aria-hidden="true"
        >
          {done && '✓'}
        </div>
      )}

      <div className="mc-card__body">
        <span className={`mc-card__titre${done && !hideCheck ? ' done' : ''}`}>{tache.titre}</span>
        <div className="mc-card__meta">
          {tache.priorite === 'urgente' && <span className="mc-card__badge mc-card__badge--urgent">Urgent</span>}
          {tache.priorite === 'haute' && <span className="mc-card__badge mc-card__badge--high">Priorité</span>}
          {ech && (
            <span className={`mc-card__badge${ech.urgent ? ' mc-card__badge--urgent' : ''}`}>
              {ech.label}
            </span>
          )}
          {joursDepuis !== null && joursDepuis > 0 && (
            <span className="mc-card__badge mc-card__badge--history">
              il y a {joursDepuis}j
            </span>
          )}
          {joursDepuis === 0 && !hideCheck && <span className="mc-card__badge mc-card__badge--today">Fait aujourd'hui</span>}
        </div>
      </div>

      <div className="mc-card__actions" onClick={e => e.stopPropagation()}>
        <button className="mc-card__act" onClick={onEdit}>✎</button>
        <button className={`mc-card__act${confirmDel ? ' confirming' : ''}`}
          onClick={() => { if (!confirmDel) { setConfirmDel(true); return; } onDelete(); setConfirmDel(false); }}
          onBlur={() => setConfirmDel(false)}
        >
          {confirmDel ? '!' : '×'}
        </button>
      </div>
    </div>
  );
}

// ─── Badge fréquence ──────────────────────────────────────────────────────────

const FREQ_DOT_COLOR: Partial<Record<FrequenceTache, string>> = {
  quotidienne:    '#1D9E75',
  hebdomadaire:   '#378ADD',
  bihebdomadaire: '#378ADD',
  mensuelle:      '#7F77DD',
  trimestrielle:  '#BA7517',
  semestrielle:   '#BA7517',
  annuelle:       '#BA7517',
};

// ─── Long-press hook ──────────────────────────────────────────────────────────

function useLongPress(callback: () => void, delay = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const start = useCallback(() => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      callback();
    }, delay);
  }, [callback, delay]);

  const cancel = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  return { start, cancel, fired };
}

// ─── Carte tâche moteur ───────────────────────────────────────────────────────

interface TaskRowEngineProps {
  task: MenageTask;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLongPress: () => void;
}

function TaskRowEngine({ task, onToggle, onEdit, onDelete, onLongPress }: TaskRowEngineProps) {
  const done = isCompletedToday(task);
  const { start, cancel, fired } = useLongPress(onLongPress);
  const [confirmDel, setConfirmDel] = useState(false);

  const handleClick = () => {
    if (fired.current) { fired.current = false; return; }
    onToggle();
  };

  return (
    <div
      className={`mc-card${done ? ' mc-card--done' : ''}`}
      onClick={handleClick}
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onTouchStart={start}
      onTouchEnd={cancel}
      onTouchMove={cancel}
      onTouchCancel={cancel}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onToggle()}
    >
      <div className="mc-card__accent" style={{ background: done ? '#34D399' : '#C69CE2' }} />
      <div
        className={`mc-card__check${done ? ' done' : ''}`}
        style={done ? {} : { borderColor: 'rgba(198,156,226,0.5)' }}
        aria-hidden="true"
      >
        {done && '✓'}
      </div>
      <div className="mc-card__body">
        <span className={`mc-card__titre${done ? ' done' : ''}`}>{task.titre}</span>
      </div>
      <span className="dj-freq" style={{ background: FREQ_DOT_COLOR[task.frequence ?? 'ponctuelle'] ?? '#9B8DB5' }} />
      <div
        className="mc-card__actions"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
      >
        <button className="mc-card__act" onClick={onEdit}>✎</button>
        <button
          className={`mc-card__act${confirmDel ? ' confirming' : ''}`}
          onClick={() => { if (!confirmDel) { setConfirmDel(true); return; } onDelete(); setConfirmDel(false); }}
          onBlur={() => setConfirmDel(false)}
        >
          {confirmDel ? '!' : '×'}
        </button>
      </div>
    </div>
  );
}

// ─── Timer hook ───────────────────────────────────────────────────────────────

function useTimer(dureeSecondes: number, actif: boolean) {
  const [restant, setRestant] = useState(dureeSecondes);

  useEffect(() => {
    if (!actif) { setRestant(dureeSecondes); return; }
    if (restant <= 0) return;
    const id = setInterval(() => setRestant(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [actif, restant, dureeSecondes]);

  const mm = String(Math.floor(restant / 60)).padStart(2, '0');
  const ss = String(restant % 60).padStart(2, '0');
  const pct = Math.round(((dureeSecondes - restant) / dureeSecondes) * 100);
  return { label: `${mm}:${ss}`, pct, fini: restant === 0 };
}

// ─── Sprint Express ───────────────────────────────────────────────────────────

interface SprintExpressProps {
  taches: Tache[];
  onQuitter: () => void;
}

function SprintExpress({ taches: tachesInitiales, onQuitter }: SprintExpressProps) {
  const store = useMaisonStore();
  const [taches, setTaches] = useState(tachesInitiales);
  const [timerActif, setTimerActif] = useState(false);
  const { label: timerLabel, pct: timerPct, fini: timerFini } = useTimer(20 * 60, timerActif);

  const faites = taches.filter(isCompletedToday).length;
  const total = taches.length;
  const toutFait = total > 0 && faites === total;

  const handleToggle = async (t: Tache) => {
    if (isCompletedToday(t)) {
      await TacheService.rouvrir(t.id);
    } else {
      await TacheService.completerTache(t.id);
    }
    // Mise à jour locale immédiate pour l'animation
    setTaches(prev => prev.map(p =>
      p.id === t.id
        ? { ...p, statut: isCompletedToday(t) ? 'a_faire' : 'fait', completeeLe: isCompletedToday(t) ? undefined : new Date() }
        : p
    ));
  };

  return (
    <div className="sprint-wrap">

      {/* En-tête sprint */}
      <div className="sprint-header">
        <div className="sprint-header__left">
          <span className="sprint-icon" />
          <div>
            <p className="sprint-title">Coup de propre express</p>
            <p className="sprint-sub">{faites}/{total} tâches · impact maximum</p>
          </div>
        </div>
        <button className="sprint-quit" onClick={onQuitter}>✕ Quitter</button>
      </div>

      {/* Timer */}
      <div className="sprint-timer" onClick={() => !timerFini && setTimerActif(a => !a)}>
        <div className="sprint-timer__arc">
          <svg viewBox="0 0 56 56" className="sprint-timer__svg">
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(167,139,250,0.15)" strokeWidth="4"/>
            <circle cx="28" cy="28" r="24" fill="none"
              stroke={toutFait ? '#34D399' : timerFini ? '#EF4444' : '#C69CE2'}
              strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 24}`}
              strokeDashoffset={`${2 * Math.PI * 24 * (1 - timerPct / 100)}`}
              transform="rotate(-90 28 28)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <span className="sprint-timer__label">
            {toutFait ? '✓' : timerFini ? '⏰' : timerLabel}
          </span>
        </div>
        {!timerActif && !timerFini && !toutFait && (
          <p className="sprint-timer__hint">Appuyer pour démarrer</p>
        )}
        {timerActif && !timerFini && (
          <p className="sprint-timer__hint">Appuyer pour pauser</p>
        )}
        {timerFini && !toutFait && (
          <p className="sprint-timer__hint" style={{ color: '#EF4444' }}>Temps écoulé</p>
        )}
        {toutFait && (
          <p className="sprint-timer__hint" style={{ color: '#059669' }}>Maison nickel</p>
        )}
      </div>

      {/* Progression globale */}
      <div className="sprint-prog-wrap">
        <div className="sprint-prog-bar">
          <div className="sprint-prog-fill"
            style={{ width: `${total > 0 ? (faites / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Tâches */}
      <div className="mc-cards">
        {taches.map(t => (
          <TacheCard key={t.id} tache={t}
            done={isCompletedToday(t)}
            color="#A78BFA"
            onToggle={() => handleToggle(t)}
            onEdit={() => store.openDrawerTache({ editId: t.id })}
            onDelete={() => TacheService.deleteTache(t.id)}
          />
        ))}
      </div>

      {toutFait && (
        <div className="dj-bravo" style={{ marginTop: 12 }}>
          <span>🏆</span>
          <p>Express terminé · maison impeccable</p>
        </div>
      )}
    </div>
  );
}

// ─── Modes ────────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<MenageMode, string> = {
  normal:           'Aujourd\'hui',
  grandMenage:      'Grand ménage',
  receptionInvites: 'Invités',
  rattrapage:       'Rattrapage',
};

// ─── Section Du Jour ──────────────────────────────────────────────────────────

function SectionDuJour() {
  const [mode, setMode] = useState<MenageMode>('normal');
  const [skippingTask, setSkippingTask] = useState<MenageTask | null>(null);
  const [sprintTaches, setSprintTaches] = useState<MenageTask[] | null>(null);
  const store = useMaisonStore();

  const tasks    = useTachesDuJourEngine(mode) ?? [];
  const saisons  = useSaisonnieres() ?? [];

  const faites  = tasks.filter(isCompletedToday).length;
  const total   = tasks.length;
  const progPct = total > 0 ? Math.round((faites / total) * 100) : 0;
  const allDone = total > 0 && faites === total;
  const durMin  = tasks.reduce((s, t) => s + (t.dureeEstimee ?? 10), 0);
  const isLoading = tasks === undefined;

  const handleToggle = async (t: MenageTask) => {
    if (isCompletedToday(t)) await TacheService.rouvrir(t.id);
    else await TacheService.completerTache(t.id);
  };

  const handleToggleSaisonniere = async (item: TacheSaisonniereLive) => {
    const annee = new Date().getFullYear();
    const clé   = cléSaisonniere(item.def.titre, annee);
    if (item.faiteAnnee && item.tache) {
      await TacheService.rouvrir(item.tache.id);
    } else if (item.tache) {
      await TacheService.completerTache(item.tache.id);
    } else {
      const id = await db.taches.add(newEntity<Tache>({
        titre: item.def.titre,
        statut: 'a_faire',
        moduleOrigine: 'maison',
        frequence: 'annuelle',
        recurrence: true,
        archive: false,
        contexteLibre: clé,
      }));
      await TacheService.completerTache(id as string);
    }
  };

  const handleSkip = async () => {
    if (!skippingTask) return;
    const patch = computeSkipPatch(skippingTask, new Date());
    await TacheService.applyMenagePatch(patch);
    setSkippingTask(null);
  };

  const lancerExpress = () => {
    const nonDone = tasks.filter(t => !isCompletedToday(t)).slice(0, 5);
    if (nonDone.length > 0) setSprintTaches(nonDone);
  };

  if (sprintTaches !== null) {
    return <SprintExpress taches={sprintTaches} onQuitter={() => setSprintTaches(null)} />;
  }

  return (
    <>
      <div className="mc-section">
        {/* En-tête */}
        <div className="mc-section__header">
          <div className="mc-section__title-row">
            <div>
              <h3 className="mc-section__title">Aujourd'hui</h3>
              <p className="mc-section__sub">
                {isLoading ? 'Chargement…'
                  : total === 0 ? 'Maison à jour'
                  : `${total} tâche${total > 1 ? 's' : ''} · ~${durMin} min`}
              </p>
            </div>
          </div>
          {total > 0 && (
            <div className="mc-section__score-col">
              <span className={`mc-section__score${allDone ? ' done' : ''}`}>{progPct}%</span>
              <div className="mc-prog-bar">
                <div className="mc-prog-fill" style={{ width: `${progPct}%`, background: allDone ? '#34D399' : '#C69CE2' }} />
              </div>
            </div>
          )}
        </div>

        {/* Sélecteur de modes */}
        <div className="dj-modes">
          {(Object.keys(MODE_LABELS) as MenageMode[]).map(m => (
            <button
              key={m}
              className={`dj-mode-pill${mode === m ? ' active' : ''}`}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Liste moteur */}
        {total === 0 && !isLoading ? (
          <div className="mc-empty">
            <span>🌿</span>
            <p>Maison à jour, rien à faire aujourd'hui</p>
          </div>
        ) : (
          <div className="mc-cards">
            {tasks.map(t => (
              <TaskRowEngine
                key={t.id}
                task={t}
                onToggle={() => handleToggle(t)}
                onEdit={() => store.openDrawerTache({ editId: t.id })}
                onDelete={() => TacheService.deleteTache(t.id)}
                onLongPress={() => setSkippingTask(t)}
              />
            ))}
          </div>
        )}

        {allDone && total > 0 && (
          <div className="dj-bravo"><span>✨</span><p>Maison impeccable — tout est fait</p></div>
        )}

        {!allDone && total > 0 && (
          <button className="sprint-cta" onClick={lancerExpress}>
            <span className="sprint-cta__icon" />
            <div className="sprint-cta__text">
              <span className="sprint-cta__title">Sprint express</span>
              <span className="sprint-cta__sub">5 tâches · impact maximum · 20 min</span>
            </div>
            <span className="sprint-cta__arrow">→</span>
          </button>
        )}

        {/* Tâches saisonnières */}
        {saisons.length > 0 && (
          <div className="dj-group">
            <span className="dj-group__label dj-group__label--saison">🍂 Ce mois-ci</span>
            <div className="mc-cards">
              {saisons.map(item => (
                <div
                  key={item.def.titre}
                  className={`mc-card${item.faiteAnnee ? ' mc-card--done' : ''}`}
                  onClick={() => handleToggleSaisonniere(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleToggleSaisonniere(item)}
                >
                  <div className="mc-card__accent" style={{ background: item.faiteAnnee ? '#34D399' : '#F59E0B' }} />
                  <div className={`mc-card__check${item.faiteAnnee ? ' done' : ''}`}
                    style={item.faiteAnnee ? {} : { borderColor: '#F59E0BAA' }}
                    aria-hidden="true"
                  >{item.faiteAnnee && '✓'}</div>
                  <div className="mc-card__body">
                    <span className={`mc-card__titre${item.faiteAnnee ? ' done' : ''}`}>
                      {item.def.emoji} {item.def.titre}
                    </span>
                    {item.def.description && (
                      <div className="mc-card__meta">
                        <span className="mc-card__badge">{item.def.description}</span>
                      </div>
                    )}
                  </div>
                  <span className="dj-freq">🍂</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Overlay "Pas aujourd'hui" */}
      {skippingTask && (
        <div className="dj-skip-overlay" onClick={() => setSkippingTask(null)}>
          <div className="dj-skip-sheet" onClick={e => e.stopPropagation()}>
            <p className="dj-skip-task-name">{skippingTask.titre}</p>
            <button className="dj-skip-btn" onClick={handleSkip}>
              Pas aujourd'hui
            </button>
            <button className="dj-skip-cancel" onClick={() => setSkippingTask(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Helper ajout en masse ────────────────────────────────────────────────────

async function ajouterToutesLesSuggestions(
  suggestions: { titre: string; emoji: string }[],
  frequence: FrequenceTache,
  existantes: Tache[],
): Promise<number> {
  const titresExistants = new Set(existantes.map(t => t.titre.trim().toLowerCase()));
  const nouvelles = suggestions.filter(s => !titresExistants.has(s.titre.trim().toLowerCase()));
  if (nouvelles.length === 0) return 0;
  await db.taches.bulkAdd(
    nouvelles.map(s => newEntity<Tache>({
      titre: s.titre, statut: 'a_faire', moduleOrigine: 'maison',
      frequence, recurrence: true, archive: false,
    }))
  );
  return nouvelles.length;
}

// ─── Section Quotidiennes ─────────────────────────────────────────────────────

function SectionQuotidiennes() {
  const taches = useTachesParFrequence('quotidienne') ?? [];
  const store = useMaisonStore();
  const [open, setOpen] = useState(true);
  const [showSugg, setShowSugg] = useState(false);
  const [ajoutMsg, setAjoutMsg] = useState<string | null>(null);

  const COLOR = '#1D9E75';

  const addSugg = async (titre: string) => {
    await db.taches.add(newEntity<Tache>({
      titre, statut: 'a_faire', moduleOrigine: 'maison',
      frequence: 'quotidienne', recurrence: true, archive: false,
    }));
    setShowSugg(false);
  };

  const addAll = async () => {
    const n = await ajouterToutesLesSuggestions(SUGGESTIONS_QUOTIDIENNES, 'quotidienne', taches);
    setShowSugg(false);
    setAjoutMsg(n === 0 ? 'Déjà toutes présentes' : `+${n} tâche${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}`);
    setTimeout(() => setAjoutMsg(null), 2500);
  };

  return (
    <div className="mc-periodik">
      <button className="mc-periodik__header" onClick={() => setOpen(o => !o)}>
        <span className="mc-periodik__icon" style={{ background: COLOR, borderRadius: '50%', width: 10, height: 10, display: 'inline-block', flexShrink: 0 }} />
        <div className="mc-periodik__titles">
          <span className="mc-periodik__label">Quotidien</span>
          <span className="mc-periodik__desc">Chaque jour</span>
        </div>
        <div className="mc-periodik__right">
          {taches.length > 0 && (
            <span className="mc-periodik__badge" style={{ background: COLOR + '18', color: COLOR }}>
              {taches.length}
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
                <TacheCard key={t.id} tache={t} color={COLOR} hideCheck
                  onEdit={() => store.openDrawerTache({ editId: t.id })}
                  onDelete={() => TacheService.deleteTache(t.id)}
                />
              ))}
            </div>
          )}

          {showSugg && (
            <div className="mc-suggestions">
              <button className="mc-sugg-btn mc-sugg-btn--all" onClick={addAll}>
                Tout ajouter ({SUGGESTIONS_QUOTIDIENNES.length} tâches)
              </button>
              {SUGGESTIONS_QUOTIDIENNES.map(s => (
                <button key={s.titre} className="mc-sugg-btn" onClick={() => addSugg(s.titre)}>
                  {s.titre}
                </button>
              ))}
            </div>
          )}

          <div className="mc-actions" style={{ marginTop: 8 }}>
            <button className="mc-btn mc-btn--primary"
              style={{ background: COLOR + '20', color: COLOR, borderColor: COLOR + '44' }}
              onClick={() => store.openDrawerTache({ frequence: 'quotidienne' })}
            >+ Ajouter</button>
            <button className="mc-btn mc-btn--ghost" onClick={() => setShowSugg(s => !s)}>Suggestions</button>
            {ajoutMsg && <span className="mc-ajout-msg">{ajoutMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section Périodique ───────────────────────────────────────────────────────

function SectionPeriodique({ cfg }: { cfg: FreqConfig }) {
  const taches = useTachesParFrequence(cfg.value) ?? [];
  const store = useMaisonStore();
  const [open, setOpen] = useState(true);
  const [showSugg, setShowSugg] = useState(false);
  const [ajoutMsg, setAjoutMsg] = useState<string | null>(null);

  const suggestions = SUGGESTIONS_PERIODIQUES[cfg.value] ?? [];

  const addSugg = async (titre: string) => {
    await db.taches.add(newEntity<Tache>({
      titre, statut: 'a_faire', moduleOrigine: 'maison',
      frequence: cfg.value, recurrence: true, archive: false,
    }));
    setShowSugg(false);
  };

  const addAll = async () => {
    const n = await ajouterToutesLesSuggestions(suggestions, cfg.value, taches);
    setShowSugg(false);
    setAjoutMsg(n === 0 ? 'Déjà toutes présentes' : `+${n} tâche${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}`);
    setTimeout(() => setAjoutMsg(null), 2500);
  };

  return (
    <div className="mc-periodik">
      <button className="mc-periodik__header" onClick={() => setOpen(o => !o)}>
        <span className="mc-periodik__icon" style={{ background: cfg.color, borderRadius: '50%', width: 10, height: 10, display: 'inline-block', flexShrink: 0 }} />
        <div className="mc-periodik__titles">
          <span className="mc-periodik__label">{cfg.label}</span>
          <span className="mc-periodik__desc">{cfg.description}</span>
        </div>
        <div className="mc-periodik__right">
          {taches.length > 0 && (
            <span className="mc-periodik__badge" style={{ background: cfg.color + '18', color: cfg.color }}>
              {taches.length}
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
                <TacheCard key={t.id} tache={t} color={cfg.color} hideCheck
                  onEdit={() => store.openDrawerTache({ editId: t.id })}
                  onDelete={() => TacheService.deleteTache(t.id)}
                />
              ))}
            </div>
          )}

          {showSugg && suggestions.length > 0 && (
            <div className="mc-suggestions">
              <button className="mc-sugg-btn mc-sugg-btn--all" onClick={addAll}>
                Tout ajouter ({suggestions.length} tâches)
              </button>
              {suggestions.map(s => (
                <button key={s.titre} className="mc-sugg-btn" onClick={() => addSugg(s.titre)}>
                  {s.titre}
                </button>
              ))}
            </div>
          )}

          <div className="mc-actions" style={{ marginTop: 8 }}>
            <button className="mc-btn mc-btn--primary"
              style={{ background: cfg.color + '20', color: cfg.color, borderColor: cfg.color + '44' }}
              onClick={() => store.openDrawerTache({ frequence: cfg.value })}
            >+ Ajouter</button>
            {suggestions.length > 0 && (
              <button className="mc-btn mc-btn--ghost" onClick={() => setShowSugg(s => !s)}>Suggestions</button>
            )}
            {ajoutMsg && <span className="mc-ajout-msg">{ajoutMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section Mes Tâches (fusion Quotidien + Périodique) ──────────────────────

function SectionMesTaches() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionQuotidiennes />
      <div className="mc-periodiques">
        {FREQUENCES_PERIODIQUES.map(cfg => <SectionPeriodique key={cfg.value} cfg={cfg} />)}
      </div>
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

      {/* Remise à zéro du moteur ménage */}
      <ResetMenageBlock />

      <TacheForm
        isOpen={store.drawerTacheOpen}
        onClose={store.closeDrawerTache}
        editId={store.drawerTacheEditId}
        piecePrefill={store.drawerTachePiecePrefill}
      />
    </div>
  );
}

function ResetMenageBlock() {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    await TacheService.resetMenageTasks();
    setLoading(false);
    setConfirm(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <div className="gm-reset-block">
      <div className="gm-reset-block__info">
        <span className="gm-reset-block__title">Remise à zéro</span>
        <span className="gm-reset-block__sub">Marque toutes les tâches comme faites aujourd'hui — utile après un déménagement ou un grand nettoyage complet.</span>
      </div>
      {done ? (
        <span className="gm-reset-block__ok">✓ Fait</span>
      ) : confirm ? (
        <div className="gm-banner__confirm">
          <span className="gm-banner__confirm-label">Remettre toutes les tâches à aujourd'hui ?</span>
          <div className="gm-banner__confirm-btns">
            <button className="gm-btn gm-btn--danger" onClick={handleReset} disabled={loading}>
              {loading ? '…' : 'Confirmer'}
            </button>
            <button className="gm-btn gm-btn--ghost" onClick={() => setConfirm(false)}>Annuler</button>
          </div>
        </div>
      ) : (
        <button className="gm-btn gm-btn--ghost" onClick={() => setConfirm(true)}>
          Remettre à zéro
        </button>
      )}
    </div>
  );
}

// ─── Module principal ─────────────────────────────────────────────────────────

export default function MenageModule() {
  const [onglet, setOnglet] = useState<OngletMenage>('du_jour');
  const store = useMaisonStore();
  const pieces = usePieces();
  useRappelMenageNatif();

  return (
    <div className="mc-module">
      <nav className="mc-tabs">
        <button className={`mc-tab${onglet === 'du_jour' ? ' active' : ''}`} onClick={() => setOnglet('du_jour')}>
          Du jour
        </button>
        <button className={`mc-tab${onglet === 'mes_taches' ? ' active' : ''}`} onClick={() => setOnglet('mes_taches')}>
          Mes tâches
        </button>
        <button className={`mc-tab${onglet === 'grand_menage' ? ' active' : ''}`} onClick={() => setOnglet('grand_menage')}>
          Pièces
        </button>
      </nav>

      <div className="mc-content">
        {onglet === 'du_jour' && <SectionDuJour />}
        {onglet === 'mes_taches' && <SectionMesTaches />}
        {onglet === 'grand_menage' && <SectionGrandMenage />}
      </div>

      {onglet !== 'grand_menage' && (
        <TacheForm
          isOpen={store.drawerTacheOpen}
          onClose={store.closeDrawerTache}
          editId={store.drawerTacheEditId}
          piecePrefill={store.drawerTachePiecePrefill}
          frequencePrefill={store.drawerTacheFrequencePrefill as import('@shared/types/entities').FrequenceTache | null}
          showMenageParams
        />
      )}
    </div>
  );
}
