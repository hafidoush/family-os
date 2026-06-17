import { useState } from 'react'
import {
  addChecklistItem,
  toggleChecklistItem,
  removeChecklistItem,
} from '../services/receptionService'
import type { EvenementDetail, ChecklistItem } from '../../../shared/types'

const C = {
  lavender: '#6F7ED6',
  green: '#34D399',
  text: '#1a1a2e',
  textLight: '#8b89a0',
  border: 'rgba(200,192,220,0.20)',
  card: '#F7F6F4',
}

type ChecklistKey = 'checklistPrep' | 'checklistDeco'

interface Props {
  evenementId: string
  detail: EvenementDetail | undefined
  checklistKey: ChecklistKey
  placeholder: string
  suggestions?: string[]
}

export default function SectionChecklist({
  evenementId,
  detail,
  checklistKey,
  placeholder,
  suggestions,
}: Props) {
  const [newItem, setNewItem] = useState('')

  const items: ChecklistItem[] = detail?.[checklistKey] ?? []
  const done = items.filter(i => i.coche).length

  async function ajouter(label: string) {
    const l = label.trim()
    if (!l) return
    await addChecklistItem(evenementId, checklistKey, l)
    setNewItem('')
  }

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Suggestions rapides */}
      {suggestions && suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {suggestions.filter(s => !items.find(i => i.label === s)).map(s => (
            <button
              key={s}
              onClick={() => ajouter(s)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: `1px dashed ${C.lavender}44`,
                background: 'transparent', color: C.textLight,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ajouter(newItem)}
          placeholder={placeholder}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 12,
            border: `1.5px solid ${C.border}`, background: C.card,
            fontSize: 15, color: C.text, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => ajouter(newItem)}
          style={{
            padding: '10px 16px', borderRadius: 12, border: 'none',
            background: C.lavender, color: 'white', fontWeight: 600,
            fontSize: 14, cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>

      {/* Compteur */}
      {items.length > 0 && (
        <p style={{ fontSize: 12, color: C.textLight, marginBottom: 10, fontWeight: 500 }}>
          {done}/{items.length} complété{items.length > 1 ? 's' : ''}
        </p>
      )}

      {/* Liste */}
      {items.length === 0 ? (
        <p style={{ color: C.textLight, fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
          {placeholder}
        </p>
      ) : (
        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {items.map((item, i) => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 14px',
                borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
            >
              <div
                onClick={() => toggleChecklistItem(evenementId, checklistKey, item.id)}
                style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0, cursor: 'pointer',
                  border: item.coche ? 'none' : `1.5px solid ${C.lavender}55`,
                  background: item.coche ? C.green : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.18s',
                }}
              >
                {item.coche && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span style={{
                flex: 1, fontSize: 15, color: item.coche ? C.textLight : C.text,
                textDecoration: item.coche ? 'line-through' : 'none',
              }}>
                {item.label}
              </span>
              <button
                onClick={() => removeChecklistItem(evenementId, checklistKey, item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 18, padding: 0, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
