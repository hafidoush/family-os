import { useState } from 'react'
import './SectionProgrammes.css'
import { useEnfantsStore } from '../../stores/enfantsStore'
import { useProgrammes, usePreparationSemaine } from '../hooks/useProgrammes'
import { exporterMaterielVersCourses } from '../services/preparationService'
import { ProgrammeCreationWizard } from './ProgrammeCreationWizard'
import { ProgrammeDetail } from './ProgrammeDetail'
import { PartageSheet } from '../../../../modules/partage/PartageSheet'
import { SectionProgrammeAnnuel } from './SectionProgrammeAnnuel'

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function labelStatut(statut: string): { label: string; color: string } {
  switch (statut) {
    case 'actif':     return { label: 'En cours',   color: '#22C55E' }
    case 'brouillon': return { label: 'Brouillon',  color: '#F59E0B' }
    case 'pause':     return { label: 'En pause',   color: '#9CA3AF' }
    case 'termine':   return { label: 'Terminé',    color: '#A78BFA' }
    default:          return { label: statut,        color: '#9CA3AF' }
  }
}

const URGENCE_CONFIG = {
  immediate:        { label: 'Urgent',          color: '#EF4444', bg: 'rgba(239,68,68,0.08)'    },
  cette_semaine:    { label: 'Cette semaine',   color: '#F59E0B', bg: 'rgba(245,158,11,0.08)'   },
  prochaine_semaine:{ label: 'Semaine prochaine', color: '#6B7280', bg: 'rgba(107,114,128,0.06)' },
}

