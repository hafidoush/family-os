/**
 * FAMILY OS — SectionPlanning v4
 *
 * Plusieurs activités par jour (matin / après-midi implicites).
 * Système de drafts par tableau — chaque draft est identifié par un id unique.
 * Une seule vue, pas de mode planifier séparé.
 */

import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { newEntity, withUpdate } from '../../../core/db/helpers'
import type { Activite, CategorieActivite, PlanificationActivite, ActiviteProgramme } from '../../../shared/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Draft {
  draftId: string      // identifiant unique du draft (pas la date)
  iso: string          // "YYYY-MM-DD"
  activite: Activite
  editing: boolean     // picker inline ouvert ?
}

// ─── Helpers date ─────────────────────────────────────────────────────────────

function getLundi(base: Date): Date {
  const d = new Date(base)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function toISO(d: Date): string { return d.toISOString().split('T')[0] }
function draftISO(s: string): string { return s.length > 10 ? s.slice(0, 10) : s }

const NOMS_JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
let _draftCounter = 0
function newDraftId(): string { return `draft_${++_draftCounter}_${Date.now()}` }

const JOURS_DEFAUT = new Set([0, 1, 2, 3]) // lun–jeu

// ─── Calcul semaine programme ──────────────────────────────────────────────────

function semaineEnCours(dateDebut: string, today = new Date()): number {
  const debut = new Date(dateDebut)
  const diff = Math.floor((today.getTime() - debut.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return Math.max(1, diff + 1)
}

// ─── Algorithme de suggestion ─────────────────────────────────────────────────

function suggerer(
  activites: Activite[],
  categories: CategorieActivite[],
  recentes: PlanificationActivite[],
  exclure: Set<string> = new Set(),
): Activite | null {
  if (!activites.length) return null
  const dernieresFois = new Map<string, string>()
  for (const p of recentes) {
    const ex = dernieresFois.get(p.activite)
    if (!ex || draftISO(p.datePrevue) > ex) dernieresFois.set(p.activite, draftISO(p.datePrevue))
  }
  const todayISO = toISO(new Date())
  const sorted = [...activites]
    .filter(a => !exclure.has(a.id))
    .map(a => {
      let s = 0
      if (a.statutBibliotheque === 'favori') s += 30
      if (!dernieresFois.has(a.id)) s += 50
      else {
        const j = Math.floor((new Date(todayISO).getTime() - new Date(dernieresFois.get(a.id)!).getTime()) / 86400000)
        s += Math.min(j * 3, 40)
      }
      s += Math.random() * 10
      return { a, s }
    })
    .sort((x, y) => y.s - x.s)
  return sorted[0]?.a ?? null
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function SectionPlanning() {
  const [weekBase, setWeekBase] = useState(new Date())
  const [drafts,   setDrafts]   = useState<Draft[]>([])
  const [saving,   setSaving]   = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const lundi       = getLundi(weekBase)
  const jours       = Array.from({ length: 7 }, (_, i) => addDays(lundi, i))
  const lundiISO    = toISO(lundi)
  const dimancheISO = toISO(addDays(lundi, 6))
  const fin14jISO   = toISO(addDays(lundi, -14))
  const todayISO    = toISO(new Date())

  // ── Données ─────────────────────────────────────────────────────────────────

  const activites = useLiveQuery(
    () => db.activites.filter(a => !a.archive && !a.deletedAt).toArray(), []
  ) ?? []

  const categories = useLiveQuery(
    () => db.categoriesActivites.toArray(), []
  ) ?? []

  const recentes = useLiveQuery(
    () => db.planificationsActivites
      .filter(p => !p.archive && !p.deletedAt && draftISO(p.datePrevue) >= fin14jISO)
      .toArray(),
    [fin14jISO]
  ) ?? []

  const planifSemaine = useLiveQuery(
    () => db.planificationsActivites
      .filter(p => !p.archive && !p.deletedAt && (() => {
        const iso = draftISO(p.datePrevue)
        return iso >= lundiISO && iso <= dimancheISO
      })())
      .toArray(),
    [lundiISO, dimancheISO]
  ) ?? []

  const catById      = new Map(categories.map(c => [c.id, c]))
  const activiteById = new Map(activites.map(a => [a.id, a]))

  // ── Activités programme à placer ─────────────────────────────────────────────

  const [placingId, setPlacingId] = useState<string | null>(null)

  const activitesPlacer = useLiveQuery(async () => {
    const programmes = await db.programmesPedagogiques
      .where('statut').equals('actif')
      .filter(p => !p.archive && !p.deletedAt)
      .toArray()
    if (programmes.length === 0) return []
    const result: (ActiviteProgramme & { semainePasse: boolean; programmeNom: string })[] = []
    for (const prog of programmes) {
      const semaineCourante = semaineEnCours(prog.dateDebut)
      const semainePrec = semaineCourante - 1
      const acts = await db.activitesProgramme
        .where('programmeId').equals(prog.id)
        .filter(a =>
          !a.archive && !a.deletedAt && !a.datePlanifiee &&
          a.statutRealisation !== 'realise' && a.statutRealisation !== 'saute' &&
          (a.semaineNumero === semaineCourante || (semainePrec >= 1 && a.semaineNumero === semainePrec))
        )
        .toArray()
      for (const a of acts) {
        result.push({ ...a, semainePasse: a.semaineNumero === semainePrec, programmeNom: prog.titre })
      }
    }
    return result.sort((a, b) => {
      if (a.semainePasse !== b.semainePasse) return a.semainePasse ? 1 : -1
      return a.ordre - b.ordre
    })
  }, []) ?? []

  // Activités programme placées dans la semaine affichée
  const activitesProgrammeSemaine = useLiveQuery(async () => {
    return db.activitesProgramme
      .filter(a => !a.archive && !a.deletedAt && !!a.datePlanifiee &&
        a.datePlanifiee >= lundiISO && a.datePlanifiee <= dimancheISO)
      .toArray()
  }, [lundiISO, dimancheISO]) ?? []

  async function placerActivite(activiteId: string, iso: string) {
    await db.activitesProgramme.update(activiteId, withUpdate({
      datePlanifiee: iso,
      statutRealisation: 'planifie',
    }))
    setPlacingId(null)
  }

  async function toggleActiviteProgramme(a: ActiviteProgramme) {
    const newStatut = a.statutRealisation === 'realise' ? 'planifie' : 'realise'
    await db.activitesProgramme.update(a.id, withUpdate({
      statutRealisation: newStatut,
      dateRealisation: newStatut === 'realise' ? toISO(new Date()) : undefined,
    }))
  }

  async function retirerActiviteProgramme(id: string) {
    await db.activitesProgramme.update(id, withUpdate({ datePlanifiee: undefined, statutRealisation: 'a_faire' }))
  }

  // ── Helpers drafts ───────────────────────────────────────────────────────────

  const draftsParJour = (iso: string) => drafts.filter(d => d.iso === iso)

  // ── Ajouter un draft pour un jour ─────────────────────────────────────────

  const ajouterDraft = useCallback((iso: string) => {
    // Exclure les activités déjà présentes ce jour (planif + draft)
    const dejaIDs = new Set([
      ...planifSemaine.filter(p => draftISO(p.datePrevue) === iso).map(p => p.activite),
      ...drafts.filter(d => d.iso === iso).map(d => d.activite.id),
    ])
    const activite = suggerer(activites, categories, recentes, dejaIDs)
    if (!activite) return
    const draft: Draft = { draftId: newDraftId(), iso, activite, editing: false }
    setDrafts(prev => [...prev, draft])
  }, [activites, categories, recentes, planifSemaine, drafts])

  // ── Changer l'activité d'un draft ────────────────────────────────────────

  const setDraftActivite = useCallback((draftId: string, activiteId: string) => {
    const a = activiteById.get(activiteId)
    if (!a) return
    setDrafts(prev => prev.map(d => d.draftId === draftId ? { ...d, activite: a, editing: false } : d))
  }, [activiteById])

  // ── Ouvrir/fermer l'édition inline d'un draft ────────────────────────────

  const toggleEditing = useCallback((draftId: string) => {
    setDrafts(prev => prev.map(d => d.draftId === draftId ? { ...d, editing: !d.editing } : { ...d, editing: false }))
  }, [])

  // ── Régénérer un draft ────────────────────────────────────────────────────

  const regenererDraft = useCallback((draftId: string) => {
    setDrafts(prev => {
      const draft = prev.find(d => d.draftId === draftId)
      if (!draft) return prev
      const exclure = new Set([
        draft.activite.id,
        ...prev.filter(d => d.iso === draft.iso && d.draftId !== draftId).map(d => d.activite.id),
        ...planifSemaine.filter(p => draftISO(p.datePrevue) === draft.iso).map(p => p.activite),
      ])
      const nouvelle = suggerer(activites, categories, recentes, exclure)
      if (!nouvelle) return prev
      return prev.map(d => d.draftId === draftId ? { ...d, activite: nouvelle, editing: false } : d)
    })
  }, [activites, categories, recentes, planifSemaine])

  // ── Supprimer un draft ────────────────────────────────────────────────────

  const supprimerDraft = useCallback((draftId: string) => {
    setDrafts(prev => prev.filter(d => d.draftId !== draftId))
  }, [])

  // ── Générer la semaine (lun–jeu par défaut, 1 par jour si vide) ───────────

  const genererSemaine = useCallback(() => {
    const nouveaux: Draft[] = []
    jours.forEach((jour, i) => {
      if (!JOURS_DEFAUT.has(i)) return
      const iso = toISO(jour)
      const dejaCount =
        planifSemaine.filter(p => draftISO(p.datePrevue) === iso).length +
        drafts.filter(d => d.iso === iso).length
      if (dejaCount >= 2) return  // déjà assez planifié
      const nbAAjouter = Math.max(0, 1 - dejaCount)
      const dejaIDs = new Set([
        ...planifSemaine.filter(p => draftISO(p.datePrevue) === iso).map(p => p.activite),
        ...drafts.filter(d => d.iso === iso).map(d => d.activite.id),
      ])
      for (let k = 0; k < nbAAjouter; k++) {
        const activite = suggerer(activites, categories, recentes, dejaIDs)
        if (activite) {
          dejaIDs.add(activite.id)
          nouveaux.push({ draftId: newDraftId(), iso, activite, editing: false })
        }
      }
    })
    setDrafts(prev => [...prev, ...nouveaux])
  }, [jours, activites, categories, recentes, planifSemaine, drafts])

  // ── Marquer comme réalisée ────────────────────────────────────────────────

  const toggleStatut = useCallback(async (planif: PlanificationActivite) => {
    if (planif.statut === 'realisee') return
    await db.planificationsActivites.update(planif.id, { statut: 'realisee', updatedAt: new Date() })
  }, [])

  // ── Supprimer une planification enregistrée ───────────────────────────────

  const supprimerPlanif = useCallback(async (id: string) => {
    await db.planificationsActivites.delete(id)
  }, [])

  // ── Confirmer tous les drafts ─────────────────────────────────────────────

  const confirmer = async () => {
    if (!drafts.length || saving) return
    setSaving(true)
    try {
      const enfants  = await db.enfants.toArray()
      const enfantId = enfants[0]?.id ?? 'default'
      await Promise.all(drafts.map(d =>
        db.planificationsActivites.add(newEntity<PlanificationActivite>({
          activite:   d.activite.id,
          enfant:     enfantId,
          datePrevue: d.iso,
          statut:     'planifiee',
          archive:    false,
        }))
      ))
      const n = drafts.length
      setDrafts([])
      setSavedMsg(`${n} activité${n > 1 ? 's' : ''} planifiée${n > 1 ? 's' : ''} ✓`)
      setTimeout(() => setSavedMsg(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const isCurrentWeek = lundiISO === toISO(getLundi(new Date()))

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="section-planning">

      {/* En-tête */}
      <div className="section-planning__header">
        <div>
          <h2 className="section-planning__title">Activités planifiées</h2>
          <p className="section-planning__subtitle">
            {lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            {' – '}
            {addDays(lundi, 6).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="section-planning__nav-btn" onClick={() => { setWeekBase(addDays(weekBase, -7)); setDrafts([]) }}>‹</button>
          {!isCurrentWeek && (
            <button className="section-planning__nav-btn" onClick={() => { setWeekBase(new Date()); setDrafts([]) }}>Auj.</button>
          )}
          <button className="section-planning__nav-btn" onClick={() => { setWeekBase(addDays(weekBase, 7)); setDrafts([]) }}>›</button>
        </div>
      </div>

      {savedMsg && <div className="section-planning__saved-msg">{savedMsg}</div>}

      {/* Grille semaine */}
      <div className="planning-semaine">
        {jours.map((jour, i) => {
          const iso        = toISO(jour)
          const isToday    = iso === todayISO
          const planifs    = planifSemaine.filter(p => draftISO(p.datePrevue) === iso)
          const draftsDuJour = draftsParJour(iso)
          const hasDrafts  = draftsDuJour.length > 0

          return (
            <div
              key={iso}
              className={[
                'planning-slot',
                isToday  ? 'planning-slot--today' : '',
                hasDrafts ? 'planning-slot--has-draft' : '',
              ].filter(Boolean).join(' ')}
            >
              {/* Colonne jour */}
              <div className={`planning-slot__jour${isToday ? ' planning-slot__jour--today' : ''}`}>
                <span className="planning-slot__jour-label">{NOMS_JOURS[i]}</span>
                <span className="planning-slot__jour-num">{jour.getDate()}</span>
              </div>

              {/* Colonne contenu */}
              <div className="planning-slot__content">

                {/* Activités enregistrées */}
                {planifs.map(p => {
                  const act  = activiteById.get(p.activite)
                  const cat  = act ? catById.get(act.categorie) : undefined
                  const done = p.statut === 'realisee'
                  return (
                    <div key={p.id} className={`planning-slot__activite${done ? ' planning-slot__activite--done' : ''}`}>
                      <span className="planning-slot__cat-icone">{cat?.icone ?? '🎯'}</span>
                      <span className="planning-slot__nom">{act?.nom ?? '—'}</span>
                      {done
                        ? <span className="planning-slot__done-badge">✓</span>
                        : <>
                            <button className="planning-slot__btn-check" onClick={() => toggleStatut(p)} title="Faite">✓</button>
                            <button className="planning-slot__btn-del"   onClick={() => supprimerPlanif(p.id)} title="Retirer">×</button>
                          </>
                      }
                    </div>
                  )
                })}

                {/* Activités programme placées ce jour */}
                {activitesProgrammeSemaine.filter(a => a.datePlanifiee === iso).map(a => {
                  const done = a.statutRealisation === 'realise'
                  return (
                    <div key={a.id} className={`planning-slot__activite planning-slot__activite--prog${done ? ' planning-slot__activite--done' : ''}`}>
                      <span className="planning-slot__cat-icone">📚</span>
                      <span className="planning-slot__nom">{a.titre}</span>
                      {done
                        ? <span className="planning-slot__done-badge">✓</span>
                        : <>
                            <button className="planning-slot__btn-check" onClick={() => toggleActiviteProgramme(a)} title="Faite">✓</button>
                            <button className="planning-slot__btn-del" onClick={() => retirerActiviteProgramme(a.id)} title="Retirer">×</button>
                          </>
                      }
                    </div>
                  )
                })}

                {/* Drafts en attente */}
                {draftsDuJour.map(d => (
                  <div key={d.draftId} className="planning-slot__activite planning-slot__activite--draft">
                    {d.editing ? (
                      <select
                        className="planning-slot__select"
                        value={d.activite.id}
                        onChange={e => setDraftActivite(d.draftId, e.target.value)}
                        onBlur={() => toggleEditing(d.draftId)}
                        autoFocus
                      >
                        {activites.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                      </select>
                    ) : (
                      <>
                        <span className="planning-slot__cat-icone">{catById.get(d.activite.categorie)?.icone ?? '🎯'}</span>
                        <span className="planning-slot__nom planning-slot__nom--tap" onClick={() => toggleEditing(d.draftId)}>
                          {d.activite.nom}
                        </span>
                        <span className="planning-slot__draft-badge">À confirmer</span>
                        <button className="planning-slot__btn-regen" onClick={() => regenererDraft(d.draftId)} title="Autre suggestion">↻</button>
                        <button className="planning-slot__btn-del"   onClick={() => supprimerDraft(d.draftId)} title="Retirer">×</button>
                      </>
                    )}
                  </div>
                ))}

                {/* Bouton + toujours présent */}
                <button
                  className="planning-slot__add"
                  onClick={() => ajouterDraft(iso)}
                  title="Ajouter une activité"
                >
                  + Ajouter
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="planning-footer">
        {activites.length === 0
          ? <p className="planning-footer__hint">Ajoutez des activités dans le Catalogue pour commencer.</p>
          : <button className="planning-footer__btn-generate" onClick={genererSemaine}>✦ Générer la semaine</button>
        }
        {drafts.length > 0 && (
          <button className="planning-footer__btn-confirm" onClick={confirmer} disabled={saving}>
            {saving ? '…' : `Confirmer (${drafts.length})`}
          </button>
        )}
      </div>

      {drafts.length > 0 && (
        <p className="planning-footer__pending">
          {drafts.length} activité{drafts.length > 1 ? 's' : ''} en attente de confirmation
        </p>
      )}

      {/* Section "À placer cette semaine" */}
      {activitesPlacer.length > 0 && (
        <div className="aplacer-section">
          <h3 className="aplacer-section__titre">À placer cette semaine</h3>
          <p className="aplacer-section__sub">Activités du programme — appuyez pour choisir le jour</p>
          <div className="aplacer-list">
            {activitesPlacer.map(a => (
              <div key={a.id} className={`aplacer-card${placingId === a.id ? ' aplacer-card--open' : ''}`}>
                <button
                  className="aplacer-card__header"
                  onClick={() => setPlacingId(placingId === a.id ? null : a.id)}
                >
                  <span className="aplacer-card__emoji">📚</span>
                  <div className="aplacer-card__info">
                    <span className="aplacer-card__nom">{a.titre}</span>
                    <span className="aplacer-card__prog">{a.programmeNom}</span>
                  </div>
                  {a.semainePasse && <span className="aplacer-card__badge">Sem. passée</span>}
                  {a.duree && <span className="aplacer-card__duree">⏱ {a.duree} min</span>}
                </button>

                {placingId === a.id && (
                  <div className="aplacer-card__jours">
                    {jours.map((jour, i) => {
                      const iso = toISO(jour)
                      const isToday = iso === todayISO
                      const isPast = iso < todayISO
                      return (
                        <button
                          key={iso}
                          className={`aplacer-jour${isToday ? ' aplacer-jour--today' : ''}${isPast ? ' aplacer-jour--past' : ''}`}
                          onClick={() => placerActivite(a.id, iso)}
                        >
                          <span className="aplacer-jour__label">{NOMS_JOURS[i]}</span>
                          <span className="aplacer-jour__date">{jour.getDate()}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
