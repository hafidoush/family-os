/**
 * FAMILY OS — MenuCard v3
 * Carte menu avec édition des dates et suppression. Pas de pin.
 */
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@core/db/database'
import { withUpdate } from '../../../../core/db/helpers'
import { MenuService } from '../../services/MenuService'
import { IngredientsPickerSheet } from '../courses/IngredientsPickerSheet'
import { IconPen, IconCart, IconTrash } from '@shared/components/ui/Icon/Icon'
import type { Menu } from '@shared/types'
import './MenuCard.css'

interface MenuCardProps {
  menu: Menu
  onClick: () => void
  onDeleted: () => void
}

function formatSemaine(dateDebut: string, dateFin?: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  const debut = new Date(dateDebut + 'T12:00:00')
  if (dateFin) {
    const fin = new Date(dateFin + 'T12:00:00')
    return `${debut.toLocaleDateString('fr-FR', opts)} – ${fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
  }
  return `Semaine du ${debut.toLocaleDateString('fr-FR', opts)}`
}

function getSemaineLabel(dateDebut: string, dateFin?: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const iso = today.toISOString().split('T')[0]
  const fin = dateFin ?? (() => {
    const d = new Date(dateDebut + 'T12:00:00')
    d.setDate(d.getDate() + 6)
    return d.toISOString().split('T')[0]
  })()
  if (iso >= dateDebut && iso <= fin) return 'Cette semaine'
  const lundi = new Date(dateDebut + 'T12:00:00')
  lundi.setHours(0, 0, 0, 0)
  const diff = Math.round((lundi.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000))
  if (diff === 1) return 'Semaine prochaine'
  if (diff === -1) return 'Semaine passée'
  if (diff > 1) return `Dans ${diff} semaines`
  return `Il y a ${Math.abs(diff)} semaines`
}

function isCourante(dateDebut: string, dateFin?: string): boolean {
  const iso = new Date().toISOString().split('T')[0]
  const fin = dateFin ?? (() => {
    const d = new Date(dateDebut + 'T12:00:00'); d.setDate(d.getDate() + 6)
    return d.toISOString().split('T')[0]
  })()
  return iso >= dateDebut && iso <= fin
}

// ─── Sheet édition des dates ──────────────────────────────────────────────────

function EditDatesSheet({ menu, onClose }: { menu: Menu; onClose: () => void }) {
  const [dateDebut, setDateDebut] = useState(menu.dateDebut)
  const [saving, setSaving] = useState(false)

  // Calculer dimanche automatiquement depuis le lundi
  const getDimanche = (lundi: string) => {
    const d = new Date(lundi + 'T12:00:00')
    d.setDate(d.getDate() + 6)
    return d.toISOString().split('T')[0]
  }

  const handleSave = async () => {
    setSaving(true)
    const dateFin = getDimanche(dateDebut)
    const d = new Date(dateDebut + 'T12:00:00')
    const nom = `Menu du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
    try {
      await db.menus.update(menu.id, withUpdate({ dateDebut, dateFin, nom }))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Formater pour affichage
  const lundi = new Date(dateDebut + 'T12:00:00')
  const dim = new Date(getDimanche(dateDebut) + 'T12:00:00')
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }

  return (
    <div className="menus-sheet__overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="menus-sheet">
        <div className="menus-sheet__handle" />
        <h3 className="menus-sheet__title">Modifier les dates</h3>

        <p className="menus-sheet__label">Lundi de la semaine</p>
        <input
          type="date"
          className="menus-sheet__input"
          value={dateDebut}
          onChange={e => setDateDebut(e.target.value)}
        />

        {dateDebut && (
          <div className="menus-sheet__preview">
            <span className="menus-sheet__preview-label">Semaine du</span>
            <span className="menus-sheet__preview-range">
              {lundi.toLocaleDateString('fr-FR', opts)} → {dim.toLocaleDateString('fr-FR', opts)}
            </span>
          </div>
        )}

        <div className="menus-sheet__footer">
          <button className="menus-sheet__btn-cancel" onClick={onClose}>Annuler</button>
          <button className="menus-sheet__btn-create" onClick={handleSave} disabled={saving || !dateDebut}>
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Carte principale ─────────────────────────────────────────────────────────

export function MenuCard({ menu, onClick, onDeleted }: MenuCardProps) {
  const [showEdit, setShowEdit] = useState(false)
  const [showIngredients, setShowIngredients] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const slots = useLiveQuery(
    () => db.menuSlots.where('menu').equals(menu.id)
      .filter(s => !s.archive && !s.deletedAt).toArray(),
    [menu.id]
  )

  const recettes = useLiveQuery(async () => {
    if (!slots?.length) return []
    const ids = [...new Set(slots.map(s => s.recette).filter(Boolean) as string[])]
    if (!ids.length) return []
    return db.recettes.where('id').anyOf(ids).toArray()
  }, [slots])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await MenuService.archiveMenu(menu.id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  const nbSlots = slots?.length ?? 0
  const nbRealises = slots?.filter(s => s.statut === 'realisee').length ?? 0
  const pct = nbSlots > 0 ? Math.round((nbRealises / nbSlots) * 100) : 0
  const courante = isCourante(menu.dateDebut, menu.dateFin)

  return (
    <>
      <li className={`menu-card ${courante ? 'menu-card--courante' : ''}`}>

        {/* Zone cliquable principale */}
        <div className="menu-card__body" onClick={onClick} role="button" tabIndex={0}>
          <div className="menu-card__top">
            <span className={`menu-card__badge ${courante ? 'menu-card__badge--current' : 'menu-card__badge--week'}`}>
              {getSemaineLabel(menu.dateDebut, menu.dateFin)}
            </span>
            <span className="menu-card__arrow">›</span>
          </div>

          <p className="menu-card__dates">{formatSemaine(menu.dateDebut, menu.dateFin)}</p>

          {(recettes?.length ?? 0) > 0 ? (
            <div className="menu-card__recettes">
              {recettes!.slice(0, 3).map(r => (
                <span key={r.id} className="menu-card__recette-chip">{r.nom}</span>
              ))}
              {(recettes?.length ?? 0) > 3 && (
                <span className="menu-card__recette-chip menu-card__recette-chip--more">
                  +{(recettes?.length ?? 0) - 3}
                </span>
              )}
            </div>
          ) : (
            <p className="menu-card__empty-hint">Aucune recette ajoutée</p>
          )}

          {nbSlots > 0 && (
            <div className="menu-card__progress">
              <div className="menu-card__progress-bar">
                <div className="menu-card__progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="menu-card__progress-label">{nbRealises}/{nbSlots} réalisées</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="menu-card__footer">
          <button className="menu-card__action-btn" onClick={e => { e.stopPropagation(); setShowEdit(true) }}>
            <IconPen size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Modifier les dates
          </button>
          <div className="menu-card__divider" />
          <button
            className="menu-card__action-btn menu-card__action-btn--courses"
            onClick={e => { e.stopPropagation(); setShowIngredients(true) }}
            disabled={nbSlots === 0}
          >
            <IconCart size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Ingrédients
          </button>
          <div className="menu-card__divider" />
          {confirmDelete ? (
            <div className="menu-card__confirm-delete">
              <span>Supprimer ce menu ?</span>
              <button className="menu-card__action-btn menu-card__action-btn--danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? '…' : 'Confirmer'}
              </button>
              <button className="menu-card__action-btn" onClick={() => setConfirmDelete(false)}>Annuler</button>
            </div>
          ) : (
            <button className="menu-card__action-btn menu-card__action-btn--danger" onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}>
              <IconTrash size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Supprimer
            </button>
          )}
        </div>
      </li>

      {showEdit && <EditDatesSheet menu={menu} onClose={() => setShowEdit(false)} />}
      {showIngredients && <IngredientsPickerSheet menuId={menu.id} onClose={() => setShowIngredients(false)} />}
    </>
  )
}
