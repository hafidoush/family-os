/**
 * FAMILY OS — SwipeGouters
 * Les enfants sélectionnent leurs 7 recettes de la semaine style Tinder.
 * Swipe droite = ✅ on prépare, gauche = ❌ pas cette fois.
 * Une fois 7 recettes sélectionnées → résumé + création SessionPreparation batch cooking.
 * La catégorie (goûters, desserts, repas) est choisie avant de démarrer.
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../core/db/database'
import { newEntity } from '../../../../core/db/helpers'
import type { Recette, SessionPreparation } from '../../../../shared/types'
import { IconHeart, IconClose } from '@shared/components/ui/Icon/Icon'
import { type BatchCategorie, BATCH_CATEGORIES, labelForCategorie, matchesBatchCategorie } from '../preparation/batchTypes'
import './SwipeGouters.css'

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEFAULT_TARGET = 5        // nb de recettes par défaut
const SWIPE_THRESHOLD = 80      // px pour valider un swipe
const TILT_FACTOR = 0.08        // rotation par pixel de déplacement (deg/px)

// ─── Emoji par type ───────────────────────────────────────────────────────────

const TYPE_EMOJI: Record<string, string> = {
  gouter:         '🧁',
  dessert:        '🍮',
  snack:          '🥜',
  petit_dejeuner: '🥐',
  plat:           '🍲',
}

// ─── Carte swipeable ──────────────────────────────────────────────────────────

interface SwipeCardProps {
  recette: Recette
  onLike: () => void
  onNope: () => void
  imageUrl?: string
}

function SwipeCardComponent({ recette, onLike, onNope, imageUrl }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null)
  const startX = useRef(0)

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (exitDir) return
    setDragging(true)
    startX.current = e.clientX
    cardRef.current?.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || exitDir) return
    setDragX(e.clientX - startX.current)
  }

  const handlePointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (dragX > SWIPE_THRESHOLD) {
      setExitDir('right')
    } else if (dragX < -SWIPE_THRESHOLD) {
      setExitDir('left')
    } else {
      setDragX(0)
    }
  }

  // Déclencher les callbacks après l'animation de sortie
  useEffect(() => {
    if (!exitDir) return
    const t = setTimeout(() => {
      exitDir === 'right' ? onLike() : onNope()
    }, 340)
    return () => clearTimeout(t)
  }, [exitDir, onLike, onNope])

  const rotation = dragging ? dragX * TILT_FACTOR : 0
  const showLike = dragX > 30
  const showNope = dragX < -30

  const cardStyle: React.CSSProperties = exitDir
    ? {}
    : {
        transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
        transition: dragging ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }

  const emoji = TYPE_EMOJI[recette.typePreparation ?? 'gouter'] ?? '🧁'

  return (
    <div
      ref={cardRef}
      className={[
        'swipe-card',
        exitDir === 'left'  ? 'swipe-card--exit-left'  : '',
        exitDir === 'right' ? 'swipe-card--exit-right' : '',
      ].filter(Boolean).join(' ')}
      style={cardStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Indicateurs directionnels */}
      <span className={`swipe-card__hint-like${showLike ? ' swipe-card__hint-like--visible' : ''}`}>
        ✓ OUI
      </span>
      <span className={`swipe-card__hint-nope${showNope ? ' swipe-card__hint-nope--visible' : ''}`}>
        ✗ NON
      </span>

      {/* Zone image */}
      <div className="swipe-card__image">
        {imageUrl ? (
          <img src={imageUrl} alt={recette.nom} />
        ) : (
          <span className="swipe-card__image-placeholder">{emoji}</span>
        )}
      </div>

      {/* Infos */}
      <div className="swipe-card__body">
        <div className="swipe-card__nom">{recette.nom}</div>

        {recette.tags && recette.tags.length > 0 && (
          <div className="swipe-card__tags">
            {recette.tags.slice(0, 3).map(t => (
              <span key={t} className="swipe-card__tag">{t}</span>
            ))}
          </div>
        )}

        <div className="swipe-card__meta">
          {recette.tempsPreparation && (
            <span>⏱ {recette.tempsPreparation} min</span>
          )}
          {recette.difficulte && (
            <span>
              {recette.difficulte === 'facile' ? '🟢' : recette.difficulte === 'moyen' ? '🟡' : '🔴'}
              {' '}{recette.difficulte}
            </span>
          )}
          {recette.congelable && <span>❄️ congélable</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Écran résultat ────────────────────────────────────────────────────────────

function ResultScreen({
  selected,
  categorie,
  targetCount,
  onConfirm,
  onReset,
}: {
  selected: Recette[]
  categorie: BatchCategorie
  targetCount: number
  onConfirm: () => Promise<void>
  onReset: () => void
}) {
  const [saving, setSaving] = useState(false)
  const catLabel = labelForCategorie(categorie, true).toLowerCase()
  const catEmoji = BATCH_CATEGORIES.find(c => c.key === categorie)?.emoji ?? '🎉'

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await onConfirm()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="swipe-result">
      <p className="swipe-result__title">
        {catEmoji} Tes {targetCount} {catLabel} de la semaine
      </p>

      <ul className="swipe-result__list" role="list">
        {selected.map((r, i) => (
          <li key={r.id} className="swipe-result__item">
            <span className="swipe-result__item-emoji">
              {TYPE_EMOJI[r.typePreparation ?? 'gouter'] ?? '🧁'}
            </span>
            <div>
              <div className="swipe-result__item-nom">{i + 1}. {r.nom}</div>
              {r.dureeConservation && (
                <div className="swipe-result__item-meta">
                  🗓 Se conserve {r.dureeConservation} j
                  {r.congelable ? ' · ❄️ congélable' : ''}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="swipe-result__actions">
        <button
          className="swipe-result__btn-primary"
          onClick={handleConfirm}
          disabled={saving}
        >
          {saving ? 'Planification…' : `${catEmoji} Planifier le batch cooking`}
        </button>
        <button className="swipe-result__btn-secondary" onClick={onReset}>
          Recommencer la sélection
        </button>
      </div>
    </div>
  )
}

// ─── Sélecteur de catégorie (style enfants) ───────────────────────────────────

function KidsCategoryPicker({ onChoisir }: { onChoisir: (cat: BatchCategorie) => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 16, padding: '32px 20px', textAlign: 'center',
    }}>
      <span style={{ fontSize: '3rem' }}>🧒</span>
      <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
        Qu'est-ce qu'on prépare ?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
        {BATCH_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => onChoisir(cat.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px', borderRadius: 16, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.75)',
              boxShadow: '0 2px 12px rgba(100,80,140,0.1)',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '2rem', flexShrink: 0 }}>{cat.emoji}</span>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{cat.labelKids}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 2 }}>{cat.descriptionKids}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Écran d'accueil "mode enfants" ──────────────────────────────────────────

function KidsIntro({ categorie, targetCount, onTargetChange, onStart }: {
  categorie: BatchCategorie
  targetCount: number
  onTargetChange: (n: number) => void
  onStart: () => void
}) {
  const cat = BATCH_CATEGORIES.find(c => c.key === categorie)!
  const label = labelForCategorie(categorie, true)
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 20, padding: '40px 24px', textAlign: 'center',
    }}>
      <span style={{ fontSize: '3.5rem' }}>{cat.emoji}</span>
      <div>
        <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
          {label}
        </p>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>
          Glisse vers la droite pour choisir,<br />
          vers la gauche pour passer.
        </p>
      </div>

      {/* Stepper objectif */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        background: 'rgba(201,184,232,0.15)', borderRadius: 16, padding: '12px 20px',
      }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4B4660' }}>Objectif</span>
        <button
          onClick={() => onTargetChange(Math.max(1, targetCount - 1))}
          style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#4B4660', color: 'white', fontSize: '1.1rem', display: 'flex',
            alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}
        >−</button>
        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1E1C2E', minWidth: 90, textAlign: 'center' }}>
          {targetCount} recette{targetCount > 1 ? 's' : ''}
        </span>
        <button
          onClick={() => onTargetChange(targetCount + 1)}
          style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#4B4660', color: 'white', fontSize: '1.1rem', display: 'flex',
            alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}
        >+</button>
      </div>

      <button
        onClick={onStart}
        style={{
          padding: '14px 32px', borderRadius: 16, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#9A5CA3,#C9B8E8)',
          color: 'white', fontSize: '1rem', fontWeight: 700,
          boxShadow: '0 4px 18px rgba(154,92,163,0.3)',
        }}
      >
        C'est parti 🎉
      </button>
    </div>
  )
}

