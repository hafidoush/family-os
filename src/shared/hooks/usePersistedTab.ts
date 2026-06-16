import { useState } from 'react';

/**
 * Comme useState, mais persiste la valeur dans sessionStorage.
 * L'onglet actif est restauré quand l'utilisateur revient sur le module.
 */
export function usePersistedTab<T extends string>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [tab, setTabState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(`tab:${key}`);
      return (stored as T) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setTab = (value: T) => {
    try {
      sessionStorage.setItem(`tab:${key}`, value);
    } catch { /* quota dépassé, on ignore */ }
    setTabState(value);
  };

  return [tab, setTab];
}
