import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { toISODate } from '../../../shared/utils/formatDate';
import { MenuService as menuService } from '../../cuisine/services/MenuService';
import type { Recette } from '../../../shared/types';
import './WidgetMenu.css';

const REPAS_LABEL: Record<string, string> = {
  petit_dejeuner: 'Petit-déj',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  collation: 'Collation',
};

const JOURS_LABEL: Record<string, string> = {
  lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer',
  jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
};

interface SlotRecette {
  id: string;
  nom: string;
  image?: Blob;
  jour?: string;
  repas?: string;
  recetteId?: string;
  descriptionLibre?: string;
}

function useWeekSlots(): SlotRecette[] | null | undefined {
  return useLiveQuery(async () => {
    const today = new Date();
    const iso = toISODate(today);

    const menusActifs = await db.menus
      .filter((m) =>
        m.dateDebut <= iso &&
        (m.dateFin == null || m.dateFin >= iso) &&
        !m.deletedAt
      )
      .toArray();

    if (!menusActifs.length) return null;

    const menu = menusActifs[0];

    const slots = await db.menuSlots
      .where('menu')
      .equals(menu.id)
      .filter((s) => !s.deletedAt && (!!s.recette || !!s.descriptionLibre))
      .toArray();

    if (!slots.length) return [];

    const recetteIds = [...new Set(slots.map((s) => s.recette).filter(Boolean) as string[])];
    const recettes = recetteIds.length
      ? await db.recettes.where('id').anyOf(recetteIds).toArray()
      : [];
    const recMap = new Map<string, Recette>(recettes.map((r) => [r.id, r]));

    return slots.map((s): SlotRecette => {
      const recette = s.recette ? recMap.get(s.recette) : undefined;
      return {
        id: s.id,
        nom: recette?.nom ?? s.descriptionLibre ?? '—',
        image: recette?.image,
        jour: s.jour,
        repas: s.repas,
        recetteId: s.recette,
      };
    });
  }, []);
}

// ── Image avec fallback ──────────────────────────────────────────────────────

function RecetteImage({ image, nom }: { image?: Blob; nom: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  if (src) return <img src={src} alt={nom} className="wmenu-card__img" />;
  return (
    <div className="wmenu-card__img wmenu-card__img--placeholder">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z"/>
        <line x1="6" y1="1" x2="6" y2="4"/>
        <line x1="10" y1="1" x2="10" y2="4"/>
        <line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    </div>
  );
}

// ── Sheet ingrédients ────────────────────────────────────────────────────────

function IngredientsSheet({ recetteId, nom, onClose }: { recetteId: string; nom: string; onClose: () => void }) {
  const navigate = useNavigate();
  const ingredients = useLiveQuery(async () => {
    return db.recettesIngredients
      .where('recette')
      .equals(recetteId)
      .toArray();
  }, [recetteId]);

  function handleVoirRecette() {
    onClose();
    navigate('/cuisine', { state: { openRecette: recetteId } });
  }

  return (
    <>
      <div className="wmenu-sheet-backdrop" onClick={onClose} />
      <div className="wmenu-sheet" role="dialog">
        <div className="wmenu-sheet__handle" />
        <div className="wmenu-sheet__header">
          <p className="wmenu-sheet__title">{nom}</p>
          <p className="wmenu-sheet__sub">Ingrédients à prévoir</p>
        </div>

        {!ingredients ? (
          <div className="wmenu-sheet__loading">Chargement…</div>
        ) : ingredients.length === 0 ? (
          <div className="wmenu-sheet__empty">Aucun ingrédient renseigné</div>
        ) : (
          <ul className="wmenu-sheet__list">
            {ingredients.map((ing) => (
              <li key={ing.id} className="wmenu-sheet__item">
                <span className="wmenu-sheet__item-dot" />
                <span className="wmenu-sheet__item-nom">{ing.produit}</span>
                {(ing.quantite || ing.unite) && (
                  <span className="wmenu-sheet__item-qty">
                    {ing.quantite} {ing.unite}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <button className="wmenu-sheet__voir-recette" onClick={handleVoirRecette}>
          Voir la recette complète →
        </button>
      </div>
    </>
  );
}

const JOURS_SEMAINE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// ── Widget état vide — cartes fantômes 7 jours ──────────────────────────────

function WidgetMenuEmpty() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const handleAddRecette = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await menuService.createMenu({ dateReference: new Date() });
    } catch { /* silencieux */ } finally {
      setCreating(false);
      navigate('/cuisine');
    }
  };

  return (
    <section className="wmenu-section">
      <div className="wmenu-section__header">
        <h2 className="wmenu-section__title">Menu de la semaine</h2>
        <button className="wmenu-section__voir" onClick={handleAddRecette}>Tout voir</button>
      </div>
      <div className="wmenu-scroll">
        {JOURS_SEMAINE.map((jour) => (
          <div key={jour} className="wmenu-card wmenu-card--empty" onClick={handleAddRecette}>
            <div className="wmenu-card__empty-plus">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="10" y1="4" x2="10" y2="16" />
                <line x1="4" y1="10" x2="16" y2="10" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Widget principal ─────────────────────────────────────────────────────────

export function WidgetMenu() {
  const slots = useWeekSlots();
  const [apercu, setApercu] = useState<SlotRecette | null>(null);

  if (slots === undefined) {
    return (
      <section className="wmenu-section">
        <div className="wmenu-section__header">
          <h2 className="wmenu-section__title">Menu de la semaine</h2>
        </div>
        <div className="wmenu-skeletons">
          {[1, 2, 3].map((i) => <div key={i} className="widget-skeleton wmenu-skel" />)}
        </div>
      </section>
    );
  }

  if (slots === null || slots.length === 0) {
    return <WidgetMenuEmpty />;
  }

  return (
    <>
      <section className="wmenu-section">
        <div className="wmenu-section__header">
          <h2 className="wmenu-section__title">Menu de la semaine</h2>
          <button className="wmenu-section__voir">Tout voir</button>
        </div>

        <div className="wmenu-scroll">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="wmenu-card"
              onClick={() => slot.recetteId && setApercu(slot)}
            >
              <RecetteImage image={slot.image} nom={slot.nom} />
              <div className="wmenu-card__overlay" />
              <div className="wmenu-card__body">
                <p className="wmenu-card__nom">{slot.nom}</p>
                <p className="wmenu-card__sub">
                  {slot.repas ? (REPAS_LABEL[slot.repas] ?? slot.repas) : 'Plat principal'}
                </p>
                {slot.jour && (
                  <span className="wmenu-card__badge">
                    {JOURS_LABEL[slot.jour] ?? slot.jour}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {apercu?.recetteId && (
        <IngredientsSheet
          recetteId={apercu.recetteId}
          nom={apercu.nom}
          onClose={() => setApercu(null)}
        />
      )}
    </>
  );
}
