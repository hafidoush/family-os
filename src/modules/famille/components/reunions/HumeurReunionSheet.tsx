/**
 * FAMILY OS — HumeurReunionSheet
 * Bottom sheet de saisie des humeurs lors d'une réunion famille.
 * Permet à chaque membre de saisir son humeur, qui est :
 *  1. Enregistrée dans db.humeurs (source = 'reunion_famille')
 *  2. Liée à la réunion via reunionService.ajouterHumeur()
 *
 * Patterns respectés :
 *  - Jamais d'écriture Dexie dans le composant → service
 *  - useLiveQuery pour les données réactives
 *  - newEntity() via le service
 */

import { useState } from 'react';
import { Drawer } from '@shared/components/ui/Drawer';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';
import { reunionHumeurService } from '../../services/reunionHumeurService';
import type { ValeurHumeur } from '@shared/types';
import type { Membre } from '@shared/types/modules';

interface Props {
  reunionId: string;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Données UI des humeurs ───────────────────────────────────────────────────

interface HumeurOption {
  valeur: ValeurHumeur;
  emoji: string;
  label: string;
  couleur: string;
  bg: string;
}

const HUMEURS: HumeurOption[] = [
  { valeur: 7, emoji: '😄', label: 'Très bien',     couleur: '#16A34A', bg: 'rgba(134,239,172,0.2)' },
  { valeur: 6, emoji: '🙂', label: 'Bien',          couleur: '#0369A1', bg: 'rgba(147,197,253,0.2)' },
  { valeur: 4, emoji: '😐', label: 'Neutre',        couleur: '#7C6FA0', bg: 'rgba(201,184,232,0.2)' },
  { valeur: 2, emoji: '😔', label: 'Difficile',     couleur: '#D97706', bg: 'rgba(252,211,77,0.2)'  },
  { valeur: 1, emoji: '😢', label: 'Très difficile',couleur: '#DC2626', bg: 'rgba(248,113,113,0.2)' },
];

const MEMBRE_COLORS: Record<string, string> = {
  'membre-maman': '#A78BFA',
  'membre-papa':  '#60A5FA',
  'membre-manel': '#F9A8D4',
  'membre-nawfel': '#86EFAC',
};

// ─── Saisie pour un membre ────────────────────────────────────────────────────

interface MembreSaisieProps {
  membre: Membre;
  humeurExistante?: ValeurHumeur | null;
  onSave: (membreId: string, valeur: ValeurHumeur, note: string) => Promise<void>;
}

function MembreSaisie({ membre, humeurExistante, onSave }: MembreSaisieProps) {
  const [valeur, setValeur] = useState<ValeurHumeur | null>(humeurExistante ?? null);
  const [note, setNote]     = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(!!humeurExistante);

  const handleSave = async () => {
    if (!valeur) return;
    setSaving(true);
    try {
      await onSave(membre.id, valeur, note);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const couleurMembre = MEMBRE_COLORS[membre.id] ?? '#C9B8E8';

  return (
    <div
      style={{
        padding: '14px',
        background: 'rgba(255,255,255,0.6)',
        border: `1.5px solid ${saved ? 'rgba(134,239,172,0.5)' : 'rgba(201,184,232,0.3)'}`,
        borderRadius: '14px',
        backdropFilter: 'blur(8px)',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* En-tête membre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: couleurMembre,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            color: 'white',
            fontSize: 14,
            boxShadow: `0 2px 8px ${couleurMembre}66`,
          }}
        >
          {membre.prenom.charAt(0)}
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#3D2F5E' }}>
          {membre.prenom}
        </span>
        {saved && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#16A34A', fontWeight: 600 }}>
            ✅ Saisie
          </span>
        )}
      </div>

      {/* Sélecteur humeur */}
      <div style={{ display: 'flex', gap: 6, marginBottom: valeur ? 10 : 0 }}>
        {HUMEURS.map(h => (
          <button
            key={h.valeur}
            onClick={() => { setValeur(h.valeur); setSaved(false); }}
            style={{
              flex: 1,
              padding: '8px 4px',
              border: `1.5px solid ${valeur === h.valeur ? h.couleur : 'rgba(201,184,232,0.25)'}`,
              borderRadius: '10px',
              background: valeur === h.valeur ? h.bg : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              transition: 'all 0.15s ease',
              transform: valeur === h.valeur ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <span style={{ fontSize: 20 }}>{h.emoji}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: valeur === h.valeur ? h.couleur : '#9CA3AF', textAlign: 'center', lineHeight: 1.2 }}>
              {h.label}
            </span>
          </button>
        ))}
      </div>

      {/* Note libre (si humeur sélectionnée) */}
      {valeur && !saved && (
        <div style={{ marginTop: 10 }}>
          <input
            className="input"
            type="text"
            placeholder="Note libre (optionnel)..."
            value={note}
            onChange={e => setNote(e.target.value)}
            style={{ marginBottom: 10, fontSize: 13 }}
          />
          <button
            className="btn btn--primary"
            style={{ width: '100%' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : 'Valider'}
          </button>
        </div>
      )}

      {/* Modifier si déjà saisi */}
      {saved && valeur && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 13, color: '#6B7280' }}>
            {HUMEURS.find(h => h.valeur === valeur)?.emoji}{' '}
            {HUMEURS.find(h => h.valeur === valeur)?.label}
          </span>
          <button
            style={{ fontSize: 11, color: '#7C6FA0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => setSaved(false)}
          >
            Modifier
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function HumeurReunionSheet({ reunionId, isOpen, onClose }: Props) {
  const membres = useLiveQuery(
    () => db.membres.filter(m => m.actif && !m.deletedAt).toArray(),
    []
  );

  // Humeurs déjà saisies pour cette réunion (source = reunion_famille, date = today)
  const reunion = useLiveQuery(
    () => db.reunionsFamille.get(reunionId),
    [reunionId]
  );

  const humeursExistantes = useLiveQuery<import('@shared/types').Humeur[]>(
    () => reunion?.humeursSaisies?.length
      ? db.humeurs.where('id').anyOf(reunion.humeursSaisies).toArray()
      : Promise.resolve([]),
    [reunion?.humeursSaisies?.join(',')]
  );

  const handleSave = async (membreId: string, valeur: ValeurHumeur, note: string) => {
    await reunionHumeurService.saisirHumeur(reunionId, membreId, valeur, note);
  };

  const nbSaisis = (humeursExistantes ?? []).length;
  const nbTotal  = (membres ?? []).length;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Humeurs de la réunion">
      <div style={{ padding: '0 16px 32px' }}>
        {/* Progression */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>
              {nbSaisis} / {nbTotal} saisies
            </span>
            {nbSaisis === nbTotal && nbTotal > 0 && (
              <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 700 }}>
                ✅ Tous les membres ont répondu
              </span>
            )}
          </div>
          <div style={{ height: 6, background: 'rgba(201,184,232,0.2)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: nbTotal > 0 ? `${(nbSaisis / nbTotal) * 100}%` : '0%',
                background: 'linear-gradient(90deg, #C9B8E8, #A78BFA)',
                borderRadius: 3,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Saisie par membre */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(membres ?? []).map(m => {
            const humeurExistante = (humeursExistantes ?? []).find(h => h.membre === m.id);
            return (
              <MembreSaisie
                key={m.id}
                membre={m}
                humeurExistante={humeurExistante?.valeur ?? null}
                onSave={handleSave}
              />
            );
          })}
        </div>

        {/* CTA fermer quand tout est saisi */}
        {nbSaisis === nbTotal && nbTotal > 0 && (
          <button
            className="btn btn--primary"
            style={{ width: '100%', marginTop: 20 }}
            onClick={onClose}
          >
            Fermer
          </button>
        )}
      </div>
    </Drawer>
  );
}
