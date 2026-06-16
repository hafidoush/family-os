/**
 * FAMILY OS — SouvenirDetail
 * Vue détail d'un souvenir dans un Drawer
 */

import { useState } from 'react';
import { Drawer } from '@shared/components/ui/Drawer';
import { Modal } from '@shared/components/ui/Modal';
import { db } from '@core/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { souvenirService } from '../../services/souvenirService';
import { ImagePlaceholder } from '@shared/components/ui/ImagePlaceholder';
import { formatDateLong } from '@shared/utils/formatDate';

interface Props {
  souvenirId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  moment_fort: '⭐',
  reussite: '🏆',
  sortie: '🎡',
  autre: '💫',
};

const TYPE_LABELS: Record<string, string> = {
  moment_fort: 'Moment fort',
  reussite: 'Réussite',
  sortie: 'Sortie',
  autre: 'Autre',
};

const MEMBRE_COLORS: Record<string, string> = {
  'membre-maman': '#A78BFA',
  'membre-papa': '#60A5FA',
  'membre-manel': '#F9A8D4',
  'membre-nawfel': '#86EFAC',
};

export default function SouvenirDetail({ souvenirId, onClose, onEdit }: Props) {
  const souvenir = useLiveQuery(
    () => souvenirId ? db.souvenirs.get(souvenirId) : undefined,
    [souvenirId]
  );
  const membres = useLiveQuery(() => db.membres.toArray(), []);

  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!souvenirId) return null;

  const handleDelete = async () => {
    await souvenirService.delete(souvenirId);
    onClose();
  };

  const participantsMembres = (souvenir?.membresAssocies ?? [])
    .map(id => membres?.find(m => m.id === id))
    .filter(Boolean);

  return (
    <>
      <Drawer isOpen={!!souvenirId} onClose={onClose} title="Souvenir">
        {souvenir ? (
          <div>
            {/* Photos */}
            {(souvenir.photosBase64 ?? []).length > 0 ? (
              <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
                {(souvenir.photosBase64 ?? []).map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt=""
                    style={{ height: 180, width: 240, objectFit: 'cover', borderRadius: 14, flexShrink: 0 }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ padding: '0 16px 16px' }}>
                <ImagePlaceholder
                  icon={TYPE_ICONS[souvenir.type ?? 'autre'] ?? '💫'}
                  label="Photo"
                  style={{ height: 180, borderRadius: 14, width: '100%' }}
                />
              </div>
            )}

            <div style={{ padding: '0 16px 24px' }}>
              {/* Type badge */}
              <span className={`souvenir-type-badge ${souvenir.type ?? 'autre'}`} style={{ marginBottom: 10 }}>
                {TYPE_ICONS[souvenir.type ?? 'autre']} {TYPE_LABELS[souvenir.type ?? 'autre']}
              </span>

              {/* Titre */}
              <h2 style={{ fontFamily: 'var(--font-display, "Playfair Display", serif)', fontSize: 22, fontWeight: 700, color: '#3D2F5E', margin: '8px 0 4px' }}>
                {souvenir.titre}
              </h2>

              {/* Date */}
              <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500, textTransform: 'capitalize', marginBottom: 16 }}>
                📅 {formatDateLong(souvenir.date)}
              </p>

              {/* Description */}
              {souvenir.description && (
                <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.7, marginBottom: 16 }}>
                  {souvenir.description}
                </p>
              )}

              {/* Membres */}
              {participantsMembres.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: 8 }}>
                    Présents
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {participantsMembres.map(m => m && (
                      <span
                        key={m.id}
                        style={{
                          padding: '5px 12px',
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

              {/* Tags */}
              {(souvenir.tags ?? []).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {souvenir.tags!.map(tag => (
                      <span
                        key={tag}
                        style={{
                          padding: '3px 10px',
                          background: 'rgba(201,184,232,0.15)',
                          border: '1px solid rgba(201,184,232,0.3)',
                          borderRadius: 20,
                          fontSize: 11,
                          color: '#7C6FA0',
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="detail-btn-edit" onClick={() => onEdit(souvenir.id)} style={{ flex: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 4.5 19.5 8.5 8.5 19.5 4 20l.5-4.5z"/><path d="M13.5 6.5 17.5 10.5"/></svg> Modifier
                </button>
                <button className="detail-btn-delete" onClick={() => setConfirmDelete(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Chargement…</div>
        )}
      </Drawer>

      <Modal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer ce souvenir ?">
        <p style={{ color: '#6B7280', marginBottom: 20 }}>Ce souvenir sera archivé.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Annuler</button>
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
