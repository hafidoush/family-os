import { useState, useRef } from 'react';
import { CoursesService } from '../../services/CoursesService';
import type { CoursesItem as CoursesItemType } from '../../../../shared/types';
import './CoursesItem.css';

interface Props {
  item: CoursesItemType;
}

const SWIPE_THRESHOLD = 80;

export function CoursesItemRow({ item }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);

  const handleToggle = async () => {
    await CoursesService.toggleCoche(item.id);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setTimeout(async () => {
      await CoursesService.deleteItem(item.id);
    }, 320);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - touchStartX.current;
    if (delta < 0) {
      setSwipeX(Math.max(delta, -SWIPE_THRESHOLD * 1.6));
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX < -SWIPE_THRESHOLD) {
      handleDelete();
    } else {
      setSwipeX(0);
    }
  };

  const swipeProgress = Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1);

  return (
    <div className={`courses-item-wrapper ${isDeleting ? 'courses-item-wrapper--deleting' : ''}`}>
      <div
        className="courses-item__delete-zone"
        style={{ opacity: swipeProgress }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div
        className={`courses-item ${item.coche ? 'courses-item--coche' : ''}`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          className="courses-item__checkbox"
          onClick={handleToggle}
          aria-label={item.coche ? 'Décocher' : 'Cocher'}
          aria-pressed={item.coche}
        >
          <svg
            className="courses-item__check-svg"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M2.5 7L5.5 10L11.5 4"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="courses-item__content">
          <span className="courses-item__nom">{item.nom}</span>
          {(item.quantite || item.unite) && (
            <span className="courses-item__quantite">
              {item.quantite && <span>{item.quantite}</span>}
              {item.unite && <span> {item.unite}</span>}
            </span>
          )}
          {item.notes && (
            <span className="courses-item__notes">{item.notes}</span>
          )}
          {item.recetteId && (
            <span className="courses-item__origine">Depuis un menu</span>
          )}
        </div>

        <button
          className="courses-item__delete"
          onClick={handleDelete}
          aria-label="Supprimer"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
