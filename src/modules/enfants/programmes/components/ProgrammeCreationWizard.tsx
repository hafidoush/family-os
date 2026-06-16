import { useState, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import './ProgrammeCreationWizard.css'
import { db } from '../../../../core/db/database'
import { genererProgrammeIA } from '../../../../core/ai/programmePedagogiqueService'
import { activerProgramme } from '../services/programmeService'
import type {
  DureeProgramme,
  DifficulteActivite,
  DomaineCompetence,
} from '../../../../shared/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const THEMES_SUGGERES = [
  { valeur: 'animaux_ferme',   label: 'Ferme',     icone: '🐄' },
  { valeur: 'espace',          label: 'Espace',    icone: '🚀' },
  { valeur: 'printemps',       label: 'Printemps', icone: '🌸' },
  { valeur: 'automne',         label: 'Automne',   icone: '🍂' },
  { valeur: 'emotions',        label: 'Émotions',  icone: '🫀' },
  { valeur: 'ocean',           label: 'Océan',     icone: '🌊' },
  { valeur: 'corps_humain',    label: 'Mon corps', icone: '🧠' },
  { valeur: 'dinosaures',      label: 'Dinos',     icone: '🦕' },
  { valeur: 'nature_foret',    label: 'Forêt',     icone: '🌿' },
  { valeur: 'arts_creatifs',   label: 'Arts',      icone: '🎨' },
]

const DUREES: { valeur: DureeProgramme; label: string; detail: string }[] = [
  { valeur: 'hebdomadaire', label: '1 semaine',   detail: '1 sem.' },
  { valeur: 'mensuel',      label: '1 mois',      detail: '4 sem.' },
  { valeur: 'trimestriel',  label: 'Trimestre',   detail: '12 sem.' },
  { valeur: 'saisonnier',   label: 'Saison',      detail: '~3 mois' },
  { valeur: 'annuel',       label: 'Annuel',      detail: '48 sem.' },
]

const DIFFICULTES: { valeur: DifficulteActivite; label: string; desc: string }[] = [
  { valeur: 'facile',    label: 'Facile',     desc: 'Activités simples et courtes' },
  { valeur: 'moyen',     label: 'Équilibré',  desc: 'Mix préparation et spontané' },
  { valeur: 'difficile', label: 'Ambitieux',  desc: 'Préparation plus élaborée' },
]

const DOMAINES_COMPETENCES: { domaine: DomaineCompetence; label: string; icone: string }[] = [
  { domaine: 'langage',           label: 'Langage',        icone: '💬' },
  { domaine: 'mathematiques',     label: 'Maths',          icone: '🔢' },
  { domaine: 'motricite',         label: 'Motricité',      icone: '🤸' },
  { domaine: 'pre_ecriture',      label: 'Pré-écriture',   icone: '✏️' },
  { domaine: 'creativite',        label: 'Créativité',     icone: '🎨' },
  { domaine: 'decouverte_monde',  label: 'Découverte',     icone: '🌍' },
  { domaine: 'social_emotionnel', label: 'Émotions',       icone: '🫀' },
  { domaine: 'vie_pratique',      label: 'Vie pratique',   icone: '🏠' },
  { domaine: 'cognitif',          label: 'Cognitif',       icone: '🧩' },
]

const ETAPES_GENERATION = [
  { label: 'Analyse du catalogue',        icone: '📚' },
  { label: 'Construction de la progression', icone: '🗺️' },
  { label: 'Génération des activités',    icone: '✨' },
  { label: 'Planification du matériel',   icone: '🛒' },
  { label: 'Enregistrement',              icone: '💾' },
]

// ─── Types internes ───────────────────────────────────────────────────────────

interface FormState {
  theme: string
  themeLibre: string
  enfantsCibles: string[]
  duree: DureeProgramme
  frequenceParSemaine: number
  difficulte: DifficulteActivite
  dateDebut: string
  domainesCibles: DomaineCompetence[]
  objectifLibre: string
}

