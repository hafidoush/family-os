/**
 * FAMILY OS — Composants Pièces
 * src/modules/maison/components/pieces/
 *
 * PiecesOverview  — grille des pièces avec score visuel
 * PieceCard       — carte individuelle avec jauge
 * PieceDetail     — vue détail d'une pièce + ses tâches
 * PieceForm       — drawer création / édition
 */

import React, { useState, useEffect } from 'react';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { MaisonService, etatLabel, etatColor, scoreToEtat } from '../../services/MaisonService';
import type { Piece } from '@shared/types/modules';

// ─── PiecesOverview ───────────────────────────────────────────────────────────

interface PiecesOverviewProps {
  pieces: Piece[];
  onSelectPiece: (id: string) => void;
  onAddPiece: () => void;
}

export function PiecesOverview({ pieces, onSelectPiece, onAddPiece }: PiecesOverviewProps) {
  if (pieces.length === 0) {
    return (
      <div className="pieces-empty">
        <span className="pieces-empty__icon">🏠</span>
        <p>Aucune pièce configurée.</p>
        <Button variant="primary" onClick={onAddPiece}>Ajouter une pièce</Button>
      </div>
    );
  }

  return (
    <div className="pieces-overview">
      <div className="pieces-grid">
        {pieces.map(p => (
          <PieceCard key={p.id} piece={p} onClick={() => onSelectPiece(p.id)} />
        ))}
        <button className="pieces-grid__add" onClick={onAddPiece} aria-label="Ajouter une pièce">
          <span>＋</span>
          <span>Ajouter</span>
        </button>
      </div>
    </div>
  );
}

// ─── PieceCard ────────────────────────────────────────────────────────────────

interface PieceCardProps {
  piece: Piece;
  onClick: () => void;
}

export function PieceCard({ piece, onClick }: PieceCardProps) {
  const etat = piece.etatGeneral ?? scoreToEtat(piece.scoreProprety);
  const couleur = etatColor(etat);
  const label = etatLabel(etat);

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

      {/* Jauge de propreté */}
      <div className="piece-card__jauge-wrapper">
        <div
          className="piece-card__jauge"
          style={{ width: `${piece.scoreProprety}%`, background: couleur }}
        />
      </div>

      <div className="piece-card__footer">
        <span className="piece-card__score">{piece.scoreProprety}%</span>
        <span className="piece-card__etat">{label}</span>
      </div>
    </button>
  );
}

// ─── PieceDetail ──────────────────────────────────────────────────────────────

interface PieceDetailProps {
  piece: Piece;
  onEdit: () => void;
  onEntretenir: () => void;
  onBack: () => void;
  onAddTache: () => void;
  children?: React.ReactNode; // liste des tâches injectée par le parent
}

export function PieceDetail({
  piece, onEdit, onEntretenir, onBack, onAddTache, children,
}: PieceDetailProps) {
  const etat = piece.etatGeneral ?? scoreToEtat(piece.scoreProprety);
  const couleur = etatColor(etat);

  return (
    <div className="piece-detail">
      <button className="piece-detail__back" onClick={onBack}>← Toutes les pièces</button>

      <div className="piece-detail__header" style={{ '--couleur-etat': couleur } as React.CSSProperties}>
        <span className="piece-detail__icone">{piece.icone ?? '🏠'}</span>
        <div className="piece-detail__titre">
          <h2 className="piece-detail__nom">{piece.nom}</h2>
          <span className="piece-detail__etat-label">{etatLabel(etat)}</span>
        </div>
        <button className="piece-detail__edit-btn" onClick={onEdit} aria-label="Modifier"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 4.5 19.5 8.5 8.5 19.5 4 20l.5-4.5z"/><path d="M13.5 6.5 17.5 10.5"/></svg></button>
      </div>

      {/* Score + jauge grande */}
      <div className="piece-detail__score-bloc">
        <div className="piece-detail__score-number">{piece.scoreProprety}<span>%</span></div>
        <div className="piece-detail__jauge-lg-track">
          <div
            className="piece-detail__jauge-lg"
            style={{ width: `${piece.scoreProprety}%`, background: couleur }}
          />
        </div>
        {piece.dernierEntretien && (
          <p className="piece-detail__last-entretien">
            Dernier entretien : {new Date(piece.dernierEntretien).toLocaleDateString('fr-FR')}
          </p>
        )}
      </div>

      {/* Action rapide */}
      {etat !== 'tres_propre' && (
        <div className="piece-detail__action-rapide">
          <Button variant="primary" onClick={onEntretenir}>
            ✨ Marquer comme entretenue
          </Button>
        </div>
      )}

      {/* Tâches d'entretien */}
      <div className="piece-detail__taches-section">
        <div className="piece-detail__section-header">
          <h3>Tâches d'entretien</h3>
          <button className="piece-detail__add-tache-btn" onClick={onAddTache}>＋ Ajouter</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── PieceForm ────────────────────────────────────────────────────────────────

const ICONES_PIECES = [
  '🍳', '🛋️', '🛁', '🛏️', '🧸', '💻', '🚗', '🌱', '🧺', '📦', '🚽',
  '🏠', '🪴', '🪑', '🔧', '🧹', '🪟', '🚪',
];

interface PieceFormProps {
  isOpen: boolean;
  onClose: () => void;
  editId?: string | null;
  piece?: Piece | null;
}

export function PieceForm({ isOpen, onClose, editId, piece }: PieceFormProps) {
  const [nom, setNom] = useState('');
  const [icone, setIcone] = useState('🏠');
  const [taux, setTaux] = useState('3');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (piece) {
      setNom(piece.nom);
      setIcone(piece.icone ?? '🏠');
      setTaux(String(piece.tauxDegradation ?? 3));
    } else {
      setNom(''); setIcone('🏠'); setTaux('3');
    }
    setError('');
  }, [isOpen, piece]);

  const handleSave = async () => {
    if (!nom.trim()) { setError('Le nom est obligatoire'); return; }
    setIsSaving(true);
    try {
      const input = { nom, icone, tauxDegradation: parseFloat(taux) || 3 };
      if (editId) await MaisonService.updatePiece(editId, input);
      else await MaisonService.addPiece(input);
      onClose();
    } catch { setError('Erreur lors de l\'enregistrement'); }
    finally { setIsSaving(false); }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={editId ? 'Modifier la pièce' : 'Nouvelle pièce'}>
      <div className="piece-form">
        <div className="piece-form__field">
          <label className="piece-form__label">Nom <span className="piece-form__required">*</span></label>
          <Input
            value={nom} onChange={e => { setNom(e.target.value); setError(''); }}
            placeholder="Ex. : Cuisine, Salon..." autoFocus
          />
          {error && <p className="piece-form__error">{error}</p>}
        </div>

        <div className="piece-form__field">
          <label className="piece-form__label">Icône</label>
          <div className="piece-form__icones-grid">
            {ICONES_PIECES.map(i => (
              <button
                key={i}
                className={`piece-form__icone-btn ${icone === i ? 'piece-form__icone-btn--actif' : ''}`}
                onClick={() => setIcone(i)}
                type="button"
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="piece-form__field">
          <label className="piece-form__label">Dégradation (points/jour)</label>
          <Input
            type="number" min="0" max="20" step="0.5"
            value={taux} onChange={e => setTaux(e.target.value)}
          />
          <p className="piece-form__hint">
            Vitesse à laquelle le score de propreté baisse chaque jour.
            Cuisine : 5 · Salle de bain : 6 · Salon : 3
          </p>
        </div>

        <div className="piece-form__actions">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving || !nom.trim()}>
            {isSaving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
