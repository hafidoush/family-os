/**
 * FAMILY OS — SectionCroissance
 * F5 : Suivi taille, poids, pointure, taille vêtements
 * Objectif : permettre les suggestions intelligentes, PAS un suivi médical
 */

import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { newEntity, softDeleteFields } from '../../../core/db/helpers'
import type { CroissanceMesure, TypeMesure } from '../../../shared/types'

// ─── Config types de mesures ──────────────────────────────────────────────────

const TYPES_MESURE: { key: TypeMesure; label: string; emoji: string; unite: string; placeholder: string }[] = [
  { key: 'taille',          label: 'Taille',         emoji: '📏', unite: 'cm',  placeholder: '95' },
  { key: 'poids',           label: 'Poids',          emoji: '⚖️', unite: 'kg',  placeholder: '16.5' },
  { key: 'pointure',        label: 'Pointure',       emoji: '👟', unite: 'EU',  placeholder: '28' },
  { key: 'taille_vetements',label: 'Taille vêtements',emoji: '👕',unite: 'cm',  placeholder: '98' },
]

interface SectionCroissanceProps {
  enfantId: string
  prenomEnfant: string
}

// ─── Formulaire saisie ────────────────────────────────────────────────────────

function MesureForm({ enfantId, onClose }: { enfantId: string; onClose: () => void }) {
  const [type, setType] = useState<TypeMesure>('taille')
  const [valeur, setValeur] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const typeInfo = TYPES_MESURE.find(t => t.key === type)!

  const handleSave = async () => {
    const v = parseFloat(valeur)
    if (!v || v <= 0) return
    setSaving(true)
    try {
      await db.croissanceMesures.add(newEntity<CroissanceMesure>({
        enfantId,
        type,
        valeur: v,
        unite: typeInfo.unite,
        date,
      }))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="croissance-modal-backdrop" onClick={onClose}>
      <div className="croissance-modal" onClick={e => e.stopPropagation()}>
        <div className="croissance-modal__handle" />
        <h3 className="croissance-modal__title">Nouvelle mesure</h3>

        <div className="croissance-type-grid">
          {TYPES_MESURE.map(t => (
            <button
              key={t.key}
              className={`croissance-type-btn${type === t.key ? ' croissance-type-btn--active' : ''}`}
              onClick={() => setType(t.key)}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="croissance-input-row">
          <input
            className="croissance-input"
            type="number"
            value={valeur}
            onChange={e => setValeur(e.target.value)}
            placeholder={typeInfo.placeholder}
            autoFocus
          />
          <span className="croissance-input__unite">{typeInfo.unite}</span>
        </div>

        <div className="croissance-form__field">
          <label className="croissance-form__label">Date</label>
          <input
            className="croissance-input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="croissance-modal__actions">
          <button className="croissance-btn croissance-btn--cancel" onClick={onClose}>Annuler</button>
          <button className="croissance-btn croissance-btn--save" onClick={handleSave}
                  disabled={saving || !valeur || parseFloat(valeur) <= 0}>
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function SectionCroissance({ enfantId, prenomEnfant }: SectionCroissanceProps) {
  const [showForm, setShowForm] = useState(false)

  const mesures = useLiveQuery(
    () => db.croissanceMesures
      .where('enfantId').equals(enfantId)
      .filter(m => !m.deletedAt)
      .toArray()
      .then(list => list.sort((a, b) => b.date.localeCompare(a.date))),
    [enfantId]
  )

  // Dernière mesure par type
  const derniereParType = useCallback((type: TypeMesure): CroissanceMesure | undefined => {
    return (mesures ?? []).find(m => m.type === type)
  }, [mesures])

  // Historique des 5 dernières pour chaque type
  const historique = useCallback((type: TypeMesure): CroissanceMesure[] => {
    return (mesures ?? []).filter(m => m.type === type).slice(0, 5)
  }, [mesures])

  const supprimer = async (m: CroissanceMesure) => {
    await db.croissanceMesures.update(m.id, softDeleteFields())
  }

  // Déterminer si une mesure est ancienne (> 3 mois) pour alerter
  const estAncienne = (m: CroissanceMesure | undefined): boolean => {
    if (!m) return true
    const diff = (new Date().getTime() - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24)
    return diff > 90
  }

  return (
    <div className="croissance-section">
      <div className="croissance-header">
        <h2 className="croissance-title">Croissance de {prenomEnfant}</h2>
        <button className="croissance-btn-new" onClick={() => setShowForm(true)}>
          + Mesure
        </button>
      </div>

      {/* Résumé des dernières valeurs */}
      <div className="croissance-summary">
        {TYPES_MESURE.map(t => {
          const derniere = derniereParType(t.key)
          const ancienne = estAncienne(derniere)

          return (
            <div key={t.key} className={`croissance-card${ancienne ? ' croissance-card--alerte' : ''}`}>
              <span className="croissance-card__emoji">{t.emoji}</span>
              <div className="croissance-card__body">
                <span className="croissance-card__label">{t.label}</span>
                {derniere ? (
                  <span className="croissance-card__valeur">
                    {derniere.valeur} <span className="croissance-card__unite">{t.unite}</span>
                  </span>
                ) : (
                  <span className="croissance-card__vide">Non renseigné</span>
                )}
                {derniere && (
                  <span className="croissance-card__date">
                    {ancienne && '⚠ '}
                    {new Date(derniere.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Historique condensé */}
      {(mesures ?? []).length > 0 && (
        <div className="croissance-historique">
          <h3 className="croissance-historique__title">Historique</h3>
          {TYPES_MESURE.map(t => {
            const items = historique(t.key)
            if (items.length === 0) return null
            return (
              <div key={t.key} className="croissance-historique__groupe">
                <span className="croissance-historique__type">{t.emoji} {t.label}</span>
                <div className="croissance-historique__list">
                  {items.map(m => (
                    <div key={m.id} className="croissance-historique__item">
                      <span className="croissance-historique__valeur">{m.valeur} {t.unite}</span>
                      <span className="croissance-historique__date">
                        {new Date(m.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                      <button className="croissance-historique__del" onClick={() => supprimer(m)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {mesures !== undefined && mesures.length === 0 && (
        <div className="croissance-empty">
          <p>Aucune mesure enregistrée.</p>
          <p className="croissance-empty__sub">Les mesures permettront des suggestions intelligentes (vérifier les chaussures, anticiper les vêtements…)</p>
        </div>
      )}

      {showForm && (
        <MesureForm enfantId={enfantId} onClose={() => setShowForm(false)} />
      )}

      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.croissance-section { padding: 16px; }

.croissance-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.croissance-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text, #1A1A2E);
  margin: 0;
}

.croissance-btn-new {
  padding: 7px 14px;
  background: linear-gradient(135deg, #9A5CA3, #C9B8E8);
  color: white;
  border: none;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.croissance-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}

.croissance-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: 12px;
}

.croissance-card--alerte {
  border-color: rgba(253,186,116,0.5);
  background: rgba(255,247,237,0.6);
}

.croissance-card__emoji { font-size: 1.2rem; flex-shrink: 0; }

.croissance-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.croissance-card__label {
  font-size: 0.72rem;
  color: var(--color-muted, #7A7A9A);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.croissance-card__valeur {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text, #1A1A2E);
}

.croissance-card__unite {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--color-muted, #7A7A9A);
}

.croissance-card__vide {
  font-size: 0.82rem;
  color: var(--color-muted, #7A7A9A);
  font-style: italic;
}

.croissance-card__date {
  font-size: 0.72rem;
  color: var(--color-muted, #7A7A9A);
}

/* Historique */
.croissance-historique { margin-top: 8px; }

.croissance-historique__title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-muted, #7A7A9A);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 10px;
}

.croissance-historique__groupe { margin-bottom: 12px; }

.croissance-historique__type {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text, #1A1A2E);
  margin-bottom: 6px;
}

.croissance-historique__list { display: flex; flex-direction: column; gap: 4px; }

.croissance-historique__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: rgba(250,248,245,0.6);
  border-radius: 8px;
}

.croissance-historique__valeur {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text, #1A1A2E);
  flex: 1;
}

.croissance-historique__date {
  font-size: 0.75rem;
  color: var(--color-muted, #7A7A9A);
}

.croissance-historique__del {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.7rem;
  color: var(--color-muted, #7A7A9A);
  display: flex;
  align-items: center;
  justify-content: center;
}

.croissance-historique__del:hover { background: rgba(254,226,226,0.5); color: #DC2626; }

/* Empty */
.croissance-empty {
  text-align: center;
  padding: 24px 16px;
  color: var(--color-muted, #7A7A9A);
  font-size: 0.875rem;
}

.croissance-empty__sub { margin-top: 6px; font-size: 0.8rem; }

/* Modale */
.croissance-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 800;
  display: flex;
  align-items: flex-end;
}

.croissance-modal {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(24px);
  border-radius: 20px 20px 0 0;
  padding: 16px 20px 32px;
  box-shadow: 0 -8px 40px rgba(100,80,140,0.15);
}

.croissance-modal__handle {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: rgba(180,160,210,0.4);
  margin: 0 auto 16px;
}

.croissance-modal__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text, #1A1A2E);
  margin: 0 0 16px;
}

.croissance-type-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.croissance-type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px;
  border-radius: 12px;
  border: 1.5px solid rgba(180,160,210,0.3);
  background: transparent;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.croissance-type-btn--active {
  background: rgba(201,184,232,0.3);
  border-color: rgba(150,120,200,0.5);
  font-weight: 600;
}

.croissance-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.croissance-input {
  flex: 1;
  background: rgba(250,248,245,0.8);
  border: 1.5px solid rgba(180,160,210,0.3);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.95rem;
  font-family: inherit;
  color: var(--color-text, #1A1A2E);
  outline: none;
}

.croissance-input:focus { border-color: rgba(150,120,200,0.6); }

.croissance-input__unite {
  font-size: 0.9rem;
  color: var(--color-muted, #7A7A9A);
  font-weight: 600;
  flex-shrink: 0;
}

.croissance-form__field { margin-bottom: 14px; }

.croissance-form__label {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-muted, #7A7A9A);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.croissance-modal__actions { display: flex; gap: 8px; margin-top: 16px; }

.croissance-btn {
  padding: 11px 16px;
  border-radius: 12px;
  border: none;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.croissance-btn--cancel {
  flex: 1;
  background: rgba(240,236,255,0.6);
  color: var(--color-muted, #7A7A9A);
}

.croissance-btn--save {
  flex: 2;
  background: linear-gradient(135deg, #9A5CA3, #C9B8E8);
  color: white;
}

.croissance-btn--save:disabled { opacity: 0.5; cursor: not-allowed; }
`
