/**
 * FAMILY OS — MenusModule
 * Orchestrateur de l'onglet Menus dans le module Cuisine.
 * Gère la navigation interne : liste → détail.
 */
import { useState } from 'react';
import { MenusList } from './MenusList';
import { MenuDetail } from './MenuDetail';

type MenusView =
  | { type: 'list' }
  | { type: 'detail'; menuId: string };

export function MenusModule() {
  const [view, setView] = useState<MenusView>({ type: 'list' });

  if (view.type === 'detail') {
    return (
      <MenuDetail
        menuId={view.menuId}
        onBack={() => setView({ type: 'list' })}
      />
    );
  }

  return (
    <MenusList
      onSelectMenu={(menuId) => setView({ type: 'detail', menuId })}
    />
  );
}
