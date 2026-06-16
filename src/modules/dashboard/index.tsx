import { WidgetContextuel }        from './components/WidgetContextuel';
import { WidgetProgrammeActif }    from './components/WidgetProgrammeActif';
import { WidgetCapturePensee }     from './components/WidgetCapturePensee';
import { WidgetProgrammeDuJour }   from './components/WidgetProgrammeDuJour';
import { WidgetHumeurs }           from './components/WidgetHumeurs';
import { WidgetHumeurBulle }       from './components/WidgetHumeurBulle';
import { WidgetMenu }              from './components/WidgetMenu';
import { WidgetCalendrier }        from './components/WidgetCalendrier';
import { WidgetPensees }           from './components/WidgetPensees';
import { WidgetAchatsMoment }     from './components/WidgetAchatsMoment';
import { WidgetRushMatin }         from './components/WidgetRushMatin';
import { WidgetBilanSemaine }      from './components/WidgetBilanSemaine';
import { WidgetOrchestrateur }     from './components/WidgetOrchestrateur';
import { HumeurSaisieSheet }       from './components/HumeurSaisieSheet';
import { NotificationBanner }      from './components/NotificationBanner';
import './components/DashboardGrid.css';
import './components/WidgetCard.css';

export default function Dashboard() {
  return (
    <main className="dashboard">
      <WidgetRushMatin />
      <WidgetBilanSemaine />
      <NotificationBanner />
      <WidgetContextuel />
      <WidgetCapturePensee />
      <WidgetOrchestrateur />
      <WidgetProgrammeDuJour />
      <WidgetProgrammeActif />
      <WidgetCalendrier />
      <div className="dashboard-duo">
        <WidgetPensees />
        <WidgetAchatsMoment />
      </div>
      <WidgetMenu />

      <div className="dashboard-grid">
        <WidgetHumeurs />
      </div>

      <HumeurSaisieSheet />
    </main>
  );
}
