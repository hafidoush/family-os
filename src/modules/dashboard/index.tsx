import { BandeauMateriel }          from './components/BandeauMateriel';
import { WidgetContextuel }        from './components/WidgetContextuel';
import { WidgetProgrammeActif }    from './components/WidgetProgrammeActif';
import { WidgetCapturePensee }     from './components/WidgetCapturePensee';
import { WidgetProgrammeDuJour }   from './components/WidgetProgrammeDuJour';
import { WidgetMenu }              from './components/WidgetMenu';
import { WidgetCalendrier }        from './components/WidgetCalendrier';
import { WidgetPensees }           from './components/WidgetPensees';
import { WidgetAchatsMoment }     from './components/WidgetAchatsMoment';
import { WidgetRushMatin }         from './components/WidgetRushMatin';
import { WidgetBilanSemaine }      from './components/WidgetBilanSemaine';
import { WidgetOrchestrateur }     from './components/WidgetOrchestrateur';
import { NotificationBanner }      from './components/NotificationBanner';
import { HumeurSaisieSheet }       from './components/HumeurSaisieSheet';
import './components/DashboardGrid.css';
import './components/WidgetCard.css';

export default function Dashboard() {
  return (
    <main className="dashboard">
      <WidgetRushMatin />
      <WidgetBilanSemaine />
      <NotificationBanner />
      <BandeauMateriel />
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

      <HumeurSaisieSheet />
    </main>
  );
}
