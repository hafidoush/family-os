/**
 * FAMILY OS — WidgetAchatsMoment
 * Affiche les besoins urgents (achats_besoins) sur le dashboard
 */

import { useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../core/db/database'
import { withUpdate } from '../../../core/db/helpers'
import { newEntity } from '../../../core/db/helpers'
import type { WishlistItem, StatutWishlist, PrioriteWishlist } from '../../../shared/types'
import './WidgetAchatsMoment.css'

const CAT_EMOJI: Record<string, string> = {
  enfants: '👧',
  maison:  '🏠',
  sante:   '💊',
  myself:  '🌸',
  autre:   '📦',
}

const HORIZON_LABEL: Record<string, string> = {
  haute:   'Cette semaine',
  normale: 'Ce mois',
  basse:   'Bientôt',
}

export function WidgetAchatsMoment() {
  const navigate  = useNavigate()
  const [adding, setAdding]   = useState(false)
  const [draft,  setDraft]    = useState('')
  const [saving, setSaving]   = useState(false)

  const items = useLiveQuery(
    () => db.wishlistItems
      .filter(i => i.contexte === 'achats_besoins' && !i.archive && !i.deletedAt && i.statut !== 'achete')
      .toArray()
      .then(list => list.sort((a, b) => {
        const order = { haute: 0, normale: 1, basse: 2 }
        return (order[a.priorite ?? 'normale'] ?? 1) - (order[b.priorite ?? 'normale'] ?? 1)
      })),
    []
  )

  const ajouterRapide = useCallback(async () => {
    const nom = draft.trim()
    if (!nom) return
    setSaving(true)
    await db.wishlistItems.add(newEntity<WishlistItem>({
      nom, contexte: 'achats_besoins', statut: 'a_decider',
      priorite: 'haute' as PrioriteWishlist, archive: false,
    }))
    setDraft('')
    setAdding(false)
    setSaving(false)
  }, [draft])

  const toggle = useCallback(async (item: WishlistItem, e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatut: StatutWishlist = item.statut === 'achete' ? 'approuve' : 'achete'
    await db.wishlistItems.update(item.id, withUpdate<WishlistItem>({ statut: newStatut }))
  }, [])

  const supprimer = useCallback(async (item: WishlistItem, e: React.MouseEvent) => {
    e.stopPropagation()
    await db.wishlistItems.update(item.id, withUpdate<WishlistItem>({ archive: true }))
  }, [])

  const visibles = (items ?? []).slice(0, 4)
  const reste        = (items ?? []).length - visibles.length
  const urgenceLabel = (items ?? [])[0]?.priorite === 'haute' ? 'Cette semaine' : null

  return (
    <div className="widget-achats-moment">
      {/* Ajout rapide */}
      {adding ? (
        <div className="wam__quick-add">
          <input
            className="wam__quick-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ajouterRapide(); if (e.key === 'Escape') { setAdding(false); setDraft('') } }}
            placeholder="Nom de l'article…"
            autoFocus
            disabled={saving}
          />
          <button className="wam__quick-ok" onClick={ajouterRapide} disabled={!draft.trim() || saving}>
            {saving ? '…' : '✓'}
          </button>
          <button className="wam__quick-cancel" onClick={() => { setAdding(false); setDraft('') }}>✕</button>
        </div>
      ) : (items ?? []).length === 0 ? (
        <div className="wam__empty">
          <span className="wam__empty-text">Rien à acheter pour le moment</span>
          <button className="wam__empty-add" onClick={() => setAdding(true)}>+ Ajouter</button>
        </div>
      ) : null}

      <div className="wam__list">
        {visibles.map(item => (
          <div key={item.id} className="wam__item">
            <div className="wam__item-body">
              <span className="wam__item-nom">{item.nom}</span>
              {item.notes && (
                <span className="wam__item-notes">{item.notes}</span>
              )}
            </div>
            <div className="wam__item-right">
              {item.priorite === 'haute' && (
                <span className="wam__dot wam__dot--urgent" title="Cette semaine" />
              )}
              {item.prix != null && (
                <span className="wam__prix">{item.prix % 1 === 0 ? item.prix : item.prix.toFixed(2)} €</span>
              )}
              <button
                className="wam__check"
                onClick={e => toggle(item, e)}
                aria-label="Marquer comme acheté"
              >○</button>
              <button
                className="wam__delete"
                onClick={e => supprimer(item, e)}
                aria-label="Supprimer"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {reste > 0 && (
        <button className="wam__voir-plus" onClick={() => navigate('/achats')}>
          + {reste} article{reste > 1 ? 's' : ''} · Voir tout
        </button>
      )}
    </div>
  )
}
