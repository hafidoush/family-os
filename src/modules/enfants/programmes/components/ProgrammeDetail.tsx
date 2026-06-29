import { useState } from 'react'
import './ProgrammeDetail.css'
import { useProgrammeDetail, useActivitesSemaine } from '../hooks/useProgrammes'
import { activerProgramme, archiverProgramme } from '../services/programmeService'
import { ActiviteDetail } from './ActiviteDetail'
import { SectionMateriel } from './SectionMateriel'
import { SectionPreparation } from './SectionPreparation'
import type { ActiviteProgramme } from '../../../../shared/types'

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  decouverte:        { label: 'Découverte',      color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
  exploration:       { label: 'Exploration',      color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  manipulation:      { label: 'Manipulation',     color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
  approfondissement: { label: 'Approfondissement',color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)' },
  consolidation:     { label: 'Consolidation',    color: '#EC4899', bg: 'rgba(236,72,153,0.10)' },
}

const STATUT_REALISATION: Record<string, { icone: string; color: string }> = {
  a_faire:  { icone: '○', color: '#D1D5DB' },
  planifie: { icone: '◑', color: '#F59E0B' },
  realise:  { icone: '●', color: '#22C55E' },
  saute:    { icone: '—', color: '#9CA3AF' },
}

// ─── Ligne activité dans la liste de la semaine ───────────────────────────────

function ActiviteRow({
  activite,
  onClick,
}: {
  activite: ActiviteProgramme
  onClick: () => void
}) {
  const st = STATUT_REALISATION[activite.statutRealisation] ?? STATUT_REALISATION.a_faire
  const phase = PHASE_CONFIG[activite.phase]

  return (
    <button className="pd-activite-row" onClick={onClick}>
      <span className="pd-activite-row__statut" style={{ color: st.color }}>
        {st.icone}
      </span>
      <div className="pd-activite-row__body">
        <span className="pd-activite-row__titre">{activite.titre}</span>
        <span className="pd-activite-row__meta">
          <span className="pd-activite-row__phase" style={{ color: phase?.color, background: phase?.bg }}>
            {phase?.label ?? activite.phase}
          </span>
          <span className="pd-activite-row__duree">{activite.duree} min</span>
        </span>
      </div>
      <span className="pd-activite-row__arrow">›</span>
    </button>
  )
}

// ─── Semaine dans le détail ───────────────────────────────────────────────────

function SemaineSection({
  programmeId,
  semaineNumero,
  totalSemaines,
  onSelect,
}: {
  programmeId: string
  semaineNumero: number
  totalSemaines: number
  onSelect: (a: ActiviteProgramme) => void
}) {
  const activites = useActivitesSemaine(programmeId, semaineNumero) ?? []
  const realisees = activites.filter(a => a.statutRealisation === 'realise').length

  return (
    <div className="pd-semaine">
      <div className="pd-semaine__header">
        <div className="pd-semaine__info">
          <span className="pd-semaine__label">Semaine {semaineNumero}</span>
          <span className="pd-semaine__count">{realisees}/{activites.length} réalisée{realisees > 1 ? 's' : ''}</span>
        </div>
        <div className="pd-semaine__bar-wrap">
          <div
            className="pd-semaine__bar"
            style={{ width: activites.length > 0 ? `${Math.round(realisees / activites.length * 100)}%` : '0%' }}
          />
        </div>
      </div>

      {activites.length === 0 ? (
        <p className="pd-semaine__empty">Aucune activité générée pour cette semaine.</p>
      ) : (
        <div className="pd-activites-list">
          {activites.map(a => (
            <ActiviteRow key={a.id} activite={a} onClick={() => onSelect(a)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface ProgrammeDetailProps {
  programmeId: string
  onClose: () => void
}

export function ProgrammeDetail({ programmeId, onClose }: ProgrammeDetailProps) {
  const { programme, isLoading } = useProgrammeDetail(programmeId)
  const [onglet, setOnglet] = useState<'activites' | 'materiel' | 'preparation'>('activites')
  const [semaineActive, setSemaineActive] = useState(1)
  const [activiteOuverte, setActiviteOuverte] = useState<ActiviteProgramme | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [introOuverte, setIntroOuverte] = useState(false)

  if (isLoading) {
    return (
      <div className="pd-overlay" onClick={onClose}>
        <div className="pd-sheet" onClick={e => e.stopPropagation()}>
          <div className="pd-loading">Chargement…</div>
        </div>
      </div>
    )
  }

  if (!programme) return null

  const totalSemaines = programme.semaines.length || 1
  const semaine = programme.semaines.find(s => s.numero === semaineActive)

  const handleActiver = async () => {
    await activerProgramme(programmeId)
  }

  const handleArchiver = async () => {
    await archiverProgramme(programmeId)
    onClose()
  }

  return (
    <>
      <div className="pd-overlay" onClick={onClose}>
        <div className="pd-sheet" onClick={e => e.stopPropagation()}>

          {/* Poignée */}
          <div className="pd-handle" />

          {/* Header */}
          <div className="pd-header">
            <div className="pd-header__top">
              <button className="pd-close" onClick={onClose}>×</button>
              <div className="pd-header__badges">
                {programme.genereParIA && (
                  <span className="pd-badge pd-badge--ia">IA</span>
                )}
                <span
                  className="pd-badge"
                  style={{
                    color: programme.statut === 'actif' ? '#22C55E'
                      : programme.statut === 'brouillon' ? '#F59E0B'
                      : '#9CA3AF',
                    background: programme.statut === 'actif' ? 'rgba(34,197,94,0.10)'
                      : programme.statut === 'brouillon' ? 'rgba(245,158,11,0.10)'
                      : 'rgba(156,163,175,0.10)',
                  }}
                >
                  {programme.statut === 'actif' ? 'En cours'
                    : programme.statut === 'brouillon' ? 'Brouillon'
                    : programme.statut === 'pause' ? 'En pause'
                    : programme.statut === 'termine' ? 'Terminé'
                    : programme.statut}
                </span>
              </div>
            </div>

            <h2 className="pd-titre">{programme.titre}</h2>
            <p className="pd-theme">{programme.theme}</p>

            <div className="pd-stats">
              <div className="pd-stat">
                <span className="pd-stat__val">{programme.progression}%</span>
                <span className="pd-stat__lbl">progression</span>
              </div>
              <div className="pd-stat">
                <span className="pd-stat__val">{totalSemaines}</span>
                <span className="pd-stat__lbl">semaine{totalSemaines > 1 ? 's' : ''}</span>
              </div>
              <div className="pd-stat">
                <span className="pd-stat__val">{programme.frequenceParSemaine}×</span>
                <span className="pd-stat__lbl">/ sem.</span>
              </div>
              <div className="pd-stat">
                <span className="pd-stat__val">{formatDate(programme.dateDebut)}</span>
                <span className="pd-stat__lbl">début</span>
              </div>
            </div>

            <div className="pd-progress-bar-wrap">
              <div className="pd-progress-bar" style={{ width: `${programme.progression}%` }} />
            </div>
          </div>

          {/* Onglets Activités / Matériel */}
          <div className="pd-onglets">
            <button
              className={`pd-onglet${onglet === 'activites' ? ' pd-onglet--active' : ''}`}
              onClick={() => setOnglet('activites')}
            >
              Activités
            </button>
            <button
              className={`pd-onglet${onglet === 'materiel' ? ' pd-onglet--active' : ''}`}
              onClick={() => setOnglet('materiel')}
            >
              📦 Matériel
            </button>
            <button
              className={`pd-onglet${onglet === 'preparation' ? ' pd-onglet--active' : ''}`}
              onClick={() => setOnglet('preparation')}
            >
              🧰 Préparation
            </button>
          </div>

          {/* Vue Matériel */}
          {onglet === 'materiel' && (
            <div className="pd-content">
              <SectionMateriel programme={programme} />
            </div>
          )}

          {/* Vue Préparation */}
          {onglet === 'preparation' && (
            <div className="pd-content">
              <SectionPreparation programme={programme} />
            </div>
          )}

          {/* Vue Activités */}
          {onglet === 'activites' && (
            <>
              {programme.introductionTheme && (
                <div className="pd-intro">
                  <button className="pd-intro__toggle" onClick={() => setIntroOuverte(o => !o)}>
                    <span>🎬 Introduction du thème</span>
                    <span className="pd-intro__chevron">{introOuverte ? '▾' : '▸'}</span>
                  </button>
                  {introOuverte && (
                    <div className="pd-intro__body">
                      {programme.introductionTheme.histoire && (
                        <div className="pd-intro__bloc">
                          <span className="pd-intro__label">Histoire de départ</span>
                          <p className="pd-intro__text">{programme.introductionTheme.histoire}</p>
                        </div>
                      )}
                      {programme.introductionTheme.presentation && (
                        <div className="pd-intro__bloc">
                          <span className="pd-intro__label">Présenter le thème</span>
                          <p className="pd-intro__text">{programme.introductionTheme.presentation}</p>
                        </div>
                      )}
                      {programme.introductionTheme.rituelLancement && (
                        <div className="pd-intro__bloc">
                          <span className="pd-intro__label">Rituel de lancement</span>
                          <p className="pd-intro__text">{programme.introductionTheme.rituelLancement}</p>
                        </div>
                      )}
                      {programme.introductionTheme.miseEnScene && (
                        <div className="pd-intro__bloc">
                          <span className="pd-intro__label">Mise en scène</span>
                          <p className="pd-intro__text">{programme.introductionTheme.miseEnScene}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="pd-semaine-nav">
                <button
                  className="pd-semaine-nav__btn"
                  disabled={semaineActive <= 1}
                  onClick={() => setSemaineActive(s => Math.max(1, s - 1))}
                >
                  ←
                </button>
                <div className="pd-semaine-nav__center">
                  {semaine ? (
                    <>
                      <span className="pd-semaine-nav__titre">{semaine.titre}</span>
                      <span className="pd-semaine-nav__num">Semaine {semaineActive} / {totalSemaines}</span>
                    </>
                  ) : (
                    <span className="pd-semaine-nav__num">Semaine {semaineActive} / {totalSemaines}</span>
                  )}
                </div>
                <button
                  className="pd-semaine-nav__btn"
                  disabled={semaineActive >= totalSemaines}
                  onClick={() => setSemaineActive(s => Math.min(totalSemaines, s + 1))}
                >
                  →
                </button>
              </div>

              {semaine?.objectif && (
                <div className="pd-objectif">
                  <span className="pd-objectif__icon">🎯</span>
                  <p className="pd-objectif__text">{semaine.objectif}</p>
                </div>
              )}

              <div className="pd-content">
                <SemaineSection
                  programmeId={programmeId}
                  semaineNumero={semaineActive}
                  totalSemaines={totalSemaines}
                  onSelect={setActiviteOuverte}
                />

                {semaineActive === totalSemaines && programme.conclusion && (
                  <div className="pd-conclusion">
                    <h3 className="pd-conclusion__title">🏁 Mission finale / conclusion</h3>
                    {programme.conclusion.jeuFinal && (
                      <div className="pd-conclusion__bloc">
                        <span className="pd-conclusion__label">Jeu final</span>
                        <p className="pd-conclusion__text">{programme.conclusion.jeuFinal}</p>
                      </div>
                    )}
                    {programme.conclusion.activiteRestitution && (
                      <div className="pd-conclusion__bloc">
                        <span className="pd-conclusion__label">Restitution</span>
                        <p className="pd-conclusion__text">{programme.conclusion.activiteRestitution}</p>
                      </div>
                    )}
                    {programme.conclusion.ideeSouvenir && (
                      <div className="pd-conclusion__bloc">
                        <span className="pd-conclusion__label">Souvenir à garder</span>
                        <p className="pd-conclusion__text">{programme.conclusion.ideeSouvenir}</p>
                      </div>
                    )}
                    {programme.conclusion.questionsBilan && programme.conclusion.questionsBilan.length > 0 && (
                      <div className="pd-conclusion__bloc">
                        <span className="pd-conclusion__label">Questions de bilan</span>
                        <ul className="pd-conclusion__questions">
                          {programme.conclusion.questionsBilan.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="pd-footer">
            {programme.statut === 'brouillon' && (
              <button className="pd-btn pd-btn--primary" onClick={handleActiver}>
                Activer ce programme
              </button>
            )}
            {!confirmArchive ? (
              <button className="pd-btn pd-btn--ghost" onClick={() => setConfirmArchive(true)}>
                Archiver
              </button>
            ) : (
              <div className="pd-confirm-archive">
                <span className="pd-confirm-archive__text">Confirmer l'archivage ?</span>
                <button className="pd-btn pd-btn--danger" onClick={handleArchiver}>Oui</button>
                <button className="pd-btn pd-btn--ghost" onClick={() => setConfirmArchive(false)}>Non</button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Détail activité (empilé par-dessus) */}
      {activiteOuverte && (
        <ActiviteDetail
          activite={activiteOuverte}
          onClose={() => setActiviteOuverte(null)}
        />
      )}
    </>
  )
}
