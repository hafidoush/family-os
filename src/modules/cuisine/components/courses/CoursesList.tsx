import { useState } from 'react';
import { useCoursesByCategorie } from '../../hooks/useCoursesByCategorie';
import { useCourses } from '../../hooks/useCourses';
import { CoursesItemRow } from './CoursesItem';
import { CoursesActions } from './CoursesActions';
import { CoursesForm } from './CoursesForm';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import { genererCoursesDepuisMenus } from '../../../../core/services/genererCoursesService';
import { PartageSheet } from '../../../../modules/partage/PartageSheet';
import { IconStarShine, IconInboxOut } from '@shared/components/ui/Icon/Icon';
import './CoursesList.css';

const CATEGORIE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  'Fruits & Légumes': { icon: '🥦', color: '#16A34A', bg: 'rgba(22, 163, 74, 0.1)' },
  'Viande & Charcuterie': { icon: '🥩', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.1)' },
  'Poissons': { icon: '🐟', color: '#0284C7', bg: 'rgba(2, 132, 199, 0.1)' },
  'Produits frais': { icon: '🥛', color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.1)' },
  'Surgelés': { icon: '🧊', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.1)' },
  'Épicerie salée': { icon: '🫙', color: '#B45309', bg: 'rgba(180, 83, 9, 0.1)' },
  'Épicerie sucrée': { icon: '🍯', color: '#D97706', bg: 'rgba(217, 119, 6, 0.1)' },
  'Épices': { icon: '🌿', color: '#65A30D', bg: 'rgba(101, 163, 13, 0.1)' },
  'Conserves': { icon: '🥫', color: '#92400E', bg: 'rgba(146, 64, 14, 0.1)' },
  'Boissons': { icon: '🧃', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)' },
  'Bio': { icon: '🌱', color: '#15803D', bg: 'rgba(21, 128, 61, 0.1)' },
  'Hygiène': { icon: '🧴', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.1)' },
  'Entretien': { icon: '🧹', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.1)' },
  'Asiatique': { icon: '🍜', color: '#EA580C', bg: 'rgba(234, 88, 12, 0.1)' },
  'Bébé': { icon: '🍼', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.1)' },
};

const DEFAULT_CONFIG = { icon: '🛒', color: '#7C6AF7', bg: 'rgba(124, 106, 247, 0.1)' };

function getCategorieConfig(nom: string) {
  return CATEGORIE_CONFIG[nom] ?? DEFAULT_CONFIG;
}

export function CoursesList() {
  const { groupes, isLoading } = useCoursesByCategorie();
  const { nbCochés, nbTotal } = useCourses();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [partageOpen, setPartageOpen] = useState(false);

  const handleGenererCourses = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenMessage(null);
    try {
      const result = await genererCoursesDepuisMenus();
      setGenMessage(`🛒 ${result.message}`);
      setTimeout(() => setGenMessage(null), 5000);
    } catch {
      setGenMessage('Erreur lors de la génération — vérifiez vos menus');
      setTimeout(() => setGenMessage(null), 4000);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="courses-list courses-list--loading">
        <div className="courses-list__skeleton" />
        <div className="courses-list__skeleton courses-list__skeleton--sm" />
        <div className="courses-list__skeleton" />
      </div>
    );
  }

  return (
    <div className="courses-list">
      {/* Header */}
      <div className="courses-list__header">
        <div className="courses-list__title-row">
          <h2 className="courses-list__title">Courses</h2>
          {nbTotal > 0 && (
            <button
              className="courses-list__share-btn"
              onClick={() => setPartageOpen(true)}
              title="Partager la liste"
            >
              <IconInboxOut size={18} />
            </button>
          )}
        </div>

        {nbTotal > 0 && (
          <div className="courses-list__progress-card">
            <div className="courses-list__progress-text">
              <span className="courses-list__compteur-val">{nbCochés}</span>
              <span className="courses-list__compteur-sep">/</span>
              <span className="courses-list__compteur-total">{nbTotal}</span>
              <span className="courses-list__compteur-label"> article{nbTotal > 1 ? 's' : ''}</span>
            </div>
            <div className="courses-list__progress">
              <div
                className="courses-list__progress-bar"
                style={{ width: `${(nbCochés / nbTotal) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bandeau génération depuis menus */}
      <div className="courses-list__gen-bar">
        <button
          className="courses-list__gen-btn"
          onClick={handleGenererCourses}
          disabled={isGenerating}
        >
          {isGenerating ? '…' : <><IconStarShine size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Générer depuis les menus</>}
        </button>
        {genMessage && (
          <span className="courses-list__gen-msg">{genMessage}</span>
        )}
      </div>

      {/* Liste vide */}
      {nbTotal === 0 && (
        <EmptyState
          icon="🛒"
          title="Liste vide"
          description="Ajoutez des articles manuellement ou générez la liste depuis vos menus."
          action={{ label: 'Ajouter un article', onClick: () => setIsFormOpen(true) }}
        />
      )}

      {/* Groupes */}
      <div className="courses-list__groupes">
        {groupes.map(groupe => {
          const key = groupe.categorie?.id ?? 'sans-categorie';
          const isCollapsed = collapsedGroups.has(key);
          const allDone = groupe.items.length > 0 && groupe.nbCochés === groupe.items.length;

          const config = getCategorieConfig(groupe.categorie?.nom ?? '');

          return (
            <div
              key={key}
              className={`courses-groupe ${allDone ? 'courses-groupe--done' : ''}`}
            >
              {/* En-tête de groupe */}
              <button
                className="courses-groupe__header"
                onClick={() => toggleGroup(key)}
                aria-expanded={!isCollapsed}
              >
                <span
                  className="courses-groupe__icon"
                  style={{ background: config.bg, color: config.color }}
                >
                  {groupe.categorie ? getCategorieConfig(groupe.categorie.nom).icon : '🛒'}
                </span>
                <span className="courses-groupe__nom">
                  {groupe.categorie?.nom ?? 'Sans catégorie'}
                </span>
                <span
                  className={`courses-groupe__count ${allDone ? 'courses-groupe__count--done' : ''}`}
                  style={allDone ? undefined : { color: config.color, background: config.bg }}
                >
                  {allDone ? '✓' : `${groupe.nbCochés}/${groupe.items.length}`}
                </span>
                <span className={`courses-groupe__chevron ${isCollapsed ? 'courses-groupe__chevron--collapsed' : ''}`}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>

              {/* Items */}
              {!isCollapsed && (
                <div className="courses-groupe__items">
                  {groupe.items.map(item => (
                    <CoursesItemRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions sticky en bas */}
      <CoursesActions
        nbCochés={nbCochés}
        onAddManuel={() => setIsFormOpen(true)}
      />

      {/* Drawer ajout */}
      <CoursesForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />

      {/* Partage avec Élies */}
      {partageOpen && (
        <PartageSheet
          titre="Liste de courses"
          items={groupes.flatMap((g, gi) =>
            g.items
              .filter(i => !i.coche)
              .map((item, ii) => ({
                label: (item as any).produit?.nom ?? (item as any).nom ?? 'Article',
                ordre: gi * 100 + ii,
              }))
          )}
          onClose={() => setPartageOpen(false)}
        />
      )}
    </div>
  );
}
