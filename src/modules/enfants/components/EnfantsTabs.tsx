import React from 'react';
import { useEnfantsStore } from '../stores/enfantsStore';
import { ENFANT_TABS } from '../types';
import type { EnfantSection } from '../types';

export function EnfantsTabs() {
  const { activeSection, setActiveSection } = useEnfantsStore();

  return (
    <nav className="enfants-tabs" role="tablist" aria-label="Sections enfants">
      {ENFANT_TABS.map((tab) => {
        const isActive = activeSection === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            className={['enfants-tab', isActive ? 'enfants-tab--active' : ''].join(' ')}
            onClick={() => setActiveSection(tab.id as EnfantSection)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
