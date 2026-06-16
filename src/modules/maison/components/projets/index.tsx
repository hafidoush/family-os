/**
 * FAMILY OS — Composants Projets Maison
 * src/modules/maison/components/projets/
 *
 * ProjetsList  — liste avec tri par statut
 * ProjetCard   — carte avec barre de progression
 * ProjetDetail — vue détail + tâches du projet
 * ProjetForm   — drawer création / édition
 */

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../core/db/database';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Select } from '../../../../shared/components/ui/Select';
import { ProjetService } from '../../services/ProjetService';
import type { ProjetMaison, Piece } from '@shared/types/modules';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUT_LABEL: Record<string, string> = {
  a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé', archive: 'Archivé',
};
const STATUT_COLOR: Record<string, string> = {
  a_faire: '#D1D5DB', en_cours: '#93C5FD', termine: '#86EFAC', archive: '#E5E7EB',
};

// ─── ProjetsList ──────────────────────────────────────────────────────────────

interface ProjetsListProps {
  projets: Array<{
    projet: ProjetMaison;
    progression: number;
    piece: Piece | null;
    nbTaches: number;
    nbFaites: number;
  }>;
  onSelectProjet: (id: string) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
}

export function ProjetsList({ projets, onSelectProjet, onEdit, onAdd }: ProjetsListProps) {
  if (projets.length === 0) {
    return (
      <div className="projets-empty">
        <span className="projets-empty__icon">🔨</span>
        <p>Aucun projet maison.</p>
        <Button variant="primary" onClick={onAdd}>Créer un projet</Button>
      </div>
    );
  }

  return (
    <div className="projets-list">
      {projets.map(({ projet, progression, piece, nbTaches, nbFaites }) => (
        <ProjetCard
          key={projet.id}
          projet={projet}
          progression={progression}
          piece={piece}
          nbTaches={nbTaches}
          nbFaites={nbFaites}
          onClick={() => onSelectProjet(projet.id)}
          onEdit={() => onEdit(projet.id)}
        />
      ))}
    </div>
  );
}

// ─── ProjetCard ───────────────────────────────────────────────────────────────

interface ProjetCardProps {
  projet: ProjetMaison;
  progression: number;
  piece: Piece | null;
  nbTaches: number;
  nbFaites: number;
  onClick: () => void;
  onEdit: () => void;
}

