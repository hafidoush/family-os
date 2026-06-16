/**
 * FAMILY OS — Module Calendrier (catégorie principale)
 * Réutilise CalendrierModule et le store famille pour la persistance d'état.
 */

import CalendrierModule from '../famille/components/calendrier/CalendrierModule';
import '../famille/styles/famille.css';

export default function CalendrierPage() {
  return (
    <div className="famille-module" style={{ minHeight: '100%', padding: '0 16px' }}>
      <CalendrierModule />
    </div>
  );
}
