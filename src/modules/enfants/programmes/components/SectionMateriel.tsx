/**
 * FAMILY OS — SectionMateriel
 * Vue matériel agrégé d'un programme pédagogique.
 * Agrège materielNecessaire + materielOptionnel de toutes les ActiviteProgramme,
 * déduplique par nom, permet de cocher "J'ai déjà" / "À acheter",
 * et pousse les items "à acheter" vers le module Courses.
 */

import { useState, useMemo } from 'react'
import './SectionMateriel.css'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../core/db/database'
import { withUpdate, newEntity } from '../../../../core/db/helpers'
import type { ProgrammePedagogique, CoursesItem } from '../../../../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type StatutMateriel = 'a_verifier' | 'possede' | 'a_acheter'

interface MaterielAgrege {
  nomNormalise: string   // clé de déduplication
  nom: string            // affichage
  quantite?: string
  optionnel: boolean
  activitesTitres: string[]
  statut: StatutMateriel
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliser(nom: string): string {
  return nom.toLowerCase().trim().replace(/\s+/g, ' ')
}

const STATUT_CONFIG: Record<StatutMateriel, { label: string; icon: string; color: string; bg: string }> = {
  a_verifier: { label: 'À vérifier', icon: '○', color: '#9CA3AF', bg: 'transparent' },
  possede:    { label: 'J\'ai déjà', icon: '✓', color: '#22C55E', bg: 'rgba(34,197,94,0.10)' },
  a_acheter:  { label: 'À acheter',  icon: '🛒', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
}

const STATUT_CYCLE: Record<StatutMateriel, StatutMateriel> = {
  a_verifier: 'possede',
  possede:    'a_acheter',
  a_acheter:  'a_verifier',
}

// ── Composant ─────────────────────────────────────────────────────────────────

interface SectionMaterielProps {
  programme: ProgrammePedagogique
}

export function SectionMateriel({ programme }: SectionMaterielProps) {
  const [filtre, setFiltre] = useState<'tous' | 'a_acheter' | 'possede' | 'a_verifier'>('tous')
  const [pushing, setPushing] = useState(false)
  const [pushDone, setPushDone] = useState(false)

  // Toutes les activités du programme
  const activites = useLiveQuery(
    () => db.activitesProgramme
      .where('programmeId').equals(programme.id)
      .filter(a => !a.archive && !a.deletedAt)
      .toArray(),
    [programme.id],
    []
  ) ?? []

  // Statuts stockés sur le programme
  const statuts: Record<string, StatutMateriel> = programme.materielStatuts ?? {}

  // Agrégation et déduplication
  const materiel: MaterielAgrege[] = useMemo(() => {
    const map = new Map<string, MaterielAgrege>()

    for (const act of activites) {
      const items = [
        ...(act.materielNecessaire ?? []).map(m => ({ ...m, optionnel: false })),
        ...(act.materielOptionnel  ?? []).map(m => ({ ...m, optionnel: true  })),
      ]
      for (const item of items) {
        const key = normaliser(item.nom)
        if (map.has(key)) {
          const existing = map.get(key)!
          if (!existing.activitesTitres.includes(act.titre)) {
            existing.activitesTitres.push(act.titre)
          }
          // Nécessaire > optionnel
          if (!item.optionnel) existing.optionnel = false
        } else {
          map.set(key, {
            nomNormalise: key,
            nom: item.nom,
            quantite: item.quantite,
            optionnel: item.optionnel,
            activitesTitres: [act.titre],
            statut: statuts[key] ?? 'a_verifier',
          })
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      // Nécessaire avant optionnel, puis alpha
      if (a.optionnel !== b.optionnel) return a.optionnel ? 1 : -1
      return (a.nom ?? "").localeCompare(b.nom ?? "", 'fr')
    })
  }, [activites, statuts])

  const aAcheter  = materiel.filter(m => m.statut === 'a_acheter')
  const possede   = materiel.filter(m => m.statut === 'possede')
  const aVerifier = materiel.filter(m => m.statut === 'a_verifier')

  const affiche = filtre === 'tous' ? materiel
    : filtre === 'a_acheter' ? aAcheter
    : filtre === 'possede'   ? possede
    : aVerifier

  // Changer le statut d'un item
  async function toggleStatut(item: MaterielAgrege) {
    const newStatut = STATUT_CYCLE[item.statut]
    const newStatuts = { ...statuts, [item.nomNormalise]: newStatut }
    await db.programmesPedagogiques.update(programme.id, withUpdate({ materielStatuts: newStatuts }))
  }

  // Pousser les "à acheter" vers Courses
  async function envoyerVersCourses() {
    if (pushing || aAcheter.length === 0) return
    setPushing(true)
    try {
      await Promise.all(
        aAcheter.map(item =>
          db.coursesItems.add(newEntity<CoursesItem>({
            produit: '',
            nom: item.nom,
            quantite: undefined,
            unite: undefined,
            coche: false,
            source: 'programme',
            dateAjout: new Date(),
            notes: `Programme : ${programme.titre}`,
            archive: false,
          }))
        )
      )
      setPushDone(true)
      setTimeout(() => setPushDone(false), 3000)
    } finally {
      setPushing(false)
    }
  }

  if (materiel.length === 0) {
    return (
      <div className="materiel-empty">
        <span>📦</span>
        <p>Aucun matériel référencé pour ce programme.</p>
      </div>
    )
  }

  return (
    <div className="materiel-section">

      {/* Résumé */}
      <div className="materiel-resume">
        <button
          className={`materiel-chip${filtre === 'tous' ? ' materiel-chip--active' : ''}`}
          onClick={() => setFiltre('tous')}
        >
          Tout ({materiel.length})
        </button>
        <button
          className={`materiel-chip materiel-chip--verifier${filtre === 'a_verifier' ? ' materiel-chip--active' : ''}`}
          onClick={() => setFiltre('a_verifier')}
        >
          À vérifier ({aVerifier.length})
        </button>
        <button
          className={`materiel-chip materiel-chip--possede${filtre === 'possede' ? ' materiel-chip--active' : ''}`}
          onClick={() => setFiltre('possede')}
        >
          ✓ En stock ({possede.length})
        </button>
        <button
          className={`materiel-chip materiel-chip--acheter${filtre === 'a_acheter' ? ' materiel-chip--active' : ''}`}
          onClick={() => setFiltre('a_acheter')}
        >
          🛒 À acheter ({aAcheter.length})
        </button>
      </div>

      <p className="materiel-hint">
        Appuyez sur un item pour changer son statut : À vérifier → J'ai déjà → À acheter
      </p>

      {/* Liste */}
      <div className="materiel-list">
        {affiche.map(item => {
          const cfg = STATUT_CONFIG[item.statut]
          return (
            <button
              key={item.nomNormalise}
              className="materiel-item"
              style={{ background: cfg.bg }}
              onClick={() => toggleStatut(item)}
            >
              <span className="materiel-item__icon" style={{ color: cfg.color }}>{cfg.icon}</span>
              <div className="materiel-item__body">
                <span className="materiel-item__nom">
                  {item.nom}
                  {item.optionnel && <span className="materiel-item__opt"> (optionnel)</span>}
                </span>
                {item.quantite && (
                  <span className="materiel-item__qte">{item.quantite}</span>
                )}
                <span className="materiel-item__acts">
                  {item.activitesTitres.slice(0, 3).join(' · ')}
                  {item.activitesTitres.length > 3 && ` +${item.activitesTitres.length - 3}`}
                </span>
              </div>
              <span className="materiel-item__statut" style={{ color: cfg.color }}>
                {cfg.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Action Courses */}
      {aAcheter.length > 0 && (
        <button
          className="materiel-courses-btn"
          onClick={envoyerVersCourses}
          disabled={pushing}
        >
          {pushing ? 'Ajout en cours…'
            : pushDone ? `✓ ${aAcheter.length} ajouté${aAcheter.length > 1 ? 's' : ''} aux courses`
            : `🛒 Ajouter aux courses (${aAcheter.length} item${aAcheter.length > 1 ? 's' : ''})`}
        </button>
      )}
    </div>
  )
}
