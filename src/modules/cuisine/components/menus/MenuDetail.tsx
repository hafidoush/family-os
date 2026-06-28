/**
 * FAMILY OS — MenuDetail
 * Vue détail d'un menu de semaine.
 * Affiche deux sections :
 *   1. Recettes libres (sans jour assigné)
 *   2. Recettes par jour (si certaines ont un jour)
 */
import { useState, useEffect, useCallback } from 'react';
import { useMenuDetail } from '../../hooks/useMenuDetail';
import { MenuService } from '../../services/MenuService';
import { IconCalendar, IconStarShine, IconCart } from '@shared/components/ui/Icon/Icon';
import { MenuSlotItem } from './MenuSlotItem';
import { MenuSlotForm } from './MenuSlotForm';
import { IngredientsPickerSheet } from '../courses/IngredientsPickerSheet';
import { genererMenusIA } from '../../../../core/ai/genererMenusService';
import { hasOpenAIKey } from '../../../../core/ai/openaiService';
import { useRecettes, useCategoriesRecettes } from '../../hooks/useRecettes';
import { RecetteCard } from '../recettes/RecetteCard';
import type { JourMenu } from '@shared/types';
import './MenuDetail.css';

const JOURS: JourMenu[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOURS_LABELS: Record<JourMenu, string> = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi',
  jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
};

function formatSemaine(dateDebut: string, dateFin?: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const debut = new Date(dateDebut + 'T12:00:00');
  if (dateFin) {
    const fin = new Date(dateFin + 'T12:00:00');
    return `${debut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${fin.toLocaleDateString('fr-FR', opts)}`;
  }
  return debut.toLocaleDateString('fr-FR', opts);
}

interface MenuDetailProps {
  menuId: string;
  onBack: () => void;
}

// ─── Sélecteur de recettes (overlay plein écran) ──────────────────────────────

