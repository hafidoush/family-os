import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { useEnfantsStore } from '../stores/enfantsStore';
import { newEntity } from '../../../core/db/helpers';
import type { ElementReligion } from '../../../shared/types';
import type { CategorieReligion } from '../religion/religionSeedData';
import {
  SOURATES_SEED,
  PROPHETES_SEED,
  DUAAS_SEED,
  APPRENTISSAGES_SEED,
  type ProphetData,
  type QuizQuestion,
} from '../religion/religionSeedData';

// ── Types statuts ─────────────────────────────────────────────────────────────

type StatutReligion = 'raconte' | 'etudie' | 'memorise';

const STATUTS: { key: StatutReligion; label: string; color: string }[] = [
  { key: 'raconte',  label: 'Raconté',   color: '#60A5FA' },
  { key: 'etudie',   label: 'Étudié',    color: '#FBBF24' },
  { key: 'memorise', label: 'Mémorisé',  color: '#34D399' },
];

// ── Hook suivi religion ───────────────────────────────────────────────────────

function useSuiviReligion(membreId: string | null): ElementReligion[] {
  const suivis = useLiveQuery<ElementReligion[]>(
    () => membreId
      ? db.elementsReligion
          .where('membreId').equals(membreId)
          .filter((e) => !e.deletedAt)
          .toArray()
      : Promise.resolve([] as ElementReligion[]),
    [membreId]
  );
  return suivis ?? [];
}

// Crée ou met à jour un suivi pour un élément
async function toggleSuivi(
  membreId: string,
  elementId: string,
  type: ElementReligion['type'],
  statuts: StatutReligion[],
  statut: StatutReligion,
  suivis: ElementReligion[]
) {
  const existing = suivis.find(
    (s) => s.elementId === elementId && s.type === type
  );

  const newStatuts = statuts.includes(statut)
    ? statuts.filter((s) => s !== statut)
    : [...statuts, statut];

  if (existing) {
    await db.elementsReligion.update(existing.id, {
      statuts: newStatuts,
      updatedAt: new Date(),
    });
  } else {
    await db.elementsReligion.add(
      newEntity<ElementReligion>({
        membreId,
        enfantAssocie: membreId, // legacy — conservé pour rétrocompatibilité
        elementId,
        type,
        statuts: newStatuts,
        archive: false,
      })
    );
  }
}

// ── Composants Statuts Dots ───────────────────────────────────────────────────

function StatutsDots({
  statuts,
  onToggle,
}: {
  statuts: StatutReligion[];
  onToggle: (s: StatutReligion) => void;
}) {
  return (
    <div className="religion-item__statuts" onClick={(e) => e.stopPropagation()}>
      {STATUTS.map((s) => (
        <button
          key={s.key}
          className={['religion-statut-dot', statuts.includes(s.key) ? 'religion-statut-dot--filled' : ''].join(' ')}
          style={{ color: s.color, borderColor: s.color }}
          onClick={() => onToggle(s.key)}
          aria-label={`${s.label} : ${statuts.includes(s.key) ? 'acquis' : 'non acquis'}`}
          title={s.label}
        />
      ))}
    </div>
  );
}

// ── Quiz mini-jeu ─────────────────────────────────────────────────────────────

function QuizMiniJeu({
  questions,
  niveau,
  onClose,
}: {
  questions: QuizQuestion[];
  niveau: 'junior' | 'senior';
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[current];
  if (!q) return null;

  function handleAnswer(idx: number) {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === q.bonneReponse) setScore((s) => s + 1);
  }

  function handleNext() {
    if (current + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
    }
  }

  if (finished) {
    const perfect = score === questions.length;
    return (
      <div className="quiz-card">
        <div className="quiz-result" style={{ color: perfect ? '#22C55E' : '#FBBF24' }}>
          {perfect ? '🌟 Parfait !' : '💪 Bien essayé !'}
          <p style={{ fontSize: 14, fontWeight: 400, marginTop: 8, color: '#6B7280' }}>
            {score} / {questions.length} bonnes réponses
          </p>
        </div>
        <button className="enfants-form__btn-save" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-card">
      <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8, fontFamily: 'Poppins,sans-serif', fontWeight: 600 }}>
        {niveau === 'junior' ? '🌱 Version Junior' : '🌿 Version Senior'} · Question {current + 1}/{questions.length}
      </p>
      <p className="quiz-card__question">{q.question}</p>
      <div className="quiz-card__options">
        {q.options.map((opt, idx) => (
          <button
            key={idx}
            className={[
              'quiz-option',
              selected !== null && idx === q.bonneReponse ? 'quiz-option--correct' : '',
              selected !== null && selected === idx && idx !== q.bonneReponse ? 'quiz-option--wrong' : '',
            ].join(' ')}
            onClick={() => handleAnswer(idx)}
          >
            {opt}
          </button>
        ))}
      </div>
      {selected !== null && (
        <button
          className="enfants-form__btn-save"
          style={{ width: '100%', marginTop: 12, background: '#34D399', boxShadow: '0 4px 12px #34D39940' }}
          onClick={handleNext}
        >
          {current + 1 >= questions.length ? 'Voir le résultat' : 'Question suivante →'}
        </button>
      )}
    </div>
  );
}

