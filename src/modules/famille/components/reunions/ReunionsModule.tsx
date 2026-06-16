/**
 * FAMILY OS — ReunionsModule
 * Orchestrateur de la section Réunions famille
 */

import { Drawer } from '@shared/components/ui/Drawer';
import { useFamilleStore } from '../../stores/familleStore';
import { useReunions, useProchainReunion } from '../../hooks/useReunions';
import ReunionForm from './ReunionForm';
import ReunionDetail from './ReunionDetail';
import { formatDateLong } from '@shared/utils/formatDate';

const HUMEUR_EMOJIS: Record<number, string> = {
  7: '😄', 6: '🙂', 5: '😊', 4: '😐', 3: '😕', 2: '😔', 1: '😢',
};

export default function ReunionsModule() {
  const {
    formReunionOuvert, setFormReunionOuvert,
    reunionDetailId, setReunionDetailId,
  } = useFamilleStore();

  const reunions = useReunions();
  const prochaine = useProchainReunion();

  const reunionsTerminees = (reunions ?? []).filter(r => r.terminee);
  const reunionsPlanifiees = (reunions ?? []).filter(r => !r.terminee);

  return (
    <>
      <div>
        {/* Bannière prochaine réunion */}
        {prochaine ? (
          <div
            className="prochaine-reunion-banner"
            onClick={() => setReunionDetailId(prochaine.id)}
          >
            <span className="prochaine-reunion-icon">🏠</span>
            <div className="prochaine-reunion-body">
              <p className="prochaine-reunion-label">Prochaine réunion</p>
              <p className="prochaine-reunion-date" style={{ textTransform: 'capitalize' }}>
                {formatDateLong(prochaine.date)}
              </p>
              {prochaine.resume && (
                <p style={{ fontSize: 12, color: '#7C6FA0', marginTop: 2 }}>
                  {prochaine.resume.slice(0, 60)}{prochaine.resume.length > 60 ? '…' : ''}
                </p>
              )}
            </div>
            <button
              className="prochaine-reunion-cta"
              onClick={e => { e.stopPropagation(); setReunionDetailId(prochaine.id); }}
            >
              Voir →
            </button>
          </div>
        ) : (
          <div
            className="prochaine-reunion-banner"
            style={{ cursor: 'pointer' }}
            onClick={() => setFormReunionOuvert(true)}
          >
            <span className="prochaine-reunion-icon">🗓</span>
            <div className="prochaine-reunion-body">
              <p className="prochaine-reunion-label">Aucune réunion planifiée</p>
              <p style={{ fontSize: 13, color: '#7C6FA0' }}>Planifiez votre prochaine réunion famille</p>
            </div>
            <button className="prochaine-reunion-cta" onClick={e => { e.stopPropagation(); setFormReunionOuvert(true); }}>
              Planifier
            </button>
          </div>
        )}

        {/* Réunions planifiées */}
        {reunionsPlanifiees.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: 'var(--font-display, "Playfair Display", serif)', fontSize: 15, fontWeight: 700, color: '#3D2F5E', marginBottom: 10 }}>
              À venir
            </h3>
            <div className="reunions-liste">
              {reunionsPlanifiees.map(r => (
                <div
                  key={r.id}
                  className="famille-card reunion-card"
                  onClick={() => setReunionDetailId(r.id)}
                >
                  <div className="reunion-card-header">
                    <span className="reunion-date" style={{ textTransform: 'capitalize' }}>
                      {formatDateLong(r.date)}
                    </span>
                    <span className="reunion-badge planifiee">Planifiée</span>
                  </div>
                  {r.resume && (
                    <p className="reunion-resume">{r.resume}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Réunions terminées */}
        {reunionsTerminees.length > 0 && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-display, "Playfair Display", serif)', fontSize: 15, fontWeight: 700, color: '#3D2F5E', marginBottom: 10 }}>
              Historique
            </h3>
            <div className="reunions-liste">
              {reunionsTerminees.map(r => (
                <div
                  key={r.id}
                  className="famille-card reunion-card"
                  onClick={() => setReunionDetailId(r.id)}
                >
                  <div className="reunion-card-header">
                    <span className="reunion-date" style={{ textTransform: 'capitalize' }}>
                      {formatDateLong(r.date)}
                    </span>
                    <span className="reunion-badge terminee">✅ Terminée</span>
                  </div>
                  {r.resume && (
                    <p className="reunion-resume">{r.resume}</p>
                  )}
                  {(r.humeursSaisies ?? []).length > 0 && (
                    <div className="reunion-humeurs">
                      {(r.humeursSaisies ?? []).slice(0, 4).map((_, i) => (
                        <span key={i} className="reunion-humeur-dot">😊</span>
                      ))}
                      <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>
                        {r.humeursSaisies!.length} humeur{r.humeursSaisies!.length > 1 ? 's' : ''} saisie{r.humeursSaisies!.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* État vide total */}
        {(reunions ?? []).length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#5B4A82', marginBottom: 6 }}>
              Aucune réunion encore
            </p>
            <p style={{ fontSize: 14, marginBottom: 20 }}>
              Les réunions famille permettent de partager humeurs, décisions et résumés.
            </p>
            <button
              className="btn btn--primary"
              onClick={() => setFormReunionOuvert(true)}
            >
              Planifier une réunion
            </button>
          </div>
        )}
      </div>

      {/* Drawer Form */}
      <Drawer
        isOpen={formReunionOuvert}
        onClose={() => setFormReunionOuvert(false)}
        title="Planifier une réunion"
      >
        <ReunionForm
          onSave={() => setFormReunionOuvert(false)}
          onCancel={() => setFormReunionOuvert(false)}
        />
      </Drawer>

      {/* Drawer Detail */}
      <ReunionDetail
        reunionId={reunionDetailId}
        onClose={() => setReunionDetailId(null)}
      />
    </>
  );
}
