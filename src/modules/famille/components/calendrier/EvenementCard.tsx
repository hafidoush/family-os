/**
 * FAMILY OS — EvenementCard
 * Carte d'un événement dans la liste du jour
 */

import type { ReactNode } from 'react';
import type { Evenement } from '@shared/types/entities';
import type { Membre } from '@shared/types/modules';
import { formatTime } from '@shared/utils/formatDate';
import { IconCalendar } from '@shared/components/ui/Icon/Icon';

interface Props {
  evenement: Evenement;
  membres?: Membre[];
  onClick: () => void;
}

const TYPE_ICONS: Record<string, ReactNode> = {
  rendez_vous: <IconCalendar size={18} />,
  anniversaire: '🎂',
  sortie: '🎡',
  evenement: '🎉',
  rappel: '⏰',
  medical: '🏥',
};

const MEMBRE_COLORS: Record<string, string> = {
  'membre-maman': '#A78BFA',
  'membre-papa': '#60A5FA',
  'membre-manel': '#F9A8D4',
  'membre-nawfel': '#86EFAC',
};

export default function EvenementCard({ evenement, membres, onClick }: Props) {
  const icon = TYPE_ICONS[evenement.type] ?? '📌';
  const heure = evenement.journeeEntiere
    ? 'Journée entière'
    : formatTime(evenement.dateDebut as unknown as string | Date);

  const participantsMembres = (evenement.personnesAssociees ?? [])
    .map(id => membres?.find(m => m.id === id))
    .filter(Boolean) as Membre[];

  return (
    <div
      className={`evenement-card type-${evenement.type}`}
      onClick={onClick}
    >
      <span className="evenement-icon">{icon}</span>
      <div className="evenement-body">
        <p className="evenement-titre">{evenement.titre}</p>
        <div className="evenement-meta">
          <span className="evenement-heure">{heure}</span>
          {evenement.lieu && (
            <span className="evenement-lieu">📍 {evenement.lieu}</span>
          )}
        </div>
        {participantsMembres.length > 0 && (
          <div className="evenement-membres">
            {participantsMembres.map(m => (
              <div
                key={m.id}
                className="membre-dot"
                style={{ backgroundColor: MEMBRE_COLORS[m.id] ?? '#C9B8E8' }}
                title={m.prenom}
              >
                {m.prenom.charAt(0)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
