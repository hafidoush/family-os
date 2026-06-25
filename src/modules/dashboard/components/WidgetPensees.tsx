/**
 * FAMILY OS — WidgetPensees
 * F9 : Affiche les pensées actives sur le tableau de bord tablette
 */

import { useState, useCallback, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../core/db/database'
import { newEntity, withUpdate } from '../../../core/db/helpers'
import type { Pensee, Tache, CoursesItem, Evenement, WishlistItem, PrioriteWishlist } from '../../../shared/types'
import './WidgetPensees.css'

const ALIMENTAIRE_MOTS = [
  'lait','pain','beurre','fromage','yaourt','yogourt','creme','oeuf','oeuf','farine','sucre',
  'pates','riz','huile','sel','poivre','cafe','the','eau','jus','soda','biere','vin',
  'poulet','boeuf','viande','poisson','saumon','thon','jambon','saucisse',
  'tomate','courgette','carotte','salade','oignon','ail','pomme de terre','patate',
  'pomme','banane','orange','fraise','raisin','fruit','legume',
  'lessive','savon','shampoing','dentifrice','gel douche','papier toilette','essuie-tout',
  'liquide vaisselle','sac poubelle','eponge','sopalin',
  'chips','chocolat','biscuit','confiture','miel','cereales','compote',
  'surgele','conserve','sauce','bouillon','moutarde','mayonnaise','ketchup',
]

function n(s: string) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }
function estAlimentaire(texte: string): boolean {
  const t = n(texte)
  return ALIMENTAIRE_MOTS.some(m => t.includes(n(m)))
}

const CAT_EMOJI: Record<string, string> = {
  enfants: '👧', maison: '🏠', administratif: '📋', animaux: '🐾',
  achats: '🛒', evenements: '🗓', sante: '💊', autre: '💭',
}

