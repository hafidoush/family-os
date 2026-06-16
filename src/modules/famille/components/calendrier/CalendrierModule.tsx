/**
 * FAMILY OS — CalendrierModule
 * Orchestrateur calendrier avec vues semaine et mois
 */

import React, { useMemo } from 'react';
import { Drawer } from '@shared/components/ui/Drawer';
import { useFamilleStore } from '../../stores/familleStore';
import { useEvenementsJour, useEvenementsMois, useEvenementsSemaine, useMembres } from '../../hooks/useCalendrier';
import EvenementCard from './EvenementCard';
import EvenementForm from './EvenementForm';
import EvenementDetail from './EvenementDetail';
import type { Evenement } from '@shared/types/entities';

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const JOURS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const TYPE_COLORS: Record<string, string> = {
  rendez_vous: '#C9B8E8',
  anniversaire: '#F9A8D4',
  sortie: '#86EFAC',
  evenement: '#B8D4E8',
  rappel: '#FCD34D',
  medical: '#F87171',
};

function getLundi(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateDisplay(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Vue Semaine ─────────────────────────────────────────────────────────────

function VueSemaine() {
  const { dateSelectionnee, setDateSelectionnee } = useFamilleStore();
  const [offsetSemaine, setOffsetSemaine] = React.useState(0);

  const lundi = useMemo(() => {
    const base = getLundi(new Date(dateSelectionnee));
    base.setDate(base.getDate() + offsetSemaine * 7);
    return base;
  }, [dateSelectionnee, offsetSemaine]);

  const semaine = useEvenementsSemaine(lundi);
  const evenementsJour = useEvenementsJour(dateSelectionnee);
  const membres = useMembres();

  const { evenementDetailId, setEvenementDetailId, setEditEvenementId, formEvenementOuvert, setFormEvenementOuvert, editEvenementId } = useFamilleStore();

  const jours = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lundi);
      d.setDate(lundi.getDate() + i);
      return d;
    });
  }, [lundi]);

  const today = toISO(new Date());

  const getEvenementsJourCalendrier = (iso: string) =>
    (semaine ?? []).filter(e => toISO(new Date(e.dateDebut)) === iso);

  const titreCalendrier = useMemo(() => {
    const dim = new Date(lundi);
    dim.setDate(lundi.getDate() + 6);
    const lM = MOIS_NOMS[lundi.getMonth()];
    const dM = MOIS_NOMS[dim.getMonth()];
    if (lM === dM) return `${lM} ${lundi.getFullYear()}`;
    return `${lundi.getDate()} ${lM} – ${dim.getDate()} ${dM}`;
  }, [lundi]);

  return (
    <>
      {/* Navigation */}
      <div className="calendrier-header">
        <div className="calendrier-nav">
          <button className="calendrier-nav-btn" onClick={() => setOffsetSemaine(o => o - 1)}>‹</button>
          <span className="calendrier-titre">{titreCalendrier}</span>
          <button className="calendrier-nav-btn" onClick={() => setOffsetSemaine(o => o + 1)}>›</button>
        </div>
        <button
          className="calendrier-nav-btn"
          style={{ fontSize: 12, fontWeight: 600, width: 'auto', padding: '0 10px' }}
          onClick={() => { setOffsetSemaine(0); setDateSelectionnee(today); }}
        >
          Auj.
        </button>
      </div>

      {/* Grille 7 jours */}
      <div className="semaine-jours">
        {jours.map((j, i) => {
          const iso = toISO(j);
          const evts = getEvenementsJourCalendrier(iso);
          const isToday = iso === today;
          const isSelected = iso === dateSelectionnee;
          return (
            <div
              key={iso}
              className={`semaine-jour-header${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
              onClick={() => setDateSelectionnee(iso)}
            >
              <div className="jour-nom">{JOURS_COURTS[i]}</div>
              <div className="jour-numero">{j.getDate()}</div>
              <div className="jour-dots">
                {evts.slice(0, 3).map((e, idx) => (
                  <div
                    key={idx}
                    className="jour-dot"
                    style={{ background: TYPE_COLORS[e.type] ?? '#C9B8E8' }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Événements du jour sélectionné */}
      <h3 className="evenements-jour-titre">
        {formatDateDisplay(dateSelectionnee)}
      </h3>

      <div className="evenements-liste">
        {(evenementsJour ?? []).length === 0 ? (
          <div className="empty-evenements">
            <div className="empty-evenements-icon">📭</div>
            <div className="empty-evenements-text">Aucun événement ce jour</div>
          </div>
        ) : (
          (evenementsJour ?? []).map(e => (
            <EvenementCard
              key={e.id}
              evenement={e}
              membres={membres ?? []}
              onClick={() => setEvenementDetailId(e.id)}
            />
          ))
        )}
      </div>

      {/* Form Drawer */}
      <Drawer
        isOpen={formEvenementOuvert}
        onClose={() => setFormEvenementOuvert(false)}
        title={editEvenementId ? 'Modifier l\'événement' : 'Nouvel événement'}
      >
        <EvenementForm
          editId={editEvenementId}
          defaultDate={dateSelectionnee}
          onSave={() => setFormEvenementOuvert(false)}
          onCancel={() => setFormEvenementOuvert(false)}
        />
      </Drawer>

      {/* Detail Drawer */}
      <EvenementDetail
        evenementId={evenementDetailId}
        onClose={() => setEvenementDetailId(null)}
        onEdit={(id) => { setEvenementDetailId(null); setEditEvenementId(id); }}
      />
    </>
  );
}

// ─── Vue Mois ─────────────────────────────────────────────────────────────────

function VueMois() {
  const { dateSelectionnee, setDateSelectionnee } = useFamilleStore();
  const { evenementDetailId, setEvenementDetailId, setEditEvenementId, formEvenementOuvert, setFormEvenementOuvert, editEvenementId } = useFamilleStore();

  const dateCourante = new Date(dateSelectionnee);
  const [annee, setAnnee] = React.useState(dateCourante.getFullYear());
  const [mois, setMois] = React.useState(dateCourante.getMonth());

  const evenements = useEvenementsMois(annee, mois);
  const membres = useMembres();
  const today = toISO(new Date());

  const navMois = (delta: number) => {
    const d = new Date(annee, mois + delta, 1);
    setAnnee(d.getFullYear());
    setMois(d.getMonth());
  };

  const cellulesCalendrier = useMemo(() => {
    const premierJour = new Date(annee, mois, 1);
    let jourSemaine = premierJour.getDay();
    jourSemaine = jourSemaine === 0 ? 6 : jourSemaine - 1; // lundi = 0

    const cells: { date: Date; autreMois: boolean }[] = [];

    // Jours précédents
    for (let i = jourSemaine - 1; i >= 0; i--) {
      const d = new Date(annee, mois, -i);
      cells.push({ date: d, autreMois: true });
    }

    // Jours du mois
    const nbJours = new Date(annee, mois + 1, 0).getDate();
    for (let i = 1; i <= nbJours; i++) {
      cells.push({ date: new Date(annee, mois, i), autreMois: false });
    }

    // Compléter à 42 cellules
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      cells.push({ date: next, autreMois: true });
    }

    return cells;
  }, [annee, mois]);

  const getEventsForDate = (iso: string) =>
    (evenements ?? []).filter(e => toISO(new Date(e.dateDebut)) === iso);

  return (
    <>
      <div className="calendrier-header">
        <div className="calendrier-nav">
          <button className="calendrier-nav-btn" onClick={() => navMois(-1)}>‹</button>
          <span className="calendrier-titre">{MOIS_NOMS[mois]} {annee}</span>
          <button className="calendrier-nav-btn" onClick={() => navMois(1)}>›</button>
        </div>
        <button
          className="calendrier-nav-btn"
          style={{ fontSize: 12, fontWeight: 600, width: 'auto', padding: '0 10px' }}
          onClick={() => { const n = new Date(); setAnnee(n.getFullYear()); setMois(n.getMonth()); setDateSelectionnee(today); }}
        >
          Auj.
        </button>
      </div>

      <div className="mois-grid-header">
        {JOURS_COURTS.map(j => (
          <div key={j} className="mois-jour-nom">{j}</div>
        ))}
      </div>

      <div className="mois-grid">
        {cellulesCalendrier.map(({ date, autreMois }) => {
          const iso = toISO(date);
          const evts = getEventsForDate(iso);
          const isToday = iso === today;
          const isSelected = iso === dateSelectionnee;

          return (
            <div
              key={iso}
              className={`mois-cell${autreMois ? ' autre-mois' : ''}${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
              onClick={() => setDateSelectionnee(iso)}
            >
              <div className="mois-cell-num">{date.getDate()}</div>
              <div className="mois-dots">
                {evts.slice(0, 2).map((e, i) => (
                  <div
                    key={i}
                    className="mois-dot"
                    style={{ background: TYPE_COLORS[e.type] ?? '#C9B8E8' }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Événements du jour sélectionné */}
      <h3 className="evenements-jour-titre" style={{ marginTop: 20 }}>
        {formatDateDisplay(dateSelectionnee)}
      </h3>

      <div className="evenements-liste">
        {getEventsForDate(dateSelectionnee).length === 0 ? (
          <div className="empty-evenements">
            <div className="empty-evenements-icon">📭</div>
            <div className="empty-evenements-text">Aucun événement ce jour</div>
          </div>
        ) : (
          getEventsForDate(dateSelectionnee).map(e => (
            <EvenementCard
              key={e.id}
              evenement={e}
              membres={membres ?? []}
              onClick={() => setEvenementDetailId(e.id)}
            />
          ))
        )}
      </div>

      <Drawer
        isOpen={formEvenementOuvert}
        onClose={() => setFormEvenementOuvert(false)}
        title={editEvenementId ? 'Modifier l\'événement' : 'Nouvel événement'}
      >
        <EvenementForm
          editId={editEvenementId}
          defaultDate={dateSelectionnee}
          onSave={() => setFormEvenementOuvert(false)}
          onCancel={() => setFormEvenementOuvert(false)}
        />
      </Drawer>

      <EvenementDetail
        evenementId={evenementDetailId}
        onClose={() => setEvenementDetailId(null)}
        onEdit={(id) => { setEvenementDetailId(null); setEditEvenementId(id); }}
      />
    </>
  );
}

// ─── Export principal ─────────────────────────────────────────────────────────

export default function CalendrierModule() {
  const { vueCalendrier, setVueCalendrier, formEvenementOuvert, setFormEvenementOuvert, editEvenementId, evenementDetailId, setEvenementDetailId, setEditEvenementId, dateSelectionnee } = useFamilleStore();

  return (
    <div>
      {/* Toggle vue */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div className="calendrier-vue-toggle">
          <button
            className={`vue-toggle-btn${vueCalendrier === 'semaine' ? ' active' : ''}`}
            onClick={() => setVueCalendrier('semaine')}
          >
            Semaine
          </button>
          <button
            className={`vue-toggle-btn${vueCalendrier === 'mois' ? ' active' : ''}`}
            onClick={() => setVueCalendrier('mois')}
          >
            Mois
          </button>
        </div>
      </div>

      {vueCalendrier === 'semaine' ? <VueSemaine /> : <VueMois />}

      {/* FAB — une seule instance, hors des sous-vues */}
      <button
        className="famille-fab"
        onClick={() => setFormEvenementOuvert(true)}
        aria-label="Ajouter un événement"
      >
        +
      </button>

      {/* Form Drawer — une seule instance */}
      <Drawer
        isOpen={formEvenementOuvert}
        onClose={() => setFormEvenementOuvert(false)}
        title={editEvenementId ? "Modifier l'événement" : 'Nouvel événement'}
      >
        <EvenementForm
          editId={editEvenementId}
          defaultDate={dateSelectionnee}
          onSave={() => setFormEvenementOuvert(false)}
          onCancel={() => setFormEvenementOuvert(false)}
        />
      </Drawer>

      {/* Detail Drawer — une seule instance */}
      <EvenementDetail
        evenementId={evenementDetailId}
        onClose={() => setEvenementDetailId(null)}
        onEdit={(id) => { setEvenementDetailId(null); setEditEvenementId(id); }}
      />
    </div>
  );
}