// ─── Jeu (rendu seulement une fois l'intro passée) ────────────────────────────

function SwipeGoutersGame({ categorie, targetCount }: { categorie: BatchCategorie; targetCount: number }) {
  const allRecettes = useLiveQuery(
    () =>
      db.recettes
        .filter(r => matchesBatchCategorie(r, categorie))
        .toArray()
        .then(list => list.sort(() => Math.random() - 0.5)),
    [categorie]
  )

  // State principal
  const [queue, setQueue] = useState<Recette[]>([])            // à swiper
  const [skipped, setSkipped] = useState<Recette[]>([])        // passées
  const [selected, setSelected] = useState<Recette[]>([])      // choisies
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [sessionCreated, setSessionCreated] = useState(false)

  // Initialise la queue quand les recettes arrivent (ou quand elles passent de vide à non-vide)
  const initialized = useRef(false)
  useEffect(() => {
    if (!allRecettes || allRecettes.length === 0) return
    // Réinitialiser si pas encore fait OU si la queue et la sélection sont vides
    // (ex : recettes ajoutées après le premier rendu vide)
    if (initialized.current && (queue.length > 0 || selected.length > 0 || done)) return
    initialized.current = true
    setQueue([...allRecettes])
    // Génère les URL pour les images : imageData (base64) en priorité, sinon Blob legacy
    const urls: Record<string, string> = {}
    allRecettes.forEach(r => {
      if (r.imageData) urls[r.id] = r.imageData
      else if (r.image) urls[r.id] = URL.createObjectURL(r.image)
    })
    setImageUrls(urls)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRecettes])

  // Cleanup URL blobs
  useEffect(() => {
    return () => {
      Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url))
    }
  }, [imageUrls])

  const currentCard = queue[queue.length - 1]

  const handleLike = useCallback(() => {
    if (!currentCard) return
    const newSelected = [...selected, currentCard]
    setQueue(q => q.slice(0, -1))
    setSelected(newSelected)
    if (newSelected.length >= targetCount) {
      setDone(true)
    }
  }, [currentCard, selected])

  const handleNope = useCallback(() => {
    if (!currentCard) return
    setSkipped(s => [...s, currentCard])
    setQueue(q => q.slice(0, -1))
    // Si on arrive à la fin sans assez de sélections, remettre les skipped
    if (queue.length === 1 && selected.length < targetCount) {
      setQueue([...skipped].sort(() => Math.random() - 0.5))
      setSkipped([])
    }
  }, [currentCard, queue.length, selected.length, skipped])

  const handleUndo = useCallback(() => {
    if (selected.length > 0) {
      const last = selected[selected.length - 1]
      setSelected(s => s.slice(0, -1))
      setQueue(q => [...q, last])
      setDone(false)
    } else if (skipped.length > 0) {
      const last = skipped[skipped.length - 1]
      setSkipped(s => s.slice(0, -1))
      setQueue(q => [...q, last])
    }
  }, [selected, skipped])

  const catLabel = labelForCategorie(categorie, true).toLowerCase()
  const catEmoji = BATCH_CATEGORIES.find(c => c.key === categorie)?.emoji ?? '🍽'

  const handleConfirm = async () => {
    const dateSession = new Date().toISOString().split('T')[0]
    await db.sessionsPreparation.add(
      newEntity<SessionPreparation>({
        dateSession,
        recetteIds: selected.map(r => r.id),
        statut: 'planifiee',
        notes: `${labelForCategorie(categorie)} de la semaine — sélectionnés par les enfants`,
      })
    )
    setSessionCreated(true)
  }

  const handleReset = () => {
    initialized.current = false
    setQueue(allRecettes ? [...allRecettes].sort(() => Math.random() - 0.5) : [])
    setSkipped([])
    setSelected([])
    setDone(false)
    setSessionCreated(false)
  }

  // ── États spéciaux ──

  if (allRecettes === undefined) {
    return (
      <div className="swipe-gouters">
        <div className="swipe-gouters__empty">
          <span className="swipe-gouters__empty-icon">⏳</span>
          Chargement des recettes…
        </div>
      </div>
    )
  }

  if (allRecettes.length === 0) {
    return (
      <div className="swipe-gouters">
        <div className="swipe-gouters__empty">
          <span className="swipe-gouters__empty-icon">{catEmoji}</span>
          Aucune recette dans cette catégorie.<br />
          {categorie === 'repas'
            ? 'Ajoute des recettes avec le type "Plat principal".'
            : `Ajoute des recettes avec le type "${catLabel}".`}
        </div>
      </div>
    )
  }

  if (sessionCreated) {
    return (
      <div className="swipe-gouters">
        <div className="swipe-gouters__empty">
          <span className="swipe-gouters__empty-icon">✅</span>
          Session batch cooking planifiée.<br />
          Retrouve-la dans l'onglet Hebdo.
          <br /><br />
          <button className="swipe-result__btn-secondary" onClick={handleReset}>
            Nouvelle sélection
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="swipe-gouters">
        <ResultScreen
          selected={selected}
          categorie={categorie}
          targetCount={targetCount}
          onConfirm={handleConfirm}
          onReset={handleReset}
        />
      </div>
    )
  }

  const remaining = targetCount - selected.length

  return (
    <div className="swipe-gouters">
      {/* Header */}
      <div className="swipe-gouters__header">
        <p className="swipe-gouters__title">Choisis tes {catLabel}</p>
        <p className="swipe-gouters__subtitle">
          {remaining === targetCount
            ? `Sélectionne ${targetCount} ${catLabel} pour la semaine`
            : `Encore ${remaining} à choisir`}
        </p>
      </div>

      {/* Progression */}
      <div className="swipe-gouters__progress" role="progressbar" aria-valuenow={selected.length} aria-valuemax={targetCount}>
        {Array.from({ length: targetCount }).map((_, i) => (
          <div
            key={i}
            className={`swipe-progress-dot${i < selected.length ? ' swipe-progress-dot--filled' : ''}`}
          />
        ))}
      </div>

      {/* Stack de cartes */}
      {queue.length > 0 ? (
        <div className="swipe-gouters__stack">
          <SwipeCardComponent
            key={currentCard?.id}
            recette={currentCard}
            onLike={handleLike}
            onNope={handleNope}
            imageUrl={currentCard?.id ? imageUrls[currentCard.id] : undefined}
          />
        </div>
      ) : (
        <div className="swipe-gouters__empty" style={{ width: 300 }}>
          <span className="swipe-gouters__empty-icon">🔄</span>
          On recommence depuis le début…
        </div>
      )}

      {/* Boutons d'action */}
      <div className="swipe-gouters__actions">
        <button
          className="swipe-action-btn swipe-action-btn--undo"
          onClick={handleUndo}
          disabled={selected.length === 0 && skipped.length === 0}
          aria-label="Annuler"
          title="Annuler"
        >
          ↩
        </button>
        <button
          className="swipe-action-btn swipe-action-btn--nope"
          onClick={handleNope}
          disabled={queue.length === 0}
          aria-label="Non merci"
        >
          <IconClose size={20} />
        </button>
        <button
          className="swipe-action-btn swipe-action-btn--like"
          onClick={handleLike}
          disabled={queue.length === 0}
          aria-label="Je veux cette recette"
        >
          <IconHeart size={20} />
        </button>
      </div>
    </div>
  )
}

// ─── Composant exporté avec sélection catégorie + intro ──────────────────────

export function SwipeGouters() {
  const [categorie, setCategorie] = useState<BatchCategorie | null>(null)
  const [targetCount, setTargetCount] = useState(DEFAULT_TARGET)
  const [started, setStarted] = useState(false)

  if (!categorie) return <KidsCategoryPicker onChoisir={setCategorie} />
  if (!started) return (
    <KidsIntro
      categorie={categorie}
      targetCount={targetCount}
      onTargetChange={setTargetCount}
      onStart={() => setStarted(true)}
    />
  )
  return <SwipeGoutersGame categorie={categorie} targetCount={targetCount} />
}

export default SwipeGouters
