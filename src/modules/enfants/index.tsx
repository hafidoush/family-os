import React, { useEffect } from 'react';
import './enfants.css';
import './enfants-forms.css';
import './enfants-religion.css';
import './enfants-planning.css';

import { useEnfants } from './hooks/useEnfants';
import { useEnfantsStore } from './stores/enfantsStore';
// navigationStore depuis shared — connexion A-31
import { useNavigationStore } from '../../shared/stores/navigationStore';

import { EnfantsTabs } from './components/EnfantsTabs';
import { SectionPlanning } from './components/SectionPlanning';
import { SectionCompetences } from './components/SectionCompetences';
import { SectionReligion } from './components/SectionReligion';
import { CatalogueActivites } from './components/CatalogueActivites';
import SortiesModule from '../sorties';
import { SectionProgrammes } from './programmes/components/SectionProgrammes';

export default function EnfantsModule() {
  const { activeSection, activeEnfantId, initActiveEnfant } = useEnfantsStore();
  const { setActiveModule, setActiveContext } = useNavigationStore();

  // Sélectionner dynamiquement le premier enfant actif si aucun n'est encore choisi
  useEffect(() => { initActiveEnfant(); }, []);

  // Signaler au navigationStore qu'on est dans le module Enfants
  useEffect(() => {
    setActiveModule('enfants');
    return () => {
      setActiveContext({});
    };
  }, [setActiveModule, setActiveContext]);

  // Mettre à jour le contexte quand l'enfant actif change
  useEffect(() => {
    if (activeEnfantId) {
      setActiveContext({ enfantId: activeEnfantId });
    }
  }, [activeEnfantId, setActiveContext]);

  const { isLoading, membres } = useEnfants();
  const membreActif = membres.find(m => m.id === activeEnfantId);
  const enfantColor = membreActif?.couleur ?? '#A78BFA';

  const style = {
    '--enfant-active-color': enfantColor,
    '--enfant-active-shadow': `${enfantColor}40`,
  } as React.CSSProperties;

  if (isLoading) {
    return (
      <div className="enfants-page" style={style}>
        <div className="enfants-header">
          <p className="enfants-header__title">Mes enfants</p>
          <div className="enfants-skeleton" style={{ height: 40, width: 200 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="enfants-page" style={style}>
      {/* Tabs : Activités / Compétences / Religion / Catalogue */}
      <EnfantsTabs />

      {/* Section active */}
      {activeSection === 'activites'   && <SectionPlanning />}
      {activeSection === 'competences' && <SectionCompetences />}
      {activeSection === 'religion'    && <SectionReligion />}
      {activeSection === 'catalogue'   && <CatalogueActivites />}
      {activeSection === 'programmes'  && <SectionProgrammes />}
    </div>
  );
}
