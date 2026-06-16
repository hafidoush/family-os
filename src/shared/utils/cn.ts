/**
 * FAMILY OS — cn()
 * Helper de concaténation de classes CSS conditionnelles.
 * Usage : cn('base-class', condition && 'conditional-class', 'always')
 * Pas de dépendance externe — implémentation légère suffisante pour le projet.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
