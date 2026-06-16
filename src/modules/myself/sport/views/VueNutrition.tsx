import { useState } from 'react';
import type { SportState, FoodItem } from '../sportTypes';
import { NUTRITION_MODES } from '../sportConstants';
import { genId } from '../sportUtils';
import './VueNutrition.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
}

const WATER_GOAL = 2500; // ml

export function VueNutrition({ state, update }: Props) {
  const [form, setForm] = useState({ nom: '', kcal: '', prot: '', glucides: '', lipides: '' });
  const mode = NUTRITION_MODES[state.nutritionMode];

  const foods = state.nutritionToday.foods;
  const totKcal = foods.reduce((s, f) => s + f.kcal, 0);
  const totProt = foods.reduce((s, f) => s + f.prot, 0);
  const totGluc = foods.reduce((s, f) => s + f.glucides, 0);
  const totLip  = foods.reduce((s, f) => s + f.lipides, 0);

  function addFood() {
    if (!form.nom.trim() || !form.kcal) return;
    const item: FoodItem = {
      id: genId(),
      nom: form.nom.trim(),
      kcal: parseFloat(form.kcal) || 0,
      prot: parseFloat(form.prot) || 0,
      glucides: parseFloat(form.glucides) || 0,
      lipides: parseFloat(form.lipides) || 0,
    };
    update({ nutritionToday: { ...state.nutritionToday, foods: [...foods, item] } });
    setForm({ nom: '', kcal: '', prot: '', glucides: '', lipides: '' });
  }

  function delFood(id: string) {
    update({ nutritionToday: { ...state.nutritionToday, foods: foods.filter(f => f.id !== id) } });
  }

  function addWater(ml: number) {
    update({ nutritionToday: { ...state.nutritionToday, water: Math.min(WATER_GOAL, state.nutritionToday.water + ml) } });
  }

  const waterPct = Math.min(100, (state.nutritionToday.water / WATER_GOAL) * 100);
  const kcalPct = Math.min(100, (totKcal / mode.kcal) * 100);

  return (
    <div className="vue-nutrition">
      <div className="vue-nutrition__title">🥗 Nutrition</div>

      {/* Modes */}
      <div className="nutr-modes">
        {(Object.entries(NUTRITION_MODES) as [keyof typeof NUTRITION_MODES, typeof NUTRITION_MODES[keyof typeof NUTRITION_MODES]][]).map(([key, m]) => (
          <div
            key={key}
            className={`nutr-mode${state.nutritionMode === key ? ' nutr-mode--active' : ''}`}
            onClick={() => update({ nutritionMode: key })}
          >
            <div className="nutr-mode__label">{m.label}</div>
            <div className="nutr-mode__desc">{m.desc}</div>
            <div className="nutr-mode__kcal">{m.kcal} kcal</div>
          </div>
        ))}
      </div>

      {/* Journal aliments */}
      <div className="nutr-card">
        <div className="nutr-card__title">Journal alimentaire</div>

        <div className="nutr-totals">
          <div className="nutr-total">
            <div className="nutr-total__val">{totKcal}</div>
            <div className="nutr-total__label">kcal / {mode.kcal}</div>
          </div>
          <div className="nutr-total">
            <div className="nutr-total__val">{totProt}g</div>
            <div className="nutr-total__label">Protéines</div>
          </div>
          <div className="nutr-total">
            <div className="nutr-total__val">{totGluc}g</div>
            <div className="nutr-total__label">Glucides</div>
          </div>
          <div className="nutr-total">
            <div className="nutr-total__val">{totLip}g</div>
            <div className="nutr-total__label">Lipides</div>
          </div>
        </div>

        <div className="nutr-macro-bar">
          <div className="nutr-macro-row">
            <div className="nutr-macro-row__label">Kcal</div>
            <div className="nutr-macro-row__bar">
              <div className="nutr-macro-row__fill" style={{ width: `${kcalPct}%`, background: '#A78BFA' }} />
            </div>
            <div className="nutr-macro-row__val">{Math.round(kcalPct)}%</div>
          </div>
          <div className="nutr-macro-row">
            <div className="nutr-macro-row__label">Protéines</div>
            <div className="nutr-macro-row__bar">
              <div className="nutr-macro-row__fill" style={{ width: `${Math.min(100, (totProt / mode.prot) * 100)}%`, background: '#F472B6' }} />
            </div>
            <div className="nutr-macro-row__val">{totProt}g/{mode.prot}</div>
          </div>
          <div className="nutr-macro-row">
            <div className="nutr-macro-row__label">Glucides</div>
            <div className="nutr-macro-row__bar">
              <div className="nutr-macro-row__fill" style={{ width: `${Math.min(100, (totGluc / mode.glucides) * 100)}%`, background: '#FDE68A' }} />
            </div>
            <div className="nutr-macro-row__val">{totGluc}g/{mode.glucides}</div>
          </div>
          <div className="nutr-macro-row">
            <div className="nutr-macro-row__label">Lipides</div>
            <div className="nutr-macro-row__bar">
              <div className="nutr-macro-row__fill" style={{ width: `${Math.min(100, (totLip / mode.lipides) * 100)}%`, background: '#67E8F9' }} />
            </div>
            <div className="nutr-macro-row__val">{totLip}g/{mode.lipides}</div>
          </div>
        </div>

        <div className="nutr-foods-list">
          {foods.map(f => (
            <div key={f.id} className="nutr-food-item">
              <div className="nutr-food-item__name">{f.nom}</div>
              <div>
                <div className="nutr-food-item__kcal">{f.kcal} kcal</div>
                <div className="nutr-food-item__macros">P{f.prot}g G{f.glucides}g L{f.lipides}g</div>
              </div>
              <button className="nutr-food-del" onClick={() => delFood(f.id)}>×</button>
            </div>
          ))}
        </div>

        <div className="nutr-add-form">
          <input placeholder="Aliment" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} />
          <input placeholder="Kcal" type="number" value={form.kcal} onChange={e => setForm(p => ({ ...p, kcal: e.target.value }))} />
          <input placeholder="Prot(g)" type="number" value={form.prot} onChange={e => setForm(p => ({ ...p, prot: e.target.value }))} />
          <input placeholder="Gluc(g)" type="number" value={form.glucides} onChange={e => setForm(p => ({ ...p, glucides: e.target.value }))} />
          <input placeholder="Lip(g)" type="number" value={form.lipides} onChange={e => setForm(p => ({ ...p, lipides: e.target.value }))} />
          <button className="nutr-add-btn" onClick={addFood}>＋</button>
        </div>
      </div>

      {/* Eau */}
      <div className="nutr-card">
        <div className="nutr-card__title">💧 Hydratation</div>
        <div className="nutr-water">
          <div className="nutr-water__display">{(state.nutritionToday.water / 1000).toFixed(2)} L / 2.5 L</div>
          <div className="nutr-water__bar">
            <div className="nutr-water__fill" style={{ width: `${waterPct}%` }} />
          </div>
          <div className="nutr-water__btns">
            <button className="nutr-water__btn" onClick={() => addWater(250)}>+250 ml</button>
            <button className="nutr-water__btn" onClick={() => addWater(500)}>+500 ml</button>
            <button className="nutr-water__btn" onClick={() => addWater(1000)}>+1 L</button>
          </div>
        </div>
      </div>
    </div>
  );
}
