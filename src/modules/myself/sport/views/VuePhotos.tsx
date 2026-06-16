import { useRef } from 'react';
import type { SportState } from '../sportTypes';
import { compressImage } from '../sportUtils';
import './VuePhotos.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
}

const VIEWS_LABELS = ['Face', 'Profil', 'Dos'];

export function VuePhotos({ state, update }: Props) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleUpload(key: string, file: File) {
    const b64 = await compressImage(file);
    update({ photos: { ...state.photos, [key]: b64 } });
  }

  function getNote(month: number) {
    return (state.photos as Record<string, string>)[`note_${month}`] ?? '';
  }

  function setNote(month: number, val: string) {
    update({ photos: { ...state.photos, [`note_${month}`]: val } });
  }

  const months = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div className="vue-photos">
      <div className="vue-photos__title">📸 Photos Évolution</div>

      <div className="photos-months">
        {months.map(month => (
          <div key={month} className="photos-month">
            <div className="photos-month__header">
              <span className="photos-month__label">Mois {month}</span>
              {month === 0 && <span className="photos-month__badge">Départ</span>}
              {month === 24 && <span className="photos-month__badge">Objectif</span>}
            </div>
            <div className="photos-slots">
              {VIEWS_LABELS.map(view => {
                const key = `m${month}_${view.toLowerCase()}`;
                const src = state.photos[key];
                return (
                  <div key={view} className="photos-slot">
                    <div className="photos-slot__label">{view}</div>
                    <div
                      className="photos-slot__area"
                      onClick={() => inputRefs.current[key]?.click()}
                    >
                      {src ? (
                        <img src={src} alt={`Mois ${month} ${view}`} />
                      ) : (
                        <span className="photos-slot__plus">＋</span>
                      )}
                    </div>
                    <input
                      ref={el => { inputRefs.current[key] = el; }}
                      className="photos-slot__input"
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(key, file);
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <textarea
              className="photos-month__note"
              placeholder="Notes du mois..."
              value={getNote(month)}
              onChange={e => setNote(month, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
