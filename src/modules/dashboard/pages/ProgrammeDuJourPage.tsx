import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTodayEvents } from '../hooks/useTodayEvents';
import type { TypeEvenement } from '../../../shared/types';
import { IconCalendar } from '@shared/components/ui/Icon/Icon';
import './ProgrammeDuJourPage.css';

const TYPE_CONFIG: Record<TypeEvenement, { label: string; emoji: ReactNode }> = {
  rendez_vous: { label: 'Rendez-vous', emoji: <IconCalendar size={18} /> },
  anniversaire: { label: 'Anniversaire', emoji: '🎂' },
  sortie:       { label: 'Sortie',       emoji: '🗺' },
  evenement:    { label: 'Événement',    emoji: '✨' },
  rappel:       { label: 'Rappel',       emoji: '🔔' },
  medical:      { label: 'Médical',      emoji: '🏥' },
};

function formatHeure(date: Date): string {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function ProgrammeDuJourPage() {
  const navigate = useNavigate();
  const evenements = useTodayEvents() ?? [];

  return (
    <div className="programme-jour-page">
      <header className="programme-jour-page__header">
        <button className="programme-jour-page__back" onClick={() => navigate(-1)} aria-label="Retour">←</button>
        <h1 className="programme-jour-page__title">Programme du jour</h1>
      </header>

      <div className="programme-jour-page__content">
        {evenements.length === 0 ? (
          <div className="programme-jour-page__empty">
            <span className="programme-jour-page__empty-icon"><IconCalendar size={48} /></span>
            <p className="programme-jour-page__empty-text">
              Aucun événement prévu aujourd'hui.<br />
              La journée est libre.
            </p>
          </div>
        ) : (
          evenements.map(evt => {
            const cfg = TYPE_CONFIG[evt.type] ?? { label: evt.type, emoji: '📌' };
            return (
              <div key={evt.id} className="event-item">
                <span className="event-item__icon">{cfg.emoji}</span>
                <div className="event-item__info">
                  <p className="event-item__titre">{evt.titre}</p>
                  <div className="event-item__meta">
                    <span className="event-item__type">{cfg.label}</span>
                    {!evt.journeeEntiere && evt.dateDebut && (
                      <span className="event-item__heure">{formatHeure(new Date(evt.dateDebut))}</span>
                    )}
                    {evt.journeeEntiere && (
                      <span className="event-item__heure">Journée entière</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
