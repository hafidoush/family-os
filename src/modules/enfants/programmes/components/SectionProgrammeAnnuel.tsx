/**
 * FAMILY OS — Section Programme Annuel
 * Grille 12 mois + génération IA + édition mois par mois
 */

import { useState, useEffect } from 'react'
import { useProgrammesAnnuels } from '../hooks/useProgrammes'
import { useEnfantsStore } from '../../stores/enfantsStore'
import {
  createProgrammeAnnuel,
  updateRepartitionMois,
} from '../services/programmeService'
import { genererProgrammeAnnuelIA } from '../../../../core/ai/programmePedagogiqueService'
import { db } from '../../../../core/db/database'
import { ProgrammeDetail } from './ProgrammeDetail'
import type { RepartitionMois, ProgrammeAnnuel } from '../../../../shared/types'
import './SectionProgrammeAnnuel.css'

// ─── Config thèmes → couleur ──────────────────────────────────────────────────

const THEME_COULEURS: Record<string, { bg: string; color: string; emoji: string }> = {
  rentree:         { bg: '#EDE9FE', color: '#6D28D9', emoji: '🎒' },
  rentree_ecole:   { bg: '#EDE9FE', color: '#6D28D9', emoji: '🎒' },
  automne:         { bg: '#FEF3C7', color: '#92400E', emoji: '🍂' },
  halloween:       { bg: '#FEE2E2', color: '#991B1B', emoji: '🎃' },
  nature:          { bg: '#D1FAE5', color: '#065F46', emoji: '🌿' },
  animaux:         { bg: '#D1FAE5', color: '#065F46', emoji: '🐾' },
  hiver:           { bg: '#DBEAFE', color: '#1E40AF', emoji: '❄️' },
  neige:           { bg: '#DBEAFE', color: '#1E40AF', emoji: '⛄' },
  noel:            { bg: '#FEE2E2', color: '#991B1B', emoji: '🎄' },
  fetes:           { bg: '#FEE2E2', color: '#991B1B', emoji: '🎉' },
  espace:          { bg: '#EDE9FE', color: '#4C1D95', emoji: '🚀' },
  corps:           { bg: '#FCE7F3', color: '#9D174D', emoji: '🧠' },
  emotions:        { bg: '#FDF4FF', color: '#7E22CE', emoji: '💛' },
  arts:            { bg: '#FFF7ED', color: '#9A3412', emoji: '🎨' },
  musique:         { bg: '#FFF7ED', color: '#9A3412', emoji: '🎵' },
  printemps:       { bg: '#ECFDF5', color: '#065F46', emoji: '🌸' },
  jardin:          { bg: '#ECFDF5', color: '#065F46', emoji: '🌱' },
  ete:             { bg: '#FEF9C3', color: '#713F12', emoji: '☀️' },
  mer:             { bg: '#CFFAFE', color: '#155E75', emoji: '🌊' },
  voyage:          { bg: '#CFFAFE', color: '#155E75', emoji: '✈️' },
  ramadan:         { bg: '#FDF4FF', color: '#6B21A8', emoji: '🌙' },
  culture:         { bg: '#FEF9C3', color: '#713F12', emoji: '🌍' },
  sciences:        { bg: '#DBEAFE', color: '#1E3A8A', emoji: '🔬' },
  alimentation:    { bg: '#ECFDF5', color: '#14532D', emoji: '🍎' },
  cuisine:         { bg: '#FFF7ED', color: '#7C2D12', emoji: '👩‍🍳' },
  famille:         { bg: '#FCE7F3', color: '#831843', emoji: '👨‍👩‍👧' },
  amitie:          { bg: '#FCE7F3', color: '#831843', emoji: '🤝' },
  langages:        { bg: '#EDE9FE', color: '#3B0764', emoji: '📚' },
  lecture:         { bg: '#EDE9FE', color: '#3B0764', emoji: '📖' },
  sport:           { bg: '#D1FAE5', color: '#064E3B', emoji: '⚽' },
  motricite:       { bg: '#D1FAE5', color: '#064E3B', emoji: '🤸' },
}

const DEFAULT_THEME = { bg: '#F3F4F6', color: '#4B5563', emoji: '📅' }

function getThemeConfig(theme: string) {
  const key = theme.toLowerCase().replace(/[^a-z_]/g, '_')
  return THEME_COULEURS[key] ?? THEME_COULEURS[key.split('_')[0]] ?? DEFAULT_THEME
}

const MOIS_LABELS = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// ─── Carte mois ───────────────────────────────────────────────────────────────