export function ProjetCard({ projet, progression, piece, nbTaches, nbFaites, onClick, onEdit }: ProjetCardProps) {
  const couleur = STATUT_COLOR[projet.statut] ?? '#D1D5DB';

  return (
    <div
      className={`projet-card projet-card--${projet.statut}`}
      style={{ '--couleur-statut': couleur } as React.CSSProperties}
    >
      <div className="projet-card__header" onClick={onClick}>
        <div className="projet-card__titre-bloc">
          <span className="projet-card__nom">{projet.nom}</span>
          {piece && (
            <span className="projet-card__piece">{piece.icone} {piece.nom}</span>
          )}
        </div>
        <span
          className="projet-card__statut-badge"
          style={{ background: couleur }}
        >
          {STATUT_LABEL[projet.statut]}
        </span>
      </div>

      {/* Barre de progression (D-03 — calculée à la volée) */}
      {nbTaches > 0 && (
        <div className="projet-card__progression-bloc" onClick={onClick}>
          <div className="projet-card__progression-track">
            <div
              className="projet-card__progression-bar"
              style={{ width: `${progression}%`, background: couleur }}
            />
          </div>
          <span className="projet-card__progression-label">
            {nbFaites}/{nbTaches} tâches · {progression}%
          </span>
        </div>
      )}

      {projet.dateCible && (
        <p className="projet-card__date-cible" onClick={onClick}>
          📅 Cible : {new Date(projet.dateCible).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
        </p>
      )}

      <button
        className="projet-card__edit-btn"
        onClick={e => { e.stopPropagation(); onEdit(); }}
        aria-label="Modifier"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 4.5 19.5 8.5 8.5 19.5 4 20l.5-4.5z"/><path d="M13.5 6.5 17.5 10.5"/></svg>
      </button>
    </div>
  );
}

// ─── ProjetDetail ─────────────────────────────────────────────────────────────

interface ProjetDetailProps {
  projet: ProjetMaison;
  progression: number;
  piece: Piece | null;
  nbTaches: number;
  nbFaites: number;
  onEdit: () => void;
  onBack: () => void;
  onChangerStatut: (statut: ProjetMaison['statut']) => void;
  onAddTache: () => void;
  children?: React.ReactNode;
}

export function ProjetDetail({
  projet, progression, piece, nbTaches, nbFaites,
  onEdit, onBack, onChangerStatut, onAddTache, children,
}: ProjetDetailProps) {
  const couleur = STATUT_COLOR[projet.statut] ?? '#D1D5DB';
  const statutsSuivants: Array<ProjetMaison['statut']> = projet.statut === 'a_faire'
    ? ['en_cours']
    : projet.statut === 'en_cours'
    ? ['termine', 'a_faire']
    : [];

  return (
    <div className="projet-detail">
      <button className="projet-detail__back" onClick={onBack}>← Tous les projets</button>

      <div className="projet-detail__header">
        <div className="projet-detail__titre-bloc">
          <h2 className="projet-detail__nom">{projet.nom}</h2>
          {piece && <p className="projet-detail__piece">{piece.icone} {piece.nom}</p>}
        </div>
        <button className="projet-detail__edit-btn" onClick={onEdit} aria-label="Modifier"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 4.5 19.5 8.5 8.5 19.5 4 20l.5-4.5z"/><path d="M13.5 6.5 17.5 10.5"/></svg></button>
      </div>

      <div
        className="projet-detail__statut-badge"
        style={{ background: couleur }}
      >
        {STATUT_LABEL[projet.statut]}
      </div>

      {projet.description && (
        <p className="projet-detail__description">{projet.description}</p>
      )}

      {/* Progression */}
      {nbTaches > 0 && (
        <div className="projet-detail__progression-bloc">
          <div className="projet-detail__progression-header">
            <span>Progression</span>
            <span className="projet-detail__progression-pct">{progression}%</span>
          </div>
          <div className="projet-detail__progression-track">
            <div
              className="projet-detail__progression-bar"
              style={{ width: `${progression}%`, background: couleur }}
            />
          </div>
          <span className="projet-detail__taches-count">{nbFaites} / {nbTaches} tâches terminées</span>
        </div>
      )}

      {/* Dates */}
      {(projet.dateDebut || projet.dateCible) && (
        <div className="projet-detail__dates">
          {projet.dateDebut && (
            <span>🗓 Début : {new Date(projet.dateDebut).toLocaleDateString('fr-FR')}</span>
          )}
          {projet.dateCible && (
            <span>🎯 Cible : {new Date(projet.dateCible).toLocaleDateString('fr-FR')}</span>
          )}
        </div>
      )}

      {/* Actions de statut */}
      {statutsSuivants.length > 0 && (
        <div className="projet-detail__statut-actions">
          {statutsSuivants.map(s => (
            <Button key={s} variant={s === 'termine' ? 'primary' : 'ghost'} onClick={() => onChangerStatut(s)}>
              {s === 'en_cours' ? '▶ Démarrer' : s === 'termine' ? '✅ Marquer terminé' : '↩ Remettre à faire'}
            </Button>
          ))}
        </div>
      )}

      {/* Tâches du projet */}
      <div className="projet-detail__taches-section">
        <div className="projet-detail__section-header">
          <h3>Tâches</h3>
          <button className="projet-detail__add-tache-btn" onClick={onAddTache}>＋ Ajouter</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── ProjetForm ───────────────────────────────────────────────────────────────

interface ProjetFormProps {
  isOpen: boolean;
  onClose: () => void;
  editId?: string | null;
  projet?: ProjetMaison | null;
}

export function ProjetForm({ isOpen, onClose, editId, projet }: ProjetFormProps) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [pieceId, setPieceId] = useState('');
  const [statut, setStatut] = useState<ProjetMaison['statut']>('a_faire');
  const [dateDebut, setDateDebut] = useState('');
  const [dateCible, setDateCible] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const pieces = useLiveQuery(
    () => db.pieces.filter(p => p.actif && !p.deletedAt).toArray(),
    [], []
  );

  useEffect(() => {
    if (!isOpen) return;
    if (projet) {
      setNom(projet.nom);
      setDescription(projet.description ?? '');
      setPieceId(projet.pieceAssociee ?? '');
      setStatut(projet.statut);
      setDateDebut(projet.dateDebut ?? '');
      setDateCible(projet.dateCible ?? '');
    } else {
      setNom(''); setDescription(''); setPieceId('');
      setStatut('a_faire'); setDateDebut(''); setDateCible('');
    }
    setError('');
  }, [isOpen, projet]);

  const handleSave = async () => {
    if (!nom.trim()) { setError('Le nom est obligatoire'); return; }
    setIsSaving(true);
    try {
      const input = {
        nom, description: description.trim() || undefined,
        pieceId: pieceId || undefined, statut,
        dateDebut: dateDebut || undefined, dateCible: dateCible || undefined,
      };
      if (editId) await ProjetService.updateProjet(editId, input);
      else await ProjetService.addProjet(input);
      onClose();
    } catch { setError("Erreur lors de l'enregistrement"); }
    finally { setIsSaving(false); }
  };

  const pieceOptions = [
    { value: '', label: 'Toute la maison' },
    ...(pieces ?? []).map(p => ({ value: p.id, label: `${p.icone ?? ''} ${p.nom}` })),
  ];
  const statutOptions = [
    { value: 'a_faire', label: 'À faire' },
    { value: 'en_cours', label: 'En cours' },
    { value: 'termine', label: 'Terminé' },
  ];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={editId ? 'Modifier le projet' : 'Nouveau projet'}>
      <div className="projet-form">
        <div className="projet-form__field">
          <label className="projet-form__label">Nom <span className="projet-form__required">*</span></label>
          <Input
            value={nom} onChange={e => { setNom(e.target.value); setError(''); }}
            placeholder="Ex. : Rénovation salle de bain, Déco chambre..." autoFocus
          />
          {error && <p className="projet-form__error">{error}</p>}
        </div>

        <div className="projet-form__field">
          <label className="projet-form__label">Description</label>
          <textarea
            className="projet-form__textarea"
            value={description} onChange={e => setDescription(e.target.value)}
            rows={2} placeholder="Objectif, contexte..."
          />
        </div>

        <div className="projet-form__row">
          <div className="projet-form__field">
            <label className="projet-form__label">Pièce</label>
            <Select value={pieceId} onChange={e => setPieceId(e.target.value)} options={pieceOptions} />
          </div>
          <div className="projet-form__field">
            <label className="projet-form__label">Statut</label>
            <Select
              value={statut}
              onChange={e => setStatut(e.target.value as ProjetMaison['statut'])}
              options={statutOptions}
            />
          </div>
        </div>

        <div className="projet-form__row">
          <div className="projet-form__field">
            <label className="projet-form__label">Date de début</label>
            <Input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
          </div>
          <div className="projet-form__field">
            <label className="projet-form__label">Date cible</label>
            <Input type="date" value={dateCible} onChange={e => setDateCible(e.target.value)} />
          </div>
        </div>

        <div className="projet-form__actions">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving || !nom.trim()}>
            {isSaving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