interface GenState {
  etape: string
  pct: number
  etapeIndex: number
  erreur: string | null
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function calculerAge(dateNaissance: string): number {
  const diff = Date.now() - new Date(dateNaissance).getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
  onSuccess: (programmeId: string) => void
  enfantIdPreselectionne?: string
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function ProgrammeCreationWizard({ onClose, onSuccess, enfantIdPreselectionne }: Props) {
  const [etape, setEtape] = useState(1)
  const [form, setForm] = useState<FormState>({
    theme:              '',
    themeLibre:         '',
    enfantsCibles:      enfantIdPreselectionne ? [enfantIdPreselectionne] : [],
    duree:              'mensuel',
    frequenceParSemaine: 3,
    difficulte:         'moyen',
    dateDebut:          todayISO(),
    domainesCibles:     [],
    objectifLibre:      '',
  })
  const [gen, setGen] = useState<GenState>({ etape: '', pct: 0, etapeIndex: -1, erreur: null })

  // Données Dexie
  const membres = useLiveQuery(
    () => db.membres.filter(m => m.role === 'enfant' && m.actif).toArray(),
    [], []
  )
  const enfants = useLiveQuery(
    () => db.enfants.toArray(),
    [], []
  )
  const activitesCatalogue = useLiveQuery(
    () => db.activites.filter(a => !a.archive).toArray(),
    [], []
  )

  // Aperçu catalogue filtré par thème
  const aperçuCatalogue = useMemo(() => {
    if (!form.theme) return []
    const themeNorm = form.theme.replace(/_/g, ' ').toLowerCase()
    return (activitesCatalogue ?? [])
      .filter(a => {
        const dans = [a.nom, a.objectifPedagogique, ...(a.tags ?? [])].join(' ').toLowerCase()
        return themeNorm.split(' ').some(mot => dans.includes(mot))
      })
      .slice(0, 5)
  }, [form.theme, activitesCatalogue])

  const themeReel = form.theme === '__autre__' ? form.themeLibre : form.theme

  // ── Handlers form ────────────────────────────────────────────────────────

  const toggleEnfant = useCallback((id: string) => {
    setForm(f => ({
      ...f,
      enfantsCibles: f.enfantsCibles.includes(id)
        ? f.enfantsCibles.filter(e => e !== id)
        : [...f.enfantsCibles, id],
    }))
  }, [])

  const toggleDomaine = useCallback((d: DomaineCompetence) => {
    setForm(f => ({
      ...f,
      domainesCibles: f.domainesCibles.includes(d)
        ? f.domainesCibles.filter(x => x !== d)
        : [...f.domainesCibles, d],
    }))
  }, [])

  // ── Validation par étape ─────────────────────────────────────────────────

  const canNext = useMemo(() => {
    if (etape === 1) return themeReel.trim().length > 0 && form.enfantsCibles.length > 0
    if (etape === 2) return true
    if (etape === 3) return true
    return false
  }, [etape, themeReel, form.enfantsCibles])

  // ── Calcul ages pour le prompt ────────────────────────────────────────────

  const [ageMin, ageMax] = useMemo(() => {
    if (form.enfantsCibles.length === 0) return [2, 6]
    const ages = form.enfantsCibles.map(id => {
      const enfant = enfants?.find(e => e.id === id)
      return enfant ? calculerAge(enfant.dateNaissance) : 4
    })
    return [Math.min(...ages), Math.max(...ages)]
  }, [form.enfantsCibles, enfants])

  // ── Génération ───────────────────────────────────────────────────────────

  const lancerGeneration = useCallback(async () => {
    setEtape(5)
    setGen({ etape: 'Démarrage…', pct: 5, etapeIndex: 0, erreur: null })

    // Compétences cibles depuis les domaines sélectionnés
    const competencesCiblees = form.domainesCibles.length > 0
      ? (await db.competences.filter(c => form.domainesCibles.includes(c.domaine)).toArray())
          .map(c => c.id)
      : []

    const objectifsSpecifiques = form.objectifLibre.trim()
      ? [form.objectifLibre.trim()]
      : []

    try {
      const resultat = await genererProgrammeIA({
        theme:               themeReel,
        ageMin,
        ageMax,
        nbEnfants:           form.enfantsCibles.length,
        enfantsCibles:       form.enfantsCibles,
        duree:               form.duree,
        frequenceParSemaine: form.frequenceParSemaine,
        difficulte:          form.difficulte,
        objectifsSpecifiques,
        dateDebut:           form.dateDebut,
        onProgress: (etapeLabel, pct) => {
          const idx = ETAPES_GENERATION.findIndex(e => etapeLabel.includes(e.label.split(' ')[0]))
          setGen({ etape: etapeLabel, pct, etapeIndex: Math.max(0, idx), erreur: null })
        },
      })

      await activerProgramme(resultat.programmeId)
      onSuccess(resultat.programmeId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      setGen(g => ({ ...g, etapeIndex: -1, erreur: msg }))
    }
  }, [form, themeReel, ageMin, ageMax, onSuccess])

  // ── Render étapes ─────────────────────────────────────────────────────────

  const TOTAL_ETAPES = 5

  const renderEtape1 = () => (
    <>
      <h2 className="wizard-step-title">Quel thème ?</h2>
      <p className="wizard-step-subtitle">Choisissez un sujet ou saisissez le vôtre</p>

      <div className="wizard-grid">
        {THEMES_SUGGERES.map(t => (
          <button
            key={t.valeur}
            className={`wizard-choice${form.theme === t.valeur ? ' wizard-choice--selected' : ''}`}
            onClick={() => setForm(f => ({ ...f, theme: t.valeur, themeLibre: '' }))}
          >
            <span className="wizard-choice__icon">{t.icone}</span>
            <span className="wizard-choice__label">{t.label}</span>
          </button>
        ))}
        <button
          className={`wizard-choice${form.theme === '__autre__' ? ' wizard-choice--selected' : ''}`}
          onClick={() => setForm(f => ({ ...f, theme: '__autre__' }))}
        >
          <span className="wizard-choice__icon">✏️</span>
          <span className="wizard-choice__label">Autre</span>
        </button>
      </div>

      {form.theme === '__autre__' && (
        <div className="wizard-theme-input-wrap">
          <input
            className="wizard-theme-other"
            placeholder="Ex : les transports, l'hiver, les pirates…"
            value={form.themeLibre}
            onChange={e => setForm(f => ({ ...f, themeLibre: e.target.value }))}
            autoFocus
          />
        </div>
      )}

      <div className="wizard-field" style={{ marginTop: 28 }}>
        <label className="wizard-field__label">Pour quel(s) enfant(s)</label>
        <div className="wizard-enfants">
          {(membres ?? []).map(membre => {
            const enfant = enfants?.find(e => e.id === membre.id)
            const age = enfant ? calculerAge(enfant.dateNaissance) : null
            const sel = form.enfantsCibles.includes(membre.id)
            return (
              <button
                key={membre.id}
                className={`wizard-enfant-pill${sel ? ' wizard-enfant-pill--selected' : ''}`}
                style={{ '--enfant-color': membre.couleur ?? '#A78BFA' } as React.CSSProperties}
                onClick={() => toggleEnfant(membre.id)}
              >
                <div
                  className="wizard-enfant-pill__avatar"
                  style={{ background: membre.couleur ?? '#A78BFA' }}
                >
                  {membre.prenom[0].toUpperCase()}
                </div>
                <span className="wizard-enfant-pill__name">{membre.prenom}</span>
                {age !== null && (
                  <span className="wizard-enfant-pill__age">{age} an{age > 1 ? 's' : ''}</span>
                )}
                <div className="wizard-enfant-pill__check">
                  {sel && <span style={{ fontSize: 12 }}>✓</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )

  const renderEtape2 = () => (
    <>
      <h2 className="wizard-step-title">Durée et rythme</h2>
      <p className="wizard-step-subtitle">Définissez l'intensité du programme</p>

      <div className="wizard-field">
        <label className="wizard-field__label">Durée du programme</label>
        <div className="wizard-grid wizard-grid--3">
          {DUREES.map(d => (
            <button
              key={d.valeur}
              className={`wizard-choice${form.duree === d.valeur ? ' wizard-choice--selected' : ''}`}
              onClick={() => setForm(f => ({ ...f, duree: d.valeur }))}
            >
              <span className="wizard-choice__label">{d.label}</span>
              <span className="wizard-choice__sub">{d.detail}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-field">
        <label className="wizard-field__label">
          Fréquence — {form.frequenceParSemaine} activité{form.frequenceParSemaine > 1 ? 's' : ''} par semaine
        </label>
        <div className="wizard-slider-row">
          <input
            type="range"
            className="wizard-slider"
            min={1} max={7} step={1}
            value={form.frequenceParSemaine}
            style={{ '--pct': `${((form.frequenceParSemaine - 1) / 6) * 100}%` } as React.CSSProperties}
            onChange={e => setForm(f => ({ ...f, frequenceParSemaine: Number(e.target.value) }))}
          />
          <span className="wizard-slider-value">
            {form.frequenceParSemaine}×
          </span>
        </div>
      </div>

      <div className="wizard-field">
        <label className="wizard-field__label">Niveau de préparation</label>
        <div className="wizard-grid">
          {DIFFICULTES.map(d => (
            <button
              key={d.valeur}
              className={`wizard-choice${form.difficulte === d.valeur ? ' wizard-choice--selected' : ''}`}
              onClick={() => setForm(f => ({ ...f, difficulte: d.valeur }))}
            >
              <span className="wizard-choice__label">{d.label}</span>
              <span className="wizard-choice__sub">{d.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-field">
        <label className="wizard-field__label">Date de début</label>
        <input
          type="date"
          className="wizard-field__input"
          value={form.dateDebut}
          min={todayISO()}
          onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))}
        />
      </div>
    </>
  )

  const renderEtape3 = () => (
    <>
      <h2 className="wizard-step-title">Objectifs
        <span className="wizard-badge-optional">optionnel</span>
      </h2>
      <p className="wizard-step-subtitle">Orientez l'IA vers des compétences précises</p>

      <div className="wizard-field">
        <label className="wizard-field__label">Compétences à travailler</label>
        <div className="wizard-chips">
          {DOMAINES_COMPETENCES.map(({ domaine, label, icone }) => (
            <button
              key={domaine}
              className={`wizard-chip${form.domainesCibles.includes(domaine) ? ' wizard-chip--selected' : ''}`}
              onClick={() => toggleDomaine(domaine)}
            >
              {icone} {label}
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-field">
        <label className="wizard-field__label">Objectif spécifique
          <span className="wizard-badge-optional">libre</span>
        </label>
        <textarea
          className="wizard-field__textarea"
          placeholder="Ex : apprendre les noms des animaux en français et en arabe, travailler la préhension pince…"
          value={form.objectifLibre}
          rows={3}
          onChange={e => setForm(f => ({ ...f, objectifLibre: e.target.value }))}
        />
      </div>
    </>
  )

  const renderEtape4 = () => {
    const nbCatalogue = aperçuCatalogue.length
    const nbSemaines = { hebdomadaire: 1, mensuel: 4, trimestriel: 12, saisonnier: 12, annuel: 48 }[form.duree]
    const totalActivites = nbSemaines * form.frequenceParSemaine
    const nbGenerer = Math.max(0, totalActivites - nbCatalogue)

    return (
      <>
        <h2 className="wizard-step-title">Prêt à générer</h2>
        <p className="wizard-step-subtitle">Voici ce que l'IA va construire pour vous</p>

        {nbCatalogue > 0 && (
          <div className="wizard-preview">
            <p className="wizard-preview__title">
              {nbCatalogue} activité{nbCatalogue > 1 ? 's' : ''} trouvée{nbCatalogue > 1 ? 's' : ''} dans votre catalogue
            </p>
            {aperçuCatalogue.map(a => (
              <div key={a.id} className="wizard-preview__item">
                <div className="wizard-preview__dot" />
                <span className="wizard-preview__nom">{a.nom}</span>
                {a.dureeEstimee && (
                  <span className="wizard-preview__meta">{a.dureeEstimee} min</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="wizard-preview-ia">
          <span className="wizard-preview-ia__icon">✨</span>
          <p className="wizard-preview-ia__text">
            L'IA va créer <strong>{nbGenerer} activité{nbGenerer > 1 ? 's' : ''}</strong> sur{' '}
            <strong>{nbSemaines} semaine{nbSemaines > 1 ? 's' : ''}</strong>,
            réparties en 5 phases pédagogiques progressives.
            Chaque activité inclut le matériel, le déroulement et les préparations à prévoir.
          </p>
        </div>

        <div className="wizard-field">
          <label className="wizard-field__label">Récapitulatif</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Thème', themeReel.replace(/_/g, ' ')],
              ['Enfants', (membres ?? []).filter(m => form.enfantsCibles.includes(m.id)).map(m => m.prenom).join(', ')],
              ['Durée', DUREES.find(d => d.valeur === form.duree)?.label ?? ''],
              ['Fréquence', `${form.frequenceParSemaine}× par semaine`],
              ['Début', formatDate(form.dateDebut)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'var(--font-body)' }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  const renderEtape5 = () => (
    <div className="wizard-generation">
      {gen.erreur ? (
        <>
          <div className="wizard-error" style={{ width: '100%', marginBottom: 24 }}>
            <p className="wizard-error__title">Une erreur est survenue</p>
            <p className="wizard-error__msg">{gen.erreur}</p>
          </div>
          <button
            className="wizard-btn-next"
            style={{ width: '100%' }}
            onClick={lancerGeneration}
          >
            Réessayer
          </button>
        </>
      ) : (
        <>
          <div className="wizard-generation__spinner" />
          <p className="wizard-generation__etape">{gen.etape}</p>
          <div className="wizard-generation__bar-wrap">
            <div className="wizard-generation__bar" style={{ width: `${gen.pct}%` }} />
          </div>
          <p className="wizard-generation__pct">{gen.pct}%</p>

          <div className="wizard-generation__steps">
            {ETAPES_GENERATION.map((e, i) => {
              const isDone   = i < gen.etapeIndex
              const isActive = i === gen.etapeIndex
              return (
                <div
                  key={i}
                  className={`wizard-gen-step${isActive ? ' wizard-gen-step--active' : ''}${isDone ? ' wizard-gen-step--done' : ''}`}
                >
                  <div className="wizard-gen-step__icon">
                    {isDone ? '✓' : e.icone}
                  </div>
                  <span className="wizard-gen-step__label">{e.label}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )

  const STEP_LABELS = ['Thème', 'Rythme', 'Objectifs', 'Aperçu', 'Génération']

  return (
    <div className="wizard-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="wizard-sheet">
        <div className="wizard-handle" />

        {/* En-tête */}
        <div className="wizard-header">
          <div className="wizard-header__top">
            <span className="wizard-header__title">Nouveau programme</span>
            {etape < 5 && (
              <button className="wizard-header__close" onClick={onClose} aria-label="Fermer">✕</button>
            )}
          </div>

          {/* Indicateur étapes */}
          <div className="wizard-steps">
            {STEP_LABELS.map((_, i) => (
              <div
                key={i}
                className={`wizard-step-dot${i + 1 === etape ? ' wizard-step-dot--active' : ''}${i + 1 < etape ? ' wizard-step-dot--done' : ''}`}
              />
            ))}
          </div>
          <p className="wizard-step-label">Étape {etape} sur {TOTAL_ETAPES} — {STEP_LABELS[etape - 1]}</p>
        </div>

        {/* Corps */}
        <div className="wizard-body">
          {etape === 1 && renderEtape1()}
          {etape === 2 && renderEtape2()}
          {etape === 3 && renderEtape3()}
          {etape === 4 && renderEtape4()}
          {etape === 5 && renderEtape5()}
          {/* Espace bas pour ne pas que le footer masque le contenu */}
          <div style={{ height: 20 }} />
        </div>

        {/* Pied de page navigation */}
        {etape < 5 && (
          <div className="wizard-footer">
            {etape > 1 && (
              <button className="wizard-btn-back" onClick={() => setEtape(e => e - 1)}>
                Retour
              </button>
            )}
            {etape < 4 ? (
              <button
                className="wizard-btn-next"
                disabled={!canNext}
                onClick={() => setEtape(e => e + 1)}
              >
                Continuer
              </button>
            ) : (
              <button
                className="wizard-btn-next"
                onClick={lancerGeneration}
              >
                Générer le programme
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
