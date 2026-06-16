import { useEnfantsStore } from '../stores/enfantsStore';
import type { Membre, Enfant } from '../../../shared/types';

interface EnfantSelectorProps {
  membres: Membre[];
  enfants: Enfant[];
}

function getAge(dateNaissance?: string | Date): string {
  if (!dateNaissance) return '';
  const today = new Date();
  const birth = new Date(dateNaissance);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} ans`;
}

function getSlug(membreId: string): 'manel' | 'nawfel' {
  return membreId === 'membre-manel' ? 'manel' : 'nawfel';
}

export function EnfantSelector({ membres, enfants }: EnfantSelectorProps) {
  const { activeEnfantId, setActiveEnfant } = useEnfantsStore();

  return (
    <div className="enfants-header">
      <p className="enfants-header__title">Mes enfants</p>
      <div className="enfants-selector">
        {membres.map((membre) => {
          const slug = getSlug(membre.id);
          const enfant = enfants.find((e) => e.id === membre.id);
          const isActive = activeEnfantId === membre.id;

          return (
            <button
              key={membre.id}
              className={[
                'enfants-selector__card',
                `enfants-selector__card--${slug}`,
                isActive ? 'enfants-selector__card--active' : '',
              ].join(' ')}
              onClick={() => setActiveEnfant(membre.id)}
              aria-pressed={isActive}
            >
              <div className={`enfants-selector__avatar enfants-selector__avatar--${slug}`}>
                {membre.prenom?.[0] ?? '?'}
              </div>
              <div className="enfants-selector__info">
                <span className="enfants-selector__name">{membre.prenom}</span>
                {enfant?.dateNaissance && (
                  <span className="enfants-selector__age">
                    {getAge(enfant.dateNaissance)}
                  </span>
                )}
              </div>
              <div className="enfants-selector__indicator" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