function CarteMois({
  mois,
  repartition,
  estMoisCourant,
  onClick,
}: {
  mois: number
  repartition?: RepartitionMois
  estMoisCourant: boolean
  onClick: () => void
}) {
  const cfg = repartition ? getThemeConfig(repartition.theme) : DEFAULT_THEME

  return (
    <button
      className={`pa-carte-mois${estMoisCourant ? ' pa-carte-mois--courant' : ''}${repartition ? ' pa-carte-mois--rempli' : ''}`}
      style={repartition ? { background: cfg.bg, borderColor: cfg.color + '30' } : undefined}
      onClick={onClick}
    >
      <span className="pa-carte-mois__num">{mois}</span>
      <span className="pa-carte-mois__label">{MOIS_LABELS[mois].slice(0, 3)}</span>
      {repartition ? (
        <>
          <span className="pa-carte-mois__emoji">{cfg.emoji}</span>
          <span className="pa-carte-mois__theme" style={{ color: cfg.color }}>
            {repartition.sousTheme ?? repartition.theme.replace(/_/g, ' ')}
          </span>
        </>
      ) : (
        <span className="pa-carte-mois__vide">+</span>
      )}
      {estMoisCourant && <span className="pa-carte-mois__dot" />}
    </button>
  )
}

// ─── Panneau édition mois ─────────────────────────────────────────────────────