function RecettesSelecteur({ menuId, recettesDejaIds, onClose }: {
  menuId: string
  recettesDejaIds: Set<string>
  onClose: () => void
}) {
  const [filtreAProgrammer, setFiltreAProgrammer] = useState(true)
  const [ajoutees, setAjoutees] = useState<Set<string>>(new Set())

  const recettes = useRecettes({ aProgrammerSeulement: filtreAProgrammer })
  const categories = useCategoriesRecettes()
  const categoriesMap = new Map(categories?.map(c => [c.id, c]))

  const handleSelect = useCallback(async (recetteId: string) => {
    try {
      await MenuService.addSlot({ menuId, recetteId })
      setAjoutees(prev => new Set(prev).add(recetteId))
    } catch { /* silencieux */ }
  }, [menuId])

  // Ferme avec Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="recettes-selecteur__overlay">
      <div className="recettes-selecteur__header">
        <button className="recettes-selecteur__close" onClick={onClose}>✕</button>
        <h2 className="recettes-selecteur__title">Ajouter des recettes</h2>
        <div className="recettes-selecteur__toggle">
          <button
            className={`recettes-selecteur__toggle-btn${filtreAProgrammer ? ' recettes-selecteur__toggle-btn--active' : ''}`}
            onClick={() => setFiltreAProgrammer(true)}
          >
            📥 À programmer
          </button>
          <button
            className={`recettes-selecteur__toggle-btn${!filtreAProgrammer ? ' recettes-selecteur__toggle-btn--active' : ''}`}
            onClick={() => setFiltreAProgrammer(false)}
          >
            Toutes
          </button>
        </div>
      </div>

      <div className="recettes-selecteur__grid">
        {!recettes || recettes.length === 0 ? (
          <div className="recettes-selecteur__empty">
            {filtreAProgrammer
              ? 'Aucune recette dans ta liste. Ajoute des recettes avec 📥 depuis la bibliothèque.'
              : 'Aucune recette.'}
          </div>
        ) : recettes.map(r => (
          <RecetteCard
            key={r.id}
            recette={r}
            categorie={categoriesMap.get(r.categorie)}
            onClick={() => {}}
            selectMode
            alreadyAdded={recettesDejaIds.has(r.id) || ajoutees.has(r.id)}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  )
}

// ─── MenuDetail ───────────────────────────────────────────────────────────────

export function MenuDetail({ menuId, onBack }: MenuDetailProps) {
  const data = useMenuDetail(menuId);
  const [showForm, setShowForm] = useState(false);
  const [showSelecteur, setShowSelecteur] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showIngredientsPicker, setShowIngredientsPicker] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [assignerJours, setAssignerJours] = useState(true);
  const [intentionMenuSemaine, setIntentionMenuSemaine] = useState('');
  const [showIntention, setShowIntention] = useState(false);

  if (data === undefined) {
    return (
      <div className="menu-detail">
        <div className="menu-detail__skeleton" />
        <div className="menu-detail__skeleton" />
        <div className="menu-detail__skeleton" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="menu-detail menu-detail--empty">
        <p>Menu introuvable.</p>
        <button onClick={onBack}>Retour</button>
      </div>
    );
  }

  const { menu, slotsLibres, slotsParJour } = data;

  // Y a-t-il au moins un slot avec un jour assigné ?
  const hasJoursAssignes = JOURS.some((j) => slotsParJour[j].length > 0);
  const totalSlots = data.tousLesSlots.length;

  const handleValider = async () => {
    setIsValidating(true);
    try {
      if (menu.valide) {
        await MenuService.invalidateMenu(menuId);
      } else {
        await MenuService.validateMenu(menuId);
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenererIA = async () => {
    if (isGenerating) return;
    if (!hasOpenAIKey()) {
      setGenMessage('Configurez une clé OpenAI dans Paramètres > IA pour utiliser cette fonction');
      setTimeout(() => setGenMessage(null), 5000);
      return;
    }
    setIsGenerating(true);
    setGenMessage(null);
    try {
      const result = await genererMenusIA(menuId, 4, assignerJours, intentionMenuSemaine.trim() || undefined);
      setGenMessage(`✦ ${result.message}`);
      setTimeout(() => setGenMessage(null), 5000);
    } catch (err: unknown) {
      const openaiError = (err as { openaiError?: string }).openaiError;
      if (openaiError === 'quota') setGenMessage('Quota IA dépassé — réessayez dans quelques minutes');
      else setGenMessage('Erreur IA — vérifiez votre clé OpenAI dans les paramètres');
      setTimeout(() => setGenMessage(null), 5000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveSlot = async (slotId: string) => {
    await MenuService.removeSlot(slotId);
  };

  const handleToggleRealise = async (slotId: string, statut: 'prevue' | 'realisee') => {
    await MenuService.updateSlot({
      slotId,
      statut: statut === 'realisee' ? 'prevue' : 'realisee',
    });
  };

  return (
    <div className="menu-detail">
      {/* En-tête */}
      <div className="menu-detail__header">
        <div className="menu-detail__semaine">{formatSemaine(menu.dateDebut, menu.dateFin)}</div>
        <div className="menu-detail__actions">
          <div className="menu-detail__gen-toggle" title="Mode de génération">
            <button
              className={`menu-detail__gen-toggle-btn ${assignerJours ? 'menu-detail__gen-toggle-btn--active' : ''}`}
              onClick={() => setAssignerJours(true)}
            >
              <IconCalendar size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />Par jour
            </button>
            <button
              className={`menu-detail__gen-toggle-btn ${!assignerJours ? 'menu-detail__gen-toggle-btn--active' : ''}`}
              onClick={() => setAssignerJours(false)}
            >
              Libre
            </button>
          </div>
          <button
            className="menu-detail__btn-ia"
            onClick={() => setShowIntention(v => !v)}
            disabled={isGenerating}
            title={hasOpenAIKey() ? 'Générer les repas avec l\'IA' : 'Configurez une clé OpenAI dans Paramètres > IA'}
          >
            {isGenerating ? '…' : <><IconStarShine size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Générer</>}
          </button>
          <button
            className="menu-detail__btn-valider"
            onClick={() => setShowIngredientsPicker(true)}
            disabled={totalSlots === 0}
          >
            <IconCart size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Ingrédients
          </button>
        </div>
      </div>

      {/* Intention semaine — visible uniquement après clic sur "Générer" */}
      {showIntention && (
        <div className="menu-detail__intention">
          <textarea
            className="menu-detail__intention-input"
            value={intentionMenuSemaine}
            onChange={(e) => setIntentionMenuSemaine(e.target.value)}
            placeholder="Décris ce que tu veux pour cette semaine… ex : plats équilibrés et légers, ou un mélange maghrébin et indien épicé"
            rows={2}
            maxLength={300}
            autoFocus
          />
          <button
            className="menu-detail__btn-ia menu-detail__btn-lancer"
            onClick={() => { setShowIntention(false); handleGenererIA(); }}
            disabled={isGenerating}
          >
            {isGenerating ? '…' : <><IconStarShine size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Lancer</>}
          </button>
        </div>
      )}

      {/* Message confirmation génération IA */}
      {genMessage && (
        <div className="menu-detail__gen-message">
          {genMessage}
        </div>
      )}

      {/* Section recettes libres — masquée si vide */}
      {slotsLibres.length > 0 && (
        <section className="menu-detail__section">
          <div className="menu-detail__section-header">
            <h3 className="menu-detail__section-title">
              🗓 Recettes de la semaine
            </h3>
            <span className="menu-detail__section-count">{slotsLibres.length}</span>
          </div>
          <p className="menu-detail__section-hint">
            Sans jour assigné — vous décidez quand vous les cuisinez
          </p>
          <ul className="menu-detail__slot-list">
            {slotsLibres.map((slot) => (
              <MenuSlotItem
                key={slot.id}
                slot={slot}
                onToggleRealise={() => handleToggleRealise(slot.id, slot.statut ?? 'prevue')}
                onRemove={() => handleRemoveSlot(slot.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Section recettes par jour (affichée seulement si au moins un jour assigné) */}
      {hasJoursAssignes && (
        <section className="menu-detail__section">
          <div className="menu-detail__section-header">
            <h3 className="menu-detail__section-title"><IconCalendar size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Planning par jour</h3>
          </div>
          {JOURS.map((jour) => {
            const slots = slotsParJour[jour];
            if (slots.length === 0) return null;
            return (
              <div key={jour} className="menu-detail__jour">
                <div className="menu-detail__jour-label">{JOURS_LABELS[jour]}</div>
                <ul className="menu-detail__slot-list">
                  {slots.map((slot) => (
                    <MenuSlotItem
                      key={slot.id}
                      slot={slot}
                      showJour={false}
                      onToggleRealise={() => handleToggleRealise(slot.id, slot.statut ?? 'prevue')}
                      onRemove={() => handleRemoveSlot(slot.id)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {/* Boutons ajout */}
      <div className="menu-detail__add-row">
        <button className="menu-detail__add-btn menu-detail__add-btn--select" onClick={() => setShowSelecteur(true)}>
          📥 Ajouter des recettes
        </button>
        <button className="menu-detail__add-btn menu-detail__add-btn--libre" onClick={() => setShowForm(true)}>
          ✏️ Description libre
        </button>
      </div>

      {/* Drawer ajout slot */}
      {showForm && (
        <MenuSlotForm
          menuId={menuId}
          onClose={() => setShowForm(false)}
          recettesDejaUtilisees={new Set(
            data.tousLesSlots.filter((s) => s.recette).map((s) => s.recette as string)
          )}
        />
      )}

      {/* Overlay sélection recettes */}
      {showSelecteur && (
        <RecettesSelecteur
          menuId={menuId}
          recettesDejaIds={new Set(data.tousLesSlots.filter(s => s.recette).map(s => s.recette as string))}
          onClose={() => setShowSelecteur(false)}
        />
      )}

      {showIngredientsPicker && (
        <IngredientsPickerSheet
          menuId={menuId}
          onClose={() => setShowIngredientsPicker(false)}
        />
      )}
    </div>
  );
}
