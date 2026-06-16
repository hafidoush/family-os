/**
 * FAMILY OS — SearchOverlay
 * Recherche globale — overlay plein écran activé depuis la loupe de navigation.
 *
 * Correction : connecté au searchService (Fuse.js) et au searchStore Zustand.
 * L'overlay s'ouvre/ferme via useSearchStore, et les résultats viennent
 * directement de searchService.query() — plus besoin de passer onSearch en prop.
 *
 * Usage :
 *   <SearchOverlay onSelect={(result) => navigate(result)} />
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchStore } from '../../../stores/searchStore';
import { searchService } from '../../../../core/search/SearchService';
import type { SearchResult as ServiceSearchResult } from '../../../../core/search/SearchService';
import { IconMagnifier } from '../../ui/Icon/Icon';

// ─── Types locaux ─────────────────────────────────────────────────────────────

export type SearchResultType =
  | 'recette'
  | 'produit'
  | 'achat'
  | 'tache'
  | 'note'
  | 'activite'
  | 'competence'
  | 'enfant'
  | 'souvenir';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  titre: string;
  description?: string;
  module: string;
  score?: number;
}

export interface SearchGroup {
  type: SearchResultType;
  label: string;
  results: SearchResult[];
}

// Props simplifiées : onSelect optionnel (navigation automatique par défaut)
export interface SearchOverlayProps {
  onSelect?: (result: SearchResult) => void;
  maxPerGroup?: number;
}

// ─── Mapping SearchService → module de navigation ─────────────────────────────

const TYPE_TO_MODULE: Record<string, string> = {
  tache:        '/dashboard',
  evenement:    '/dashboard',
  produit:      '/cuisine',
  recette:      '/cuisine',
  note:         '/famille',
  activite:     '/enfants',
  souvenir:     '/famille',
  projetMaison: '/maison',
  membre:       '/famille',
};

/** Adapte un SearchResult du service vers le type local de l'overlay */
function adaptResult(r: ServiceSearchResult): SearchResult {
  return {
    id: r.id,
    type: r.type as SearchResultType,
    titre: r.titre,
    module: TYPE_TO_MODULE[r.type] ?? '/dashboard',
    score: r.score,
  };
}

// ─── Config des groupes ───────────────────────────────────────────────────────

const GROUP_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  recette:    { label: 'Recettes',     icon: '🍽️',  color: 'var(--module-cuisine)'  },
  produit:    { label: 'Produits',     icon: '🛒',  color: 'var(--module-cuisine)'  },
  achat:      { label: 'Achats',       icon: '✨',  color: 'var(--module-achats)'   },
  tache:      { label: 'Tâches',       icon: '✓',   color: 'var(--module-dashboard)'},
  note:       { label: 'Notes',        icon: '📝',  color: 'var(--module-famille)'  },
  activite:   { label: 'Activités',    icon: '🎨',  color: 'var(--module-enfants)'  },
  competence: { label: 'Compétences',  icon: '🧠',  color: 'var(--module-enfants)'  },
  enfant:     { label: 'Enfants',      icon: '👧',  color: 'var(--module-enfants)'  },
  souvenir:   { label: 'Souvenirs',    icon: '📸',  color: 'var(--module-famille)'  },
};

const TYPE_ORDER: SearchResultType[] = [
  'tache', 'recette', 'produit', 'activite', 'competence',
  'enfant', 'achat', 'note', 'souvenir',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupResults(results: SearchResult[], maxPerGroup: number): SearchGroup[] {
  const map = new Map<string, SearchResult[]>();
  for (const r of results) {
    const arr = map.get(r.type) ?? [];
    if (arr.length < maxPerGroup) arr.push(r);
    map.set(r.type, arr);
  }
  return TYPE_ORDER
    .filter((t) => map.has(t))
    .map((t) => ({
      type: t,
      label: GROUP_CONFIG[t]?.label ?? t,
      results: map.get(t)!,
    }));
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="search-highlight">{part}</mark> : part
  );
}

