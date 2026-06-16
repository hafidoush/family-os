/**
 * FAMILY OS — Gemini AI Service
 * Classification automatique des pensées en entités actionables.
 *
 * Stockage de la clé : localStorage 'family_os_gemini_key'
 * Ne jamais écrire la clé en dur dans le code.
 */

const GEMINI_KEY_STORAGE = 'family_os_gemini_key';
const GEMINI_MODEL       = 'gemini-2.0-flash';
const GEMINI_URL         = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Timestamp du dernier appel pour respecter le rate limit (4s entre appels)
let lastCallTime = 0;

// ─── Clé API ──────────────────────────────────────────────────────────────────

export function getGeminiKey(): string {
  return localStorage.getItem(GEMINI_KEY_STORAGE)?.trim() ?? '';
}

export function setGeminiKey(key: string): void {
  localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
}

export function hasGeminiKey(): boolean {
  return getGeminiKey().length > 10;
}

// ─── Types de classification ──────────────────────────────────────────────────

export type TypeClassification = 'evenement' | 'tache' | 'achat' | 'note';

export interface ClassificationPensee {
  type:           TypeClassification;
  titre:          string;
  articles?:      string[];           // pour type=achat avec plusieurs produits
  date:           string | null;
  heure:          string | null;
  typeEvenement?: 'rendez_vous' | 'sortie' | 'evenement' | 'rappel' | 'anniversaire';
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(texte: string, today: string): string {
  return `Tu es l'assistant IA d'une application de gestion familiale française.
Analyse le texte suivant et retourne UNIQUEMENT un objet JSON valide, sans markdown, sans backticks, sans explication.

Date d'aujourd'hui : ${today}

Texte à analyser : "${texte}"

Règles de classification :
- "evenement" : kermesse, réunion, spectacle, sortie, anniversaire, fête, match, rendez-vous, cours, conseil de classe, voyage
- "tache"     : appeler, envoyer, préparer, réparer, penser à, faire, amener, récupérer, signer, rendre
- "achat"     : acheter, prendre, commander, ramener, besoin de, manque de, courses, liste de courses
- "note"      : tout le reste (idée, souvenir, observation)

Règles pour le titre et les articles :
- Si type="achat" et UN SEUL produit : titre = nom du produit sans verbe. Ex: "acheter du lait" → titre "Lait"
- Si type="achat" et PLUSIEURS produits : titre = "Courses", articles = tableau de chaque produit sans verbe. Ex: "du lait, du pain et de l'eau" → titre "Courses", articles ["Lait","Pain","Eau"]
- Si type="tache" : titre = action courte. Ex: "appeler le médecin" → "Appeler médecin"
- Si type="evenement" : titre = nom de l'événement. Ex: "kermesse vendredi" → "Kermesse école"

Calcul des dates relatives depuis ${today} :
- "demain" → lendemain
- "vendredi", "lundi" etc → prochain jour de semaine correspondant
- "vendredi 12", "le 12" → prochain 12 du mois actuel ou suivant si déjà passé
- "semaine prochaine" → lundi de la semaine suivante
- Aucune date mentionnée → null

Retourne exactement ce JSON :
{
  "type": "evenement" | "tache" | "achat" | "note",
  "titre": "titre court",
  "articles": ["produit1", "produit2"],
  "date": "YYYY-MM-DD" | null,
  "heure": "HH:MM" | null,
  "typeEvenement": "rendez_vous" | "sortie" | "evenement" | "rappel" | "anniversaire"
}
Notes :
- "articles" uniquement si type=achat et plusieurs produits, sinon omis
- "typeEvenement" uniquement si type=evenement, sinon omis`;
}

// ─── Classification ───────────────────────────────────────────────────────────

export type GeminiError = 'quota' | 'invalid_key' | 'network';

export async function classifierPensee(texte: string): Promise<ClassificationPensee | null> {
  const key = getGeminiKey();
  if (!key) return null;

  // Respect du rate limit : 4 secondes minimum entre deux appels
  const now = Date.now();
  const wait = 4000 - (now - lastCallTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallTime = Date.now();

  const today = new Date().toISOString().split('T')[0];

  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        contents:         [{ parts: [{ text: buildPrompt(texte, today) }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw Object.assign(new Error('quota'), { geminiError: 'quota' as GeminiError });
      if (res.status === 401 || res.status === 403) throw Object.assign(new Error('invalid_key'), { geminiError: 'invalid_key' as GeminiError });
      if (res.status === 503) return null; // serveur indisponible, fallback local
      return null;
    }

    const bodyText = await res.text();
    const data = JSON.parse(bodyText);

    const parts: { text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
    const raw = parts.map(p => p.text ?? '').join('');

    // Nettoyer le markdown que Gemini ajoute parfois
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as ClassificationPensee;

    if (!parsed.type || !parsed.titre) return null;

    return parsed;
  } catch (err) {
    throw err;
  }
}
