/**
 * FAMILY OS — Module Maison & Déco
 * Décoration, aménagement, inspirations et suivi des transformations.
 * Sections : Pièces · Moodboards · Wishlist · Projets · Avant/Après
 */

import { usePersistedTab } from '../../shared/hooks/usePersistedTab'
import { useMaisonStore } from '../maison/stores/maisonStore'
import { usePieces, usePieceById, useProjets } from '../maison/hooks'
import { PiecesOverview, PieceDetail, PieceForm } from '../maison/components/pieces'
import { ProjetsList, ProjetDetail, ProjetForm } from '../maison/components/projets'
import { TachesList, TacheForm } from '../maison/components/taches'
import { TacheService } from '../maison/services/TacheService'
import { ProjetService } from '../maison/services/ProjetService'
import { MaisonService } from '../maison/services/MaisonService'
import { useTachesMaison } from '../maison/hooks'
import '../maison/MaisonModule.css'

type DecoPieceView = 'list' | 'detail'

// ─── Section Pièces ───────────────────────────────────────────────────────────

function SectionPieces() {
  const store = useMaisonStore()
  const pieces = usePieces()
  const pieceActive = usePieceById(store.pieceActiveId)
  const tachesPiece = useTachesMaison({ pieceId: store.pieceActiveId, statut: 'toutes' })

  const handleCompleterTache = (id: string) => TacheService.completerTache(id)
  const handleRouvrirTache   = (id: string) => TacheService.rouvrir(id)
  const handleDeleteTache    = (id: string) => TacheService.deleteTache(id)

  if (store.pieceActiveId && pieceActive) {
    return (
      <>
        <PieceDetail
          piece={pieceActive}
          onBack={() => store.setPieceActiveId(null)}
          onEdit={() => store.openDrawerPiece(pieceActive.id)}
          onEntretenir={() => MaisonService.marquerEntretenue(pieceActive.id)}
          onAddTache={() => store.openDrawerTache({ pieceId: pieceActive.id })}
        >
          <TachesList
            taches={tachesPiece ?? []}
            pieces={pieces ?? []}
            onComplete={handleCompleterTache}
            onReouvrir={handleRouvrirTache}
            onEdit={(id) => store.openDrawerTache({ editId: id })}
            onDelete={handleDeleteTache}
            showPiece={false}
          />
        </PieceDetail>
        <PieceForm isOpen={store.drawerPieceOpen} onClose={store.closeDrawerPiece} editId={store.drawerPieceEditId} piece={store.drawerPieceEditId ? pieceActive : null} />
        <TacheForm isOpen={store.drawerTacheOpen} onClose={store.closeDrawerTache} editId={store.drawerTacheEditId} piecePrefill={store.drawerTachePiecePrefill} />
      </>
    )
  }

  return (
    <>
      <PiecesOverview
        pieces={pieces ?? []}
        onSelectPiece={store.setPieceActiveId}
        onAddPiece={() => store.openDrawerPiece()}
      />
      <PieceForm isOpen={store.drawerPieceOpen} onClose={store.closeDrawerPiece} editId={store.drawerPieceEditId} piece={store.drawerPieceEditId ? (pieces ?? []).find(p => p.id === store.drawerPieceEditId) ?? null : null} />
    </>
  )
}

// ─── Section Projets ──────────────────────────────────────────────────────────

