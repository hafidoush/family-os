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
import { SwipeGouters } from '../gouters/SwipeGouters'

type SweetBatchMode = 'parent' | 'enfants'

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
        <button
          onClick={() => setMode('parent')}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: 20,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            background: mode === 'parent'
              ? 'white'
              : 'transparent',
            color: mode === 'parent'
              ? 'var(--color-text, #1A1A2E)'
              : 'var(--color-muted, #7A7A9A)',
            boxShadow: mode === 'parent'
              ? '0 2px 10px rgba(100,80,140,0.12)'
              : 'none',
          }}
        >
          🧁 Ma sélection
        </button>
        <button
          onClick={() => setMode('enfants')}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: 20,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            background: mode === 'enfants'
              ? 'white'
              : 'transparent',
            color: mode === 'enfants'
              ? 'var(--color-text, #1A1A2E)'
              : 'var(--color-muted, #7A7A9A)',
            boxShadow: mode === 'enfants'
              ? '0 2px 10px rgba(100,80,140,0.12)'
              : 'none',
          }}
        >
          🧒 Mode enfants
        </button>
      </div>

      {/* ── Contenu selon mode ── */}
      {mode === 'parent'  && <PreparationHebdo />}
      {mode === 'enfants' && <SwipeGouters />}
    </div>
  )
}

export default SweetBatch
