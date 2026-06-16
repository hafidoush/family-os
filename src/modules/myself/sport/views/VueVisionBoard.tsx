import { useState, useRef } from 'react';
import type { SportState, VisionItem } from '../sportTypes';
import { genId, compressImage } from '../sportUtils';
import './VueVisionBoard.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
}

const COLORS = ['#EAE5FF', '#C4B5FD', '#FBD0E8', '#FDE68A'];

export function VueVisionBoard({ state, update }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [quoteColor, setQuoteColor] = useState(COLORS[0]);
  const imgInputRef = useRef<HTMLInputElement>(null);

  function addQuote() {
    if (!quoteText.trim()) return;
    const item: VisionItem = { id: genId(), type: 'quote', text: quoteText.trim(), color: quoteColor };
    update({ visionBoard: [...state.visionBoard, item] });
    setQuoteText('');
    setQuoteColor(COLORS[0]);
    setShowModal(false);
  }

  async function handleImageUpload(file: File) {
    const src = await compressImage(file);
    const item: VisionItem = { id: genId(), type: 'image', src };
    update({ visionBoard: [...state.visionBoard, item] });
  }

  function deleteItem(id: string) {
    update({ visionBoard: state.visionBoard.filter(v => v.id !== id) });
  }

  return (
    <div className="vue-visionboard">
      <div className="vue-visionboard__title">🌸 Vision Board</div>
      <div className="vue-visionboard__sub">Ton tableau d'inspiration — ce vers quoi tu tends</div>

      <div className="vb-actions">
        <button className="vb-btn" onClick={() => setShowModal(true)}>＋ Citation</button>
        <button className="vb-btn vb-btn--outline" onClick={() => imgInputRef.current?.click()}>＋ Image</button>
        <input
          ref={imgInputRef}
          className="vb-image-input"
          type="file"
          accept="image/*"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
        />
      </div>

      <div className="vb-grid">
        {state.visionBoard.map(item => (
          <div
            key={item.id}
            className={`vb-item vb-item--${item.type}`}
            style={item.type === 'quote' ? { background: item.color ?? '#EAE5FF' } : undefined}
          >
            {item.type === 'quote' && <span>{item.text}</span>}
            {item.type === 'image' && item.src && <img src={item.src} alt="" />}
            <button className="vb-item__del" onClick={() => deleteItem(item.id)}>×</button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="vb-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="vb-modal" onClick={e => e.stopPropagation()}>
            <div className="vb-modal__title">Nouvelle citation</div>
            <textarea
              placeholder="Ta citation inspirante..."
              value={quoteText}
              onChange={e => setQuoteText(e.target.value)}
              autoFocus
            />
            <div className="vb-color-picker">
              {COLORS.map(c => (
                <div
                  key={c}
                  className={`vb-color-swatch${quoteColor === c ? ' vb-color-swatch--active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setQuoteColor(c)}
                />
              ))}
            </div>
            <div className="vb-modal__actions">
              <button className="vb-modal__cancel" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="vb-modal__ok" onClick={addQuote}>Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
