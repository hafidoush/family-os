/**
 * FAMILY OS — MenusModule
 * Orchestrateur de l'onglet Menus dans le module Cuisine.
 * Gère la navigation interne : liste → détail.
 */
import { useState } from 'react';
import { MenusList } from './MenusList';
import { MenuDetail } from './MenuDetail';
import { useBackToList } from '@shared/hooks/useBackToList';

type MenusView =
  | { type: 'list' }
  | { type: 'detail'; menuId: string };

export function MenusModule() {
  const [view, setView] = useState<MenusView>({ type: 'list' });
  const goToList = () => setView({ type: 'list' });
  useBackToList(view.type === 'detail', goToList);

  if (view.type === 'detail') {
    return (
      <MenuDetail
        menuId={view.menuId}
        onBack={() => window.history.back()}
      />
    );
  }

  return (
    <MenusList
      onSelectMenu={(menuId) => setView({ type: 'detail', menuId })}
    />
  );
}
