import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { useEvenementDetail } from '../hooks/useReceptions'
import { PartageSheet } from '../../partage/PartageSheet'
import SectionInvites from './SectionInvites'
import SectionMenu from './SectionMenu'
import SectionCourses from './SectionCourses'
import SectionChecklist from './SectionChecklist'
import SectionIA from './SectionIA'

const C = {
  lavender: '#6F7ED6',
  lilac: '#DBBFEE',
  amber: '#FEC355',
  text: '#1a1a2e',
  textLight: '#8b89a0',
  border: 'rgba(200,192,220,0.20)',
  card: '#F7F6F4',
  bg: '#ffffff',
}

type Onglet = 'invites' | 'menu' | 'courses' | 'preparer' | 'deco' | 'ia'

const ONGLETS: { id: Onglet; label: string; emoji: string }[] = [
  { id: 'invites',  label: 'Invités',  emoji: '👥' },
  { id: 'menu',     label: 'Menu',     emoji: '🍽️' },
  { id: 'courses',  label: 'Courses',  emoji: '🛒' },
  { id: 'preparer', label: 'Préparer', emoji: '✅' },
  { id: 'deco',     label: 'Déco',     emoji: '🎉' },
  { id: 'ia',       label: 'IA',       emoji: '✦'  },
]

const SUGGESTIONS_PREP = [
  'Acheter les courses',
  'Préparer le gâteau',
  'Sortir la décoration',
  'Ranger le salon',
  'Mettre la table',
  'Préparer les boissons',
]

const SUGGESTIONS_DECO = [
  'Ballons',
  'Bougies',
  'Nappe',
  'Cadeau',
  'Guirlandes',
  'Fleurs',
]

interface Props {
  evenementId: string
}

export default function ReceptionDetail({ evenementId }: Props) {
  const navigate = useNavigate()
  const [onglet, setOnglet] = useState<Onglet>('invites')
  const [partageOuvert, setPartageOuvert] = useState(false)

  const evenement = useLiveQuery(() => db.evenements.get(evenementId), [evenementId])
  const detail = useEvenementDetail(evenementId)

  const hasRecettes = (detail?.menuItems ?? []).some(i => i.recetteId)

  // Items à partager = courses + checklist préparation + déco
  const itemsPartage = [
    ...(detail?.coursesItems ?? []).filter(i => !i.coche).map((i, idx) => ({ label: `🛒 ${i.label}${i.quantite ? ` ×${i.quantite}${i.unite ? ` ${i.unite}` : ''}` : ''}`, ordre: idx })),
    ...(detail?.checklistPrep ?? []).filter(i => !i.coche).map((i, idx) => ({ label: `✅ ${i.label}`, ordre: 100 + idx })),
    ...(detail?.checklistDeco ?? []).filter(i => !i.coche).map((i, idx) => ({ label: `🎉 ${i.label}`, ordre: 200 + idx })),
  ]

  if (!evenement) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: C.textLight }}>
        Événement introuvable
      </div>
    )
  }

  const dateStr = new Date(evenement.dateDebut).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const invitesCount = (detail?.nbAdultes ?? 0) + (detail?.nbEnfants ?? 0)
  const prepCount = (detail?.checklistPrep ?? []).filter(i => i.coche).length
  const prepTotal = (detail?.checklistPrep ?? []).length

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: 'var(--font-sans, -apple-system, sans-serif)' }}>

      {/* Header */}
      <div style={{
        padding: '20px 16px 0',
        background: `linear-gradient(135deg, ${C.lavender}18, ${C.lilac}10)`,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => navigate('/receptions')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.lavender, fontSize: 22, padding: 0, lineHeight: 1,
            }}
          >
            ←
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.5px' }}>
              {evenement.titre}
            </h1>
            <p style={{ fontSize: 13, color: C.textLight, margin: '2px 0 0', textTransform: 'capitalize' }}>
              {dateStr}{evenement.heureDebut ? ` · ${evenement.heureDebut}` : ''}
            </p>
          </div>
        </div>

        {/* Chips résumé */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 14, overflowX: 'auto' }}>
          {invitesCount > 0 && (
            <Chip label={`${invitesCount} invité${invitesCount > 1 ? 's' : ''}`} color={C.lavender} />
          )}
          {(detail?.menuItems ?? []).length > 0 && (
            <Chip label={`${detail!.menuItems!.length} plat${detail!.menuItems!.length > 1 ? 's' : ''}`} color={C.amber} />
          )}
          {prepTotal > 0 && (
            <Chip label={`${prepCount}/${prepTotal} préparé`} color="#34D399" />
          )}
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 0 }}>
          {ONGLETS.map(o => (
            <button
              key={o.id}
              onClick={() => setOnglet(o.id)}
              style={{
                padding: '8px 12px', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'inherit',
                fontSize: 13, fontWeight: onglet === o.id ? 700 : 500,
                color: onglet === o.id ? C.lavender : C.textLight,
                borderBottom: onglet === o.id ? `2px solid ${C.lavender}` : '2px solid transparent',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {o.emoji} {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bouton partage flottant */}
      {itemsPartage.length > 0 && (
        <button
          onClick={() => setPartageOuvert(true)}
          style={{
            position: 'fixed', bottom: 90, right: 20, zIndex: 50,
            padding: '12px 18px', borderRadius: 24, border: 'none',
            background: C.lavender, color: 'white',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 4px 20px ${C.lavender}55`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span>📤</span> Envoyer à Élies
        </button>
      )}

      {/* PartageSheet */}
      {partageOuvert && (
        <PartageSheet
          titre={`${evenement.titre} — Préparation`}
          items={itemsPartage}
          onClose={() => setPartageOuvert(false)}
        />
      )}

      {/* Contenu onglet */}
      <div style={{ padding: '0 16px 120px' }}>
        {onglet === 'invites' && (
          <SectionInvites evenementId={evenementId} detail={detail} />
        )}
        {onglet === 'menu' && (
          <SectionMenu evenementId={evenementId} detail={detail} />
        )}
        {onglet === 'courses' && (
          <SectionCourses evenementId={evenementId} detail={detail} hasRecettes={hasRecettes} />
        )}
        {onglet === 'preparer' && (
          <SectionChecklist
            evenementId={evenementId}
            detail={detail}
            checklistKey="checklistPrep"
            placeholder="Ajouter une tâche de préparation"
            suggestions={SUGGESTIONS_PREP}
          />
        )}
        {onglet === 'deco' && (
          <SectionChecklist
            evenementId={evenementId}
            detail={detail}
            checklistKey="checklistDeco"
            placeholder="Ajouter un élément déco ou matériel"
            suggestions={SUGGESTIONS_DECO}
          />
        )}
        {onglet === 'ia' && (
          <SectionIA
            evenementId={evenementId}
            evenementTitre={evenement.titre}
            detail={detail}
          />
        )}
      </div>
    </div>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap',
      background: `${color}18`, color,
      fontSize: 12, fontWeight: 600,
      border: `1px solid ${color}30`,
    }}>
      {label}
    </span>
  )
}
