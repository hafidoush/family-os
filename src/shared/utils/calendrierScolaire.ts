/**
 * Calendrier scolaire Zone A (académie de Lyon) + jours fériés France
 * Années scolaires 2025-2026 et 2026-2027
 */

// ─── Calcul de Pâques (algorithme de Butcher) ────────────────────────────────

function datesPaques(annee: number): Date {
  const a = annee % 19
  const b = Math.floor(annee / 100)
  const c = annee % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31) - 1 // 0-indexed
  const jour = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(annee, mois, jour)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ─── Jours fériés France ──────────────────────────────────────────────────────

export interface JourFerie {
  date: string // YYYY-MM-DD
  label: string
}

function getJoursFeries(annee: number): JourFerie[] {
  const paques = datesPaques(annee)
  return [
    { date: `${annee}-01-01`, label: 'Jour de l\'An' },
    { date: toISO(addDays(paques, 1)),  label: 'Lundi de Pâques' },
    { date: `${annee}-05-01`, label: 'Fête du Travail' },
    { date: `${annee}-05-08`, label: 'Victoire 1945' },
    { date: toISO(addDays(paques, 39)), label: 'Ascension' },
    { date: toISO(addDays(paques, 50)), label: 'Lundi de Pentecôte' },
    { date: `${annee}-07-14`, label: 'Fête Nationale' },
    { date: `${annee}-08-15`, label: 'Assomption' },
    { date: `${annee}-11-01`, label: 'Toussaint' },
    { date: `${annee}-11-11`, label: 'Armistice' },
    { date: `${annee}-12-25`, label: 'Noël' },
  ]
}

// ─── Vacances scolaires Zone A ────────────────────────────────────────────────

interface PeriodeVacances {
  label: string
  debut: string  // YYYY-MM-DD inclus
  fin: string    // YYYY-MM-DD inclus
}

const VACANCES_ZONE_A: PeriodeVacances[] = [
  // 2025-2026
  { label: 'Vacances de la Toussaint',  debut: '2025-10-18', fin: '2025-11-03' },
  { label: 'Vacances de Noël',          debut: '2025-12-20', fin: '2026-01-05' },
  { label: 'Vacances d\'hiver',         debut: '2026-02-14', fin: '2026-03-02' },
  { label: 'Vacances de printemps',     debut: '2026-04-11', fin: '2026-04-27' },
  { label: 'Vacances d\'été',           debut: '2026-07-04', fin: '2026-09-01' },
  // 2026-2027
  { label: 'Vacances de la Toussaint',  debut: '2026-10-17', fin: '2026-11-02' },
  { label: 'Vacances de Noël',          debut: '2026-12-19', fin: '2027-01-04' },
  { label: 'Vacances d\'hiver',         debut: '2027-02-13', fin: '2027-03-01' },
  { label: 'Vacances de printemps',     debut: '2027-04-10', fin: '2027-04-26' },
  { label: 'Vacances d\'été',           debut: '2027-07-03', fin: '2027-09-06' },
]

// ─── API publique ─────────────────────────────────────────────────────────────

export interface InfoJour {
  pasEcole: boolean
  raison?: string        // "Mercredi", "Week-end", "Vacances de Noël", "Fête du Travail"…
  vacances: boolean
  ferie: boolean
  labelFerie?: string
}

export function getInfoJour(date: Date): InfoJour {
  const iso = toISO(date)
  const jourSemaine = date.getDay() // 0=dim, 1=lun … 6=sam
  const annee = date.getFullYear()

  // Week-end
  if (jourSemaine === 0) return { pasEcole: true, raison: 'Dimanche', vacances: false, ferie: false }
  if (jourSemaine === 6) return { pasEcole: true, raison: 'Samedi',   vacances: false, ferie: false }

  // Jour férié
  const feries = [...getJoursFeries(annee), ...getJoursFeries(annee - 1)]
  const ferie = feries.find(f => f.date === iso)
  if (ferie) return { pasEcole: true, raison: ferie.label, vacances: false, ferie: true, labelFerie: ferie.label }

  // Vacances scolaires
  const vacance = VACANCES_ZONE_A.find(v => iso >= v.debut && iso <= v.fin)
  if (vacance) return { pasEcole: true, raison: vacance.label, vacances: true, ferie: false }

  // Mercredi (pas d'école l'après-midi en général, mais école le matin)
  if (jourSemaine === 3) return { pasEcole: false, raison: 'Mercredi', vacances: false, ferie: false }

  return { pasEcole: false, vacances: false, ferie: false }
}

// Raccourci pour aujourd'hui et demain
export function infoAujourdhui(): InfoJour { return getInfoJour(new Date()) }
export function infoDemain(): InfoJour {
  return getInfoJour(addDays(new Date(), 1))
}
