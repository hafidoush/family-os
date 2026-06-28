import { useState, useEffect } from 'react';
import { conseillerManques } from '../../../../core/ai/conseillerManquesService';
import type { ResultatManques } from '../../../../core/ai/conseillerManquesService';
import './ManquesSheet.css';

interface Props {
  menuId: string;
  onClose: () => void;
}

export function ManquesSheet({ menuId, onClose }: Props) {
  const [manques, setManques] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState<ResultatManques | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleAnalyser = async () => {
    if (!manques.trim()) return;
    setLoading(true);
    setErreur(null);
    setResultat(null);
    try {
      const res = await conseillerManques(menuId, manques.trim());
      setResultat(res);
    } catch (err: unknown) {
      const e = err as { openaiError?: string; message?: string };
      if (e.openaiError === 'quota') setErreur('Quota IA dépassé — réessayez dans quelques minutes');
      else if (e.message === 'Aucune recette dans ce menu') setErreur('Ajoutez des recettes au menu avant d\'analyser');
      else setErreur('Erreur IA — vérifiez votre clé OpenAI dans les paramètres');
    } finally {
      setLoading(false);
    }
  };

  const STATUT_CONFIG = {
    ok:       { label: 'Faisable',  color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    adapter:  { label: 'À adapter', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    remplacer:{ label: 'À remplacer', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  };

  return (
    <div className="mq__overlay" onClick={onClose}>
      <div className="mq__sheet" onClick={e => e.stopPropagation()}>

        <div className="mq__handle" />

        <div className="mq__header">
          <span className="mq__title">Que faire avec ce que j'ai ?</span>
          <button className="mq__close" onClick={onClose}>✕</button>
        </div>

        {!resultat ? (
          <>
            <div className="mq__body">
              <p className="mq__hint">Dis-moi ce qui te manque et je t'indique comment adapter tes repas de la semaine.</p>
              <textarea
                className="mq__input"
                placeholder="Ex : il me manque du riz, du saumon et du pesto…"
                value={manques}
                onChange={e => setManques(e.target.value)}
                rows={3}
              />
              {erreur && <p className="mq__erreur">{erreur}</p>}
            </div>
            <div className="mq__footer">
              <button
                className="mq__btn"
                onClick={handleAnalyser}
                disabled={loading || !manques.trim()}
              >
                {loading ? <><span className="mq__spinner" /> Analyse en cours…</> : '✦ Analyser mes repas'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mq__body">
              {resultat.analyses.map(a => {
                const cfg = STATUT_CONFIG[a.statut];
                return (
                  <div key={a.recetteId} className="mq__recette" style={{ background: cfg.bg }}>
                    <div className="mq__recette-header">
                      <span className="mq__recette-nom">{a.recetteNom}</span>
                      <span className="mq__badge" style={{ color: cfg.color, borderColor: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                    {a.conseil && <p className="mq__conseil">{a.conseil}</p>}
                  </div>
                );
              })}

              {resultat.recetteJoker && (
                <div className="mq__joker">
                  <div className="mq__joker-label">✦ Recette joker</div>
                  <div className="mq__joker-nom">{resultat.recetteJoker.nom}</div>
                  {resultat.recetteJoker.temps && (
                    <div className="mq__joker-temps">{resultat.recetteJoker.temps}</div>
                  )}
                  <p className="mq__joker-desc">{resultat.recetteJoker.description}</p>
                </div>
              )}
            </div>
            <div className="mq__footer">
              <button className="mq__btn mq__btn--ghost" onClick={() => { setResultat(null); setManques(''); }}>
                Nouvelle analyse
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
