/**
 * FAMILY OS — MembresModule
 * Liste et gestion des membres de la famille avec photo de profil.
 */

import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';
import { newEntity } from '@core/db/helpers';
import type { Membre } from '@shared/types/modules';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarToUrl(avatar: string | undefined): string | null {
  if (!avatar || typeof avatar !== 'string') return null;
  return avatar;
}

function fileToBase64(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = url;
  });
}

const COULEURS: string[] = [
  '#C9B8E8', '#F9A8D4', '#86EFAC', '#FCD34D',
  '#93C5FD', '#FDBA74', '#6EE7B7', '#F9A8D4',
];

function getInitiales(prenom: string): string {
  return prenom.slice(0, 2).toUpperCase();
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function MembreAvatar({ membre, size = 64 }: { membre: Membre; size?: number }) {
  const url = avatarToUrl(membre.avatar);

  return url ? (
    <img
      src={url}
      alt={membre.prenom}
      style={{
        width: size, height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: `2px solid ${membre.couleur ?? '#C9B8E8'}`,
      }}
    />
  ) : (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: membre.couleur ?? '#C9B8E8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.3, fontWeight: 700, color: '#3D3357',
      flexShrink: 0,
    }}>
      {getInitiales(membre.prenom)}
    </div>
  );
}

// ─── Formulaire membre ────────────────────────────────────────────────────────

interface MembreFormProps {
  membre?: Membre | null;
  onSave: () => void;
  onCancel: () => void;
}

function MembreForm({ membre, onSave, onCancel }: MembreFormProps) {
  const [prenom, setPrenom] = useState(membre?.prenom ?? '');
  const [role, setRole] = useState<Membre['role']>(membre?.role ?? 'parent');
  const [couleur, setCouleur] = useState(membre?.couleur ?? COULEURS[0]);
  const [avatar, setAvatar] = useState<string | undefined>(membre?.avatar);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => avatarToUrl(membre?.avatar));
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setAvatar(b64);
    setPreviewUrl(b64);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prenom.trim()) return;
    setSaving(true);
    try {
      if (membre) {
        await db.membres.update(membre.id, { prenom: prenom.trim(), role, couleur, avatar });
      } else {
        const m = newEntity<Membre>({ prenom: prenom.trim(), role, couleur, avatar, actif: true });
        await db.membres.add(m);
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Photo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {previewUrl ? (
          <img src={previewUrl} alt="Aperçu" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${couleur}` }} />
        ) : (
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: couleur, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#3D3357' }}>
            {prenom ? getInitiales(prenom) : '?'}
          </div>
        )}
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{ fontSize: 13, color: '#7C5CBF', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          {previewUrl ? 'Changer la photo' : 'Ajouter une photo'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
      </div>

      {/* Prénom */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 13, color: '#6B5B8A', fontWeight: 500 }}>Prénom</label>
        <input
          value={prenom}
          onChange={e => setPrenom(e.target.value)}
          placeholder="Prénom du membre"
          style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E8E0F0', fontSize: 15, outline: 'none' }}
          required
        />
      </div>

      {/* Rôle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 13, color: '#6B5B8A', fontWeight: 500 }}>Rôle</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['parent', 'enfant'] as const).map(r => (
            <button key={r} type="button"
              onClick={() => setRole(r)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, border: '1.5px solid',
                borderColor: role === r ? '#7C5CBF' : '#E8E0F0',
                background: role === r ? '#F3EDFF' : 'white',
                color: role === r ? '#7C5CBF' : '#6B5B8A',
                fontWeight: role === r ? 600 : 400, fontSize: 14, cursor: 'pointer',
              }}>
              {r === 'parent' ? 'Parent' : 'Enfant'}
            </button>
          ))}
        </div>
      </div>

      {/* Couleur */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, color: '#6B5B8A', fontWeight: 500 }}>Couleur</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COULEURS.map(c => (
            <div key={c} onClick={() => setCouleur(c)}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                outline: couleur === c ? `3px solid #7C5CBF` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onCancel}
          style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid #E8E0F0', background: 'white', color: '#6B5B8A', fontSize: 15, cursor: 'pointer' }}>
          Annuler
        </button>
        <button type="submit" disabled={saving || !prenom.trim()}
          style={{ flex: 1, padding: '11px 0', borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, #9A5CA3 0%, #C9B8E8 100%)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement…' : membre ? 'Modifier' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
}

// ─── Carte membre ─────────────────────────────────────────────────────────────

interface MembreCardProps {
  membre: Membre;
  onEdit: (m: Membre) => void;
}

function MembreCard({ membre, onEdit }: MembreCardProps) {
  return (
    <div
      onClick={() => onEdit(membre)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'rgba(255,255,255,0.7)', borderRadius: 16,
        padding: '14px 16px', cursor: 'pointer',
        border: '1px solid rgba(201,184,232,0.25)',
        backdropFilter: 'blur(8px)',
        transition: 'all 0.15s',
      }}
    >
      <MembreAvatar membre={membre} size={54} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#3D3357' }}>{membre.prenom}</div>
        <div style={{ fontSize: 13, color: '#9B8DB5', marginTop: 2 }}>
          {membre.role === 'parent' ? 'Parent' : 'Enfant'}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#C9B8E8' }}>›</div>
    </div>
  );
}

// ─── Module principal ─────────────────────────────────────────────────────────

export default function MembresModule() {
  const membres = useLiveQuery(
    () => db.membres.filter(m => m.actif && !m.deletedAt).toArray(),
    []
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editMembre, setEditMembre] = useState<Membre | null>(null);

  const openCreate = () => { setEditMembre(null); setFormOpen(true); };
  const openEdit = (m: Membre) => { setEditMembre(m); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditMembre(null); };

  const parents = (membres ?? []).filter(m => m.role === 'parent');
  const enfants = (membres ?? []).filter(m => m.role === 'enfant');

  if (formOpen) {
    return (
      <div style={{ padding: '0 0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button onClick={closeForm}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#7C5CBF', padding: '4px 8px', borderRadius: 8 }}>
            ←
          </button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#3D3357' }}>
            {editMembre ? 'Modifier le membre' : 'Nouveau membre'}
          </h2>
        </div>
        <MembreForm membre={editMembre} onSave={closeForm} onCancel={closeForm} />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#3D3357' }}>Membres</h2>
        <button onClick={openCreate}
          style={{ background: 'linear-gradient(135deg, #9A5CA3 0%, #C9B8E8 100%)', color: 'white', border: 'none', borderRadius: 999, padding: '8px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          + Ajouter
        </button>
      </div>

      {/* Liste vide */}
      {(membres ?? []).length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9B8DB5' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍👩‍👧‍👦</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Aucun membre pour l'instant</div>
          <div style={{ fontSize: 14 }}>Ajoutez les membres de votre famille</div>
        </div>
      )}

      {/* Parents */}
      {parents.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9B8DB5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Parents
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {parents.map(m => <MembreCard key={m.id} membre={m} onEdit={openEdit} />)}
          </div>
        </section>
      )}

      {/* Enfants */}
      {enfants.length > 0 && (
        <section>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9B8DB5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Enfants
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {enfants.map(m => <MembreCard key={m.id} membre={m} onEdit={openEdit} />)}
          </div>
        </section>
      )}
    </div>
  );
}
