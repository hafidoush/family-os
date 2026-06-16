/**
 * FAMILY OS — ReunionDetail (v2)
 * Vue détail d'une réunion famille.
 * COMPLÉMENT : bouton "Saisir les humeurs" ouvre HumeurReunionSheet.
 *
 * Remplace : src/modules/famille/components/reunions/ReunionDetail.tsx
 */

import { useState } from 'react';
import { Drawer } from '@shared/components/ui/Drawer';
import { db } from '@core/db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { reunionService } from '../../services/reunionService';
import { formatDateLong } from '@shared/utils/formatDate';
import HumeurReunionSheet from './HumeurReunionSheet';

interface Props {
  reunionId: string | null;
  onClose: () => void;
}

const HUMEUR_EMOJIS: Record<number, string> = {
  7: '😄', 6: '🙂', 5: '😊', 4: '😐', 3: '😕', 2: '😔', 1: '😢',
};

const HUMEUR_LABELS: Record<number, string> = {
  7: 'Très bien', 6: 'Bien', 5: 'Heureux', 4: 'Neutre', 3: 'Pas bien', 2: 'Difficile', 1: 'Très difficile',
};

const HUMEUR_COLORS: Record<number, string> = {
  7: '#16A34A', 6: '#0369A1', 5: '#0369A1', 4: '#7C6FA0', 3: '#D97706', 2: '#D97706', 1: '#DC2626',
};

export default function ReunionDetail({ reunionId, onClose }: Props) {
  const reunion = useLiveQuery(
    () => reunionId ? db.reunionsFamille.get(reunionId) : undefined,
    [reunionId]
  );

  const humeurs = useLiveQuery<import('@shared/types').Humeur[]>(
    () => reunion?.humeursSaisies?.length
      ? db.humeurs.where('id').anyOf(reunion.humeursSaisies).toArray()
      : Promise.resolve([]),
    [reunion?.humeursSaisies?.join(',')]
  );

  const membres = useLiveQuery(() => db.membres.toArray(), []);

  const [editResume, setEditResume]           = useState(false);
  const [resumeText, setResumeText]           = useState('');
  const [terminerLoading, setTerminerLoading] = useState(false);
  const [humeurSheetOpen, setHumeurSheetOpen] = useState(false);   // ← NOUVEAU

  if (!reunionId || !reunion) return null;

  const handleTerminer = async () => {
    setTerminerLoading(true);
    await reunionService.terminer(reunionId, reunion.resume);
    setTerminerLoading(false);
  };

  const handleSaveResume = async () => {
    await reunionService.updateResume(reunionId, resumeText);
    setEditResume(false);
  };

  const nbMembres = (membres ?? []).length;
  const nbHumeurs = (humeurs ?? []).length;

  return (
    <>
      <Drawer isOpen={!!reunionId} onClose={onClose} title="Réunion famille">
        <div style={{ padding: '0 16px 24px' }}>

          {/* Date */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: 4 }}>
              Date
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#3D2F5E', textTransform: 'capitalize' }}>
              {formatDateLong(reunion.date)}
            </p>
          </div>

          {/* Statut */}
          <div style={{ marginBottom: 20 }}>
            <span
              className={`reunion-badge ${reunion.terminee ? 'terminee' : 'planifiee'}`}
              style={{ fontSize: 12, padding: '5px 14px' }}
            >
              {reunion.terminee ? '✅ Terminée' : '📅 Planifiée'}
            </span>
          </div>

          {/* ── SECTION HUMEURS ─────────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>
                Humeurs ({nbHumeurs}/{nbMembres})
              </p>
              <button
                style={{
                  padding: '5px 12px',
                  background: 'rgba(201,184,232,0.2)',
                  border: '1.5px solid rgba(201,184,232,0.4)',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#5B4A82',
                  cursor: 'pointer',
                }}
                onClick={() => setHumeurSheetOpen(true)}
              >
                {nbHumeurs === 0 ? 'Saisir' : 'Modifier'}
              </button>
            </div>

            {/* Barre de progression humeurs */}
            {nbMembres > 0 && (
              <div style={{ height: 5, background: 'rgba(201,184,232,0.15)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(nbHumeurs / nbMembres) * 100}%`,
                    background: 'linear-gradient(90deg, #C9B8E8, #A78BFA)',
                    borderRadius: 3,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            )}

            {(humeurs ?? []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(humeurs ?? []).map(h => {
                  const membre = membres?.find(m => m.id === h.membre);
                  const couleur = HUMEUR_COLORS[h.valeur] ?? '#9CA3AF';
                  return (
                    <div
                      key={h.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        background: `${couleur}18`,
                        border: `1px solid ${couleur}33`,
                        borderRadius: 10,
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{HUMEUR_EMOJIS[h.valeur] ?? '😐'}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#3D2F5E', margin: 0 }}>
                          {membre?.prenom ?? 'Membre'}
                          <span style={{ fontWeight: 400, color: couleur, marginLeft: 6 }}>
                            — {HUMEUR_LABELS[h.valeur]}
                          </span>
                        </p>
                        {h.noteLibre && (
                          <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0', fontStyle: 'italic' }}>
                            "{h.noteLibre}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '16px',
                  background: 'rgba(201,184,232,0.08)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: '1.5px dashed rgba(201,184,232,0.4)',
                }}
                onClick={() => setHumeurSheetOpen(true)}
              >
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                  Aucune humeur saisie — appuyer pour commencer
                </p>
              </div>
            )}
          </div>

          {/* ── RÉSUMÉ / ORDRE DU JOUR ───────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>
                {reunion.terminee ? 'Résumé' : 'Ordre du jour'}
              </p>
              <button
                style={{ fontSize: 11, color: '#7C6FA0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => { setResumeText(reunion.resume ?? ''); setEditResume(true); }}
              >
                {reunion.resume ? 'Modifier' : '+ Ajouter'}
              </button>
            </div>

            {editResume ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  className="input"
                  rows={4}
                  value={resumeText}
                  onChange={e => setResumeText(e.target.value)}
                  style={{ resize: 'vertical', minHeight: 100 }}
                  placeholder="Notes, compte-rendu, décisions..."
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setEditResume(false)}>Annuler</button>
                  <button className="btn btn--primary" style={{ flex: 2 }} onClick={handleSaveResume}>Enregistrer</button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>
                {reunion.resume || <em style={{ color: '#D1D5DB' }}>Aucun contenu</em>}
              </p>
            )}
          </div>

          {/* Action terminer */}
          {!reunion.terminee && (
            <button
              className="btn btn--primary"
              style={{ width: '100%', marginTop: 8 }}
              onClick={handleTerminer}
              disabled={terminerLoading}
            >
              {terminerLoading ? 'En cours…' : '✅ Marquer comme terminée'}
            </button>
          )}
        </div>
      </Drawer>

      {/* Sheet saisie humeurs — monté en dehors du Drawer principal */}
      {reunionId && (
        <HumeurReunionSheet
          reunionId={reunionId}
          isOpen={humeurSheetOpen}
          onClose={() => setHumeurSheetOpen(false)}
        />
      )}
    </>
  );
}