// ── Sous-section Sourates ─────────────────────────────────────────────────────

function SouRates({ suivis, membreId }: { suivis: any[]; membreId: string }) {
  return (
    <div>
      {SOURATES_SEED.map((s) => {
        const suivi = suivis.find((sv) => sv.elementId === s.id && sv.type === 'sourate');
        const statuts: StatutReligion[] = suivi?.statuts ?? [];
        return (
          <div key={s.id} className="religion-item">
            <div className="religion-item__icon">📖</div>
            <div className="religion-item__content">
              <p className="religion-item__nom">{s.nomArabe} — {s.nomFrancais}</p>
              <p className="religion-item__sub">Sourate {s.numero} · {s.nbVersets} versets</p>
            </div>
            <StatutsDots
              statuts={statuts}
              onToggle={(st) => toggleSuivi(membreId, s.id, 'sourate', statuts, st, suivis)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Sous-section Prophètes ────────────────────────────────────────────────────

function Prophetes({ suivis, membreId }: { suivis: any[]; membreId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<{ prophet: ProphetData; niveau: 'junior' | 'senior' } | null>(null);

  return (
    <div>
      {quiz && (
        <QuizMiniJeu
          questions={quiz.niveau === 'junior' ? quiz.prophet.quizJunior : quiz.prophet.quizSenior}
          niveau={quiz.niveau}
          onClose={() => setQuiz(null)}
        />
      )}
      {PROPHETES_SEED.map((p) => {
        const suivi = suivis.find((sv) => sv.elementId === p.id && sv.type === 'prophete');
        const statuts: StatutReligion[] = suivi?.statuts ?? [];
        const isOpen = expanded === p.id;

        return (
          <div key={p.id}>
            <div className="religion-item" onClick={() => setExpanded(isOpen ? null : p.id)}>
              <div className="religion-item__icon">🌙</div>
              <div className="religion-item__content">
                <p className="religion-item__nom">{p.nom} — {p.nomArabe}</p>
                <p className="religion-item__sub">{p.valeursPedagogiques.slice(0, 2).join(' · ')}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <StatutsDots
                  statuts={statuts}
                  onToggle={(st) => toggleSuivi(membreId, p.id, 'prophete', statuts, st, suivis)}
                />
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {isOpen && (
              <div className="religion-detail">
                <p className="religion-detail__resume">{p.resume}</p>

                <div className="religion-detail__section">
                  <p className="religion-detail__label">💡 Valeurs pédagogiques</p>
                  <div className="religion-detail__tags">
                    {p.valeursPedagogiques.map((v) => (
                      <span key={v} className="religion-detail__tag">{v}</span>
                    ))}
                  </div>
                </div>

                <div className="religion-detail__section">
                  <p className="religion-detail__label">🎨 Idées d'activités</p>
                  {p.ideeActivites.map((idea) => (
                    <p key={idea} className="religion-detail__idea">· {idea}</p>
                  ))}
                </div>

                <div className="religion-detail__quiz-btns">
                  <button
                    className="religion-quiz-btn"
                    onClick={(e) => { e.stopPropagation(); setQuiz({ prophet: p, niveau: 'junior' }); }}
                  >
                    🌱 Quiz Junior
                  </button>
                  <button
                    className="religion-quiz-btn religion-quiz-btn--senior"
                    onClick={(e) => { e.stopPropagation(); setQuiz({ prophet: p, niveau: 'senior' }); }}
                  >
                    🌿 Quiz Senior
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sous-section Duaas ────────────────────────────────────────────────────────

function Duaas({ suivis, membreId }: { suivis: any[]; membreId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      {DUAAS_SEED.map((d) => {
        const suivi = suivis.find((sv) => sv.elementId === d.id && sv.type === 'duaa');
        const statuts: StatutReligion[] = suivi?.statuts ?? [];
        const isOpen = expanded === d.id;

        return (
          <div key={d.id}>
            <div className="religion-item" onClick={() => setExpanded(isOpen ? null : d.id)}>
              <div className="religion-item__icon">🤲</div>
              <div className="religion-item__content">
                <p className="religion-item__nom">{d.nom}</p>
                <p className="religion-item__sub" style={{ fontFamily: 'serif', fontSize: 13 }}>
                  {d.texteArabe}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <StatutsDots
                  statuts={statuts}
                  onToggle={(st) => toggleSuivi(membreId, d.id, 'duaa', statuts, st, suivis)}
                />
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {isOpen && (
              <div className="religion-detail">
                <p className="religion-detail__arabic">{d.texteArabe}</p>
                <p className="religion-detail__translitt">{d.translitteration}</p>
                <p className="religion-detail__traduction">"{d.traduction}"</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sous-section Fondamentaux ─────────────────────────────────────────────────

function Fondamentaux({ suivis, membreId }: { suivis: any[]; membreId: string }) {
  return (
    <div>
      {APPRENTISSAGES_SEED.map((a) => {
        const suivi = suivis.find((sv) => sv.elementId === a.id && sv.type === 'apprentissage');
        const statuts: StatutReligion[] = suivi?.statuts ?? [];

        return (
          <div key={a.id} className="religion-item">
            <div className="religion-item__icon">
              {a.categorie === 'pilliers' ? '🕌' : a.categorie === 'fetes' ? '🌙' : '📿'}
            </div>
            <div className="religion-item__content">
              <p className="religion-item__nom">{a.nom}</p>
              <p className="religion-item__sub">{a.description.slice(0, 60)}…</p>
            </div>
            <StatutsDots
              statuts={statuts}
              onToggle={(st) => toggleSuivi(membreId, a.id, 'apprentissage', statuts, st, suivis)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

const CATEGORIES: { id: CategorieReligion; label: string; icon: string }[] = [
  { id: 'sourates',     label: 'Sourates',      icon: '📖' },
  { id: 'prophetes',    label: 'Prophètes',     icon: '🌙' },
  { id: 'duaas',        label: 'Duaas',         icon: '🤲' },
  { id: 'fondamentaux', label: 'Fondamentaux',  icon: '🕌' },
];

export function SectionReligion() {
  const { activeEnfantId } = useEnfantsStore();
  const [categorie, setCategorie] = useState<CategorieReligion>('sourates');
  const suivis = useSuiviReligion(activeEnfantId);

  if (!activeEnfantId) return null;

  // Barre de progression globale
  const totalElements =
    SOURATES_SEED.length + PROPHETES_SEED.length + DUAAS_SEED.length + APPRENTISSAGES_SEED.length;
  const memorises = suivis.filter((s) => s.statuts?.includes('memorise')).length;
  const progressPct = totalElements > 0 ? Math.round((memorises / totalElements) * 100) : 0;

  return (
    <div className="enfants-section">
      <div className="enfants-section__header">
        <h2 className="enfants-section__title">
          Espace <span>Religion</span>
        </h2>
      </div>

      {/* Progression globale */}
      <div className="religion-progress">
        <div className="religion-progress__bar">
          <div
            className="religion-progress__fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="religion-progress__label">
          {memorises} mémorisés sur {totalElements} éléments
        </p>
      </div>

      {/* Légende statuts */}
      <div className="religion-legend">
        {STATUTS.map((s) => (
          <div key={s.key} className="religion-legend__item">
            <div
              className="religion-statut-dot religion-statut-dot--filled"
              style={{ color: s.color, borderColor: s.color, width: 8, height: 8 }}
            />
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Catégories */}
      <div className="religion-categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={['religion-cat-btn', categorie === cat.id ? 'religion-cat-btn--active' : ''].join(' ')}
            onClick={() => setCategorie(cat.id)}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Contenu selon catégorie */}
      {categorie === 'sourates'     && <SouRates     suivis={suivis} membreId={activeEnfantId} />}
      {categorie === 'prophetes'    && <Prophetes     suivis={suivis} membreId={activeEnfantId} />}
      {categorie === 'duaas'        && <Duaas         suivis={suivis} membreId={activeEnfantId} />}
      {categorie === 'fondamentaux' && <Fondamentaux  suivis={suivis} membreId={activeEnfantId} />}
    </div>
  );
}
