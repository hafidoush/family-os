import React, { useState } from 'react';
import { useFamilyHumeurs } from '../hooks/useFamilyHumeurs';
import { useDashboardStore } from '../stores/dashboardStore';
import './WidgetHumeurs.css';

// ─── Constants ─────────────────────────────────────────────────────────────────

const HUMEUR_EMOJIS: Record<number, string> = {
  1: '😔', 2: '😕', 3: '😐', 4: '🙂', 5: '😊', 6: '😄', 7: '🤩',
};

const HUMEUR_LABELS: Record<number, string> = {
  1: 'Très difficile', 2: 'Difficile', 3: 'Pas bien', 4: 'Neutre', 5: 'Bien', 6: 'Super', 7: 'Excellent',
};

// ─── Brain icon ────────────────────────────────────────────────────────────────

const BrainIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2a2.5 2.5 0 0 1 0 5H9a4 4 0 0 0-4 4v.5"/>
    <path d="M14.5 2a2.5 2.5 0 0 0 0 5H15a4 4 0 0 1 4 4v.5"/>
    <path d="M5 11.5A4 4 0 0 0 9 15.5h.5"/>
    <path d="M19 11.5a4 4 0 0 1-4 4H14.5"/>
    <path d="M9.5 15.5a3 3 0 0 0 5 0"/>
    <path d="M12 15.5V22"/>
  </svg>
);

// ─── Person picker sheet ───────────────────────────────────────────────────────

function PersonPickerSheet({
  humeurs,
  onSelect,
  onClose,
}: {
  humeurs: NonNullable<ReturnType<typeof useFamilyHumeurs>>;
  onSelect: (membreId: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="mood-picker-backdrop" onClick={onClose} />
      <div className="mood-picker-sheet" role="dialog" aria-modal>
        <div className="mood-picker-sheet__handle" />
        <p className="mood-picker-sheet__title">Qui enregistre son humeur ?</p>
        <div className="mood-picker-sheet__grid">
          {humeurs.map(({ membre, humeurAujourdhui }) => (
            <button
              key={membre.id}
              className="mood-picker-person"
              onClick={() => onSelect(membre.id)}
            >
              <div className="mood-picker-person__avatar-wrap">
                {membre.avatar ? (
                  <img src={membre.avatar} alt={membre.prenom} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div
                    className="mood-picker-person__initiale"
                    style={{ background: membre.couleur ?? 'var(--primary-light)' }}
                  >
                    {membre.prenom[0].toUpperCase()}
                  </div>
                )}
                {humeurAujourdhui !== null && (
                  <span className="mood-picker-person__badge">
                    {HUMEUR_EMOJIS[humeurAujourdhui as number]}
                  </span>
                )}
              </div>
              <span className="mood-picker-person__prenom">{membre.prenom}</span>
              {humeurAujourdhui !== null ? (
                <span className="mood-picker-person__status mood-picker-person__status--done">
                  {HUMEUR_LABELS[humeurAujourdhui as number]}
                </span>
              ) : (
                <span className="mood-picker-person__status mood-picker-person__status--pending">
                  Non saisi
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Widget principal ──────────────────────────────────────────────────────────

export function WidgetHumeurs() {
  const humeurs = useFamilyHumeurs();
  const openHumeurSheet = useDashboardStore((s) => s.openHumeurSheet);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePersonSelect = (membreId: string) => {
    setPickerOpen(false);
    openHumeurSheet(membreId);
  };

  const loggedCount = humeurs?.filter((h) => h.humeurAujourdhui !== null).length ?? 0;
  const totalCount = humeurs?.length ?? 0;

  return (
    <>
      <div className="widget-mood-card area-humeurs">
        {/* ── Header ── */}
        <div className="widget-mood-card__header">
          <span className="widget-mood-card__label">État d'esprit</span>
          <BrainIcon />
        </div>

        {/* ── Main question ── */}
        <p className="widget-mood-card__question">
          Comment vous sentez-vous aujourd'hui ?
        </p>

        {/* ── CTA button ── */}
        <button
          className="widget-mood-card__cta"
          onClick={() => setPickerOpen(true)}
        >
          Enregistrer mon humeur
        </button>
      </div>

      {/* ── Person picker ── */}
      {pickerOpen && humeurs && (
        <PersonPickerSheet
          humeurs={humeurs}
          onSelect={handlePersonSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
