import { useState } from 'react'
import { upsertDetail } from '../services/receptionService'
import type { EvenementDetail } from '../../../shared/types'

const C = {
  lavender: '#6F7ED6',
  text: '#1a1a2e',
  textLight: '#8b89a0',
  border: 'rgba(200,192,220,0.20)',
  card: '#F7F6F4',
}

interface Props {
  evenementId: string
  detail: EvenementDetail | undefined
}

export default function SectionInvites({ evenementId, detail }: Props) {
  const [prenom, setPrenom] = useState('')

  async function setNb(field: 'nbAdultes' | 'nbEnfants', val: number) {
    await upsertDetail(evenementId, { [field]: Math.max(0, val) })
  }

  async function ajouterPrenom() {
    const p = prenom.trim()
    if (!p) return
    const liste = [...(detail?.prenomInvites ?? []), p]
    await upsertDetail(evenementId, { prenomInvites: liste })
    setPrenom('')
  }

  async function retirerPrenom(nom: string) {
    await upsertDetail(evenementId, {
      prenomInvites: (detail?.prenomInvites ?? []).filter(p => p !== nom),
    })
  }

  const adultes = detail?.nbAdultes ?? 0
  const enfants = detail?.nbEnfants ?? 0
  const total = adultes + enfants

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Compteurs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Counter label="Adultes" value={adultes} onChange={v => setNb('nbAdultes', v)} />
        <Counter label="Enfants" value={enfants} onChange={v => setNb('nbEnfants', v)} />
        {total > 0 && (
          <div style={{
            flex: 1, background: `${C.lavender}12`, borderRadius: 16,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '14px 8px', border: `1px solid ${C.lavender}22`,
          }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: C.lavender }}>{total}</span>
            <span style={{ fontSize: 11, color: C.textLight, marginTop: 2, fontWeight: 500 }}>total</span>
          </div>
        )}
      </div>

      {/* Prénoms optionnels */}
      <p style={{ fontSize: 13, fontWeight: 600, color: C.textLight, marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Prénoms (optionnel)
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={prenom}
          onChange={e => setPrenom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ajouterPrenom()}
          placeholder="Ajouter un prénom"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 12,
            border: `1.5px solid ${C.border}`, background: C.card,
            fontSize: 15, color: C.text, outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={ajouterPrenom}
          style={{
            padding: '10px 16px', borderRadius: 12, border: 'none',
            background: C.lavender, color: 'white', fontWeight: 600,
            fontSize: 14, cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>

      {(detail?.prenomInvites ?? []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {detail!.prenomInvites!.map(p => (
            <span
              key={p}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: `${C.lavender}18`, borderRadius: 20,
                padding: '5px 12px', fontSize: 14, color: C.lavender, fontWeight: 500,
              }}
            >
              {p}
              <button
                onClick={() => retirerPrenom(p)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.lavender, padding: 0, lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{
      flex: 1, background: C.card, borderRadius: 16, padding: '14px 8px',
      border: `1px solid ${C.border}`, textAlign: 'center',
    }}>
      <p style={{ fontSize: 11, color: C.textLight, fontWeight: 600, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <button
          onClick={() => onChange(value - 1)}
          style={{
            width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${C.border}`,
            background: 'white', cursor: 'pointer', fontSize: 18, color: C.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          −
        </button>
        <span style={{ fontSize: 26, fontWeight: 800, color: C.text, minWidth: 28, textAlign: 'center' }}>
          {value}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none',
            background: C.lavender, cursor: 'pointer', fontSize: 18, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}