function PanneauMois({
  mois,
  repartition,
  onSave,
  onClose,
  onOuvrirProgramme,
}: {
  mois: number
  repartition?: RepartitionMois
  onSave: (r: RepartitionMois) => void
  onClose: () => void
  onOuvrirProgramme?: (id: string) => void
}) {
  const [theme, setTheme] = useState(repartition?.theme ?? '')
  const [sousTheme, setSousTheme] = useState(repartition?.sousTheme ?? '')
  const [raison, setRaison] = useState(repartition?.raisonPedagogique ?? '')
  const [competences, setCompetences] = useState(
    repartition?.competencesPrioritaires.join(', ') ?? ''
  )

  const cfg = theme ? getThemeConfig(theme) : DEFAULT_THEME

  const handleSave = () => {
    onSave({
      mois,
      theme: theme || 'libre',
      sousTheme: sousTheme || undefined,
      raisonPedagogique: raison || undefined,
      competencesPrioritaires: competences
        ? competences.split(',').map(c => c.trim()).filter(Boolean)
        : [],
      programmeId: repartition?.programmeId,
    })
    onClose()
  }

  return (
    <div className="pa-panneau-overlay" onClick={onClose}>
      <div className="pa-panneau" onClick={e => e.stopPropagation()}>
        <div className="pa-panneau__handle" />

        <div className="pa-panneau__header" style={{ background: cfg.bg }}>
          <button className="pa-panneau__close" onClick={onClose}>×</button>
          <span className="pa-panneau__emoji">{cfg.emoji}</span>
          <h3 className="pa-panneau__titre" style={{ color: cfg.color }}>
            {MOIS_LABELS[mois]}
          </h3>
        </div>

        <div className="pa-panneau__body">
          <div className="pa-panneau__field">
            <label className="pa-panneau__label">Thème</label>
            <input
              className="pa-panneau__input"
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="ex : nature, espace, émotions…"
            />
          </div>

          <div className="pa-panneau__field">
            <label className="pa-panneau__label">Sous-thème / précision</label>
            <input
              className="pa-panneau__input"
              value={sousTheme}
              onChange={e => setSousTheme(e.target.value)}
              placeholder="ex : les insectes, le système solaire…"
            />
          </div>

          <div className="pa-panneau__field">
            <label className="pa-panneau__label">Compétences ciblées</label>
            <input
              className="pa-panneau__input"
              value={competences}
              onChange={e => setCompetences(e.target.value)}
              placeholder="langage, motricité fine, social… (séparés par virgule)"
            />
          </div>

          <div className="pa-panneau__field">
            <label className="pa-panneau__label">Pourquoi ce mois-ci ?</label>
            <textarea
              className="pa-panneau__textarea"
              value={raison}
              onChange={e => setRaison(e.target.value)}
              placeholder="Note libre — contexte, saison, intention…"
              rows={3}
            />
          </div>

          {repartition?.programmeId && (
            <button
              className="pa-panneau__prog-link"
              onClick={() => onOuvrirProgramme?.(repartition.programmeId!)}
            >
              <span>📋</span>
              <span>Voir le programme de ce mois</span>
              <span>›</span>
            </button>
          )}
        </div>

        <div className="pa-panneau__footer">
          <button className="pa-panneau__btn pa-panneau__btn--primary" onClick={handleSave}>
            Enregistrer
          </button>
          <button className="pa-panneau__btn pa-panneau__btn--ghost" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function SectionProgrammeAnnuel() {
  const { activeEnfantId } = useEnfantsStore()
  const programmesAnnuels = useProgrammesAnnuels(activeEnfantId ?? undefined)
  const programmeAnnuel = programmesAnnuels?.[0] ?? null

  const [moisSelectionne, setMoisSelectionne] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genEtape, setGenEtape] = useState('')
  const [genPct, setGenPct] = useState(0)
  const [programmeDetailId, setProgrammeDetailId] = useState<string | null>(null)

  const now = new Date()
  const annee = now.getFullYear()
  const moisCourant = now.getMonth() + 1

  // 12 mois glissants à partir du mois courant (numéros 1-12)
  const moisGlissants = Array.from({ length: 12 }, (_, i) => {
    const m = ((moisCourant - 1 + i) % 12) + 1
    return m
  })

  // Supprime automatiquement les enregistrements corrompus (repartitionMensuelle absente)
  useEffect(() => {
    if (programmeAnnuel && !Array.isArray(programmeAnnuel.repartitionMensuelle)) {
      db.programmesAnnuels.delete(programmeAnnuel.id)
    }
  }, [programmeAnnuel])

  // Mapping mois → repartition
  const repartitionMap: Record<number, RepartitionMois> = {}
  if (programmeAnnuel && Array.isArray(programmeAnnuel.repartitionMensuelle)) {
    for (const r of programmeAnnuel.repartitionMensuelle) {
      repartitionMap[r.mois] = r
    }
  }

  const handleGenerer = async () => {
    if (!activeEnfantId) return
    setGenerating(true)
    setGenEtape('Analyse des compétences…')
    setGenPct(0)

    try {
      const enfantData = await import('../../../../core/db/database').then(m =>
        m.db.enfants.get(activeEnfantId)
      )
      const ageMin = enfantData
        ? Math.floor((Date.now() - new Date(enfantData.dateNaissance).getTime()) / (365.25 * 24 * 3600 * 1000))
        : 3

      const repartition = await genererProgrammeAnnuelIA({
        annee,
        enfantsCibles: [activeEnfantId],
        ageMin,
        ageMax: ageMin + 1,
        onProgress: (etape, pct) => { setGenEtape(etape); setGenPct(pct) },
      })

      await createProgrammeAnnuel(annee, [activeEnfantId], repartition, true)
    } catch (e) {
      console.error('[ProgrammeAnnuel] Erreur génération :', e)
    } finally {
      setGenerating(false)
      setGenEtape('')
      setGenPct(0)
    }
  }

  const handleSaveMois = async (r: RepartitionMois) => {
    if (!programmeAnnuel) return
    const nouvelle = (programmeAnnuel.repartitionMensuelle ?? [])
      .filter(x => x.mois !== r.mois)
      .concat(r)
      .sort((a, b) => a.mois - b.mois)
    await updateRepartitionMois(programmeAnnuel.id, nouvelle)
  }

  const moisSelectionnéRepartition = moisSelectionne
    ? repartitionMap[moisSelectionne]
    : undefined

  // ── État vide ──
  if (!programmeAnnuel && !generating) {
    return (
      <div className="pa-empty">
        <div className="pa-empty__icon">📅</div>
        <h3 className="pa-empty__titre">Parcours annuel</h3>
        <p className="pa-empty__sub">
          L'IA génère un parcours thématique sur 12 mois, adapté à l'âge et aux compétences de ton enfant. Tu peux ensuite tout modifier mois par mois.
        </p>
        <button className="pa-empty__btn" onClick={handleGenerer} disabled={!activeEnfantId}>
          <span>✨</span> Générer le parcours {annee}
        </button>
        {!activeEnfantId && (
          <p className="pa-empty__hint">Sélectionne un enfant d'abord</p>
        )}
      </div>
    )
  }

  // ── Génération en cours ──
  if (generating) {
    return (
      <div className="pa-generating">
        <div className="pa-generating__spinner" />
        <p className="pa-generating__etape">{genEtape}</p>
        <div className="pa-generating__bar-wrap">
          <div className="pa-generating__bar" style={{ width: `${genPct}%` }} />
        </div>
        <p className="pa-generating__pct">{genPct}%</p>
      </div>
    )
  }

  return (
    <>
      <div className="pa-section">
        {/* En-tête */}
        <div className="pa-header">
          <div>
            <h3 className="pa-header__titre">Parcours {annee}</h3>
            <p className="pa-header__sub">
              {programmeAnnuel.genereParIA ? 'Généré par IA · ' : ''}
              Touche un mois pour modifier
            </p>
          </div>
          <button className="pa-header__regen" onClick={handleGenerer} title="Regénérer">
            ↺
          </button>
        </div>

        {/* Grille 12 mois glissants */}
        <div className="pa-grille">
          {moisGlissants.map(mois => (
            <CarteMois
              key={mois}
              mois={mois}
              repartition={repartitionMap[mois]}
              estMoisCourant={mois === moisCourant}
              onClick={() => setMoisSelectionne(mois)}
            />
          ))}
        </div>

        {/* Légende mois courant */}
        <p className="pa-legende">
          <span className="pa-legende__dot" /> Mois en cours
        </p>
      </div>

      {/* Panneau édition mois */}
      {moisSelectionne && (
        <PanneauMois
          mois={moisSelectionne}
          repartition={moisSelectionnéRepartition}
          onSave={handleSaveMois}
          onClose={() => setMoisSelectionne(null)}
          onOuvrirProgramme={id => { setMoisSelectionne(null); setProgrammeDetailId(id) }}
        />
      )}

      {/* Détail programme lié */}
      {programmeDetailId && (
        <ProgrammeDetail
          programmeId={programmeDetailId}
          onClose={() => setProgrammeDetailId(null)}
        />
      )}
    </>
  )
}
