/**
 * FAMILY OS — EvenementDetail
 * Vue détail d'un événement dans un Drawer
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '@shared/components/ui/Drawer';
import { Modal } from '@shared/components/ui/Modal';
import { db } from '@core/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { evenementService } from '../../services/evenementService';
import { formatDateLong, formatTime } from '@shared/utils/formatDate';
import type { Membre } from '@shared/types/modules';
import { IconCalendar } from '@shared/components/ui/Icon/Icon';

interface Props {
  evenementId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
}

const TYPE_ICONS: Record<string, ReactNode> = {
  rendez_vous: <IconCalendar size={18} />,
  anniversaire: '🎂',
  sortie: '🎡',
  evenement: '🎉',
  rappel: '⏰',
  medical: '🏥',
};

const TYPE_LABELS: Record<string, string> = {
  rendez_vous: 'Rendez-vous',
  anniversaire: 'Anniversaire',
  sortie: 'Sortie',
  evenement: 'Événement',
  rappel: 'Rappel',
  medical: 'Médical',
};

const TYPE_COLORS: Record<string, string> = {
  rendez_vous: 'rgba(201, 184, 232, 0.25)',
  anniversaire: 'rgba(249, 168, 212, 0.25)',
  sortie: 'rgba(134, 239, 172, 0.25)',
  evenement: 'rgba(184, 212, 232, 0.25)',
  rappel: 'rgba(252, 211, 77, 0.25)',
  medical: 'rgba(248, 113, 113, 0.2)',
};

const MEMBRE_COLORS: Record<string, string> = {
  'membre-maman': '#A78BFA',
  'membre-papa': '#60A5FA',
  'membre-manel': '#F9A8D4',
  'membre-nawfel': '#86EFAC',
};

export default function EvenementDetail({ evenementId, onClose, onEdit }: Props) {
  const evenement = useLiveQuery(
    () => evenementId ? db.evenements.get(evenementId) : undefined,
    [evenementId]
  );
  const membres = useLiveQuery(() => db.membres.toArray(), []) as Membre[] | undefined;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  if (!evenementId) return null;

  const handleDelete = async () => {
    if (evenementId) {
      await evenementService.delete(evenementId);
      onClose();
    }
  };

  const participantsMembres = (evenement?.personnesAssociees ?? [])
    .map(id => membres?.find(m => m.id === id))
    .filter(Boolean) as Membre[];

  const icon = evenement ? (TYPE_ICONS[evenement.type] ?? '📌') : '📌';

  return (
    <>
      <Drawer isOpen={!!evenementId} onClose={onClose} title="">
        {evenement ? (
          <>
            <div className="evenement-detail-header">
              <span className="evenement-detail-type-icon">{icon}</span>
              <div className="evenement-detail-titles">
                <h2 className="evenement-detail-titre">{evenement.titre}</h2>
                <span
                  className="evenement-detail-type-badge"
                  style={{ background: TYPE_COLORS[evenement.type] ?? 'rgba(201,184,232,0.2)', color: '#5B4A82' }}
                >
                  {TYPE_LABELS[evenement.type] ?? evenement.type}
                </span>
              </div>
            </div>

            <div className="evenement-detail-body">
              {/* Date/Heure */}
              <div className="detail-row">
                <span className="detail-icon">🗓</span>
                <span className="detail-text">
                  {formatDateLong(evenement.dateDebut as unknown as string | Date)}
                  {!evenement.journeeEntiere && ` · ${formatTime(evenement.dateDebut as unknown as string | Date)}`}
                  {evenement.dateFin && ` → ${formatTime(evenement.dateFin as unknown as string | Date)}`}
                  {evenement.journeeEntiere && ' (journée entière)'}
                </span>
              </div>

              {/* Lieu */}
              {evenement.lieu && (
                <div className="detail-row">
                  <span className="detail-icon">📍</span>
                  <span className="detail-text">{evenement.lieu}</span>
                </div>
              )}

              {/* Récurrence */}
              {evenement.recurrence && (
                <div className="detail-row">
                  <span className="detail-icon">🔁</span>
                  <span className="detail-text">
                    Récurrent · {evenement.frequence ?? 'fréquence non définie'}
                  </span>
                </div>
              )}

              {/* Participants */}
              {participantsMembres.length > 0 && (
                <div className="detail-row">
                  <span className="detail-icon">👥</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {participantsMembres.map(m => (
                      <span
                        key={m.id}
                        style={{
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: `${MEMBRE_COLORS[m.id] ?? '#C9B8E8'}33`,
                          color: '#3D2F5E',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {m.prenom}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Médical */}
              {evenement.contexteMedical && (
                <div className="detail-row">
                  <span className="detail-icon">🏥</span>
                  <span className="detail-text" style={{ color: '#DC2626', fontWeight: 600 }}>
                    Contexte médical
                  </span>
                </div>
              )}

              {/* Notes */}
              {evenement.notes && (
                <div className="detail-row">
                  <span className="detail-icon">📝</span>
                  <span className="detail-text">{evenement.notes}</span>
                </div>
              )}
            </div>

            <div className="detail-actions">
              <button
                onClick={() => { onClose(); navigate(`/receptions/${evenement.id}`); }}
                style={{
                  width: '100%', padding: '11px', borderRadius: 12, border: 'none',
                  background: 'rgba(111,126,214,0.12)', color: '#6F7ED6',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginBottom: 10, fontFamily: 'inherit',
                }}
              >
                🎉 Préparer cet événement
              </button>
              <button className="detail-btn-edit" onClick={() => onEdit(evenement.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 4.5 19.5 8.5 8.5 19.5 4 20l.5-4.5z"/><path d="M13.5 6.5 17.5 10.5"/></svg> Modifier
              </button>
              <button className="detail-btn-delete" onClick={() => setConfirmDelete(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>
            Chargement…
          </div>
        )}
      </Drawer>

      <Modal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer l'événement ?"
      >
        <p style={{ color: '#6B7280', marginBottom: 20 }}>
          Cet événement sera archivé et ne sera plus visible dans le calendrier.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>
            Annuler
          </button>
          <button
            className="btn"
            style={{ flex: 1, background: 'rgba(248,113,113,0.15)', color: '#DC2626', border: '1.5px solid rgba(248,113,113,0.3)', borderRadius: 12 }}
            onClick={handleDelete}
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </>
  );
}
