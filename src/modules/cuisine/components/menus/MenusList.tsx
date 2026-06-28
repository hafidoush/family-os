/**
 * FAMILY OS — MenusList v2
 * Liste redessinée avec sélecteur de semaine et pin dashboard.
 */
import { useState } from 'react'
import { useMenus } from '../../hooks/useMenus'
import { MenuCard } from './MenuCard'
import { MenuService } from '../../services/MenuService'
import { db } from '../../../../core/db/database'
import { withUpdate } from '../../../../core/db/helpers'
import './MenusList.css'

interface Props {
  onSelectMenu: (menuId: string) => void
}

// ─── Helpers semaines ─────────────────────────────────────────────────────────

function getLundi(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatSemaineLabel(lundi: Date): string {
  const dim = new Date(lundi)
  dim.setDate(lundi.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${lundi.toLocaleDateString('fr-FR', opts)} – ${dim.toLocaleDateString('fr-FR', opts)}`
}

function getSemaineOptions() {
  const today = new Date()
  return [0, 1, 2].map(offset => {
    const lundi = getLundi(today)
    lundi.setDate(lundi.getDate() + offset * 7)
    const dim = new Date(lundi)
    dim.setDate(lundi.getDate() + 6)
    return {
      label: offset === 0 ? 'Cette semaine' : offset === 1 ? 'Semaine prochaine' : 'Dans 2 semaines',
      sublabel: formatSemaineLabel(lundi),
      dateDebut: toISO(lundi),
      dateFin: toISO(dim),
    }
  })
}

// ─── Sheet création ───────────────────────────────────────────────────────────

function CreationSheet({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (dateDebut: string, dateFin: string, nom?: string) => Promise<void>
}) {
  const todayISO = toISO(new Date())
  const [dateDebut, setDateDebut] = useState(todayISO)
  const [dateFin, setDateFin] = useState('')
  const [nom, setNom] = useState('')
  const [creating, setCreating] = useState(false)

  const handleDebutChange = (val: string) => {
    setDateDebut(val)
    // Auto-calcule la fin à J+6 si pas encore saisie ou si l'utilisatrice n'a pas modifié
    if (val) {
      const d = new Date(val + 'T12:00:00')
      d.setDate(d.getDate() + 6)
      setDateFin(toISO(d))
    }
  }

  const canCreate = dateDebut && dateFin && dateFin >= dateDebut

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true)
    try {
      await onCreate(dateDebut, dateFin, nom.trim() || undefined)
      onClose()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="menus-sheet__overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="menus-sheet">
        <div className="menus-sheet__handle" />
        <h3 className="menus-sheet__title">Nouveau menu</h3>

        <p className="menus-sheet__label">Du</p>
        <input
          type="date"
          className="menus-sheet__input"
          value={dateDebut}
          onChange={e => handleDebutChange(e.target.value)}
        />

        <p className="menus-sheet__label">Au</p>
        <input
          type="date"
          className="menus-sheet__input"
          value={dateFin}
          min={dateDebut}
          onChange={e => setDateFin(e.target.value)}
        />

        <p className="menus-sheet__label" style={{ marginTop: 16 }}>Nom <span style={{ fontWeight: 400, fontSize: '12px' }}>(optionnel)</span></p>
        <input
          className="menus-sheet__input"
          placeholder="ex : Menu léger, Semaine végé…"
          value={nom}
          onChange={e => setNom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />

        <div className="menus-sheet__footer">
          <button className="menus-sheet__btn-cancel" onClick={onClose}>Annuler</button>
          <button
            className="menus-sheet__btn-create"
            onClick={handleCreate}
            disabled={!canCreate || creating}
          >
            {creating ? '…' : 'Créer le menu'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Module principal ─────────────────────────────────────────────────────────

export function MenusList({ onSelectMenu }: Props) {
  const menus = useMenus()
  const [showCreation, setShowCreation] = useState(false)

  const handleCreate = async (dateDebut: string, dateFin: string, nom?: string) => {
    const menu = await MenuService.createMenu({ dateReference: new Date(dateDebut + 'T12:00:00'), nom })
    // Override les dates calculées par le service avec celles choisies
    await db.menus.update(menu.id, withUpdate({ dateDebut, dateFin }))
    onSelectMenu(menu.id)
  }

  if (menus === undefined) {
    return (
      <div className="menus-list">
        <div className="menus-list__skeleton" />
        <div className="menus-list__skeleton" />
      </div>
    )
  }

  return (
    <div className="menus-list">

      {/* Header */}
      <div className="menus-list__header">
        <div>
          <h2 className="menus-list__title">Mes menus</h2>
          <p className="menus-list__subtitle">
            {menus.length === 0
              ? 'Aucun menu pour l\'instant'
              : `${menus.length} menu${menus.length > 1 ? 's' : ''} planifié${menus.length > 1 ? 's' : ''}`
            }
          </p>
        </div>
        <button className="menus-list__btn-new" onClick={() => setShowCreation(true)}>
          + Nouveau
        </button>
      </div>

      {/* Liste */}
      {menus.length === 0 ? (
        <div className="menus-list__empty">
          <div className="menus-list__empty-icon">🍽️</div>
          <p>Planifie ta première semaine de repas</p>
          <button className="menus-list__empty-cta" onClick={() => setShowCreation(true)}>
            Créer un menu
          </button>
        </div>
      ) : (
        <ul className="menus-list__list">
          {menus.map(menu => (
            <MenuCard
              key={menu.id}
              menu={menu}
              onClick={() => onSelectMenu(menu.id)}
              onDeleted={() => {}}
            />
          ))}
        </ul>
      )}

      {/* Sheet création */}
      {showCreation && (
        <CreationSheet
          onClose={() => setShowCreation(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