const TYPE_ICONE: Record<string, string> = {
  imprimer:  '🖨',
  decoupe:   '✂️',
  preparer:  '🧺',
  acheter:   '🛒',
  anticiper: '📅',
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function SectionProgrammes() {
  const { activeEnfantId } = useEnfantsStore()
  const [wizardOuvert, setWizardOuvert] = useState(false)
  const [programmeDetailId, setProgrammeDetailId] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<'programmes' | 'preparer' | 'annuel'>('programmes')
  const [partageOpen, setPartageOpen] = useState(false)

  const programmes = useProgrammes(activeEnfantId ?? undefined)
  const { bilan, isLoading: bilanLoading } = usePreparationSemaine()

  const toutesLesTaches = bilan
    ? [...bilan.urgentes, ...bilan.cetteSemaine, ...bilan.prochaineSemaine]
    : []
  const nbUrgent = bilan?.urgentes.length ?? 0

  const handleSuccess = (id: string) => {
    setWizardOuvert(false)
    setProgrammeDetailId(id)
  }

  return (
    <div className="programmes-section">

      {/* Onglets internes */}
      <div className="programmes-inner-tabs">
        <button
          className={`programmes-inner-tab${onglet === 'programmes' ? ' programmes-inner-tab--active' : ''}`}
          onClick={() => setOnglet('programmes')}
        >
          Programmes
        </button>
        <button
          className={`programmes-inner-tab${onglet === 'preparer' ? ' programmes-inner-tab--active' : ''}`}
          onClick={() => setOnglet('preparer')}
        >
          À préparer
          {nbUrgent > 0 && (
            <span className="programmes-badge-urgent">{nbUrgent}</span>
          )}
        </button>
        <button
          className={`programmes-inner-tab${onglet === 'annuel' ? ' programmes-inner-tab--active' : ''}`}
          onClick={() => setOnglet('annuel')}
        >
          Annuel
        </button>
      </div>

      {onglet === 'annuel' && <SectionProgrammeAnnuel />}

      {onglet === 'programmes' ? (
        <>
          {/* Bouton créer */}
          <button className="programmes-create-btn" onClick={() => setWizardOuvert(true)}>
            <span className="programmes-create-btn__icon">✨</span>
            <div className="programmes-create-btn__text">
              <span className="programmes-create-btn__title">Nouveau programme IA</span>
              <span className="programmes-create-btn__sub">Générer un parcours pédagogique complet</span>
            </div>
            <span className="programmes-create-btn__arrow">→</span>
          </button>

          {/* Liste programmes */}
          {(programmes ?? []).length === 0 ? (
            <div className="programmes-empty">
              <p className="programmes-empty__icon">🎯</p>
              <p className="programmes-empty__title">Aucun programme</p>
              <p className="programmes-empty__sub">
                Créez votre premier programme pédagogique et laissez l'IA organiser les activités pour vous.
              </p>
            </div>
          ) : (
            <div className="programmes-list">
              {(programmes ?? []).map(p => {
                const st = labelStatut(p.statut)
                return (
                  <div
                    key={p.id}
                    className="programme-card"
                    onClick={() => setProgrammeDetailId(p.id)}
                  >
                    <div className="programme-card__header">
                      <div className="programme-card__meta">
                        <span className="programme-card__statut" style={{ color: st.color }}>
                          {st.label}
                        </span>
                        {p.genereParIA && (
                          <span className="programme-card__ia-badge">IA</span>
                        )}
                      </div>
                      <div className="programme-card__progress-ring">
                        <span className="programme-card__pct">{p.progression}%</span>
                      </div>
                    </div>

                    <h3 className="programme-card__titre">{p.titre}</h3>

                    <div className="programme-card__dates">
                      {formatDate(p.dateDebut)} → {formatDate(p.dateFin)}
                    </div>

                    {/* Barre de progression */}
                    <div className="programme-card__bar-wrap">
                      <div
                        className="programme-card__bar"
                        style={{ width: `${p.progression}%` }}
                      />
                    </div>

                    <div className="programme-card__footer">
                      <span className="programme-card__semaines">
                        {p.semaines.length} semaine{p.semaines.length > 1 ? 's' : ''}
                      </span>
                      <span className="programme-card__freq">
                        {p.frequenceParSemaine}× / sem.
                      </span>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : onglet === 'preparer' ? (
        /* ── Vue "À préparer" ── */
        <div className="preparer-section">
          {bilanLoading ? (
            <div className="preparer-loading">Chargement…</div>
          ) : toutesLesTaches.length === 0 && (bilan?.materielAcheter.length ?? 0) === 0 ? (
            <div className="programmes-empty">
              <p className="programmes-empty__icon">✅</p>
              <p className="programmes-empty__title">Tout est prêt</p>
              <p className="programmes-empty__sub">
                Aucune préparation en attente pour cette semaine.
              </p>
            </div>
          ) : (
            <>
              {/* Tâches par urgence */}
              {(['urgentes', 'cetteSemaine', 'prochaineSemaine'] as const).map(cle => {
                const taches = bilan?.[cle] ?? []
                if (taches.length === 0) return null
                const cfg = URGENCE_CONFIG[
                  cle === 'urgentes' ? 'immediate'
                  : cle === 'cetteSemaine' ? 'cette_semaine'
                  : 'prochaine_semaine'
                ]
                return (
                  <div key={cle} className="preparer-group">
                    <div className="preparer-group__header">
                      <span className="preparer-group__dot" style={{ background: cfg.color }} />
                      <span className="preparer-group__label" style={{ color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                    {taches.map(t => (
                      <div
                        key={t.id}
                        className="preparer-tache"
                        style={{ background: cfg.bg }}
                      >
                        <span className="preparer-tache__icone">{TYPE_ICONE[t.type] ?? '📌'}</span>
                        <div className="preparer-tache__body">
                          <p className="preparer-tache__titre">{t.titre}</p>
                          <p className="preparer-tache__meta">
                            {t.programmeTitre} · {t.dureeEstimee} min
                          </p>
                        </div>
                        {t.faite && <span className="preparer-tache__done">✓</span>}
                      </div>
                    ))}
                  </div>
                )
              })}

              {/* Matériel à acheter */}
              {(bilan?.materielAcheter.length ?? 0) > 0 && (
                <div className="preparer-group">
                  <div className="preparer-group__header">
                    <span className="preparer-group__dot" style={{ background: '#7C3AED' }} />
                    <span className="preparer-group__label" style={{ color: '#7C3AED' }}>
                      Matériel à acheter
                    </span>
                    <button
                      className="preparer-group__action"
                      onClick={() => exporterMaterielVersCourses(bilan!.materielAcheter)}
                    >
                      + Courses
                    </button>
                    <button
                      className="preparer-group__action"
                      onClick={() => setPartageOpen(true)}
                    >
                      📤
                    </button>
                  </div>
                  {bilan!.materielAcheter.map((m, i) => (
                    <div key={i} className="preparer-tache">
                      <span className="preparer-tache__icone">🛒</span>
                      <div className="preparer-tache__body">
                        <p className="preparer-tache__titre">{m.nom}</p>
                        <p className="preparer-tache__meta">{m.activiteTitre}</p>
                      </div>
                      {m.quantite && (
                        <span className="preparer-tache__done" style={{ color: '#9CA3AF' }}>
                          {m.quantite}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {/* Wizard */}

      {wizardOuvert && (
        <ProgrammeCreationWizard
          onClose={() => setWizardOuvert(false)}
          onSuccess={handleSuccess}
          enfantIdPreselectionne={activeEnfantId ?? undefined}
        />
      )}

      {/* Partage préparation */}
      {partageOpen && bilan && (
        <PartageSheet
          titre="Préparation de la semaine"
          items={[
            ...bilan.urgentes,
            ...bilan.cetteSemaine,
            ...bilan.prochaineSemaine,
          ].map((t, i) => ({ label: t.titre, ordre: i }))}
          onClose={() => setPartageOpen(false)}
        />
      )}

      {/* Détail programme */}
      {programmeDetailId && (
        <ProgrammeDetail
          programmeId={programmeDetailId}
          onClose={() => setProgrammeDetailId(null)}
        />
      )}
    </div>
  )
}
