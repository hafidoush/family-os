/**
 * FAMILY OS — Module Routines
 * F6 : Routines adaptatives — affichage automatique selon le moment de la journée
 */

import { useState, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../core/db/database'
import { newEntity, withUpdate, softDeleteFields } from '../../core/db/helpers'
import { useNotificationsStore } from '../../shared/stores/notificationsStore'
import type { Routine, RoutineItem, CreneauRoutine, JourSemaine } from '../../shared/types'
import './routines.css'

// ─── Config créneaux ──────────────────────────────────────────────────────────

const CRENEAUX: { key: CreneauRoutine; label: string; emoji: string; heures: [number, number] }[] = [
  { key: 'matin',      label: 'Matin',       emoji: '🌅', heures: [6,  11] },
  { key: 'midi',       label: 'Midi',        emoji: '☀️', heures: [11, 14] },
  { key: 'apres_midi', label: 'Après-midi',  emoji: '🌤', heures: [14, 18] },
  { key: 'soir',       label: 'Soir',        emoji: '🌙', heures: [18, 22] },
  { key: 'nuit',       label: 'Nuit',        emoji: '💤', heures: [22, 6]  },
]

const JOURS: { key: JourSemaine; label: string }[] = [
  { key: 'lun', label: 'L' }, { key: 'mar', label: 'M' }, { key: 'mer', label: 'Me' },
  { key: 'jeu', label: 'J' }, { key: 'ven', label: 'V' }, { key: 'sam', label: 'S' },
  { key: 'dim', label: 'D' },
]

function getCreneauActuel(): CreneauRoutine {
  const h = new Date().getHours()
  if (h >= 6  && h < 11) return 'matin'
  if (h >= 11 && h < 14) return 'midi'
  if (h >= 14 && h < 18) return 'apres_midi'
  if (h >= 18 && h < 22) return 'soir'
  return 'nuit'
}

function getJourActuel(): JourSemaine {
  const jours: JourSemaine[] = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
  return jours[new Date().getDay()]
}

function routineEstActive(routine: Routine): boolean {
  if (!routine.actif) return false
  const jourActuel = getJourActuel()
  if (routine.joursActifs && routine.joursActifs.length > 0) {
    if (!routine.joursActifs.includes(jourActuel)) return false
  }
  return true
}

// ─── Formulaire routine ───────────────────────────────────────────────────────

interface RoutineFormProps {
  edit?: Routine
  onClose: () => void
}

function RoutineForm({ edit, onClose }: RoutineFormProps) {
  const [nom, setNom] = useState(edit?.nom ?? '')
  const [creneau, setCreneau] = useState<CreneauRoutine>(edit?.creneau ?? getCreneauActuel())
  const [joursActifs, setJoursActifs] = useState<JourSemaine[]>(edit?.joursActifs ?? [])
  const [saving, setSaving] = useState(false)
  const { addToast } = useNotificationsStore()

  const toggleJour = (j: JourSemaine) => {
    setJoursActifs(prev =>
      prev.includes(j) ? prev.filter(x => x !== j) : [...prev, j]
    )
  }

  const handleSave = async () => {
    if (!nom.trim()) return
    setSaving(true)
    try {
      const data = { nom: nom.trim(), creneau, joursActifs, actif: true, archive: false as const }
      if (edit) {
        await db.routines.update(edit.id, withUpdate<Routine>(data))
        addToast({ message: 'Routine modifiée', type: 'success', duration: 2000 })
      } else {
        await db.routines.add(newEntity<Routine>(data))
        addToast({ message: 'Routine créée', type: 'success', duration: 2000 })
      }
      onClose()
    } catch {
      addToast({ message: 'Erreur lors de la sauvegarde', type: 'error', duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="routines-modal-backdrop" onClick={onClose}>
      <div className="routines-modal" onClick={e => e.stopPropagation()}>
        <div className="routines-modal__handle" onClick={onClose} style={{ cursor: 'pointer' }} />
        <h3 className="routines-modal__title">{edit ? 'Modifier la routine' : 'Nouvelle routine'}</h3>

        <div className="routines-form__field">
          <label className="routines-form__label">Nom</label>
          <input
            className="routines-form__input"
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="Routine du matin, Préparation sac…"
            autoFocus
          />
        </div>

        <div className="routines-form__field">
          <label className="routines-form__label">Créneau</label>
          <div className="routines-creneaux">
            {CRENEAUX.map(c => (
              <button
                key={c.key}
                className={`routines-creneau-btn${creneau === c.key ? ' routines-creneau-btn--active' : ''}`}
                onClick={() => setCreneau(c.key)}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="routines-form__field">
          <label className="routines-form__label">Jours (vide = tous les jours)</label>
          <div className="routines-jours">
            {JOURS.map(j => (
              <button
                key={j.key}
                className={`routines-jour-btn${joursActifs.includes(j.key) ? ' routines-jour-btn--active' : ''}`}
                onClick={() => toggleJour(j.key)}
              >
                {j.label}
              </button>
            ))}
          </div>
        </div>

        <div className="routines-modal__actions">
          <button className="routines-btn routines-btn--cancel" onClick={onClose}>Annuler</button>
          <button className="routines-btn routines-btn--save" onClick={handleSave} disabled={saving || !nom.trim()}>
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Formulaire item ──────────────────────────────────────────────────────────

interface ItemFormProps {
  routineId: string
  edit?: RoutineItem
  ordre: number
  onClose: () => void
}

function ItemForm({ routineId, edit, ordre, onClose }: ItemFormProps) {
  const [libelle, setLibelle] = useState(edit?.libelle ?? '')
  const [emoji, setEmoji] = useState(edit?.emoji ?? '')
  const [saving, setSaving] = useState(false)
  const { addToast } = useNotificationsStore()

  const handleSave = async () => {
    if (!libelle.trim()) return
    setSaving(true)
    try {
      const data = { routineId, libelle: libelle.trim(), emoji: emoji.trim() || undefined, ordre, archive: false as const }
      if (edit) {
        await db.routineItems.update(edit.id, withUpdate<RoutineItem>(data))
        addToast({ message: 'Étape modifiée', type: 'success', duration: 2000 })
      } else {
        await db.routineItems.add(newEntity<RoutineItem>(data))
        addToast({ message: 'Étape ajoutée', type: 'success', duration: 2000 })
      }
      onClose()
    } catch {
      addToast({ message: 'Erreur lors de la sauvegarde', type: 'error', duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="routines-modal-backdrop" onClick={onClose}>
      <div className="routines-modal routines-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="routines-modal__handle" onClick={onClose} style={{ cursor: 'pointer' }} />
        <h3 className="routines-modal__title">{edit ? 'Modifier l\'étape' : 'Nouvelle étape'}</h3>

        <div className="routines-item-form">
          <input
            className="routines-form__input routines-form__input--emoji"
            value={emoji}
            onChange={e => setEmoji(e.target.value)}
            placeholder="🎒"
            maxLength={2}
          />
          <input
            className="routines-form__input routines-form__input--libelle"
            value={libelle}
            onChange={e => setLibelle(e.target.value)}
            placeholder="Préparer le sac, vérifier les médicaments…"
            autoFocus
          />
        </div>

        <div className="routines-modal__actions">
          {edit && (
            <button className="routines-btn routines-btn--delete"
                    onClick={async () => {
                      try {
                        await db.routineItems.update(edit.id, softDeleteFields())
                        addToast({ message: 'Étape supprimée', type: 'info', duration: 2000 })
                        onClose()
                      } catch {
                        addToast({ message: 'Erreur lors de la suppression', type: 'error', duration: 3000 })
                      }
                    }}>
              Supprimer
            </button>
          )}
          <button className="routines-btn routines-btn--cancel" onClick={onClose}>Annuler</button>
          <button className="routines-btn routines-btn--save" onClick={handleSave} disabled={saving || !libelle.trim()}>
            {saving ? '…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Carte routine ────────────────────────────────────────────────────────────

interface RoutineCardProps {
  routine: Routine
  isActive: boolean
  items: RoutineItem[]
  onEdit: () => void
  onAddItem: () => void
  onEditItem: (item: RoutineItem) => void
  onToggleActif: () => void
}

function RoutineCard({ routine, isActive, items, onEdit, onAddItem, onEditItem, onToggleActif }: RoutineCardProps) {
  const creneauInfo = CRENEAUX.find(c => c.key === routine.creneau)

  return (
    <div className={`routine-card${isActive ? ' routine-card--active' : ''}${!routine.actif ? ' routine-card--inactive' : ''}`}>
      <div className="routine-card__header">
        <div className="routine-card__title-row">
          <span className="routine-card__emoji">{creneauInfo?.emoji}</span>
          <div className="routine-card__title-block">
            <h3 className="routine-card__name">{routine.nom}</h3>
            <span className="routine-card__creneau">{creneauInfo?.label}</span>
          </div>
        </div>
        <div className="routine-card__controls">
          {isActive && <span className="routine-card__badge-active">En cours</span>}
          <button className="routine-card__toggle" onClick={onToggleActif}
                  title={routine.actif ? 'Désactiver' : 'Activer'}>
            {routine.actif ? '⏸' : '▶'}
          </button>
          <button className="routine-card__edit" onClick={onEdit}>✎</button>
        </div>
      </div>

      <div className="routine-card__items">
        {items.map(item => (
          <div key={item.id} className="routine-item" onClick={() => onEditItem(item)}>
            {item.emoji && <span className="routine-item__emoji">{item.emoji}</span>}
            <span className="routine-item__libelle">{item.libelle}</span>
          </div>
        ))}
        <button className="routine-item routine-item--add" onClick={onAddItem}>
          <span className="routine-item__emoji">＋</span>
          <span className="routine-item__libelle">Ajouter une étape</span>
        </button>
      </div>
    </div>
  )
}

// ─── Module principal ─────────────────────────────────────────────────────────

type ModalState =
  | { type: 'none' }
  | { type: 'routine-form'; edit?: Routine }
  | { type: 'item-form'; routineId: string; edit?: RoutineItem; ordre: number }

export default function Routines() {
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [filtreActif, setFiltreActif] = useState<'toutes' | 'actives'>('actives')

  const creneauActuel = getCreneauActuel()

  const routines = useLiveQuery(
    () => db.routines.filter(r => !r.archive && !r.deletedAt).toArray()
      .then(list => list.sort((a, b) => {
        const order = ['matin', 'midi', 'apres_midi', 'soir', 'nuit']
        return order.indexOf(a.creneau) - order.indexOf(b.creneau)
      })),
    []
  )

  const allItems = useLiveQuery(
    () => db.routineItems.filter(i => !i.archive && !i.deletedAt).toArray(),
    []
  )

  const filtered = (routines ?? []).filter(r =>
    filtreActif === 'toutes' || routineEstActive(r)
  )

  const toggleActif = useCallback(async (r: Routine) => {
    await db.routines.update(r.id, withUpdate<Routine>({ actif: !r.actif }))
  }, [])

  const itemsParRoutine = useMemo(() => {
    const map = new Map<string, RoutineItem[]>()
    for (const item of allItems ?? []) {
      const list = map.get(item.routineId) ?? []
      list.push(item)
      map.set(item.routineId, list)
    }
    map.forEach(list => list.sort((a, b) => a.ordre - b.ordre))
    return map
  }, [allItems])

  const getItems = (routineId: string) => itemsParRoutine.get(routineId) ?? []

  return (
    <div className="routines-module">
      <div className="routines-header">
        <div>
          <h1 className="routines-title">Routines</h1>
          <p className="routines-subtitle">
            Créneau actuel : <strong>{CRENEAUX.find(c => c.key === creneauActuel)?.emoji} {CRENEAUX.find(c => c.key === creneauActuel)?.label}</strong>
          </p>
        </div>
        <button className="routines-btn-new" onClick={() => setModal({ type: 'routine-form' })}>
          + Nouvelle
        </button>
      </div>

      <div className="routines-filtres">
        {(['actives', 'toutes'] as const).map(f => (
          <button
            key={f}
            className={`routines-filtre${filtreActif === f ? ' routines-filtre--active' : ''}`}
            onClick={() => setFiltreActif(f)}
          >
            {f === 'actives' ? 'Actives aujourd\'hui' : 'Toutes'}
          </button>
        ))}
      </div>

      {routines === undefined && <div className="routines-skeleton" />}

      {routines !== undefined && filtered.length === 0 && (
        <div className="routines-empty">
          <span className="routines-empty__icon">🗂</span>
          <p className="routines-empty__title">Aucune routine configurée</p>
          <button className="routines-btn routines-btn--save" onClick={() => setModal({ type: 'routine-form' })}>
            Créer une routine
          </button>
        </div>
      )}

      <div className="routines-list">
        {filtered.map(routine => (
          <RoutineCard
            key={routine.id}
            routine={routine}
            isActive={routineEstActive(routine) && routine.creneau === creneauActuel}
            items={getItems(routine.id)}
            onEdit={() => setModal({ type: 'routine-form', edit: routine })}
            onAddItem={() => setModal({
              type: 'item-form',
              routineId: routine.id,
              ordre: getItems(routine.id).length,
            })}
            onEditItem={item => setModal({ type: 'item-form', routineId: routine.id, edit: item, ordre: item.ordre })}
            onToggleActif={() => toggleActif(routine)}
          />
        ))}
      </div>

      {/* Modales */}
      {modal.type === 'routine-form' && (
        <RoutineForm edit={modal.edit} onClose={() => setModal({ type: 'none' })} />
      )}
      {modal.type === 'item-form' && (
        <ItemForm
          routineId={modal.routineId}
          edit={modal.edit}
          ordre={modal.ordre}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  )
}
