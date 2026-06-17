import { useState } from 'react'
import { addMenuItem, removeMenuItem } from '../services/receptionService'
import { useRecettes } from '../hooks/useReceptions'
import type { EvenementDetail, TypeMenuItem } from '../../../shared/types'

const C = {
  lavender: '#6F7ED6',
  amber: '#FEC355',
  text: '#1a1a2e',
  textLight: '#8b89a0',
  border: 'rgba(200,192,220,0.20)',
  card: '#F7F6F4',
}

const TYPES: { value: TypeMenuItem; label: string; emoji: string }[] = [
  { value: 'plat',    label: 'Plat',    emoji: '🍽️' },
  { value: 'dessert', label: 'Dessert', emoji: '🍰' },
  { value: 'boisson', label: 'Boisson', emoji: '🥤' },
  { value: 'autre',   label: 'Autre',   emoji: '✨' },
]

interface Props {
  evenementId: string
  detail: EvenementDetail | undefined
}

export default function SectionMenu({ evenementId, detail }: Props) {
  const recettes = useRecettes()
  const [type, setType] = useState<TypeMenuItem>('plat')
  const [label, setLabel] = useState('')
  const [recetteId, setRecetteId] = useState('')
  const [modeRecette, setModeRecette] = useState(false)

  async function ajouter() {
    const l = label.trim() || recettes?.find(r => r.id === recetteId)?.nom || ''
    if (!l && !recetteId) return
    await addMenuItem(evenementId, {
      type,
      label: l || recettes?.find(r => r.id === recetteId)?.nom || '',
      recetteId: recetteId || undefined,
    })
    setLabel('')
    setRecetteId('')
  }

  const items = detail?.menuItems ?? []
  const grouped = TYPES.map(t => ({ ...t, items: items.filter(i => i.type === t.value) }))
    .filter(g => g.items.length > 0)

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Type selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: type === t.value ? C.lavender : `${C.lavender}15`,
              color: type === t.value ? 'white' : C.lavender,
              fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Mode switch */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setModeRecette(false)}
          style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
            background: !modeRecette ? C.amber : `${C.amber}20`,
            color: !modeRecette ? C.text : C.textLight,
            fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          Saisie libre
        </button>
        <button
          onClick={() => setModeRecette(true)}
          style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
            background: modeRecette ? C.amber : `${C.amber}20`,
            color: modeRecette ? C.text : C.textLight,
            fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          Mes recettes
        </button>
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {modeRecette ? (
          <select
            value={recetteId}
            onChange={e => setRecetteId(e.target.value)}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12,
              border: `1.5px solid ${C.border}`, background: C.card,
              fontSize: 15, color: recetteId ? C.text : C.textLight,
              outline: 'none', fontFamily: 'inherit',
            }}
          >
            <option value="">Choisir une recette</option>
            {(recettes ?? []).map(r => (
              <option key={r.id} value={r.id}>{r.nom}</option>
            ))}
          </select>
        ) : (
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ajouter()}
            placeholder={`Ajouter un ${TYPES.find(t => t.value === type)?.label.toLowerCase()}`}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12,
              border: `1.5px solid ${C.border}`, background: C.card,
              fontSize: 15, color: C.text, outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        )}
        <button
          onClick={ajouter}
          style={{
            padding: '10px 16px', borderRadius: 12, border: 'none',
            background: C.lavender, color: 'white', fontWeight: 600,
            fontSize: 14, cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>

      {/* Liste groupée */}
      {grouped.length === 0 ? (
        <p style={{ color: C.textLight, fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
          Menu vide — ajoutez vos plats
        </p>
      ) : (
        grouped.map(group => (
          <div key={group.value} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.textLight, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
              {group.emoji} {group.label}
            </p>
            <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              {group.items.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px',
                    borderBottom: i < group.items.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <span style={{ flex: 1, fontSize: 15, color: C.text }}>{item.label}</span>
                  {item.recetteId && (
                    <span style={{ fontSize: 11, color: C.lavender, background: `${C.lavender}18`, padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>
                      recette
                    </span>
                  )}
                  <button
                    onClick={() => removeMenuItem(evenementId, item.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 18, padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
