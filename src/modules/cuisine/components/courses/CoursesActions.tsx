import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../core/db/database';
import { CoursesService } from '../../services/CoursesService';
import { IngredientsPickerSheet } from './IngredientsPickerSheet';
import './CoursesActions.css';

interface Props {
  nbCochés: number;
  onAddManuel: () => void;
}

export function CoursesActions({ nbCochés, onAddManuel }: Props) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [showMenuPicker, setShowMenuPicker] = useState(false);
  const [pickerMenuId, setPickerMenuId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const menusValides = useLiveQuery(
    () => db.menus
      .filter(m => !m.archive && !m.deletedAt)
      .reverse()
      .sortBy('updatedAt'),
    [],
    []
  );

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleOuvrirPicker = (menuId: string) => {
    setShowMenuPicker(false);
    setPickerMenuId(menuId);
  };

  const handleArchiverCoches = async () => {
    setIsArchiving(true);
    try {
      const count = await CoursesService.archiverCoches();
      showFeedback(`${count} article${count > 1 ? 's' : ''} archivé${count > 1 ? 's' : ''}`);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <>
    <div className="courses-actions">
      {feedback && (
        <div className="courses-actions__feedback" role="status">
          {feedback}
        </div>
      )}

      <div className="courses-actions__bar">
        {/* Ajouter */}
        <button className="courses-actions__btn-primary" onClick={onAddManuel}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          Ajouter
        </button>

        {/* Depuis un menu */}
        <div className="courses-actions__menu-picker-wrapper">
          <button
            className="courses-actions__btn-secondary"
            onClick={() => setShowMenuPicker(v => !v)}
            disabled={(menusValides?.length ?? 0) === 0}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 4h12M2 8h8M2 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Depuis un menu
          </button>

          {showMenuPicker && (menusValides?.length ?? 0) > 0 && (
            <div className="courses-actions__menu-dropdown">
              {menusValides!.map(menu => (
                <button
                  key={menu.id}
                  className="courses-actions__menu-option"
                  onClick={() => handleOuvrirPicker(menu.id)}
                >
                  <span className="courses-actions__menu-name">{menu.nom}</span>
                  {menu.dateDebut && (
                    <span className="courses-actions__menu-date">
                      Semaine du {new Date(menu.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Archiver cochés */}
        {nbCochés > 0 && (
          <button
            className="courses-actions__btn-archive"
            onClick={handleArchiverCoches}
            disabled={isArchiving}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 5h12v9a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M1 2h14v3H1V2z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M6 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Archiver ({nbCochés})
          </button>
        )}
      </div>
    </div>

    {/* Sheet de sélection des ingrédients */}
    {pickerMenuId && (
      <IngredientsPickerSheet
        menuId={pickerMenuId}
        onClose={() => setPickerMenuId(null)}
      />
    )}
    </>
  );
}
