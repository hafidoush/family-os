import { useState } from 'react'
import { useNavigate, useParams, Routes, Route } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../core/db/database'
import { evenementService } from '../famille/services/evenementService'
import ReceptionDetail from './components/ReceptionDetail'
import type { Evenement } from '../../shared/types'

const C = {
  lavender: '#6F7ED6',
  lilac: '#DBBFEE',
  amber: '#FEC355',
  orange: '#FD7746',
  text: '#1a1a2e',
  textLight: '#8b89a0',
  border: 'rgba(200,192,220,0.20)',
  card: '#F7F6F4',
  bg: '#ffffff',
}

const TYPE_COLOR: Record<string, string> = {
  anniversaire: '#F472B6',
  evenement:    C.lavender,
  rendez_vous:  '#60A5FA',
  sortie:       '#34D399',
  rappel:       C.amber,
  medical:      '#F87171',
}

const TYPE_EMOJI: Record<string, string> = {
  anniversaire: '🎂',
  evenement:    '🎉',
  rendez_vous:  '📅',
  sortie:       '🎡',
  rappel:       '⏰',
  medical:      '🏥',
}

function ReceptionsList() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ titre: '', dateDebut: '', heureDebut: '', notes: '' })

  const evenements = useLiveQuery(async () => {
    const passee = new Date()
    passee.setDate(passee.getDate() - 7)
    const all = await db.evenements
      .filter(e => !e.archive && !e.deletedAt && new Date(e.dateDebut) >= passee)
      .toArray()
    return all.sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime())
  }, [])

  const details = useLiveQuery(() =>
    db.evenementsDetails.filter(d => !d.archive).toArray(), []
  )

  async function creerEvenement() {
    if (!formData.titre.trim() || !formData.dateDebut) return
    const dateStr = formData.heureDebut
      ? `${formData.dateDebut}T${formData.heureDebut}`
      : `${formData.dateDebut}T00:00`
    const id = await evenementService.create({
      titre: formData.titre.trim(),
      type: 'evenement',
      dateDebut: dateStr,
      journeeEntiere: !formData.heureDebut,
      notes: formData.notes || undefined,
      recurrence: false,
      contexteMedical: false,
      personnesAssociees: [],
    })
    setShowForm(false)
    setFormData({ titre: '', dateDebut: '', heureDebut: '', notes: '' })
    navigate(`/receptions/${id}`)
  }

  const now = new Date()
  const aVenir = (evenements ?? []).filter(e => new Date(e.dateDebut) >= now)
  const passes = (evenements ?? []).filter(e => new Date(e.dateDebut) < now)

  function getDetailInfo(id: string) {
    const d = (details ?? []).find(x => x.evenementId === id)
    if (!d) return null
    const invites = (d.nbAdultes ?? 0) + (d.nbEnfants ?? 0)
    const prep = (d.checklistPrep ?? []).filter(i => i.coche).length
    const prepTotal = (d.checklistPrep ?? []).length
    return { invites, prep, prepTotal, hasMenu: (d.menuItems ?? []).length > 0 }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: C.bg,
      padding: '28px 16px 120px',
      fontFamily: 'var(--font-sans, -apple-system, sans-serif)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: '-1px', margin: '0 0 4px' }}>
            Réceptions
          </h1>
          <p style={{ fontSize: 13, color: C.textLight, margin: 0 }}>
            Préparez vos événements sereinement
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            background: C.lavender, color: 'white', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 16px ${C.lavender}44`,
            flexShrink: 0,
          }}
        >
          +
        </button>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div style={{
          background: C.card, borderRadius: 20, padding: 20,
          border: `1px solid ${C.border}`, marginBottom: 24,
          boxShadow: '0 4px 24px rgba(111,126,214,0.12)',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>
            Nouvel événement
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              placeholder="Nom de l'événement (Aïd, Anniversaire…)"
              value={formData.titre}
              onChange={e => setFormData(p => ({ ...p, titre: e.target.value }))}
              style={inputStyle}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="date"
                value={formData.dateDebut}
                onChange={e => setFormData(p => ({ ...p, dateDebut: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="time"
                value={formData.heureDebut}
                onChange={e => setFormData(p => ({ ...p, heureDebut: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Heure"
              />
            </div>
            <textarea
              placeholder="Notes (optionnel)"
              value={formData.notes}
              onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={() => setShowForm(false)}
              style={{
                flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.textLight, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Annuler
            </button>
            <button
              onClick={creerEvenement}
              disabled={!formData.titre.trim() || !formData.dateDebut}
              style={{
                flex: 2, padding: '12px', borderRadius: 12, border: 'none',
                background: C.lavender, color: 'white', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                opacity: (!formData.titre.trim() || !formData.dateDebut) ? 0.5 : 1,
              }}
            >
              Créer et préparer
            </button>
          </div>
        </div>
      )}

      {/* À venir */}
      {aVenir.length > 0 && (
        <>
          <SectionLabel label="À venir" />
          {aVenir.map(e => (
            <EvenementCard
              key={e.id}
              evenement={e}
              info={getDetailInfo(e.id)}
              onClick={() => navigate(`/receptions/${e.id}`)}
            />
          ))}
        </>
      )}

      {/* Passés */}
      {passes.length > 0 && (
        <>
          <SectionLabel label="Passés" />
          {passes.map(e => (
            <EvenementCard
              key={e.id}
              evenement={e}
              info={getDetailInfo(e.id)}
              onClick={() => navigate(`/receptions/${e.id}`)}
              passe
            />
          ))}
        </>
      )}

      {(evenements ?? []).length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.textLight }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <p style={{ fontSize: 15, fontWeight: 500 }}>Aucun événement</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Créez votre premier pour commencer</p>
        </div>
      )}
    </div>
  )
}

interface CardInfo {
  invites: number
  prep: number
  prepTotal: number
  hasMenu: boolean
}

function EvenementCard({
  evenement, info, onClick, passe,
}: {
  evenement: Evenement
  info: CardInfo | null
  onClick: () => void
  passe?: boolean
}) {
  const color = TYPE_COLOR[evenement.type] ?? C.lavender
  const emoji = TYPE_EMOJI[evenement.type] ?? '📅'
  const date = new Date(evenement.dateDebut)

  return (
    <div
      onClick={onClick}
      style={{
        background: C.card, borderRadius: 18,
        border: `1px solid ${C.border}`,
        marginBottom: 12, cursor: 'pointer',
        overflow: 'hidden',
        opacity: passe ? 0.65 : 1,
        boxShadow: '0 1px 8px rgba(100,90,150,0.06)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
        {/* Date badge */}
        <div style={{
          width: 44, flexShrink: 0, textAlign: 'center',
          background: `${color}18`, borderRadius: 12, padding: '6px 0',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {date.toLocaleDateString('fr-FR', { weekday: 'short' })}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
            {date.getDate()}
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, color: C.textLight }}>
            {date.toLocaleDateString('fr-FR', { month: 'short' })}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>{emoji}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.2px' }}>
              {evenement.titre}
            </span>
          </div>
          {evenement.heureDebut && (
            <span style={{ fontSize: 12, color: C.textLight }}>{evenement.heureDebut}</span>
          )}

          {/* Badges info */}
          {info && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {info.invites > 0 && (
                <span style={chipStyle(color)}>👥 {info.invites}</span>
              )}
              {info.hasMenu && (
                <span style={chipStyle(C.amber)}>🍽️ menu</span>
              )}
              {info.prepTotal > 0 && (
                <span style={chipStyle('#34D399')}>
                  ✅ {info.prep}/{info.prepTotal}
                </span>
              )}
            </div>
          )}
        </div>

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6" stroke={C.textLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p style={{
      fontSize: 12, fontWeight: 700, color: C.textLight,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      margin: '0 0 10px',
    }}>
      {label}
    </p>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 12,
  border: `1.5px solid rgba(200,192,220,0.30)`,
  background: 'white', fontSize: 15, color: '#1a1a2e',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

function chipStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 9px', borderRadius: 20,
    background: `${color}18`, color,
    fontSize: 11, fontWeight: 600,
  }
}

export default function ReceptionsModule() {
  return (
    <Routes>
      <Route index element={<ReceptionsList />} />
      <Route path=":id" element={<ReceptionDetailRoute />} />
    </Routes>
  )
}

function ReceptionDetailRoute() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return <ReceptionDetail evenementId={id} />
}
