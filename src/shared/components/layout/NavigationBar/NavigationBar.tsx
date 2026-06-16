/**
 * FAMILY OS — NavigationBar
 * Composant de navigation principale adaptatif :
 *   - iPhone  (< 768px) : bottom tab bar glassmorphism
 *   - iPad / tablette (≥ 768px) : sidebar gauche glassmorphism
 *
 * Usage :
 *   <NavigationBar activeModule="dashboard" onNavigate={(id) => ...} />
 *
 * Convention :
 *   - Pas de valeurs brutes — uniquement les tokens CSS du design system.
 *   - Pas d'imports cross-modules.
 *   - Toutes les chaînes de routes via le type ModuleId.
 */

import { useCallback } from 'react';
import type { ModuleOrigine } from '@shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModuleId = ModuleOrigine | 'parametres';

export interface NavItem {
  id: ModuleId;
  label: string;
  shortLabel: string; // bottom bar (espace contraint)
  icon: React.ReactNode;
  color: string; // token CSS --module-*
}

export interface NavigationBarProps {
  activeModule: ModuleId;
  onNavigate: (id: ModuleId) => void;
  /** Optionnel — permet d'afficher un badge de notification sur un module */
  badges?: Partial<Record<ModuleId, number>>;
}

// ─── Icônes SVG inline (pas de dépendance icon lib) ──────────────────────────

const DashboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M6.448 1.75C5.54954 1.74997 4.8003 1.74995 4.20552 1.82991C3.57773 1.91432 3.01093 2.09999 2.55546 2.55546C2.09999 3.01093 1.91432 3.57773 1.82991 4.20552C1.74995 4.8003 1.74997 5.54951 1.75 6.44798V6.552C1.74997 7.45047 1.74995 8.19971 1.82991 8.79448C1.91432 9.42228 2.09999 9.98908 2.55546 10.4445C3.01093 10.9 3.57773 11.0857 4.20552 11.1701C4.8003 11.2501 5.54951 11.25 6.44798 11.25H6.552C7.45047 11.25 8.19971 11.2501 8.79448 11.1701C9.42228 11.0857 9.98908 10.9 10.4445 10.4445C10.9 9.98908 11.0857 9.42228 11.1701 8.79448C11.2501 8.19971 11.25 7.4505 11.25 6.55203V6.44801C11.25 5.54954 11.2501 4.8003 11.1701 4.20552C11.0857 3.57773 10.9 3.01093 10.4445 2.55546C9.98908 2.09999 9.42228 1.91432 8.79448 1.82991C8.19971 1.74995 7.4505 1.74997 6.55203 1.75H6.448ZM3.61612 3.61612C3.74644 3.4858 3.94393 3.37858 4.4054 3.31654C4.88843 3.2516 5.53599 3.25 6.5 3.25C7.46401 3.25 8.11157 3.2516 8.59461 3.31654C9.05607 3.37858 9.25357 3.4858 9.38389 3.61612C9.5142 3.74644 9.62143 3.94393 9.68347 4.4054C9.74841 4.88843 9.75 5.53599 9.75 6.5C9.75 7.46401 9.74841 8.11157 9.68347 8.59461C9.62143 9.05607 9.5142 9.25357 9.38389 9.38389C9.25357 9.5142 9.05607 9.62143 8.59461 9.68347C8.11157 9.74841 7.46401 9.75 6.5 9.75C5.53599 9.75 4.88843 9.74841 4.4054 9.68347C3.94393 9.62143 3.74644 9.5142 3.61612 9.38389C3.4858 9.25357 3.37858 9.05607 3.31654 8.59461C3.2516 8.11157 3.25 7.46401 3.25 6.5C3.25 5.53599 3.2516 4.88843 3.31654 4.4054C3.37858 3.94393 3.4858 3.74644 3.61612 3.61612Z" fill="currentColor"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M17.448 12.75C16.5495 12.75 15.8003 12.7499 15.2055 12.8299C14.5777 12.9143 14.0109 13.1 13.5555 13.5555C13.1 14.0109 12.9143 14.5777 12.8299 15.2055C12.7499 15.8003 12.75 16.5495 12.75 17.448V17.552C12.75 18.4505 12.7499 19.1997 12.8299 19.7945C12.9143 20.4223 13.1 20.9891 13.5555 21.4445C14.0109 21.9 14.5777 22.0857 15.2055 22.1701C15.8003 22.2501 16.5495 22.25 17.4479 22.25H17.552C18.4504 22.25 19.1997 22.2501 19.7945 22.1701C20.4223 22.0857 20.9891 21.9 21.4445 21.4445C21.9 20.9891 22.0857 20.4223 22.1701 19.7945C22.2501 19.1997 22.25 18.4505 22.25 17.5521V17.448C22.25 16.5496 22.2501 15.8003 22.1701 15.2055C22.0857 14.5777 21.9 14.0109 21.4445 13.5555C20.9891 13.1 20.4223 12.9143 19.7945 12.8299C19.1997 12.7499 18.4505 12.75 17.552 12.75H17.448ZM14.6161 14.6161C14.7464 14.4858 14.9439 14.3786 15.4054 14.3165C15.8884 14.2516 16.536 14.25 17.5 14.25C18.464 14.25 19.1116 14.2516 19.5946 14.3165C20.0561 14.3786 20.2536 14.4858 20.3839 14.6161C20.5142 14.7464 20.6214 14.9439 20.6835 15.4054C20.7484 15.8884 20.75 16.536 20.75 17.5C20.75 18.464 20.7484 19.1116 20.6835 19.5946C20.6214 20.0561 20.5142 20.2536 20.3839 20.3839C20.2536 20.5142 20.0561 20.6214 19.5946 20.6835C19.1116 20.7484 18.464 20.75 17.5 20.75C16.536 20.75 15.8884 20.7484 15.4054 20.6835C14.9439 20.6214 14.7464 20.5142 14.6161 20.3839C14.4858 20.2536 14.3786 20.0561 14.3165 19.5946C14.2516 19.1116 14.25 18.464 14.25 17.5C14.25 16.536 14.2516 15.8884 14.3165 15.4054C14.3786 14.9439 14.4858 14.7464 14.6161 14.6161Z" fill="currentColor"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M6.448 12.75H6.552C7.45048 12.75 8.1997 12.7499 8.79448 12.8299C9.42228 12.9143 9.98908 13.1 10.4445 13.5555C10.9 14.0109 11.0857 14.5777 11.1701 15.2055C11.2501 15.8003 11.25 16.5495 11.25 17.448V17.552C11.25 18.4505 11.2501 19.1997 11.1701 19.7945C11.0857 20.4223 10.9 20.9891 10.4445 21.4445C9.98908 21.9 9.42228 22.0857 8.79448 22.1701C8.19971 22.2501 7.45051 22.25 6.55206 22.25H6.44801C5.54955 22.25 4.80029 22.2501 4.20552 22.1701C3.57773 22.0857 3.01093 21.9 2.55546 21.4445C2.09999 20.9891 1.91432 20.4223 1.82991 19.7945C1.74995 19.1997 1.74997 18.4505 1.75 17.552V17.448C1.74997 16.5495 1.74995 15.8003 1.82991 15.2055C1.91432 14.5777 2.09999 14.0109 2.55546 13.5555C3.01093 13.1 3.57773 12.9143 4.20552 12.8299C4.8003 12.7499 5.54952 12.75 6.448 12.75ZM4.4054 14.3165C3.94393 14.3786 3.74644 14.4858 3.61612 14.6161C3.4858 14.7464 3.37858 14.9439 3.31654 15.4054C3.2516 15.8884 3.25 16.536 3.25 17.5C3.25 18.464 3.2516 19.1116 3.31654 19.5946C3.37858 20.0561 3.4858 20.2536 3.61612 20.3839C3.74644 20.5142 3.94393 20.6214 4.4054 20.6835C4.88843 20.7484 5.53599 20.75 6.5 20.75C7.46401 20.75 8.11157 20.7484 8.59461 20.6835C9.05607 20.6214 9.25357 20.5142 9.38389 20.3839C9.5142 20.2536 9.62143 20.0561 9.68347 19.5946C9.74841 19.1116 9.75 18.464 9.75 17.5C9.75 16.536 9.74841 15.8884 9.68347 15.4054C9.62143 14.9439 9.5142 14.7464 9.38389 14.6161C9.25357 14.4858 9.05607 14.3786 8.59461 14.3165C8.11157 14.2516 7.46401 14.25 6.5 14.25C5.53599 14.25 4.88843 14.2516 4.4054 14.3165Z" fill="currentColor"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M17.448 1.75C16.5495 1.74997 15.8003 1.74995 15.2055 1.82991C14.5777 1.91432 14.0109 2.09999 13.5555 2.55546C13.1 3.01093 12.9143 3.57773 12.8299 4.20552C12.7499 4.8003 12.75 5.54952 12.75 6.448V6.552C12.75 7.45048 12.7499 8.1997 12.8299 8.79448C12.9143 9.42228 13.1 9.98908 13.5555 10.4445C14.0109 10.9 14.5777 11.0857 15.2055 11.1701C15.8003 11.2501 16.5495 11.25 17.448 11.25H17.552C18.4505 11.25 19.1997 11.2501 19.7945 11.1701C20.4223 11.0857 20.9891 10.9 21.4445 10.4445C21.9 9.98908 22.0857 9.42228 22.1701 8.79448C22.2501 8.19971 22.25 7.4505 22.25 6.55203V6.44801C22.25 5.54954 22.2501 4.8003 22.1701 4.20552C22.0857 3.57773 21.9 3.01093 21.4445 2.55546C20.9891 2.09999 20.4223 1.91432 19.7945 1.82991C19.1997 1.74995 18.4505 1.74997 17.552 1.75H17.448ZM14.6161 3.61612C14.7464 3.4858 14.9439 3.37858 15.4054 3.31654C15.8884 3.2516 16.536 3.25 17.5 3.25C18.464 3.25 19.1116 3.2516 19.5946 3.31654C20.0561 3.37858 20.2536 3.4858 20.3839 3.61612C20.5142 3.74644 20.6214 3.94393 20.6835 4.4054C20.7484 4.88843 20.75 5.53599 20.75 6.5C20.75 7.46401 20.7484 8.11157 20.6835 8.59461C20.6214 9.05607 20.5142 9.25357 20.3839 9.38389C20.2536 9.5142 20.0561 9.62143 19.5946 9.68347C19.1116 9.74841 18.464 9.75 17.5 9.75C16.536 9.75 15.8884 9.74841 15.4054 9.68347C14.9439 9.62143 14.7464 9.5142 14.6161 9.38389C14.4858 9.25357 14.3786 9.05607 14.3165 8.59461C14.2516 8.11157 14.25 7.46401 14.25 6.5C14.25 5.53599 14.2516 4.88843 14.3165 4.4054C14.3786 3.94393 14.4858 3.74644 14.6161 3.61612Z" fill="currentColor"/>
  </svg>
);

const CuisineIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M7.25285 4.25547C8.09403 2.47951 9.90263 1.25 12 1.25C14.0974 1.25 15.906 2.47951 16.7471 4.25547C16.831 4.25184 16.9153 4.25 17 4.25C20.1756 4.25 22.75 6.82436 22.75 10C22.75 12.1806 21.5363 14.0762 19.75 15.0508L19.75 18.052C19.75 18.9505 19.7501 19.6997 19.6701 20.2945C19.5857 20.9223 19.4 21.4891 18.9445 21.9445C18.4891 22.4 17.9223 22.5857 17.2945 22.6701C16.6997 22.7501 15.9505 22.75 15.052 22.75H8.94801C8.04952 22.75 7.3003 22.7501 6.70552 22.6701C6.07773 22.5857 5.51093 22.4 5.05546 21.9445C4.59999 21.4891 4.41432 20.9223 4.32991 20.2945C4.24994 19.6997 4.24997 18.9505 4.25 18.052L4.25 15.0508C2.46371 14.0762 1.25 12.1806 1.25 10C1.25 6.82436 3.82436 4.25 7 4.25C7.08469 4.25 7.16899 4.25184 7.25285 4.25547ZM6.80262 5.7545C4.54704 5.85762 2.75 7.71895 2.75 10C2.75 11.7416 3.79769 13.2402 5.30028 13.8967C5.57345 14.016 5.75 14.2859 5.75 14.584V17.25H18.25L18.25 14.584C18.25 14.2859 18.4265 14.016 18.6997 13.8967C20.2023 13.2402 21.25 11.7416 21.25 10C21.25 7.71895 19.453 5.85761 17.1974 5.7545C17.2321 5.99825 17.25 6.24718 17.25 6.5V7C17.25 7.41421 16.9142 7.75 16.5 7.75C16.0858 7.75 15.75 7.41421 15.75 7V6.5C15.75 6.07715 15.6803 5.67212 15.5524 5.29486C15.0502 3.81402 13.6484 2.75 12 2.75C10.3516 2.75 8.94981 3.81402 8.44763 5.29486C8.3197 5.67212 8.25 6.07715 8.25 6.5V7C8.25 7.41421 7.91421 7.75 7.5 7.75C7.08579 7.75 6.75 7.41421 6.75 7V6.5C6.75 6.24717 6.76792 5.99825 6.80262 5.7545ZM18.2482 18.75H5.75181C5.75604 19.3194 5.77008 19.7491 5.81654 20.0946C5.87858 20.5561 5.9858 20.7536 6.11612 20.8839C6.24643 21.0142 6.44393 21.1214 6.90539 21.1835C7.38843 21.2484 8.03599 21.25 9 21.25H15C15.964 21.25 16.6116 21.2484 17.0946 21.1835C17.5561 21.1214 17.7536 21.0142 17.8839 20.8839C18.0142 20.7536 18.1214 20.5561 18.1835 20.0946C18.2299 19.7491 18.244 19.3194 18.2482 18.75Z" fill="currentColor"/>
  </svg>
);

const EnfantsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2.75C11.3096 2.75 10.75 3.30964 10.75 4C10.75 4.69036 11.3096 5.25 12 5.25C12.6904 5.25 13.25 4.69036 13.25 4C13.25 3.30964 12.6904 2.75 12 2.75ZM9.25 4C9.25 2.48122 10.4812 1.25 12 1.25C13.5188 1.25 14.75 2.48122 14.75 4C14.75 5.51878 13.5188 6.75 12 6.75C10.4812 6.75 9.25 5.51878 9.25 4ZM16.9894 7.16382C18.4102 6.85936 19.75 7.94247 19.75 9.39553C19.75 10.3779 19.1214 11.2501 18.1894 11.5608L16.0141 12.2859C15.877 12.3316 15.795 12.3591 15.7342 12.3821C15.6957 12.3966 15.6795 12.4044 15.6756 12.4063C15.5935 12.4582 15.5488 12.5528 15.561 12.6491C15.562 12.6534 15.5663 12.6709 15.5795 12.7098C15.6004 12.7714 15.6313 12.8522 15.6832 12.987L16.93 16.2287C17.4901 17.6849 16.4152 19.25 14.8549 19.25C14.0571 19.25 13.3205 18.8225 12.9246 18.1298L12 16.5117L11.0754 18.1298C10.6795 18.8225 9.94287 19.25 9.14506 19.25C7.58484 19.25 6.50994 17.6849 7.07002 16.2287L8.31681 12.987C8.36869 12.8522 8.3996 12.7714 8.42051 12.7098C8.43373 12.6709 8.43803 12.6534 8.43901 12.6491C8.4512 12.5528 8.40652 12.4582 8.32443 12.4063C8.32052 12.4044 8.30434 12.3966 8.26583 12.3821C8.20501 12.3591 8.12301 12.3316 7.98592 12.2859L5.81062 11.5608C4.87863 11.2501 4.25 10.3779 4.25 9.39553C4.25 7.94247 5.58979 6.85936 7.0106 7.16382L8.90817 7.57044C9.01467 7.59326 9.06443 7.60392 9.11353 7.61407C11.0177 8.00795 12.9823 8.00795 14.8865 7.61407C14.9356 7.60392 14.9853 7.59326 15.0918 7.57044L16.9894 7.16382ZM18.25 9.39553C18.25 8.89743 17.7907 8.52615 17.3037 8.63052L15.4034 9.03773C15.3006 9.05975 15.2453 9.0716 15.1903 9.08298C13.0857 9.51831 10.9143 9.51831 8.80969 9.08298C8.7547 9.0716 8.69947 9.05977 8.59688 9.03779L6.69631 8.63052C6.20927 8.52615 5.75 8.89743 5.75 9.39553C5.75 9.73228 5.96549 10.0313 6.28497 10.1378L8.46026 10.8629C8.47839 10.8689 8.49661 10.8749 8.5149 10.881C8.72048 10.9491 8.93409 11.0199 9.1102 11.1286C9.69929 11.4922 10.0186 12.169 9.92485 12.8548C9.89681 13.0599 9.81566 13.2698 9.73756 13.4718C9.73061 13.4898 9.72369 13.5077 9.71683 13.5255L8.47004 16.7672C8.28784 17.2409 8.63751 17.75 9.14506 17.75C9.40459 17.75 9.64422 17.6109 9.77299 17.3856L11.3488 14.6279C11.4823 14.3942 11.7309 14.25 12 14.25C12.2691 14.25 12.5177 14.3942 12.6512 14.6279L14.227 17.3856C14.3558 17.6109 14.5954 17.75 14.8549 17.75C15.3625 17.75 15.7122 17.2409 15.53 16.7672L14.2832 13.5255C14.2763 13.5077 14.2694 13.4898 14.2624 13.4718C14.1843 13.2698 14.1032 13.0599 14.0751 12.8548C13.9814 12.169 14.3007 11.4922 14.8898 11.1286C15.0659 11.0199 15.2795 10.9491 15.4851 10.881C15.5034 10.8749 15.5216 10.8689 15.5397 10.8629L17.715 10.1378C18.0345 10.0313 18.25 9.73228 18.25 9.39553ZM5.21639 14.1631C5.40245 14.5332 5.25328 14.984 4.88321 15.1701C3.36229 15.9348 2.75 16.7949 2.75 17.5C2.75 18.2637 3.47401 19.2048 5.23671 19.998C6.929 20.7596 9.31951 21.25 12 21.25C14.6805 21.25 17.071 20.7596 18.7633 19.998C20.526 19.2048 21.25 18.2637 21.25 17.5C21.25 16.7949 20.6377 15.9348 19.1168 15.1701C18.7467 14.984 18.5975 14.5332 18.7836 14.1631C18.9697 13.793 19.4205 13.6439 19.7906 13.8299C21.4366 14.6575 22.75 15.9 22.75 17.5C22.75 19.2216 21.2354 20.5305 19.3788 21.3659C17.4518 22.2331 14.8424 22.75 12 22.75C9.15764 22.75 6.54815 22.2331 4.62116 21.3659C2.76457 20.5305 1.25 19.2216 1.25 17.5C1.25 15.9 2.5634 14.6575 4.20941 13.8299C4.57948 13.6439 5.03032 13.793 5.21639 14.1631Z" fill="currentColor"/>
  </svg>
);

const MyselfIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 13.4811 3.09753 14.8788 3.7148 16.1181C3.96254 16.6155 4.05794 17.2103 3.90163 17.7945L3.30602 20.0205C3.19663 20.4293 3.57066 20.8034 3.97949 20.694L6.20553 20.0984C6.78973 19.9421 7.38451 20.0375 7.88191 20.2852C9.12121 20.9025 10.5189 21.25 12 21.25C17.1086 21.25 21.25 17.1086 21.25 12C21.25 6.89137 17.1086 2.75 12 2.75ZM1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C10.2817 22.75 8.65552 22.3463 7.21315 21.6279C6.99791 21.5207 6.77814 21.4979 6.59324 21.5474L4.3672 22.143C2.84337 22.5507 1.44927 21.1566 1.857 19.6328L2.4526 17.4068C2.50208 17.2219 2.47933 17.0021 2.37213 16.7869C1.65371 15.3445 1.25 13.7183 1.25 12ZM15.272 7.82214C16.507 8.28392 17.25 9.53897 17.25 11.1084C17.25 12.0241 16.8154 12.8821 16.2951 13.5946C15.766 14.3192 15.0855 14.9787 14.4574 15.513C14.4262 15.5396 14.3952 15.566 14.3644 15.5923C13.6274 16.2207 13.0148 16.7431 12 16.7431C10.9852 16.7431 10.3726 16.2207 9.63564 15.5923C9.60486 15.566 9.57385 15.5396 9.54259 15.513C8.91448 14.9786 8.23403 14.3192 7.70492 13.5946C7.18465 12.8821 6.75 12.0241 6.75 11.1084C6.75 9.53898 7.49299 8.28393 8.72797 7.82214C9.77086 7.43218 10.9575 7.6854 12 8.4956C13.0425 7.6854 14.2291 7.43218 15.272 7.82214ZM14.7467 9.22713C14.2295 9.03374 13.4049 9.13696 12.5359 10.0245C12.3948 10.1686 12.2017 10.2498 12 10.2498C11.7983 10.2498 11.6052 10.1686 11.4641 10.0245C10.5951 9.13696 9.77051 9.03374 9.25333 9.22713C8.74454 9.41738 8.25 10.0007 8.25 11.1084C8.25 11.5612 8.47476 12.1053 8.91635 12.71C9.34909 13.3027 9.93292 13.8757 10.5145 14.3705C11.3828 15.1091 11.586 15.2431 12 15.2431C12.414 15.2431 12.6172 15.1091 13.4855 14.3705C14.0671 13.8757 14.6509 13.3027 15.0837 12.71C15.5252 12.1053 15.75 11.5612 15.75 11.1084C15.75 10.0007 15.2555 9.41738 14.7467 9.22713Z" fill="currentColor"/>
  </svg>
);

const AchatsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M2.24896 2.29245C1.8582 2.15506 1.43005 2.36047 1.29266 2.75123C1.15527 3.142 1.36068 3.57015 1.75145 3.70754L2.01266 3.79937C2.68026 4.03409 3.11902 4.18964 3.44186 4.34805C3.74509 4.49683 3.87876 4.61726 3.96682 4.74612C4.05708 4.87821 4.12678 5.05963 4.16611 5.42298C4.20726 5.80319 4.20828 6.2984 4.20828 7.03835V9.75999C4.20828 11.2125 4.22191 12.2599 4.35897 13.0601C4.50529 13.9144 4.79742 14.526 5.34366 15.1022C5.93752 15.7285 6.69032 16.0012 7.58656 16.1283C8.44479 16.25 9.53464 16.25 10.8804 16.25L16.2861 16.25C17.0278 16.25 17.6518 16.25 18.1568 16.1882C18.6925 16.1227 19.1811 15.9793 19.6076 15.6318C20.0341 15.2842 20.2731 14.8346 20.4455 14.3232C20.6079 13.841 20.7339 13.2299 20.8836 12.5035L21.3925 10.0341L21.3935 10.0295L21.4039 9.97726C21.5686 9.15237 21.7071 8.45848 21.7416 7.90037C21.7777 7.31417 21.711 6.73616 21.3292 6.23977C21.0942 5.93435 20.7639 5.76144 20.4634 5.65586C20.1569 5.54817 19.8103 5.48587 19.4606 5.44677C18.7735 5.36997 17.9389 5.36998 17.1203 5.36999L5.66809 5.36999C5.6648 5.33324 5.66124 5.29709 5.6574 5.26156C5.60367 4.76518 5.48725 4.31246 5.20527 3.89982C4.92109 3.48396 4.54324 3.21762 4.10261 3.00142C3.69052 2.79922 3.16689 2.61514 2.55036 2.39841L2.24896 2.29245ZM5.70828 6.86999H8.30391L9.6938 14.746C8.91096 14.7381 8.29853 14.7143 7.79716 14.6432C7.08235 14.5418 6.70473 14.3576 6.43219 14.0701C6.11202 13.7325 5.93933 13.4018 5.83744 12.8069C5.72628 12.1578 5.70828 11.249 5.70828 9.75999L5.70828 6.86999ZM11.2177 14.75H14.2827L15.6733 6.86999H9.82709L11.2177 14.75ZM15.8059 14.75L17.1965 6.87C18.0085 6.87019 18.7241 6.87379 19.2939 6.93748C19.5895 6.97052 19.8107 7.01642 19.9661 7.07104C20.0931 7.11568 20.1361 7.15213 20.1423 7.1574C20.2037 7.23881 20.2704 7.38651 20.2444 7.80796C20.217 8.25153 20.1005 8.84379 19.9229 9.73372L19.9225 9.73594L19.4237 12.1561C19.2623 12.9389 19.1537 13.4593 19.024 13.8441C18.9009 14.2095 18.7853 14.3669 18.66 14.469C18.5348 14.571 18.3573 14.6525 17.9746 14.6993C17.5714 14.7487 17.0399 14.75 16.2406 14.75H15.8059Z" fill="currentColor"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M7.5002 21.75C6.25756 21.75 5.2502 20.7426 5.2502 19.5C5.2502 18.2573 6.25756 17.25 7.5002 17.25C8.74285 17.25 9.7502 18.2573 9.7502 19.5C9.7502 20.7426 8.74285 21.75 7.5002 21.75ZM6.7502 19.5C6.7502 19.9142 7.08599 20.25 7.5002 20.25C7.91442 20.25 8.2502 19.9142 8.2502 19.5C8.2502 19.0858 7.91442 18.75 7.5002 18.75C7.08599 18.75 6.7502 19.0858 6.7502 19.5Z" fill="currentColor"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M16.5002 21.7501C15.2576 21.7501 14.2502 20.7427 14.2502 19.5001C14.2502 18.2574 15.2576 17.2501 16.5002 17.2501C17.7428 17.2501 18.7502 18.2574 18.7502 19.5001C18.7502 20.7427 17.7428 21.7501 16.5002 21.7501ZM15.7502 19.5001C15.7502 19.9143 16.086 20.2501 16.5002 20.2501C16.9144 20.2501 17.2502 19.9143 17.2502 19.5001C17.2502 19.0859 16.9144 18.7501 16.5002 18.7501C16.086 18.7501 15.7502 19.0859 15.7502 19.5001Z" fill="currentColor"/>
  </svg>
);

const FamilleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M16.25 3.75V5.43953L18.25 7.03953V3.75H16.25ZM19.75 8.23953V3.5C19.75 2.80964 19.1904 2.25 18.5 2.25H16C15.3097 2.25 14.75 2.80964 14.75 3.5V4.23953L14.3426 3.91362C12.9731 2.81796 11.027 2.81796 9.65742 3.91362L1.53151 10.4143C1.20806 10.6731 1.15562 11.1451 1.41438 11.4685C1.67313 11.792 2.1451 11.8444 2.46855 11.5857L3.25003 10.9605V21.25H2.00003C1.58581 21.25 1.25003 21.5858 1.25003 22C1.25003 22.4142 1.58581 22.75 2.00003 22.75H22C22.4142 22.75 22.75 22.4142 22.75 22C22.75 21.5858 22.4142 21.25 22 21.25H20.75V10.9605L21.5315 11.5857C21.855 11.8444 22.3269 11.792 22.5857 11.4685C22.8444 11.1451 22.792 10.6731 22.4685 10.4143L19.75 8.23953ZM19.25 9.76047L13.4056 5.08492C12.5838 4.42753 11.4162 4.42753 10.5945 5.08492L4.75003 9.76047V21.25H8.25003L8.25003 16.9506C8.24999 16.2858 8.24996 15.7129 8.31163 15.2542C8.37773 14.7625 8.52679 14.2913 8.90904 13.909C9.29128 13.5268 9.76255 13.3777 10.2542 13.3116C10.7129 13.2499 11.2858 13.25 11.9507 13.25H12.0494C12.7143 13.25 13.2871 13.2499 13.7459 13.3116C14.2375 13.3777 14.7088 13.5268 15.091 13.909C15.4733 14.2913 15.6223 14.7625 15.6884 15.2542C15.7501 15.7129 15.7501 16.2858 15.75 16.9506L15.75 21.25H19.25V9.76047ZM14.25 21.25V17C14.25 16.2717 14.2484 15.8009 14.2018 15.454C14.1581 15.1287 14.0875 15.0268 14.0304 14.9697C13.9733 14.9126 13.8713 14.842 13.546 14.7982C13.1991 14.7516 12.7283 14.75 12 14.75C11.2717 14.75 10.8009 14.7516 10.4541 14.7982C10.1288 14.842 10.0268 14.9126 9.9697 14.9697C9.9126 15.0268 9.84199 15.1287 9.79826 15.454C9.75162 15.8009 9.75003 16.2717 9.75003 17V21.25H14.25ZM12 8.25C11.3097 8.25 10.75 8.80964 10.75 9.5C10.75 10.1904 11.3097 10.75 12 10.75C12.6904 10.75 13.25 10.1904 13.25 9.5C13.25 8.80964 12.6904 8.25 12 8.25ZM9.25003 9.5C9.25003 7.98122 10.4812 6.75 12 6.75C13.5188 6.75 14.75 7.98122 14.75 9.5C14.75 11.0188 13.5188 12.25 12 12.25C10.4812 12.25 9.25003 11.0188 9.25003 9.5Z" fill="currentColor"/>
  </svg>
);

const ParametresIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// ─── Configuration des items de navigation ────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Accueil',
    icon: <DashboardIcon />,
    color: 'var(--module-dashboard)',
  },
  {
    id: 'cuisine',
    label: 'Cuisine',
    shortLabel: 'Cuisine',
    icon: <CuisineIcon />,
    color: 'var(--module-cuisine)',
  },
  {
    id: 'enfants',
    label: 'Enfants',
    shortLabel: 'Enfants',
    icon: <EnfantsIcon />,
    color: 'var(--module-enfants)',
  },
  {
    id: 'myself',
    label: 'Myself',
    shortLabel: 'Myself',
    icon: <MyselfIcon />,
    color: 'var(--module-myself)',
  },
  {
    id: 'achats',
    label: 'Achats',
    shortLabel: 'Achats',
    icon: <AchatsIcon />,
    color: 'var(--module-achats, #F59E0B)',
  },
  {
    id: 'famille',
    label: 'Famille',
    shortLabel: 'Famille',
    icon: <FamilleIcon />,
    color: 'var(--module-famille)',
  },
];

const SIDEBAR_BOTTOM_ITEMS: NavItem[] = [
  {
    id: 'parametres',
    label: 'Paramètres',
    shortLabel: 'Config',
    icon: <ParametresIcon />,
    color: 'var(--text-tertiary)',
  },
];

// ─── Composant principal ──────────────────────────────────────────────────────

export const NavigationBar: React.FC<NavigationBarProps> = ({
  activeModule,
  onNavigate,
  badges = {},
}) => {
  const handleNav = useCallback(
    (id: ModuleId) => {
      onNavigate(id);
    },
    [onNavigate]
  );

  return (
    <>
      {/* ── Sidebar iPad / tablette (≥ 768px) ── */}
      <nav className="nav-sidebar" aria-label="Navigation principale">
        {/* Logo / wordmark */}
        <div className="nav-sidebar__header">
          <div className="nav-sidebar__logo">
            <span className="nav-sidebar__logo-icon">✦</span>
            <span className="nav-sidebar__logo-text">Family OS</span>
          </div>
        </div>

        {/* Items principaux */}
        <ul className="nav-sidebar__list" role="list">
          {NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              isActive={activeModule === item.id}
              badge={badges[item.id]}
              onNavigate={handleNav}
            />
          ))}
        </ul>

        {/* Séparateur + Paramètres */}
        <div className="nav-sidebar__footer">
          <div className="nav-sidebar__divider" role="separator" />
          <ul className="nav-sidebar__list" role="list">
            {SIDEBAR_BOTTOM_ITEMS.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                isActive={activeModule === item.id}
                badge={badges[item.id]}
                onNavigate={handleNav}
              />
            ))}
          </ul>
        </div>
      </nav>

      {/* ── Bottom tab bar iPhone (< 768px) ── */}
      {/* Spacer pour le contenu principal (évite le chevauchement) */}
      <div className="nav-bottom-spacer" aria-hidden="true" />

      <nav className="nav-bottom" aria-label="Navigation principale">
        <ul className="nav-bottom__list" role="list">
          {NAV_ITEMS.map((item) => (
            <BottomTabItem
              key={item.id}
              item={item}
              isActive={activeModule === item.id}
              badge={badges[item.id]}
              onNavigate={handleNav}
            />
          ))}
        </ul>
      </nav>

      <style>{STYLES}</style>
    </>
  );
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

