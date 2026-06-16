/**
 * FAMILY OS — PartageSheet
 * Bottom sheet pour créer et partager une liste avec Élies.
 */

import { useState } from 'react'
import { creerListePartagee } from '../../core/supabase/partageService'
import './PartageSheet.css'

export interface ItemAPartager {
  label: string
  ordre: number
}

interface PartageSheetProps {
  titre: string
  items: ItemAPartager[]
  onClose: () => void
}

export function PartageSheet({ titre, items, onClose }: PartageSheetProps) {
  const [etape, setEtape] = useState<'confirm' | 'loading' | 'done' | 'error'>('confirm')
  const [url, setUrl] = useState('')
  const [copie, setCopie] = useState(false)

  const handlePartager = async () => {
    setEtape('loading')
    try {
      const result = await creerListePartagee(titre, items)
      setUrl(result.url)
      setEtape('done')
    } catch {
      setEtape('error')
    }
  }

  const handleCopier = async () => {
    await navigator.clipboard.writeText(url)
    setCopie(true)
    setTimeout(() => setCopie(false), 2000)
  }

  const handlePartagerViaApp = () => {
    if (navigator.share) {
      navigator.share({ title: titre, url })
    } else {
      handleCopier()
    }
  }

  return (
    <div className="ps-overlay" onClick={onClose}>
      <div className="ps-sheet" onClick={e => e.stopPropagation()}>
        <div className="ps-handle" />

        {etape === 'confirm' && (
          <>
            <div className="ps-header">
              <button className="ps-close" onClick={onClose}>×</button>
              <span className="ps-header__title">Partager avec Élies</span>
            </div>

            <div className="ps-body">
              <div className="ps-preview-titre">{titre}</div>
              <div className="ps-items-preview">
                {items.slice(0, 5).map((item, i) => (
                  <div key={i} className="ps-preview-item">
                    <span className="ps-preview-item__dot" />
                    <span className="ps-preview-item__label">{item.label}</span>
                  </div>
                ))}
                {items.length > 5 && (
                  <div className="ps-preview-more">+ {items.length - 5} autres</div>
                )}
              </div>

              <p className="ps-info">
                Un lien sera généré. Élies pourra cocher les items depuis son téléphone, sans installer l'app.
              </p>
            </div>

            <div className="ps-footer">
              <button className="ps-btn ps-btn--primary" onClick={handlePartager}>
                <span>🔗</span> Générer le lien
              </button>
              <button className="ps-btn ps-btn--ghost" onClick={onClose}>Annuler</button>
            </div>
          </>
        )}

        {etape === 'loading' && (
          <div className="ps-loading">
            <div className="ps-spinner" />
            <span>Création de la liste…</span>
          </div>
        )}

        {etape === 'done' && (
          <>
            <div className="ps-header">
              <button className="ps-close" onClick={onClose}>×</button>
              <span className="ps-header__title">Liste prête</span>
            </div>

            <div className="ps-body">
              <div className="ps-success-icon">✓</div>
              <p className="ps-success-text">
                La liste est en ligne. Élies peut la consulter et cocher les items en temps réel.
              </p>

              <div className="ps-url-box">
                <span className="ps-url-text">{url}</span>
              </div>
            </div>

            <div className="ps-footer">
              <button className="ps-btn ps-btn--primary" onClick={handlePartagerViaApp}>
                <span>📤</span> Envoyer à Élies
              </button>
              <button className="ps-btn ps-btn--ghost" onClick={handleCopier}>
                {copie ? '✓ Copié !' : 'Copier le lien'}
              </button>
            </div>
          </>
        )}

        {etape === 'error' && (
          <>
            <div className="ps-header">
              <button className="ps-close" onClick={onClose}>×</button>
              <span className="ps-header__title">Erreur</span>
            </div>
            <div className="ps-body">
              <p className="ps-error-text">
                Impossible de créer la liste. Vérifie ta connexion et réessaie.
              </p>
            </div>
            <div className="ps-footer">
              <button className="ps-btn ps-btn--primary" onClick={handlePartager}>Réessayer</button>
              <button className="ps-btn ps-btn--ghost" onClick={onClose}>Fermer</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
