/**
 * FAMILY OS — Module Famille
 * Orchestrateur principal · Onglets : Calendrier · Réunions · Souvenirs
 *
 * Phase 5 — Architecture conforme au doc de passation
 */

import './styles/famille.css';
import { useFamilleStore } from './stores/familleStore';
import MembresModule from './components/membres/MembresModule';
import ReunionsModule from './components/reunions/ReunionsModule';
import SouvenirModule from './components/souvenirs/SouvenirModule';
import type { OngletFamille } from './types/familleTypes';

interface Tab {
  id: OngletFamille;
  label: string;
}

const TABS: Tab[] = [
  { id: 'membres',  label: 'Membres'  },
  { id: 'reunions', label: 'Réunions' },
  { id: 'souvenirs', label: 'Souvenirs' },
];

export default function FamilleModule() {
  const { ongletActif, setOngletActif } = useFamilleStore();

  return (
    <div className="famille-module" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation onglets */}
      <nav className="famille-tabs" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`famille-tab${ongletActif === tab.id ? ' active' : ''}`}
            role="tab"
            aria-selected={ongletActif === tab.id}
            onClick={() => setOngletActif(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Contenu */}
      <div className="famille-content" role="tabpanel">
        {ongletActif === 'membres'  && <MembresModule />}
        {ongletActif === 'reunions' && <ReunionsModule />}
        {ongletActif === 'souvenirs' && <SouvenirModule />}
      </div>
    </div>
  );
}

// Named export pour compatibilité router
export { FamilleModule };
