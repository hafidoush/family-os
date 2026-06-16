import { useBudgetAlertes } from '../hooks/useBudgetAlertes';
import './WidgetBudgetAlerte.css';

export function WidgetBudgetAlerte() {
  const alertes = useBudgetAlertes();

  // Widget conditionnel — ne s'affiche pas si aucune alerte
  if (!alertes || alertes.length === 0) return null;

  return (
    <div className="widget-card area-budget widget-budget">
      <div className="widget-header">
        <span className="widget-title">⚠️ Alerte budget</span>
      </div>
      <ul className="widget-budget__list">
        {alertes.map((env) => (
          <li key={env.id} className="widget-budget__item">
            <div className="widget-budget__info">
              <span className="widget-budget__nom">{env.nom}</span>
              <span className="widget-budget__restant">
                {env.montantRestant >= 0
                  ? `${env.montantRestant.toFixed(0)} € restants`
                  : `${Math.abs(env.montantRestant).toFixed(0)} € de dépassement`}
              </span>
            </div>
            <div className="widget-budget__bar-wrap">
              <div
                className={`widget-budget__bar ${env.pctConsomme >= 100 ? 'widget-budget__bar--over' : ''}`}
                style={{ width: `${Math.min(env.pctConsomme, 100)}%` }}
              />
            </div>
            <span className="widget-budget__pct">{env.pctConsomme}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}