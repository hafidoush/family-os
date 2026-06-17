import { useEffect, useRef, useState } from 'react'

export function DebugPanel() {
  const safeAreaRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<Record<string, number>>({})

  useEffect(() => {
    function measure() {
      const nav = document.querySelector('.fos-pill')
      const rect = nav?.getBoundingClientRect()
      const safeAreaEl = safeAreaRef.current

      setData({
        'window.innerHeight':        window.innerHeight,
        'window.outerHeight':        window.outerHeight,
        'visualViewport.height':     window.visualViewport?.height ?? -1,
        'visualViewport.offsetTop':  window.visualViewport?.offsetTop ?? -1,
        'nav.top':                   rect?.top ?? -1,
        'nav.bottom':                rect?.bottom ?? -1,
        'nav.height':                rect?.height ?? -1,
        'innerH - nav.bottom':       window.innerHeight - (rect?.bottom ?? 0),
        'env(safe-area-inset-bottom)': safeAreaEl?.getBoundingClientRect().height ?? -1,
      })
    }

    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <>
      {/* Élément invisible dont la hauteur = env(safe-area-inset-bottom) */}
      <div ref={safeAreaRef} style={{
        position: 'fixed', bottom: 0, left: 0,
        height: 'env(safe-area-inset-bottom)',
        width: 1, pointerEvents: 'none', opacity: 0,
      }} />

      {/* Panneau debug */}
      <div style={{
        position: 'fixed', top: 60, left: 8, right: 8, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)', color: '#0f0', borderRadius: 8,
        padding: '10px 12px', fontFamily: 'monospace', fontSize: 11,
        pointerEvents: 'none',
      }}>
        <div style={{ color: '#ff0', fontWeight: 'bold', marginBottom: 6 }}>
          DEBUG iOS LAYOUT
        </div>
        {Object.entries(data).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
            <span style={{ color: '#aaa' }}>{k}</span>
            <span style={{ color: k === 'innerH - nav.bottom' ? '#f80' : '#0f0', fontWeight: 'bold' }}>
              {v.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
