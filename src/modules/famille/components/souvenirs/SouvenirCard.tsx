/**
 * FAMILY OS — SouvenirCard
 * Carte souvenir dans la grille masonry
 */

import type { Souvenir } from '@shared/types/modules';
import { formatDateLong } from '@shared/utils/formatDate';

interface Props {
  souvenir: Souvenir;
  onClick: () => void;
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

export default function SouvenirCard({ souvenir, onClick }: Props) {
  const type = souvenir.type ?? 'autre';

  return (
    <div className="famille-card souvenir-card" onClick={onClick}>
      <span className={`souvenir-type-badge ${type}`}>
        {TYPE_ICONS[type]} {TYPE_LABELS[type]}
      </span>
      <h4 className="souvenir-titre">{souvenir.titre}</h4>
      <p className="souvenir-date">{formatDateLong(souvenir.date)}</p>
      {souvenir.description && (
        <p className="souvenir-description">{souvenir.description}</p>
      )}
      {(souvenir.tags ?? []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(souvenir.tags ?? []).slice(0, 3).map(tag => (
            <span
              key={tag}
              style={{
                padding: '2px 7px',
                background: 'rgba(201,184,232,0.15)',
                borderRadius: 20,
                fontSize: 10,
                color: '#7C6FA0',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
