import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../../core/db/database'

// Palette
const C = {
  lavender:  '#6F7ED6',
  lilac:     '#DBBFEE',
  orange:    '#DBBFEE',
  amber:     '#FEC355',
  offwhite:  '#F0EEEA',
  text:      '#1a1a2e',
  textLight: '#8b89a0',
  card:      '#F7F6F4',
  border:    'rgba(200,192,220,0.20)',
}

// ── Composants ──────────────────────────────────────────────────────────────

function StatChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      flex: 1, background: C.card, borderRadius: 16,
      padding: '14px 8px', textAlign: 'center',
      border: `1px solid ${C.border}`,
      boxShadow: '0 1px 6px rgba(100,90,150,0.06)',
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-1px' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.textLight, marginTop: 5, fontWeight: 500 }}>
        {label}
      </div>
    </div>
  )
}

function SectionHeader({
  icon, label, color, count, onClick,
}: {
  icon: React.ReactNode; label: string; color: string; count?: number; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '13px 16px',
      background: `${color}12`,
      border: 'none', cursor: 'pointer', textAlign: 'left',
      borderBottom: `1px solid ${color}18`,
      WebkitTapHighlightColor: 'transparent',
    }}>
      {/* Icon badge */}
      <div style={{
        width: 30, height: 30, borderRadius: 9, background: color, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 2px 8px ${color}44`,
      }}>
        {icon}
      </div>
      {/* Label */}
      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color, letterSpacing: '-0.1px' }}>
        {label}
      </span>
      {/* Count badge */}
      {count !== undefined && count > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'white',
          background: color, padding: '2px 8px', borderRadius: 20,
          boxShadow: `0 1px 6px ${color}44`,
        }}>
          {count}
        </span>
      )}
      {/* Chevron */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

function Check({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <div onClick={e => { e.stopPropagation(); onToggle() }} style={{
      width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
      border: checked ? 'none' : `1.5px solid ${C.lavender}55`,
      background: checked ? C.lavender : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
      boxShadow: checked ? `0 2px 8px ${C.lavender}44` : 'none',
    }}>
      {checked && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  )
}

const card: React.CSSProperties = {
  background: C.card,
  borderRadius: 20,
  border: `1px solid ${C.border}`,
  boxShadow: '0 1px 8px rgba(100,90,150,0.06)',
  overflow: 'hidden',
  marginBottom: 16,
}

const itemRow = (last: boolean, accent?: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '12px 16px',
  borderBottom: last ? 'none' : `1px solid ${C.border}`,
  cursor: 'pointer',
  ...(accent ? { borderLeft: `3px solid ${accent}`, paddingLeft: 13 } : {}),
})

// ── Page ───────────────────────────────────────────────────────────────────

export default function FoyerHub() {
  const navigate = useNavigate()

  const coursesItems = useLiveQuery(() =>
    db.coursesItems.filter(c => !c.coche && !c.archive && !c.deletedAt).toArray()
  )
  const taches = useLiveQuery(() =>
    db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison' && t.statut !== 'fait' && t.statut !== 'archive')
      .toArray()
  )
  const evenements = useLiveQuery(async () => {
    const all = await db.evenements.filter(e => !e.archive && !e.deletedAt).toArray()
    const now = new Date()
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return all
      .filter(e => new Date(e.dateDebut) >= now && new Date(e.dateDebut) <= in7)
      .sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime())
      .slice(0, 4)
  })

  const coursesCount = coursesItems?.length ?? 0
  const tachesCount  = taches?.length ?? 0
  const eventsCount  = evenements?.length ?? 0

  async function toggleCourse(id: string, current: boolean) {
    await db.coursesItems.update(id, { coche: !current, updatedAt: new Date() })
  }

  const displayCourses = coursesItems?.slice(0, 6) ?? []
  const displayTaches  = taches?.slice(0, 4) ?? []

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#ffffff',
      padding: '28px 16px 100px',
      fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif)',
    }}>

      {/* Header */}
      <h1 style={{ fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: '-1px', margin: '0 0 4px' }}>
        Foyer
      </h1>
      <p style={{ fontSize: 13, color: C.textLight, margin: '0 0 24px', fontWeight: 400 }}>
        Gestion du quotidien
      </p>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <StatChip value={coursesCount} label="courses"  color={C.lavender} />
        <StatChip value={tachesCount}  label="tâches"   color={C.orange}   />
        <StatChip value={eventsCount}  label="à venir"  color={C.amber === '#FEC355' ? '#d4a017' : C.amber} />
      </div>

      {/* ── Courses ── */}
      <div style={card}>
        <SectionHeader
          onClick={() => navigate('/courses')}
          label="Courses"
          color={C.lavender}
          count={coursesCount}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M2.249 2.292a.75.75 0 0 1 1.003-.457l.3.096c.669.235 1.108.39 1.431.548.303.149.437.27.525.399.09.132.16.313.199.676.04.38.042.875.042 1.615v2.732c0 1.452.013 2.5.15 3.3.146.854.438 1.466.985 2.042.593.627 1.346.899 2.242 1.026.858.121 1.948.121 3.295.121h5.405c.743 0 1.367 0 1.872-.062.535-.065 1.024-.208 1.45-.561.426-.352.666-.802.838-1.313.162-.482.289-1.093.438-1.82l.509-2.469.01-.045.01-.052c.165-.825.304-1.52.339-2.077.036-.588-.031-1.166-.413-1.663a2.109 2.109 0 0 0-.497-.499c-.3-.106-.654-.168-1.003-.207-.667-.077-1.502-.077-2.321-.077H5.668l-.01-.104c-.055-.503-.17-.956-.453-1.369-.283-.415-.661-.68-1.101-.897-.411-.202-.937-.387-1.554-.59L2.25 2.293Zm3.459 4.578H8.304l1.39 7.876c-.782-.008-1.395-.032-1.896-.104-.715-.101-1.092-.286-1.365-.573-.32-.337-.493-.668-.595-1.263-.111-.65-.13-1.558-.13-3.059V6.87Zm5.51 7.88h3.065l1.39-7.88H9.828l1.39 7.88ZM7.5 21.75a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Zm9 0a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z" fill="white"/>
            </svg>
          }
        />
        {coursesCount === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: C.textLight, fontSize: 13 }}>
            Liste vide — tout est en stock
          </div>
        ) : (
          <>
            {displayCourses.map((item, i) => (
              <div key={item.id}
                style={itemRow(i === displayCourses.length - 1)}
                onClick={() => toggleCourse(item.id, item.coche)}
              >
                <Check checked={item.coche} onToggle={() => toggleCourse(item.id, item.coche)} />
                <span style={{
                  flex: 1, fontSize: 15, fontWeight: 450, letterSpacing: '-0.1px',
                  color: item.coche ? C.textLight : C.text,
                  textDecoration: item.coche ? 'line-through' : 'none',
                }}>
                  {item.nom || item.produit}
                </span>
                {item.quantite && (
                  <span style={{
                    fontSize: 12, color: C.lavender, background: `${C.lavender}15`,
                    padding: '2px 8px', borderRadius: 20, fontWeight: 500,
                  }}>
                    ×{item.quantite}{item.unite ? ` ${item.unite}` : ''}
                  </span>
                )}
              </div>
            ))}
            {coursesCount > 6 && (
              <div onClick={() => navigate('/courses')} style={{
                padding: '10px', textAlign: 'center',
                fontSize: 12, color: C.lavender, cursor: 'pointer', fontWeight: 600,
              }}>
                + {coursesCount - 6} article{coursesCount - 6 > 1 ? 's' : ''} de plus
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Ménage ── */}
      <div style={card}>
        <SectionHeader
          onClick={() => navigate('/menage')}
          label="Ménage"
          color={C.orange}
          count={tachesCount}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M21.037 2.884a.75.75 0 0 1 0 1.06l-1.633 1.633c1.232 1.695 1.203 4.02-.084 5.688l.003.033-.032.004c.031-.004.031-.003.031-.003l.001.005.002.009.002.027c.003.023.005.055.009.095.007.082.016.2.023.348.017.298.03.72.017 1.236-.029 1.028-.163 2.435-.594 3.94-.291 1.019-.744 2.026-1.209 2.906-1.16 2.2-3.832 2.856-5.875 1.813l-.025-.012-1.12-.72a18.498 18.498 0 0 1-6.272-6.272l-.718-1.117-.012-.023c-1.043-2.044-.388-4.716 1.813-5.875.88-.465 1.887-.918 2.906-1.21 1.505-.43 2.912-.564 3.94-.593.516-.014.938 0 1.237.016.147.008.265.017.347.024.04.003.072.006.095.008l.027.003.009.001.005.001c0 0 .001 0-.003.032l.033-.004.033-.004-.004-.033c.667-.712 1.535-1.194 2.47-1.407L19.977 2.884a.75.75 0 0 1 1.06 0Z" fill="white"/>
            </svg>
          }
        />
        {tachesCount === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: C.textLight, fontSize: 13 }}>
            Aucune tâche en attente
          </div>
        ) : (
          <>
            {displayTaches.map((t, i) => (
              <div key={t.id}
                style={itemRow(i === displayTaches.length - 1, `${C.orange}88`)}
                onClick={() => navigate('/menage')}
              >
                <span style={{ flex: 1, fontSize: 14, fontWeight: 450, color: C.text, letterSpacing: '-0.1px' }}>
                  {t.titre}
                </span>
                {t.priorite === 'haute' && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: 'white',
                    background: C.orange, padding: '2px 7px', borderRadius: 20,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                  }}>
                    urgent
                  </span>
                )}
              </div>
            ))}
            {tachesCount > 4 && (
              <div onClick={() => navigate('/menage')} style={{
                padding: '10px', textAlign: 'center',
                fontSize: 12, color: C.orange, cursor: 'pointer', fontWeight: 600,
              }}>
                + {tachesCount - 4} tâche{tachesCount - 4 > 1 ? 's' : ''} de plus
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Calendrier ── */}
      <div style={card}>
        <SectionHeader
          onClick={() => navigate('/calendrier')}
          label="Calendrier"
          color="#d4a017"
          count={eventsCount}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M17 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-5-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm1 3a1 1 0 1 0-2 0 1 1 0 0 0 2 0ZM7 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm1 3a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z" fill="white"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M7 1.75a.75.75 0 0 1 .75.75v.763C8.412 3.25 9.141 3.25 9.943 3.25h4.114c.802 0 1.531 0 2.193.013V2.5a.75.75 0 0 1 1.5 0v.827c.26.02.506.045.739.076 1.172.158 2.121.49 2.87 1.238.748.748 1.08 1.697 1.237 2.869C22.75 8.65 22.75 10.106 22.75 11.944v2.113c0 1.837 0 3.294-.154 4.433-.158 1.172-.49 2.121-1.238 2.87-.748.748-1.697 1.08-2.869 1.237-1.14.155-2.595.153-4.432.153H9.943c-1.838 0-3.294 0-4.433-.153-1.172-.158-2.121-.49-2.87-1.238-.748-.748-1.08-1.697-1.237-2.869C1.25 17.35 1.25 15.894 1.25 14.057v-2.113c0-1.838 0-3.294.153-4.433.158-1.172.49-2.121 1.238-2.87.748-.748 1.697-1.08 2.869-1.237A11.9 11.9 0 0 1 6.25 3.327V2.5A.75.75 0 0 1 7 1.75Zm-1.29 3.14c-.906.123-1.486.379-1.91.803-.424.424-.68 1.003-.803 1.91C2.876 8.5 2.75 9.793 2.75 11.25V14c0 1.907.002 3.25.13 4.29.123.906.38 1.486.803 1.91.424.424 1.003.68 1.91.803 1.04.14 2.395.147 4.303.147h4c1.908 0 3.264-.007 4.29-.147.906-.123 1.486-.38 1.91-.803.424-.424.68-1.003.803-1.91.128-1.04.13-2.382.13-4.29v-2.75H2.75Z" fill="white"/>
            </svg>
          }
        />
        {eventsCount === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: C.textLight, fontSize: 13 }}>
            Semaine calme
          </div>
        ) : (
          evenements!.map((e, i) => (
            <div key={e.id}
              style={{ ...itemRow(i === eventsCount - 1), alignItems: 'center', gap: 12 }}
              onClick={() => navigate('/calendrier')}
            >
              <div style={{
                width: 38, flexShrink: 0, textAlign: 'center',
                background: '#FEC35522', borderRadius: 10, padding: '4px 0',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#d4a017', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {new Date(e.dateDebut).toLocaleDateString('fr-FR', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
                  {new Date(e.dateDebut).getDate()}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{e.titre}</div>
                {e.heureDebut && <div style={{ fontSize: 12, color: C.textLight, marginTop: 1 }}>{e.heureDebut}</div>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Réceptions — hero card ── */}
      <div onClick={() => navigate('/receptions')} style={{
        background: `linear-gradient(135deg, #A78BFA, #DBBFEE)`,
        borderRadius: 20, padding: '18px 20px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 6px 24px rgba(167,139,250,0.35)',
        position: 'relative', overflow: 'hidden',
        marginBottom: 14,
        WebkitTapHighlightColor: 'transparent',
      }}>
        <div style={{ position: 'absolute', right: -16, top: -16, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 32, bottom: -22, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.70)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Réceptions
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>
            Préparer un événement
          </div>
        </div>
        <div style={{ position: 'relative', flexShrink: 0, fontSize: 28 }}>🎉</div>
      </div>

      {/* ── Maison & Déco — hero card ── */}
      <div onClick={() => navigate('/maison-deco')} style={{
        background: `linear-gradient(135deg, ${C.lavender}, ${C.lilac})`,
        borderRadius: 20, padding: '18px 20px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: `0 6px 24px ${C.lavender}44`,
        position: 'relative', overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
      }}>
        <div style={{ position: 'absolute', right: -16, top: -16, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 32, bottom: -22, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Maison & Déco
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>
            Projets & aménagement
          </div>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ position: 'relative', flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.8)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

    </div>
  )
}
