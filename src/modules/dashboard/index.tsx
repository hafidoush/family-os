import { useState }                  from 'react';
import { BandeauMateriel }           from './components/BandeauMateriel';
import { WidgetContextuel }          from './components/WidgetContextuel';
import { WidgetCapturePensee }       from './components/WidgetCapturePensee';
import { WidgetProgrammeDuJour }     from './components/WidgetProgrammeDuJour';
import { WidgetMenu }                from './components/WidgetMenu';
import { WidgetCalendrier }          from './components/WidgetCalendrier';
import { WidgetPensees }             from './components/WidgetPensees';
import { WidgetAchatsMoment }        from './components/WidgetAchatsMoment';
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

      {/* ── Capture rapide côte à côte ── */}
      <div className="dashboard-duo">
        <WidgetPensees />
        <WidgetAchatsMoment />
      </div>

      {/* ── Menu de la semaine ── */}
      <WidgetMenu />

      {/* ── Événements ── */}
      <WidgetCalendrier />

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
