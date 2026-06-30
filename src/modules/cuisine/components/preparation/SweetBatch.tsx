/**
 * FAMILY OS — SweetBatch
 * Conteneur principal qui regroupe :
 *   - Mode Parent  : sélection manuelle de recettes + gestion des sessions
 *   - Mode Enfants : swipe goûters style Tinder (SwipeGouters)
 *
 * La bascule entre les deux modes est visible en haut de page.
 */

import { useState } from 'react'
import { PreparationHebdo } from './PreparationHebdo'
import { HistoriqueBatch } from './HistoriqueBatch'
import { SwipeGouters } from '../gouters/SwipeGouters'

type SweetBatchMode = 'parent' | 'enfants' | 'historique'

const MODES: { key: SweetBatchMode; label: string }[] = [
  { key: 'parent',     label: 'Ma sélection' },
  { key: 'enfants',    label: 'Mode enfants' },
  { key: 'historique', label: 'Historique' },
]

export function SweetBatch() {
  const [mode, setMode] = useState<SweetBatchMode>('parent')

  return (
    <div>
      {/* ── Toggle mode ── */}
      <div style={{
        display: 'flex',
        gap: 0,
        margin: '12px 16px 0',
        background: 'rgba(201,184,232,0.18)',
        borderRadius: 24,
        padding: 4,
      }}>
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              flex: 1,
              padding: '9px 0',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              background: mode === m.key ? 'white' : 'transparent',
              color: mode === m.key
                ? 'var(--color-text, #1A1A2E)'
                : 'var(--color-muted, #7A7A9A)',
              boxShadow: mode === m.key
                ? '0 2px 10px rgba(100,80,140,0.12)'
                : 'none',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Contenu selon mode ── */}
      {mode === 'parent'     && <PreparationHebdo />}
      {mode === 'enfants'    && <SwipeGouters onSessionCreated={() => setMode('parent')} />}
      {mode === 'historique' && <HistoriqueBatch />}
    </div>
  )
}

export default SweetBatch
