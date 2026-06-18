import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import './ActiviteDetail.css'
import { marquerActiviteRealisee, marquerActiviteSautee } from '../services/programmeService'
import { db } from '../../../../core/db/database'
import type { ActiviteProgramme } from '../../../../shared/types'

// ─── Utilitaires ──────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  decouverte:        { label: 'Découverte',       color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
  exploration:       { label: 'Exploration',       color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  manipulation:      { label: 'Manipulation',      color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
  approfondissement: { label: 'Approfondissement', color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)' },
  consolidation:     { label: 'Consolidation',     color: '#EC4899', bg: 'rgba(236,72,153,0.10)' },
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface ActiviteDetailProps {
  activite: ActiviteProgramme
  onClose: () => void
}

export function ActiviteDetail({ activite, onClose }: ActiviteDetailProps) {
  const [notes, setNotes] = useState(activite.notesParent ?? '')
  const [enCours, setEnCours] = useState(false)
  const [confirmerSaut, setConfirmerSaut] = useState(false)

  const competencesMap = useLiveQuery(async () => {
    if (!activite.competencesTravaillees?.length) return new Map<string, string>()
    const comps = await db.competences.where('id').anyOf(activite.competencesTravaillees).toArray()
    return new Map(comps.map(c => [c.id, c.nom]))
  }, [activite.competencesTravaillees?.join(',')]) ?? new Map<string, string>()

  const phase = PHASE_CONFIG[activite.phase]
  const estRealisee = activite.statutRealisation === 'realise'
  const estSautee = activite.statutRealisation === 'saute'

  const handleRealiser = async () => {
    setEnCours(true)
    await marquerActiviteRealisee(activite.id, notes || undefined)
    setEnCours(false)
    onClose()
  }

  const handleSauter = async () => {
    await marquerActiviteSautee(activite.id)
    onClose()
  }

  return (
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-sheet" onClick={e => e.stopPropagation()}>

        <div className="ad-handle" />

        {/* Header */}
        <div className="ad-header">
          <div className="ad-header__top">
            <button className="ad-close" onClick={onClose}>×</button>
            <div className="ad-header__badges">
              {phase && (
                <span
                  className="ad-badge"
                  style={{ color: phase.color, background: phase.bg }}
                >
                  {phase.label}
                </span>
              )}
              {activite.source === 'generee_ia' && (
                <span className="ad-badge ad-badge--ia">IA</span>
              )}
            </div>
          </div>

          <h2 className="ad-titre">{activite.titre}</h2>

          <div className="ad-meta-row">
            <span className="ad-meta-item">⏱ {activite.duree} min</span>
            {activite.tempsPreparation > 0 && (
              <span className="ad-meta-item">🧺 {activite.tempsPreparation} min prép.</span>
            )}
            <span className="ad-meta-item">👶 {activite.ageRecommande}</span>
          </div>

          {(estRealisee || estSautee) && (
            <div className={`ad-statut-banner ad-statut-banner--${activite.statutRealisation}`}>
              {estRealisee ? '✓ Réalisée' : '— Sautée'}
              {activite.dateRealisation && (
                <span className="ad-statut-banner__date">
                  {new Date(activite.dateRealisation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Contenu scrollable */}
        <div className="ad-content">

          {/* Objectif pédagogique */}
          <div className="ad-section">
            <h3 className="ad-section__title">Objectif</h3>
            <p className="ad-section__text">{activite.objectifPedagogique}</p>
          </div>

          {/* Description */}
          {activite.description && (
            <div className="ad-section">
              <h3 className="ad-section__title">Description</h3>
              <p className="ad-section__text">{activite.description}</p>
            </div>
          )}

          {/* Déroulement */}
          {activite.deroulement.length > 0 && (
            <div className="ad-section">
              <h3 className="ad-section__title">Déroulement</h3>
              <div className="ad-etapes">
                {activite.deroulement.map((etape, i) => (
                  <div key={i} className="ad-etape">
                    <div className="ad-etape__num">{i + 1}</div>
                    <div className="ad-etape__body">
                      <p className="ad-etape__texte">{etape.texte}</p>
                      {etape.duree && (
                        <span className="ad-etape__duree">{etape.duree} min</span>
                      )}
                      {etape.conseil && (
                        <p className="ad-etape__conseil">💡 {etape.conseil}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matériel nécessaire */}
          {activite.materielNecessaire.length > 0 && (
            <div className="ad-section">
              <h3 className="ad-section__title">Matériel nécessaire</h3>
              <div className="ad-materiel-list">
                {activite.materielNecessaire.map((m, i) => (
                  <div key={i} className="ad-materiel-item">
                    <span className="ad-materiel-item__dot" style={{ background: m.aAcheter ? '#EF4444' : '#22C55E' }} />
                    <span className="ad-materiel-item__nom">{m.nom}</span>
                    {m.quantite && (
                      <span className="ad-materiel-item__qte">{m.quantite}</span>
                    )}
                    {m.aAcheter && (
                      <span className="ad-materiel-item__acheter">à acheter</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matériel optionnel */}
          {activite.materielOptionnel.length > 0 && (
            <div className="ad-section">
              <h3 className="ad-section__title">Matériel optionnel</h3>
              <div className="ad-materiel-list">
                {activite.materielOptionnel.map((m, i) => (
                  <div key={i} className="ad-materiel-item ad-materiel-item--opt">
                    <span className="ad-materiel-item__dot" style={{ background: '#D1D5DB' }} />
                    <span className="ad-materiel-item__nom">{m.nom}</span>
                    {m.quantite && (
                      <span className="ad-materiel-item__qte">{m.quantite}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variantes par âge */}
          {activite.variantes && activite.variantes.length > 0 && (
            <div className="ad-section">
              <h3 className="ad-section__title">Variantes par âge</h3>
              <div className="ad-variantes">
                {activite.variantes.map((v, i) => (
                  <div key={i} className="ad-variante">
                    <span className="ad-variante__age">{v.ageMin}–{v.ageMax} ans</span>
                    <p className="ad-variante__text">{v.adaptation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compétences travaillées */}
          {activite.competencesTravaillees.length > 0 && (
            <div className="ad-section">
              <h3 className="ad-section__title">Compétences</h3>
              <div className="ad-tags">
                {activite.competencesTravaillees.map((c, i) => (
                  <span key={i} className="ad-tag">
                    {competencesMap.get(c) ?? c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes parent (uniquement si pas encore réalisée) */}
          {!estRealisee && !estSautee && (
            <div className="ad-section">
              <h3 className="ad-section__title">Notes (optionnel)</h3>
              <textarea
                className="ad-notes"
                placeholder="Comment s'est passée l'activité ?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Notes existantes si réalisée */}
          {estRealisee && activite.notesParent && (
            <div className="ad-section">
              <h3 className="ad-section__title">Notes</h3>
              <p className="ad-section__text ad-section__text--notes">{activite.notesParent}</p>
            </div>
          )}

        </div>

        {/* Footer actions */}
        {!estRealisee && !estSautee && (
          <div className="ad-footer">
            <button
              className="ad-btn ad-btn--primary"
              onClick={handleRealiser}
              disabled={enCours}
            >
              {enCours ? 'Enregistrement…' : 'Marquer comme réalisée'}
            </button>
            {!confirmerSaut ? (
              <button className="ad-btn ad-btn--ghost" onClick={() => setConfirmerSaut(true)}>
                Sauter cette activité
              </button>
            ) : (
              <div className="ad-confirm-saut">
                <span className="ad-confirm-saut__text">Confirmer ?</span>
                <button className="ad-btn ad-btn--sm ad-btn--danger" onClick={handleSauter}>Oui</button>
                <button className="ad-btn ad-btn--sm ad-btn--ghost" onClick={() => setConfirmerSaut(false)}>Non</button>
              </div>
            )}
          </div>
        )}

        {(estRealisee || estSautee) && (
          <div className="ad-footer">
            <button className="ad-btn ad-btn--ghost" onClick={onClose}>Fermer</button>
          </div>
        )}

      </div>
    </div>
  )
}
