/**
 * FAMILY OS — SouvenirModule
 * Grille masonry de souvenirs avec filtres membres + type
 */

import { Drawer } from '@shared/components/ui/Drawer';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';
import { useFamilleStore } from '../../stores/familleStore';
import { useSouvenirs } from '../../hooks/useSouvenirs';
import SouvenirCard from './SouvenirCard';
import SouvenirForm from './SouvenirForm';
import SouvenirDetail from './SouvenirDetail';

const MEMBRE_COLORS: Record<string, string> = {
  'membre-maman': '#A78BFA',
  'membre-papa': '#60A5FA',
  'membre-manel': '#F9A8D4',
  'membre-nawfel': '#86EFAC',
};

const TYPES_FILTER = [
  { value: 'moment_fort', label: '⭐ Moment fort' },
  { value: 'reussite', label: '🏆 Réussite' },
  { value: 'sortie', label: '🎡 Sortie' },
  { value: 'autre', label: '💫 Autre' },
];

export default function SouvenirModule() {
  const {
    filtreMembreSouvenir, setFiltreMembreSouvenir,
    filtreTypeSouvenir, setFiltreTypeSouvenir,
    souvenirDetailId, setSouvenirDetailId,
    formSouvenirOuvert, setFormSouvenirOuvert,
    editSouvenirId, setEditSouvenirId,
  } = useFamilleStore();

  const membres = useLiveQuery(() => db.membres.filter(m => m.actif && !m.deletedAt).toArray(), []);
  const souvenirs = useSouvenirs(filtreMembreSouvenir, filtreTypeSouvenir);

  return (
    <>
      <div>
        {/* Filtres membres */}
        <div className="souvenirs-filtres">
          <div className="souvenirs-filtres-membres">
            <button
              className={`filtre-membre-btn${!filtreMembreSouvenir ? ' active' : ''}`}
              onClick={() => setFiltreMembreSouvenir(null)}
            >
              Tous
            </button>
            {membres?.map(m => (
              <button
                key={m.id}
                className={`filtre-membre-btn${filtreMembreSouvenir === m.id ? ' active' : ''}`}
                onClick={() => setFiltreMembreSouvenir(filtreMembreSouvenir === m.id ? null : m.id)}
              >
                <span
                  className="filtre-membre-avatar"
                  style={{ background: MEMBRE_COLORS[m.id] ?? '#C9B8E8' }}
                >
                  {m.prenom.charAt(0)}
                </span>
                {m.prenom}
              </button>
            ))}
          </div>

          {/* Filtres type */}
          <div className="souvenirs-filtres-types">
            <button
              className={`filtre-type-chip${!filtreTypeSouvenir ? ' active' : ''}`}
              onClick={() => setFiltreTypeSouvenir(null)}
            >
              Tout
            </button>
            {TYPES_FILTER.map(t => (
              <button
                key={t.value}
                className={`filtre-type-chip${filtreTypeSouvenir === t.value ? ' active' : ''}`}
                onClick={() => setFiltreTypeSouvenir(filtreTypeSouvenir === t.value ? null : t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Compteur */}
        {(souvenirs ?? []).length > 0 && (
          <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
            {(souvenirs ?? []).length} souvenir{(souvenirs ?? []).length > 1 ? 's' : ''}
          </p>
        )}

        {/* Grille masonry */}
        {(souvenirs ?? []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌟</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#5B4A82', marginBottom: 6 }}>
              Aucun souvenir
            </p>
            <p style={{ fontSize: 14, marginBottom: 20 }}>
              Capturez vos moments forts, sorties et réussites familiales.
            </p>
            <button
              className="btn btn--primary"
              onClick={() => setFormSouvenirOuvert(true)}
            >
              Ajouter un souvenir
            </button>
          </div>
        ) : (
          <div className="souvenirs-masonry">
            {(souvenirs ?? []).map(s => (
              <SouvenirCard
                key={s.id}
                souvenir={s}
                onClick={() => setSouvenirDetailId(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drawer Form */}
      <Drawer
        isOpen={formSouvenirOuvert}
        onClose={() => setFormSouvenirOuvert(false)}
        title={editSouvenirId ? 'Modifier le souvenir' : 'Nouveau souvenir'}
      >
        <SouvenirForm
          editId={editSouvenirId}
          onSave={() => setFormSouvenirOuvert(false)}
          onCancel={() => setFormSouvenirOuvert(false)}
        />
      </Drawer>

      {/* Detail Drawer */}
      <SouvenirDetail
        souvenirId={souvenirDetailId}
        onClose={() => setSouvenirDetailId(null)}
        onEdit={(id) => { setSouvenirDetailId(null); setEditSouvenirId(id); }}
      />
    </>
  );
}
