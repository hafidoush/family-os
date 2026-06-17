import { useState } from 'react'
import { appelOpenAI, hasOpenAIKey } from '../../../core/ai/openaiService'
import { upsertDetail } from '../services/receptionService'
import type { EvenementDetail } from '../../../shared/types'

const C = {
  lavender: '#6F7ED6',
  lilac: '#DBBFEE',
  text: '#1a1a2e',
  textLight: '#8b89a0',
  border: 'rgba(200,192,220,0.20)',
  card: '#F7F6F4',
}

interface Props {
  evenementId: string
  evenementTitre: string
  detail: EvenementDetail | undefined
}

export default function SectionIA({ evenementId, evenementTitre, detail }: Props) {
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')

  const nbAdultes = detail?.nbAdultes ?? 0
  const nbEnfants = detail?.nbEnfants ?? 0
  const suggestion = detail?.suggestionIA

  async function generer() {
    if (!hasOpenAIKey()) {
      setErreur('Clé OpenAI non configurée dans les paramètres.')
      return
    }
    setLoading(true)
    setErreur('')
    try {
      const prompt = `Tu es un assistant familial francophone. Je reçois ${nbAdultes} adulte${nbAdultes > 1 ? 's' : ''} et ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''} pour "${evenementTitre}".

Donne-moi des suggestions simples et pratiques en 5-8 points :
- Quantités de boissons recommandées
- Quantités de nourriture / gâteaux
- 2-3 idées de plats ou menu adaptés
- 1 conseil pratique pour organiser

Réponds directement, sans introduction, avec des tirets. Sois concis et chaleureux.`

      const result = await appelOpenAI(prompt, { model: 'gpt-4o-mini', maxTokens: 400, temperature: 0.7 })
      await upsertDetail(evenementId, { suggestionIA: result })
    } catch {
      setErreur('Une erreur est survenue. Vérifie ta connexion.')
    } finally {
      setLoading(false)
    }
  }

  const peutGenerer = nbAdultes > 0 || nbEnfants > 0

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Contexte */}
      <div style={{
        background: `${C.lavender}10`, borderRadius: 14, padding: '14px 16px',
        border: `1px solid ${C.lavender}20`, marginBottom: 16,
      }}>
        <p style={{ fontSize: 13, color: C.textLight, margin: 0, lineHeight: 1.5 }}>
          {peutGenerer
            ? `${nbAdultes} adulte${nbAdultes > 1 ? 's' : ''} · ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''} · "${evenementTitre}"`
            : 'Renseigne le nombre d\'invités dans l\'onglet Invités pour activer l\'aide IA.'}
        </p>
      </div>

      {/* Bouton */}
      <button
        onClick={generer}
        disabled={!peutGenerer || loading}
        style={{
          width: '100%', padding: '14px', borderRadius: 14, border: 'none',
          background: peutGenerer ? `linear-gradient(135deg, ${C.lavender}, ${C.lilac})` : C.card,
          color: peutGenerer ? 'white' : C.textLight,
          fontSize: 15, fontWeight: 700, cursor: peutGenerer ? 'pointer' : 'default',
          fontFamily: 'inherit', marginBottom: 16,
          boxShadow: peutGenerer ? `0 4px 16px ${C.lavender}44` : 'none',
          opacity: loading ? 0.7 : 1,
          transition: 'all 0.2s',
        }}
      >
        {loading ? '✦ Génération en cours…' : '✦ Obtenir des suggestions'}
      </button>

      {erreur && (
        <p style={{ fontSize: 13, color: '#F87171', textAlign: 'center', marginBottom: 12 }}>{erreur}</p>
      )}

      {/* Résultat */}
      {suggestion && (
        <div style={{
          background: C.card, borderRadius: 16, padding: '16px',
          border: `1px solid ${C.border}`,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textLight, letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Suggestions IA
          </p>
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {suggestion}
          </div>
          <button
            onClick={generer}
            disabled={loading}
            style={{
              marginTop: 14, padding: '8px 16px', borderRadius: 20, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.textLight, fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Regénérer
          </button>
        </div>
      )}
    </div>
  )
}
