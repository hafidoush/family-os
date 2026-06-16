/**
 * FAMILY OS — MaisonModule
 * src/modules/maison/MaisonModule.tsx
 *
 * Orchestrateur : gère la navigation interne (overview / pièce / projets / tâches)
 * et connecte les hooks, services et composants.
 */

import { useMaisonStore } from './stores/maisonStore';
import {
  usePieces, usePieceById, useTachesMaison, useProjets, useMaisonOverview,
} from './hooks';
import { MaisonService, etatColor, scoreToEtat } from './services/MaisonService';
import { TacheService } from './services/TacheService';
import { ProjetService } from './services/ProjetService';
import { PiecesOverview, PieceCard, PieceDetail, PieceForm } from './components/pieces';
import { TachesList, TacheForm } from './components/taches';
import { ProjetsList, ProjetDetail, ProjetForm } from './components/projets';
import './MaisonModule.css';

export default function MaisonModule() {
  const store = useMaisonStore();
  const overview = useMaisonOverview();
  const pieces = usePieces();
  const projets = useProjets();
  const pieceActive = usePieceById(store.pieceActiveId);
  const projetActif = (projets ?? []).find(p => p.projet.id === store.projetActifId) ?? null;

  // Tâches filtrées selon le contexte
  const tachesPiece = useTachesMaison({
    pieceId: store.pieceActiveId,
    statut: 'toutes',
  });
  const tachesProjet = useTachesMaison({
    projetId: store.projetActifId,
    statut: 'toutes',
  });
  const tachesGlobales = useTachesMaison({
    pieceId: store.filtrePieceId,
    statut: store.filtreStatut,
  });

  // ── Handlers communs ────────────────────────────────────────────────────────

  const handleCompleterTache = async (id: string) => {
    await TacheService.completerTache(id);
  };
  const handleRouvrirTache = async (id: string) => {
    await TacheService.rouvrir(id);
  };
  const handleDeleteTache = async (id: string) => {
    await TacheService.deleteTache(id);
  };

  // ── Vue : Détail d'une pièce ────────────────────────────────────────────────

  if (store.pieceActiveId && pieceActive) {
    return (
      <div className="maison-module">
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

        <PieceForm
          isOpen={store.drawerPieceOpen}
          onClose={store.closeDrawerPiece}
          editId={store.drawerPieceEditId}
          piece={store.drawerPieceEditId ? pieceActive : null}
        />
        <TacheForm
          isOpen={store.drawerTacheOpen}
          onClose={store.closeDrawerTache}
          editId={store.drawerTacheEditId}
          piecePrefill={store.drawerTachePiecePrefill}
        />
      </div>
    );
  }

  // ── Vue : Détail d'un projet ────────────────────────────────────────────────

  if (store.projetActifId && projetActif) {
    return (
      <div className="maison-module">
        <ProjetDetail
          projet={projetActif.projet}
          progression={projetActif.progression}
          piece={projetActif.piece}
          nbTaches={projetActif.nbTaches}
          nbFaites={projetActif.nbFaites}
          onBack={() => { store.setProjetActifId(null); store.setVue('projets'); }}
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

        <ProjetForm
          isOpen={store.drawerProjetOpen}
          onClose={store.closeDrawerProjet}
          editId={store.drawerProjetEditId}
          projet={projetActif.projet}
        />
        <TacheForm
          isOpen={store.drawerTacheOpen}
          onClose={store.closeDrawerTache}
          editId={store.drawerTacheEditId}
          projetPrefill={store.drawerTacheProjetPrefill}
        />
      </div>
    );
  }

  // ── Vue principale : tabs Overview / Tâches / Projets ──────────────────────

  return (
    <div className="maison-module">

      {/* Header avec stats rapides */}
      {overview && (
        <div className="maison-stats-bar">
          <div className="maison-stat">
            <span className="maison-stat__value"
              style={{ color: overview.scoreMoyen >= 60 ? '#86EFAC' : overview.scoreMoyen >= 35 ? '#FCD34D' : '#FCA5A5' }}>
              {overview.scoreMoyen}%
            </span>
            <span className="maison-stat__label">Score moyen</span>
          </div>
          {overview.piecesCritiques > 0 && (
            <div className="maison-stat maison-stat--alerte">
              <span className="maison-stat__value">{overview.piecesCritiques}</span>
              <span className="maison-stat__label">Urgent{overview.piecesCritiques > 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="maison-stat">
            <span className="maison-stat__value">{overview.tachesEnAttente}</span>
            <span className="maison-stat__label">Tâches</span>
          </div>
          {overview.tachesEnRetard > 0 && (
            <div className="maison-stat maison-stat--alerte">
              <span className="maison-stat__value">{overview.tachesEnRetard}</span>
              <span className="maison-stat__label">En retard</span>
            </div>
          )}
          <div className="maison-stat">
            <span className="maison-stat__value">{overview.projetsEnCours}</span>
            <span className="maison-stat__label">Projets</span>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="maison-tabs">
        {(['overview', 'taches', 'projets'] as const).map(v => (
          <button
            key={v}
            className={`maison-tab ${store.vue === v ? 'maison-tab--actif' : ''}`}
            onClick={() => store.setVue(v)}
          >
            {v === 'overview' ? 'Pièces' : v === 'taches' ? 'Tâches' : 'Projets'}
          </button>
        ))}
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="maison-content">

        {store.vue === 'overview' && (
          <PiecesOverview
            pieces={pieces ?? []}
            onSelectPiece={store.setPieceActiveId}
            onAddPiece={() => store.openDrawerPiece()}
          />
        )}

        {store.vue === 'taches' && (
          <div className="maison-taches-vue">
            {/* Filtres */}
            <div className="maison-taches-filtres">
              <select
                className="maison-filtre-select"
                value={store.filtrePieceId ?? ''}
                onChange={e => store.setFiltrePieceId(e.target.value || null)}
              >
                <option value="">Toutes les pièces</option>
                {(pieces ?? []).map(p => (
                  <option key={p.id} value={p.id}>{p.icone} {p.nom}</option>
                ))}
              </select>
              <div className="maison-filtre-statut">
                {(['toutes', 'a_faire', 'fait'] as const).map(s => (
                  <button
                    key={s}
                    className={`maison-filtre-btn ${store.filtreStatut === s ? 'maison-filtre-btn--actif' : ''}`}
                    onClick={() => store.setFiltreStatut(s)}
                  >
                    {s === 'toutes' ? 'Toutes' : s === 'a_faire' ? 'À faire' : 'Faites'}
                  </button>
                ))}
              </div>
            </div>

            <TachesList
              taches={tachesGlobales ?? []}
              pieces={pieces ?? []}
              onComplete={handleCompleterTache}
              onReouvrir={handleRouvrirTache}
              onEdit={(id) => store.openDrawerTache({ editId: id })}
              onDelete={handleDeleteTache}
              showPiece={!store.filtrePieceId}
            />

            <button
              className="maison-fab-tache"
              onClick={() => store.openDrawerTache()}
              aria-label="Nouvelle tâche"
            >
              ＋ Nouvelle tâche
            </button>
          </div>
        )}

        {store.vue === 'projets' && (
          <div className="maison-projets-vue">
            <ProjetsList
              projets={projets ?? []}
              onSelectProjet={(id) => { store.setProjetActifId(id); }}
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
          </div>
        )}
      </div>

      {/* Drawers globaux */}
      <PieceForm
        isOpen={store.drawerPieceOpen}
        onClose={store.closeDrawerPiece}
        editId={store.drawerPieceEditId}
        piece={store.drawerPieceEditId
          ? (pieces ?? []).find(p => p.id === store.drawerPieceEditId) ?? null
          : null
        }
      />
      <TacheForm
        isOpen={store.drawerTacheOpen}
        onClose={store.closeDrawerTache}
        editId={store.drawerTacheEditId}
        piecePrefill={store.drawerTachePiecePrefill}
        projetPrefill={store.drawerTacheProjetPrefill}
      />
      <ProjetForm
        isOpen={store.drawerProjetOpen}
        onClose={store.closeDrawerProjet}
        editId={store.drawerProjetEditId}
        projet={store.drawerProjetEditId
          ? (projets ?? []).find(p => p.projet.id === store.drawerProjetEditId)?.projet ?? null
          : null
        }
      />
    </div>
  );
}
