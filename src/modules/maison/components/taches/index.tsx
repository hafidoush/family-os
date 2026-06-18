/**
 * FAMILY OS — Composants Tâches d'entretien
 * src/modules/maison/components/taches/
 *
 * TachesList  — liste avec filtre pièce/statut
 * TacheItem   — item avec checkbox, badge priorité, date échéance
 * TacheForm   — drawer création / édition
 */

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../core/db/database';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Select } from '../../../../shared/components/ui/Select';
import { ConfirmModal } from '../../../../shared/components/ui/ConfirmModal';
import { TacheService } from '../../services/TacheService';
import type { Tache, PrioriteTache, FrequenceTache } from '@shared/types/entities';
import type { Piece } from '@shared/types/modules';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITE_COLOR: Record<string, string> = {
  urgente: '#FCA5A5', haute: '#FCD34D', normale: '#93C5FD', basse: '#D1D5DB',
};
const PRIORITE_LABEL: Record<string, string> = {
  urgente: 'Urgente', haute: 'Haute', normale: 'Normale', basse: 'Basse',
};

function isEnRetard(t: Tache): boolean {
  if (!t.dateEcheance || t.statut === 'fait') return false;
  return new Date(t.dateEcheance) < new Date();
}

function formatEcheance(d: Date | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── TachesList ───────────────────────────────────────────────────────────────

interface TachesListProps {
  taches: Tache[];
  pieces: Piece[];
  onComplete: (id: string) => void;
  onReouvrir: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  showPiece?: boolean; // affiche la pièce dans l'item (vue globale)
}

export function TachesList({
  taches, pieces, onComplete, onReouvrir, onEdit, onDelete, showPiece = false,
}: TachesListProps) {
  const pieceMap = new Map(pieces.map(p => [p.id, p]));

  if (taches.length === 0) {
    return (
      <div className="taches-empty">
        <span>✅</span>
        <p>Aucune tâche ici.</p>
      </div>
    );
  }

  // Grouper par statut : à faire d'abord, faites en bas
  const aFaire = taches.filter(t => t.statut !== 'fait');
  const faites = taches.filter(t => t.statut === 'fait');

  return (
    <div className="taches-list">
      {aFaire.map(t => (
        <TacheItem
          key={t.id} tache={t}
          piece={showPiece && t.pieceAssociee ? pieceMap.get(t.pieceAssociee) ?? null : null}
          onComplete={() => onComplete(t.id)}
          onReouvrir={() => onReouvrir(t.id)}
          onEdit={() => onEdit(t.id)}
          onDelete={() => onDelete(t.id)}
        />
      ))}
      {faites.length > 0 && (
        <details className="taches-list__faites">
          <summary className="taches-list__faites-toggle">
            Terminées ({faites.length})
          </summary>
          {faites.map(t => (
            <TacheItem
              key={t.id} tache={t}
              piece={showPiece && t.pieceAssociee ? pieceMap.get(t.pieceAssociee) ?? null : null}
              onComplete={() => onComplete(t.id)}
              onReouvrir={() => onReouvrir(t.id)}
              onEdit={() => onEdit(t.id)}
              onDelete={() => onDelete(t.id)}
            />
          ))}
        </details>
      )}
    </div>
  );
}

// ─── TacheItem ────────────────────────────────────────────────────────────────

interface TacheItemProps {
  tache: Tache;
  piece: Piece | null;
  onComplete: () => void;
  onReouvrir: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TacheItem({ tache, piece, onComplete, onReouvrir, onEdit, onDelete }: TacheItemProps) {
  const fait = tache.statut === 'fait';
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <div className={`tache-item ${fait ? 'tache-item--fait' : ''}`}>
        <button
          className="tache-item__checkbox"
          onClick={fait ? onReouvrir : onComplete}
          aria-label={fait ? 'Rouvrir' : 'Marquer comme fait'}
        >
          {fait ? '✓' : ''}
        </button>

        <div className="tache-item__content">
          <span className={`tache-item__titre ${fait ? 'tache-item__titre--barre' : ''}`}>
            {tache.titre}
          </span>
          <div className="tache-item__meta">
            {piece && (
              <span className="tache-item__badge tache-item__badge--piece">
                {piece.icone} {piece.nom}
              </span>
            )}
            {tache.dureeEstimee && (
              <span className="tache-item__badge">⏱ {tache.dureeEstimee} min</span>
            )}
          </div>
        </div>

        <div className="tache-item__actions">
          <button className="tache-item__action-btn" onClick={onEdit} aria-label="Modifier">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 4.5 19.5 8.5 8.5 19.5 4 20l.5-4.5z"/><path d="M13.5 6.5 17.5 10.5"/></svg>
          </button>
          <button className="tache-item__action-btn" onClick={() => setConfirmDelete(true)} aria-label="Supprimer">
            ×
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Supprimer cette tâche ?"
        confirmLabel="Supprimer"
        danger
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

// ─── TacheForm ────────────────────────────────────────────────────────────────

const JOURS_OPTIONS = [
  { value: 'lun', label: 'Lun' },
  { value: 'mar', label: 'Mar' },
  { value: 'mer', label: 'Mer' },
  { value: 'jeu', label: 'Jeu' },
  { value: 'ven', label: 'Ven' },
  { value: 'sam', label: 'Sam' },
  { value: 'dim', label: 'Dim' },
];

interface TacheFormProps {
  isOpen: boolean;
  onClose: () => void;
  editId?: string | null;
  piecePrefill?: string | null;
  projetPrefill?: string | null;
  frequencePrefill?: FrequenceTache | null;
  moduleOriginePrefill?: string | null;
}

function toInputDate(d: Date | undefined): string {
  if (!d) return '';
  return new Date(d).toISOString().split('T')[0];
}

export function TacheForm({ isOpen, onClose, editId, piecePrefill, projetPrefill, frequencePrefill }: TacheFormProps) {
  const [titre, setTitre] = useState('');
  const [pieceId, setPieceId] = useState('');
  const [frequence, setFrequence] = useState<FrequenceTache>('trimestrielle');
  const [duree, setDuree] = useState('');
  const [dateReference, setDateReference] = useState('');
  const [derniereRealisation, setDerniereRealisation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const pieces = useLiveQuery(
    () => db.pieces.filter(p => p.actif && !p.deletedAt).toArray(),
    [], []
  );

  useEffect(() => {
    if (!isOpen) return;
    if (editId) {
      db.taches.get(editId).then(t => {
        if (!t) return;
        setTitre(t.titre);
        setPieceId(t.pieceAssociee ?? '');
        setFrequence(t.frequence ?? 'trimestrielle');
        setDuree(t.dureeEstimee?.toString() ?? '');
        setDateReference(toInputDate(t.dateReference));
        setDerniereRealisation(toInputDate(t.completeeLe));
      });
    } else {
      setTitre('');
      setPieceId(piecePrefill ?? '');
      setFrequence(frequencePrefill ?? 'trimestrielle');
      setDuree('');
      setDateReference('');
      setDerniereRealisation('');
    }
    setError('');
  }, [isOpen, editId, piecePrefill, projetPrefill, frequencePrefill]);

  const handleSave = async () => {
    if (!titre.trim()) { setError('Le titre est obligatoire'); return; }
    setIsSaving(true);
    try {
      const input = {
        titre,
        pieceId: pieceId || undefined,
        recurrence: frequence !== 'ponctuelle',
        frequence,
        dureeEstimee: duree ? parseInt(duree) : undefined,
        dateReference: dateReference ? new Date(dateReference) : undefined,
        completeeLe: derniereRealisation ? new Date(derniereRealisation) : undefined,
      };
      if (editId) await TacheService.updateTache(editId, input);
      else await TacheService.addTache(input);
      onClose();
    } catch { setError("Erreur lors de l'enregistrement"); }
    finally { setIsSaving(false); }
  };

  const pieceOptions = [
    { value: '', label: 'Toute la maison' },
    ...(pieces ?? []).map(p => ({ value: p.id, label: `${p.icone ?? ''} ${p.nom}` })),
  ];

  const frequenceOptions = [
    { value: 'quotidienne',    label: 'Quotidienne' },
    { value: 'hebdomadaire',   label: 'Hebdomadaire' },
    { value: 'bihebdomadaire', label: 'Toutes les 2 semaines' },
    { value: 'mensuelle',      label: 'Mensuelle' },
    { value: 'trimestrielle',  label: 'Trimestrielle' },
    { value: 'semestrielle',   label: 'Semestrielle' },
    { value: 'annuelle',       label: 'Annuelle' },
    { value: 'ponctuelle',     label: 'Ponctuelle' },
  ];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={editId ? 'Modifier la tâche' : 'Nouvelle tâche'}>
      <div className="tache-form">

        <div className="tache-form__field">
          <label className="tache-form__label">Titre <span className="tache-form__required">*</span></label>
          <Input
            value={titre} onChange={e => { setTitre(e.target.value); setError(''); }}
            placeholder="Ex. : Nettoyer le four…" autoFocus
          />
          {error && <p className="tache-form__error">{error}</p>}
        </div>

        <div className="tache-form__field">
          <label className="tache-form__label">Pièce</label>
          <Select value={pieceId} onChange={e => setPieceId(e.target.value)} options={pieceOptions} />
        </div>

        <div className="tache-form__row">
          <div className="tache-form__field">
            <label className="tache-form__label">Fréquence</label>
            <Select value={frequence} onChange={e => setFrequence(e.target.value as FrequenceTache)} options={frequenceOptions} />
          </div>
          <div className="tache-form__field">
            <label className="tache-form__label">Durée (min)</label>
            <Input type="number" min="0" value={duree} onChange={e => setDuree(e.target.value)} placeholder="30" />
          </div>
        </div>

        {frequence !== 'ponctuelle' && (
          <div className="tache-form__row">
            <div className="tache-form__field">
              <label className="tache-form__label">Date de départ</label>
              <Input
                type="date"
                value={dateReference}
                onChange={e => setDateReference(e.target.value)}
              />
              <span className="tache-form__hint">Ancre du calcul de la prochaine échéance</span>
            </div>
            <div className="tache-form__field">
              <label className="tache-form__label">Dernière réalisation</label>
              <Input
                type="date"
                value={derniereRealisation}
                onChange={e => setDerniereRealisation(e.target.value)}
              />
              <span className="tache-form__hint">Remplace la date de départ si renseignée</span>
            </div>
          </div>
        )}

        <div className="tache-form__actions">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving || !titre.trim()}>
            {isSaving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer'}
          </Button>
        </div>

      </div>
    </Drawer>
  );
}