function flattenGroups(groups: SearchGroup[]): SearchResult[] {
  return groups.flatMap((g) => g.results);
}

// ─── Icônes ───────────────────────────────────────────────────────────────────

const SearchIcon = () => <IconMagnifier size={20} />;

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg className="search-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);

// ─── Composant principal ──────────────────────────────────────────────────────

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  onSelect,
  maxPerGroup = 4,
}) => {
  // ── Store — source de vérité pour l'état ouvert/fermé ──
  const { isOpen, close } = useSearchStore();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatResults = flattenGroups(groups);

  // ── Animation d'entrée / sortie ──────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const t = setTimeout(() => {
        setMounted(false);
        setQuery('');
        setGroups([]);
        setActiveIndex(-1);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Focus automatique ────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  // ── Raccourci clavier global ⌘K / Ctrl+K ────────────────────────────────
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Le toggle est géré depuis le parent via searchStore.toggle()
      }
      if (e.key === 'Escape' && isOpen) close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  // ── Recherche avec debounce → searchService.query() ─────────────────────
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      setActiveIndex(-1);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!val.trim()) {
        setGroups([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      debounceRef.current = setTimeout(() => {
        try {
          // searchService.query() est synchrone (Fuse.js in-memory)
          const raw = searchService.query(val.trim());
          const adapted = raw.map(adaptResult);
          setGroups(groupResults(adapted, maxPerGroup));
        } catch {
          setGroups([]);
        } finally {
          setLoading(false);
        }
      }, 220);
    },
    [maxPerGroup]
  );

  // ── Navigation clavier ───────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        const result = flatResults[activeIndex];
        if (result) handleSelect(result);
      } else if (e.key === 'Escape') {
        close();
      }
    },
    [flatResults, activeIndex, close] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Scroll de l'item actif dans la vue ──────────────────────────────────
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  // ── Sélection d'un résultat ──────────────────────────────────────────────
  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (onSelect) {
        onSelect(result);
      } else {
        // Navigation par défaut vers le module du résultat
        navigate(result.module);
      }
      close();
    },
    [onSelect, navigate, close]
  );

  const hasResults = groups.length > 0;
  const hasQuery = query.trim().length > 0;

  if (!mounted) return null;

  let globalIndex = -1;

  return (
    <>
      <div
        className={`search-backdrop${visible ? ' search-backdrop--visible' : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      <div
        className={`search-overlay${visible ? ' search-overlay--visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale"
      >
        {/* ── Barre de recherche ── */}
        <div className="search-bar">
          <span className="search-bar__icon" aria-hidden="true">
            <SearchIcon />
          </span>

          <input
            ref={inputRef}
            className="search-bar__input"
            type="search"
            inputMode="search"
            placeholder="Rechercher une recette, tâche, activité…"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
            aria-label="Recherche"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
          />

          {loading && (
            <span className="search-bar__spinner" aria-label="Recherche en cours">
              <SpinnerIcon />
            </span>
          )}

          {hasQuery && !loading && (
            <button
              className="search-bar__clear"
              onClick={() => {
                setQuery('');
                setGroups([]);
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
              aria-label="Effacer la recherche"
              tabIndex={-1}
            >
              <CloseIcon />
            </button>
          )}
        </div>

        {/* ── Séparateur ── */}
        <div className="search-divider" role="separator" />

        {/* ── Résultats ── */}
        <div
          className="search-results"
          ref={listRef}
          id="search-results"
          role="listbox"
          aria-label="Résultats de recherche"
        >
          {!hasQuery && (
            <div className="search-empty">
              <span className="search-empty__icon" aria-hidden="true">✦</span>
              <p className="search-empty__title">Recherche globale</p>
              <p className="search-empty__hint">
                Recettes · Produits · Tâches · Activités · Compétences · Notes · Souvenirs
              </p>
              <p className="search-empty__shortcut">
                <kbd>⌘</kbd><kbd>K</kbd> pour ouvrir · <kbd>↑↓</kbd> pour naviguer · <kbd>↵</kbd> pour sélectionner
              </p>
            </div>
          )}

          {hasQuery && !loading && !hasResults && (
            <div className="search-empty">
              <span className="search-empty__icon" aria-hidden="true">🔍</span>
              <p className="search-empty__title">Aucun résultat</p>
              <p className="search-empty__hint">
                Aucun élément ne correspond à «&nbsp;<strong>{query}</strong>&nbsp;»
              </p>
            </div>
          )}

          {groups.map((group) => {
            const cfg = GROUP_CONFIG[group.type] ?? { label: group.type, icon: '•', color: 'var(--primary)' };
            return (
              <div key={group.type} className="search-group">
                <div className="search-group__header">
                  <span className="search-group__icon" aria-hidden="true">{cfg.icon}</span>
                  <span className="search-group__label" style={{ color: cfg.color }}>
                    {group.label}
                  </span>
                  <span className="search-group__count">{group.results.length}</span>
                </div>

                <ul className="search-group__list" role="presentation">
                  {group.results.map((result) => {
                    globalIndex += 1;
                    const idx = globalIndex;
                    const isActive = activeIndex === idx;

                    return (
                      <li key={result.id} role="presentation">
                        <button
                          id={`search-result-${idx}`}
                          data-index={idx}
                          role="option"
                          aria-selected={isActive}
                          className={`search-result${isActive ? ' search-result--active' : ''}`}
                          style={{ '--result-color': cfg.color } as React.CSSProperties}
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setActiveIndex(idx)}
                        >
                          <span className="search-result__dot" aria-hidden="true" />
                          <span className="search-result__content">
                            <span className="search-result__title">
                              {highlightMatch(result.titre, query)}
                            </span>
                            {result.description && (
                              <span className="search-result__desc">
                                {highlightMatch(result.description, query)}
                              </span>
                            )}
                          </span>
                          <span className="search-result__arrow" aria-hidden="true">
                            <ArrowRightIcon />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {hasResults && (
          <div className="search-footer" aria-hidden="true">
            <span><kbd>↑↓</kbd> naviguer</span>
            <span><kbd>↵</kbd> ouvrir</span>
            <span><kbd>Esc</kbd> fermer</span>
          </div>
        )}
      </div>

      <style>{STYLES}</style>
    </>
  );
};

// ─── Styles scopés (inchangés) ────────────────────────────────────────────────

const STYLES = `

/* ── Backdrop ── */
.search-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal) - 1);
  background: var(--surface-overlay);
  opacity: 0;
  transition: opacity var(--duration-slow) var(--ease-out);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.search-backdrop--visible {
  opacity: 1;
}

/* ── Overlay panel ── */
.search-overlay {
  position: fixed;
  top: calc(var(--safe-top) + var(--space-4));
  left: 50%;
  transform: translateX(-50%) translateY(-12px);
  z-index: var(--z-modal);

  width: min(640px, calc(100vw - var(--space-8)));
  max-height: min(560px, calc(100dvh - var(--safe-top) - var(--space-8)));
  display: flex;
  flex-direction: column;

  background: var(--glass-bg-strong);
  backdrop-filter: var(--glass-blur-strong);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-2xl);
  box-shadow: var(--glass-shadow-strong),
              0 0 0 1px hsla(0, 0%, 100%, 0.12) inset;

  opacity: 0;
  transition:
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-spring);
  will-change: transform, opacity;
  overflow: hidden;
}

.search-overlay--visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* ── Barre de recherche ── */
.search-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3-5) var(--space-4);
  flex-shrink: 0;
}

.search-bar__icon {
  display: flex;
  align-items: center;
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: color var(--duration-fast) var(--ease-out);
}

.search-bar:focus-within .search-bar__icon {
  color: var(--primary);
}

.search-bar__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-weight: var(--font-weight-regular);
  color: var(--text-primary);
  caret-color: var(--primary);
  min-width: 0;
  -webkit-appearance: none;
}

.search-bar__input::placeholder {
  color: var(--text-tertiary);
}

.search-bar__input::-webkit-search-decoration,
.search-bar__input::-webkit-search-cancel-button,
.search-bar__input::-webkit-search-results-button,
.search-bar__input::-webkit-search-results-decoration {
  display: none;
}

.search-bar__spinner {
  display: flex;
  align-items: center;
  color: var(--primary);
  flex-shrink: 0;
}

.search-spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.search-bar__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: var(--transition-interactive);
}

.search-bar__clear:hover {
  background: var(--border-default);
  color: var(--text-primary);
}

.search-bar__clear:active {
  transform: scale(0.9);
}

/* ── Séparateur ── */
.search-divider {
  height: 1px;
  background: var(--border-subtle);
  flex-shrink: 0;
}

/* ── Zone de résultats ── */
.search-results {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-2) 0 var(--space-2);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--border-subtle) transparent;
}

.search-results::-webkit-scrollbar { width: 4px; }
.search-results::-webkit-scrollbar-track { background: transparent; }
.search-results::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: var(--radius-full);
}

/* ── État vide ── */
.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-6);
  text-align: center;
  gap: var(--space-2);
}

.search-empty__icon { font-size: 28px; margin-bottom: var(--space-1); opacity: 0.6; }
.search-empty__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  margin: 0;
}
.search-empty__hint {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
  line-height: var(--leading-relaxed);
}
.search-empty__shortcut {
  margin-top: var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  justify-content: center;
}

/* ── Groupes ── */
.search-group {
  padding: 0 var(--space-2);
  margin-bottom: var(--space-1);
  animation: groupFadeIn var(--duration-normal) var(--ease-out) both;
}

@keyframes groupFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.search-group__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) var(--space-1);
}

.search-group__icon { font-size: 13px; line-height: 1; }
.search-group__label {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.search-group__count {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  background: var(--bg-sunken);
  padding: 1px var(--space-1-5);
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-body);
}

.search-group__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* ── Résultat individuel ── */
.search-result {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2-5) var(--space-3);
  border-radius: var(--radius-xl);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background var(--duration-fast) var(--ease-out);
  -webkit-tap-highlight-color: transparent;
}

.search-result:active { transform: scale(0.99); }

.search-result--active,
.search-result:hover {
  background: color-mix(in srgb, var(--result-color, var(--primary)) 8%, var(--surface-2));
}

.search-result__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--result-color, var(--primary));
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity var(--duration-fast);
}

.search-result--active .search-result__dot,
.search-result:hover .search-result__dot { opacity: 1; }

.search-result__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-result__title {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-result__desc {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-result__arrow {
  display: flex;
  align-items: center;
  color: var(--text-tertiary);
  opacity: 0;
  transform: translateX(-4px);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
  flex-shrink: 0;
}

.search-result--active .search-result__arrow,
.search-result:hover .search-result__arrow {
  opacity: 1;
  transform: translateX(0);
  color: var(--result-color, var(--primary));
}

.search-highlight {
  background: transparent;
  color: var(--primary);
  font-weight: var(--font-weight-semibold);
  border-radius: 2px;
}

/* ── Footer hints ── */
.search-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-2-5) var(--space-4);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.search-footer span {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-family: var(--font-body);
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--space-1);
  background: var(--bg-sunken);
  border: 1px solid var(--border-default);
  border-bottom-width: 2px;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  line-height: 1;
}

/* ── Responsive iPhone ── */
@media (max-width: 480px) {
  .search-overlay {
    top: var(--safe-top);
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 100dvh;
    transform: translateX(0) translateY(20px);
    border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
  }

  .search-overlay--visible {
    transform: translateX(0) translateY(0);
  }

  .search-empty {
    padding: var(--space-8) var(--space-4);
  }

  .search-empty__shortcut {
    display: none;
  }

  .search-footer {
    padding-bottom: calc(var(--space-2-5) + var(--safe-bottom));
  }
}

`;

export default SearchOverlay;