export function WidgetPensees() {
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const [planifierId, setPlanifierId] = useState<string | null>(null)
  const [dateChoisie, setDateChoisie] = useState('')
  const [traiteeIds, setTraiteeIds] = useState<Set<string>>(new Set())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const pensees = useLiveQuery(
    () => db.pensees
      .filter(p => !p.archive && !p.deletedAt && p.statut === 'active')
      .toArray()
      .then(list => list.sort((a, b) => {
        // Épinglées "À faire" en premier, puis par date de création décroissante
        if (a.aFaire && !b.aFaire) return -1
        if (!a.aFaire && b.aFaire) return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })),
    []
  )

  const visibles = showAll ? (pensees ?? []) : (pensees ?? []).slice(0, 4)

  const traiter = useCallback(async (p: Pensee, e: React.MouseEvent) => {
    e.stopPropagation()
    // Montrer l'animation "rayé" 2s avant d'archiver
    setTraiteeIds(prev => new Set(prev).add(p.id))
    const timer = setTimeout(async () => {
      await db.pensees.update(p.id, withUpdate<Pensee>({ statut: 'traitee' }))
      setTraiteeIds(prev => { const s = new Set(prev); s.delete(p.id); return s })
      timers.current.delete(p.id)
    }, 2000)
    timers.current.set(p.id, timer)
  }, [])

  const ouvrirPlanifier = useCallback((p: Pensee, e: React.MouseEvent) => {
    e.stopPropagation()
    const dateMin = new Date().toISOString().split('T')[0]
    setDateChoisie(p.dateDetectee ?? dateMin)
    setPlanifierId(p.id)
  }, [])

  const confirmerPlanifier = useCallback(async (p: Pensee, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!dateChoisie) return
    await db.evenements.add(newEntity<Evenement>({
      titre: p.contenu, type: 'evenement',
      dateDebut: new Date(dateChoisie + 'T00:00:00'),
      journeeEntiere: true, archive: false, recurrence: false, contexteMedical: false,
    }))
    await db.pensees.update(p.id, withUpdate<Pensee>({ statut: 'traitee' }))
    setPlanifierId(null)
    setDateChoisie('')
  }, [dateChoisie])

  const supprimer = useCallback(async (p: Pensee, e: React.MouseEvent) => {
    e.stopPropagation()
    await db.pensees.update(p.id, withUpdate<Pensee>({ statut: 'traitee' }))
  }, [])

  const transformer = useCallback(async (
    p: Pensee,
    vers: 'tache' | 'achat',
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    if (vers === 'tache') {
      await db.pensees.update(p.id, withUpdate<Pensee>({ aFaire: !p.aFaire }))
      return
    }
    await db.wishlistItems.add(newEntity<WishlistItem>({
      nom: p.contenu, contexte: 'achats_besoins', statut: 'a_decider',
      priorite: 'normale' as PrioriteWishlist, archive: false,
    }))
    await db.pensees.update(p.id, withUpdate<Pensee>({ statut: 'traitee' }))
  }, [])

  return (
    <div className="widget-pensees">
      {(!pensees || pensees.length === 0) && (
        <div className="widget-pensees__empty">
          <span className="widget-pensees__empty-text">Tête libre</span>
          <button className="widget-pensees__empty-add" onClick={() => navigate('/pensees')}>
            + Capturer
          </button>
        </div>
      )}

      <div className="widget-pensees__list">
        {visibles.map(p => {
          const enCoursDeSuppression = traiteeIds.has(p.id)
          return (
          <div key={p.id} className={[
            'widget-pensee-item',
            p.aFaire ? 'widget-pensee-item--afaire' : '',
            enCoursDeSuppression ? 'widget-pensee-item--traitee' : '',
          ].filter(Boolean).join(' ')}>
            <div className="widget-pensee-item__top">
              <span className="widget-pensee-item__contenu">{p.contenu}</span>
              {p.aFaire && !enCoursDeSuppression && <span className="widget-pensee-item__afaire-badge">À faire</span>}
              {enCoursDeSuppression
                ? <span className="widget-pensee-item__traitee-label">Traité ✓</span>
                : p.aFaire
                  ? <button className="widget-pensee-item__check" onClick={e => traiter(p, e)} title="Traité">✓</button>
                  : null
              }
              {!enCoursDeSuppression && (
                <button className="widget-pensee-item__delete" onClick={e => supprimer(p, e)} title="Supprimer" aria-label="Supprimer">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>

            {!p.aFaire && planifierId === p.id ? (
              <div className="widget-pensee-item__planifier" onClick={e => e.stopPropagation()}>
                <input
                  type="date"
                  className="widget-pensee-item__date-input"
                  value={dateChoisie}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setDateChoisie(e.target.value)}
                  autoFocus
                />
                <button
                  className="widget-pensee-item__chip widget-pensee-item__chip--cal"
                  onClick={e => confirmerPlanifier(p, e)}
                  disabled={!dateChoisie}
                >
                  Confirmer
                </button>
                <button
                  className="widget-pensee-item__chip widget-pensee-item__chip--annuler"
                  onClick={e => { e.stopPropagation(); setPlanifierId(null) }}
                >
                  ✕
                </button>
              </div>
            ) : !p.aFaire ? (
              <div className="widget-pensee-item__actions">
                <button className="widget-pensee-item__chip widget-pensee-item__chip--tache"
                  onClick={e => transformer(p, 'tache', e)}>
                  {p.aFaire ? '✓ À faire' : '→ Faire'}
                </button>
                <button className="widget-pensee-item__chip widget-pensee-item__chip--achat"
                  onClick={e => transformer(p, 'achat', e)}>→ Acheter</button>
                <button className="widget-pensee-item__chip widget-pensee-item__chip--cal"
                  onClick={e => ouvrirPlanifier(p, e)}>→ Planifier</button>
              </div>
            ) : null}
          </div>
        )})}
      </div>

      {(pensees ?? []).length > 4 && (
        <button className="widget-pensees__voir-plus" onClick={() => setShowAll(v => !v)}>
          {showAll ? 'Voir moins' : `+ ${(pensees ?? []).length - 3} autres pensées`}
        </button>
      )}
    </div>
  )
}
