import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { useSportState } from './useSportState';
import type { SportNavId } from './sportTypes';
import { VueDashboard }    from './views/VueDashboard';
import { VueProgramme }    from './views/VueProgramme';
import { VueSeance }       from './views/VueSeance';
import { VueMensurations } from './views/VueMensurations';
import { VueJournal }      from './views/VueJournal';
import './SectionSport.css';

// ─── 4 onglets essentiels ────────────────────────────────────────────────────
const TABS: { id: SportNavId; label: string }[] = [
  { id: 'dashboard',    label: 'Accueil'      },
  { id: 'programme',    label: 'Programme'    },
  { id: 'journal',      label: 'Journal'      },
  { id: 'mensurations', label: 'Suivi'        },
];

export function SectionSport() {
  const [activeNav, setActiveNav] = useState<SportNavId>('dashboard');
  const [seanceJourId, setSeanceJourId] = useState<number | null>(null);
  const { state, update, setState } = useSportState();
  const sessions = useLiveQuery(
    () => db.sportSessions.orderBy('date').reverse().limit(50).toArray(),
    []
  ) ?? [];

  function startSeance(jourId: number) {
    setSeanceJourId(jourId);
    setActiveNav('seance');
  }

  function finishSeance() {
    setSeanceJourId(null);
    setActiveNav('dashboard');
  }

  const sharedProps = { state, update, setState, sessions };

  const renderView = () => {
    switch (activeNav) {
      case 'dashboard':    return <VueDashboard {...sharedProps} onNav={setActiveNav} onStartSeance={startSeance} />;
      case 'programme':    return <VueProgramme {...sharedProps} onStartSeance={startSeance} />;
      case 'seance':       return seanceJourId !== null
                             ? <VueSeance jourId={seanceJourId} onFinish={finishSeance} onCancel={() => setActiveNav('programme')} />
                             : <VueProgramme {...sharedProps} onStartSeance={startSeance} />;
      case 'journal':      return <VueJournal {...sharedProps} />;
      case 'mensurations': return <VueMensurations {...sharedProps} />;
      default:             return null;
    }
  };

  // Pendant une séance, pas de barre de tabs
  const showTabs = activeNav !== 'seance';

  return (
    <div className="sport-section">
      {showTabs && (
        <nav className="sport-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`sport-tab${activeNav === tab.id ? ' sport-tab--active' : ''}`}
              onClick={() => setActiveNav(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      <div className="sport-view">
        {renderView()}
      </div>
    </div>
  );
}
