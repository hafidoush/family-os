import { useState } from 'react'
import {
  genererCoursesDepuisRecettes,
  toggleCourseItem,
  removeCourseItem,
  addCourseItem,
  ajouterAuxCoursesPrincipales,
} from '../services/receptionService'
import type { EvenementDetail } from '../../../shared/types'

const C = {
  lavender: '#6F7ED6',
  green: '#34D399',
  text: '#1a1a2e',
  textLight: '#8b89a0',
  border: 'rgba(200,192,220,0.20)',
  card: '#F7F6F4',
}

interface Props {
  evenementId: string
  detail: EvenementDetail | undefined
  hasRecettes: boolean
}

export default function SectionCourses({ evenementId, detail, hasRecettes }: Props) {
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  const items = detail?.coursesItems ?? []

  async function generer() {
    setLoading(true)
    await genererCoursesDepuisRecettes(evenementId)
    setLoading(false)
    showToast('Ingrédients ajoutés')
  }

  async function ajouter() {
    const l = newItem.trim()
    if (!l) return
    await addCourseItem(evenementId, l)
    setNewItem('')
  }

  async function envoyerVersCourses() {
    const n = await ajouterAuxCoursesPrincipales(evenementId)
    showToast(`${n} article${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à mes courses`)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const cocheCount = items.filter(i => i.coche).length

  return (
    <div style={{ padding: '16px 0', position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a2e', color: 'white', padding: '10px 20px',
          borderRadius: 20, fontSize: 14, fontWeight: 500, zIndex: 100,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          {toast}
        </div>
      )}

      {/* Générer depuis recettes */}
      {hasRecettes && (
        <button
          onClick={generer}
          disabled={loading}
          style={{
            width: '100%', padding: '12px', borderRadius: 14, border: 'none',
            background: `${C.lavender}15`, color: C.lavender,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            marginBottom: 16, fontFamily: 'inherit',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Génération...' : '✦ Générer depuis les recettes du menu'}
        </button>
      )}

      {/* Ajout manuel */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ajouter()}
          placeholder="Ajouter un article"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 12,
            border: `1.5px solid ${C.border}`, background: C.card,
            fontSize: 15, color: C.text, outline: 'none', fontFamily: 'inherit',
          }}
        />
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

      {/* Compteur */}
      {items.length > 0 && (
        <p style={{ fontSize: 12, color: C.textLight, marginBottom: 10, fontWeight: 500 }}>
          {cocheCount}/{items.length} article{items.length > 1 ? 's' : ''}
        </p>
      )}

      {/* Liste */}
      {items.length === 0 ? (
        <p style={{ color: C.textLight, fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
          Aucun article — ajoutez ou générez depuis le menu
        </p>
      ) : (
        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 16 }}>
          {items.map((item, i) => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
            >
              {/* Checkbox */}
              <div
                onClick={() => toggleCourseItem(evenementId, item.id)}
                style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                  border: item.coche ? 'none' : `1.5px solid ${C.lavender}55`,
                  background: item.coche ? C.lavender : 'transparent',
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
              {item.quantite && (
                <span style={{ fontSize: 12, color: C.lavender, background: `${C.lavender}15`, padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>
                  ×{item.quantite}{item.unite ? ` ${item.unite}` : ''}
                </span>
              )}
              <button
                onClick={() => removeCourseItem(evenementId, item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 18, padding: 0, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bouton envoyer vers courses */}
      {items.filter(i => !i.coche).length > 0 && (
        <button
          onClick={envoyerVersCourses}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: C.lavender, color: 'white',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: `0 4px 16px ${C.lavender}44`,
          }}
        >
          Ajouter à ma liste de courses
        </button>
      )}
    </div>
  )
}