function SectionProjets() {
  const store = useMaisonStore()
  const pieces = usePieces()
  const projets = useProjets()
  const projetActif = (projets ?? []).find(p => p.projet.id === store.projetActifId) ?? null
  const tachesProjet = useTachesMaison({ projetId: store.projetActifId, statut: 'toutes' })

  const handleCompleterTache = (id: string) => TacheService.completerTache(id)
  const handleRouvrirTache   = (id: string) => TacheService.rouvrir(id)
  const handleDeleteTache    = (id: string) => TacheService.deleteTache(id)

  if (store.projetActifId && projetActif) {
    return (
      <>
        <ProjetDetail
          projet={projetActif.projet}
          progression={projetActif.progression}
          piece={projetActif.piece}
          nbTaches={projetActif.nbTaches}
          nbFaites={projetActif.nbFaites}
          onBack={() => { store.setProjetActifId(null) }}
          onEdit={() => store.openDrawerProjet(projetActif.projet.id)}
          onChangerStatut={(s) => ProjetService.changerStatut(projetActif.projet.id, s)}
          onAddTache={() => store.openDrawerTache({ projetId: projetActif.projet.id })}
        >
          <TachesList
            taches={tachesProjet ?? []}
            pieces={pieces ?? []}
            onComplete={handleCompleterTache}
            onReouvrir={handleRouvrirTache}
            onEdit={(id) => store.openDrawerTache({ editId: id })}
            onDelete={handleDeleteTache}
            showPiece={true}
          />
        </ProjetDetail>
        <ProjetForm isOpen={store.drawerProjetOpen} onClose={store.closeDrawerProjet} editId={store.drawerProjetEditId} projet={projetActif.projet} />
        <TacheForm isOpen={store.drawerTacheOpen} onClose={store.closeDrawerTache} editId={store.drawerTacheEditId} projetPrefill={store.drawerTacheProjetPrefill} />
      </>
    )
  }

  return (
    <>
      <ProjetsList
        projets={projets ?? []}
        onSelectProjet={(id) => store.setProjetActifId(id)}
        onEdit={(id) => store.openDrawerProjet(id)}
        onAdd={() => store.openDrawerProjet()}
      />
      <button
        className="maison-fab-projet"
        onClick={() => store.openDrawerProjet()}
        aria-label="Nouveau projet"
      >
        ＋ Nouveau projet
      </button>
      <ProjetForm isOpen={store.drawerProjetOpen} onClose={store.closeDrawerProjet} editId={store.drawerProjetEditId} projet={store.drawerProjetEditId ? (projets ?? []).find(p => p.projet.id === store.drawerProjetEditId)?.projet ?? null : null} />
    </>
  )
}

// ─── Sections placeholder ─────────────────────────────────────────────────────

function PlaceholderSection({ icon, titre, description }: { icon: string; titre: string; description: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', color: '#9B8DB5' }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: '#3D3357', marginBottom: 6 }}>{titre}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{description}</div>
      <div style={{ marginTop: 24, fontSize: 12, color: '#C9B8E8', fontStyle: 'italic' }}>Bientôt disponible</div>
    </div>
  )
}

// ─── Module principal ─────────────────────────────────────────────────────────

type DecoTab = 'pieces' | 'moodboards' | 'wishlist' | 'projets' | 'avant_apres'

const TABS: { key: DecoTab; label: string }[] = [
  { key: 'projets',    label: 'Projets'      },
  { key: 'moodboards', label: 'Moodboards'   },
  { key: 'wishlist',   label: 'Wishlist'     },
  { key: 'avant_apres', label: 'Avant / Après' },
]

export default function MaisonDecoModule() {
  const [activeTab, setActiveTab] = usePersistedTab<DecoTab>('maison-deco', 'projets')

  return (
    <div className="maison-module" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Onglets scrollables */}
      <nav className="seg-tabs seg-tabs--scroll">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`seg-tab${activeTab === tab.key ? ' seg-tab--active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'projets' && <div className="maison-content"><SectionProjets /></div>}
        {activeTab === 'moodboards' && (
          <PlaceholderSection
            icon="🖼️"
            titre="Moodboards"
            description="Créez des planches d'inspiration pour chaque pièce et projet de décoration."
          />
        )}
        {activeTab === 'wishlist' && (
          <PlaceholderSection
            icon="✨"
            titre="Wishlist déco"
            description="Enregistrez les meubles, accessoires et éléments de décoration qui vous inspirent."
          />
        )}
        {activeTab === 'avant_apres' && (
          <PlaceholderSection
            icon="📸"
            titre="Avant / Après"
            description="Immortalisez les transformations de votre intérieur avec des comparatifs photo."
          />
        )}
      </div>
    </div>
  )
}