interface ItemProps {
  item: NavItem;
  isActive: boolean;
  badge?: number;
  onNavigate: (id: ModuleId) => void;
}

const SidebarItem: React.FC<ItemProps> = ({ item, isActive, badge, onNavigate }) => (
  <li>
    <button
      className={`nav-sidebar__item${isActive ? ' nav-sidebar__item--active' : ''}`}
      onClick={() => onNavigate(item.id)}
      aria-current={isActive ? 'page' : undefined}
      aria-label={item.label}
      style={{ '--item-color': item.color } as React.CSSProperties}
    >
      {/* Indicateur actif */}
      {isActive && <span className="nav-sidebar__active-bar" aria-hidden="true" />}

      {/* Fond coloré au hover/active */}
      <span className="nav-sidebar__item-bg" aria-hidden="true" />

      {/* Icône */}
      <span className="nav-sidebar__icon" aria-hidden="true">
        {item.icon}
      </span>

      {/* Label */}
      <span className="nav-sidebar__label">{item.label}</span>

      {/* Badge */}
      {badge != null && badge > 0 && (
        <span className="nav-badge" aria-label={`${badge} notification${badge > 1 ? 's' : ''}`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  </li>
);

const BottomTabItem: React.FC<ItemProps> = ({ item, isActive, badge, onNavigate }) => (
  <li className="nav-bottom__item">
    <button
      className={`nav-bottom__btn${isActive ? ' nav-bottom__btn--active' : ''}`}
      onClick={() => onNavigate(item.id)}
      aria-current={isActive ? 'page' : undefined}
      aria-label={item.label}
      style={{ '--item-color': item.color } as React.CSSProperties}
    >
      <span className="nav-bottom__icon-wrap" aria-hidden="true">
        <span className="nav-bottom__icon">{item.icon}</span>
        {badge != null && badge > 0 && (
          <span className="nav-badge nav-badge--dot" aria-label={`${badge} notification${badge > 1 ? 's' : ''}`} />
        )}
      </span>
      <span className="nav-bottom__label">{item.shortLabel}</span>
    </button>
  </li>
);

// ─── Styles scopés ────────────────────────────────────────────────────────────

const STYLES = `

/* ════════════════════════════════════════════════════
   SIDEBAR — iPad & tablette (≥ 768px)
   ════════════════════════════════════════════════════ */

.nav-sidebar {
  display: none; /* masquée par défaut (iPhone) */
}

@media (min-width: 768px) {
  .nav-sidebar {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    width: var(--nav-sidebar-width);
    height: 100dvh;
    z-index: var(--z-nav);

    /* Glassmorphism */
    background: var(--nav-sidebar-bg);
    backdrop-filter: var(--nav-sidebar-blur);
    -webkit-backdrop-filter: var(--nav-sidebar-blur);
    border-right: 1px solid var(--nav-sidebar-border);
    box-shadow: var(--elevation-nav);

    padding-top: calc(var(--space-6) + var(--safe-top));
    padding-bottom: calc(var(--space-4) + var(--safe-bottom));
    padding-left: var(--space-3);
    padding-right: var(--space-3);
    gap: var(--space-2);
  }

  /* ── Header / Logo ── */
  .nav-sidebar__header {
    padding: 0 var(--space-2) var(--space-5);
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: var(--space-2);
  }

  .nav-sidebar__logo {
    display: flex;
    align-items: center;
    gap: var(--space-2-5);
    user-select: none;
  }

  .nav-sidebar__logo-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary);
    color: var(--primary-text);
    border-radius: var(--radius-lg);
    font-size: 18px;
    box-shadow: var(--shadow-brand-sm);
    flex-shrink: 0;
  }

  .nav-sidebar__logo-text {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-brand);
    letter-spacing: -0.02em;
  }

  /* ── Liste d'items ── */
  .nav-sidebar__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
  }

  /* ── Item individuel ── */
  .nav-sidebar__item {
    position: relative;
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
    color: var(--text-secondary);
    transition: var(--transition-interactive);
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;
  }

  /* Fond animé au hover */
  .nav-sidebar__item-bg {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--item-color, var(--primary));
    opacity: 0;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .nav-sidebar__item:hover .nav-sidebar__item-bg {
    opacity: 0.07;
  }

  .nav-sidebar__item:active {
    transform: scale(0.98);
  }

  /* Barre latérale indicateur actif */
  .nav-sidebar__active-bar {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 60%;
    background: var(--item-color, var(--primary));
    border-radius: 0 var(--radius-full) var(--radius-full) 0;
    box-shadow: 0 0 8px var(--item-color, var(--primary));
  }

  /* État actif */
  .nav-sidebar__item--active {
    background: color-mix(in srgb, var(--item-color, var(--primary)) 10%, transparent);
    color: var(--item-color, var(--primary));
  }

  .nav-sidebar__item--active .nav-sidebar__item-bg {
    opacity: 0; /* le fond coloré vient du background direct */
  }

  .nav-sidebar__item--active:hover .nav-sidebar__item-bg {
    opacity: 0.05;
  }

  /* Icône */
  .nav-sidebar__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
    color: inherit;
    transition: transform var(--duration-fast) var(--ease-spring);
  }

  .nav-sidebar__item:hover .nav-sidebar__icon {
    transform: scale(1.1);
  }

  .nav-sidebar__item--active .nav-sidebar__icon {
    color: var(--item-color, var(--primary));
    transform: scale(1.05);
  }

  /* Label */
  .nav-sidebar__label {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    letter-spacing: 0.01em;
    position: relative;
    z-index: 1;
    color: inherit;
    transition: color var(--duration-fast) var(--ease-out);
  }

  .nav-sidebar__item--active .nav-sidebar__label {
    font-weight: var(--font-weight-semibold);
  }

  /* Footer (Paramètres) */
  .nav-sidebar__footer {
    margin-top: auto;
  }

  .nav-sidebar__divider {
    height: 1px;
    background: var(--border-subtle);
    margin: var(--space-3) var(--space-2);
  }
}


/* ════════════════════════════════════════════════════
   BOTTOM BAR — iPhone (< 768px)
   ════════════════════════════════════════════════════ */

.nav-bottom-spacer {
  display: block;
  height: calc(var(--height-nav-bottom) + 32px + var(--safe-bottom));
}

@media (min-width: 768px) {
  .nav-bottom-spacer {
    display: none;
  }
}

.nav-bottom {
  position: fixed;
  bottom: calc(16px + var(--safe-bottom));
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-nav);
  width: calc(100% - 32px);
  max-width: 420px;

  /* Pill flottante glassmorphisme */
  background: var(--nav-bottom-bg);
  backdrop-filter: var(--nav-bottom-blur);
  -webkit-backdrop-filter: var(--nav-bottom-blur);
  border: 1px solid var(--nav-bottom-border);
  border-radius: 28px;
  box-shadow:
    0 8px 40px rgba(111, 126, 214, 0.14),
    0 0 0 1px rgba(210, 173, 235, 0.12);
}

@media (min-width: 768px) {
  .nav-bottom {
    display: none;
  }
}

.nav-bottom__list {
  list-style: none;
  margin: 0;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 2px;
}

.nav-bottom__item {
  flex: 1;
}

/* Bouton */
.nav-bottom__btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  width: 100%;
  height: 100%;
  padding: var(--space-1-5) var(--space-1);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--nav-item-color);
  transition: var(--transition-interactive);
  -webkit-tap-highlight-color: transparent;
}

.nav-bottom__btn:active {
  transform: scale(0.90);
}

/* Wrapper icône */
.nav-bottom__icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 28px;
}

/* Pill actif — pseudo-élément sur le bouton entier (icon + label) */
.nav-bottom__btn {
  position: relative;
}

.nav-bottom__btn--active::before {
  content: '';
  position: absolute;
  inset: 4px 6px;
  border-radius: 999px;
  background: var(--lilac, #D2ADEB);
  box-shadow: 0 3px 12px rgba(210, 173, 235, 0.50);
  animation: pillIn var(--duration-slow) var(--ease-spring) forwards;
  z-index: 0;
}

.nav-bottom__icon-wrap,
.nav-bottom__label {
  position: relative;
  z-index: 1;
}

@keyframes pillIn {
  from { transform: scaleX(0.5) scaleY(0.7); opacity: 0; }
  to   { transform: scaleX(1)   scaleY(1);   opacity: 1; }
}

/* Icône */
.nav-bottom__icon {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  color: inherit;
  transition: transform var(--duration-fast) var(--ease-spring);
}

.nav-bottom__btn--active .nav-bottom__icon {
  color: white;
  transform: translateY(-1px) scale(1.05);
}

/* Label */
.nav-bottom__label {
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.02em;
  color: inherit;
  transition: color var(--duration-fast) var(--ease-out),
              font-weight var(--duration-fast);
  white-space: nowrap;
  line-height: 1;
}

.nav-bottom__btn--active {
  color: white;
}

.nav-bottom__btn--active .nav-bottom__label {
  font-weight: var(--font-weight-semibold);
}


/* ════════════════════════════════════════════════════
   BADGE (partagé sidebar + bottom)
   ════════════════════════════════════════════════════ */

.nav-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  background: var(--status-danger-icon);
  color: hsl(0, 0%, 100%);
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  position: relative;
  z-index: 1;
  box-shadow: 0 1px 4px hsla(4, 65%, 52%, 0.35);
  animation: badgeIn var(--duration-slow) var(--ease-spring);
}

.nav-badge--dot {
  position: absolute;
  top: 0;
  right: 2px;
  min-width: 8px;
  height: 8px;
  padding: 0;
  border: 1.5px solid var(--bg-app);
}

@keyframes badgeIn {
  from { transform: scale(0); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}


/* ════════════════════════════════════════════════════
   LAYOUT HELPER — offset sidebar pour le contenu
   ════════════════════════════════════════════════════ */

.app-content-with-sidebar {
  margin-left: 0;
  transition: margin-left var(--duration-slow) var(--ease-snappy);
}

@media (min-width: 768px) {
  .app-content-with-sidebar {
    margin-left: var(--nav-sidebar-width);
  }
}

`;

export default NavigationBar;
