import { useState } from 'react'
import { db } from '../../../core/db/database'
import { genererFicheActivite } from '../../../core/ai/preparationActiviteService'
import { hasOpenAIKey } from '../../../core/ai/openaiService'

interface MigrationState {
  status: 'idle' | 'running' | 'done' | 'error'
  total: number
  processed: number
  updated: number
  currentNom: string
  errors: string[]
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function MigrationPreparationActivites() {
  const [state, setState] = useState<MigrationState>({
    status: 'idle', total: 0, processed: 0, updated: 0, currentNom: '', errors: [],
  })

  async function runMigration() {
    if (!hasOpenAIKey()) return

    const activites = await db.activites
      .filter(a => !a.archive && !a.deletedAt && a.preparationDelaiJours === undefined)
      .toArray()

    setState({ status: 'running', total: activites.length, processed: 0, updated: 0, currentNom: '', errors: [] })

    let updated = 0
    const errors: string[] = []

    for (let i = 0; i < activites.length; i++) {
      const act = activites[i]
      setState(s => ({ ...s, processed: i + 1, currentNom: act.nom }))

      try {
        const result = await genererFicheActivite(act.nom)
        await db.activites.update(act.id, {
          preparationDelaiJours: result.preparationDelaiJours,
          preparationTexte:      result.preparationTexte || undefined,
          preparationUrgence:    result.preparationDelaiJours > 0 ? result.preparationUrgence : undefined,
          updatedAt:             new Date(),
        })
        updated++
        setState(s => ({ ...s, updated }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue'
        errors.push(`${act.nom} : ${msg}`)
        setState(s => ({ ...s, errors: [...s.errors, `${act.nom} : ${msg}`] }))
      }

      if (i < activites.length - 1) await sleep(1000)
    }

    setState(s => ({
      ...s,
      status: errors.length === activites.length ? 'error' : 'done',
      currentNom: '',
      errors,
    }))
  }

  if (!hasOpenAIKey()) {
    return (
      <p style={{ fontSize: 13, color: '#9B8DB5', margin: 0 }}>
        Ajoute ta clé OpenAI ci-dessus pour activer la migration.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {state.status === 'idle' && (
        <button className="param-ia-migrate-btn" onClick={runMigration}>
          Lancer l'analyse IA sur le catalogue existant
        </button>
      )}

      {state.status === 'running' && (
        <div className="param-ia-migrate-progress">
          <div className="param-ia-migrate-progress__bar-wrap">
            <div
              className="param-ia-migrate-progress__bar"
              style={{ width: state.total > 0 ? `${(state.processed / state.total) * 100}%` : '0%' }}
            />
          </div>
          <p className="param-ia-migrate-progress__label">
            {state.processed}/{state.total} — {state.currentNom}
          </p>
        </div>
      )}

      {state.status === 'done' && (
        <div className="param-ia-migrate-done">
          <span>Terminé — {state.updated} activité{state.updated !== 1 ? 's' : ''} analysée{state.updated !== 1 ? 's' : ''}</span>
          {state.errors.length > 0 && (
            <p style={{ fontSize: 11, color: '#B71C1C', margin: '4px 0 0' }}>
              {state.errors.length} erreur{state.errors.length > 1 ? 's' : ''} : {state.errors[0]}
              {state.errors.length > 1 ? ` +${state.errors.length - 1} autres` : ''}
            </p>
          )}
          <button
            className="param-ia-migrate-btn"
            style={{ marginTop: 6, opacity: 0.6, fontSize: 12 }}
            onClick={() => setState({ status: 'idle', total: 0, processed: 0, updated: 0, currentNom: '', errors: [] })}
          >
            Relancer pour les nouvelles activités
          </button>
        </div>
      )}

      {state.status === 'error' && (
        <p style={{ fontSize: 13, color: '#B71C1C', margin: 0 }}>
          Toutes les requêtes ont échoué. Vérifiez votre clé OpenAI.
        </p>
      )}
    </div>
  )
}
