import { useState }                  from 'react';
import { BandeauMateriel }           from './components/BandeauMateriel';
import { WidgetContextuel }          from './components/WidgetContextuel';
import { WidgetCapturePensee }       from './components/WidgetCapturePensee';
import { WidgetProgrammeDuJour }     from './components/WidgetProgrammeDuJour';
import { WidgetMenu }                from './components/WidgetMenu';
import { WidgetCalendrier }          from './components/WidgetCalendrier';
import { WidgetPenseesAchats }       from './components/WidgetPenseesAchats';
import { WidgetBilanSemaine }        from './components/WidgetBilanSemaine';
import { WidgetOrchestrateur }       from './components/WidgetOrchestrateur';
import { WidgetProgrammeActif }      from './components/WidgetProgrammeActif';
import { NotificationBanner }        from './components/NotificationBanner';
import { HumeurSaisieSheet }         from './components/HumeurSaisieSheet';
import './components/DashboardGrid.css';
import './components/WidgetCard.css';

export default function Dashboard() {
  const [showSecondaires, setShowSecondaires] = useState(false);

  return (
    <main className="dashboard">

      {/* ── Système ── */}
      <NotificationBanner />
      <BandeauMateriel />
      <WidgetContextuel />

      {/* ── Hero + capture ── */}
      <WidgetCapturePensee />

      {/* ── Activités du jour ── */}
      <WidgetProgrammeDuJour />

      {/* ── Dans ma tête / À acheter ── */}
      <div style={{ marginTop: 8 }}>
        <WidgetPenseesAchats />
      </div>

      {/* ── Menu de la semaine ── */}
      <WidgetMenu />

{/* ── Widgets secondaires ── */}
      {showSecondaires && (
        <div className="dashboard-secondaires">
          <WidgetOrchestrateur />
          <WidgetProgrammeActif />
          <WidgetBilanSemaine />
        </div>
      )}

      <button
        className="dashboard-toggle-secondaires"
        onClick={() => setShowSecondaires(v => !v)}
      >
        {showSecondaires ? 'Réduire' : '+ 3 autres widgets'}
      </button>

      <HumeurSaisieSheet />
    </main>
  );
}
