// Seed data pour l'espace religion
// Ces données sont utilisées par seedDatabase() dans src/core/db/seed.ts

export type CategorieReligion = 'sourates' | 'prophetes' | 'duaas' | 'fondamentaux';

export interface SourateData {
  id: string;
  numero: number;
  nomArabe: string;
  nomFrancais: string;
  nbVersets: number;
}

export interface ProphetData {
  id: string;
  nom: string;
  nomArabe: string;
  resume: string;
  valeursPedagogiques: string[];
  ideeActivites: string[];
  quizJunior: QuizQuestion[];
  quizSenior: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  bonneReponse: number; // index dans options
}

export interface DuaaData {
  id: string;
  nom: string;
  texteArabe: string;
  translitteration: string;
  traduction: string;
  categorie: string;
}

export interface ApprentissageData {
  id: string;
  nom: string;
  description: string;
  categorie: string;
  ordre: number;
}

// ── Sourates (Juzz Amma - les plus courantes pour enfants) ────────────────────

export const SOURATES_SEED: SourateData[] = [
  { id: 'sourate-114', numero: 114, nomArabe: 'الناس',    nomFrancais: 'Les Hommes',        nbVersets: 6  },
  { id: 'sourate-113', numero: 113, nomArabe: 'الفلق',    nomFrancais: 'L\'Aube',           nbVersets: 5  },
  { id: 'sourate-112', numero: 112, nomArabe: 'الإخلاص',  nomFrancais: 'Le Monothéisme',    nbVersets: 4  },
  { id: 'sourate-111', numero: 111, nomArabe: 'المسد',    nomFrancais: 'La Fibre',          nbVersets: 5  },
  { id: 'sourate-110', numero: 110, nomArabe: 'النصر',    nomFrancais: 'Le Secours',        nbVersets: 3  },
  { id: 'sourate-109', numero: 109, nomArabe: 'الكافرون', nomFrancais: 'Les Mécréants',     nbVersets: 6  },
  { id: 'sourate-108', numero: 108, nomArabe: 'الكوثر',   nomFrancais: 'L\'Abondance',      nbVersets: 3  },
  { id: 'sourate-107', numero: 107, nomArabe: 'الماعون',  nomFrancais: 'L\'Ustensile',      nbVersets: 7  },
  { id: 'sourate-106', numero: 106, nomArabe: 'قريش',     nomFrancais: 'Quraysh',           nbVersets: 4  },
  { id: 'sourate-105', numero: 105, nomArabe: 'الفيل',    nomFrancais: 'L\'Éléphant',       nbVersets: 5  },
  { id: 'sourate-104', numero: 104, nomArabe: 'الهمزة',   nomFrancais: 'Le Médisant',       nbVersets: 9  },
  { id: 'sourate-103', numero: 103, nomArabe: 'العصر',    nomFrancais: 'Le Temps',          nbVersets: 3  },
  { id: 'sourate-102', numero: 102, nomArabe: 'التكاثر',  nomFrancais: 'L\'Accumulation',   nbVersets: 8  },
  { id: 'sourate-101', numero: 101, nomArabe: 'القارعة',  nomFrancais: 'Le Fracas',         nbVersets: 11 },
  { id: 'sourate-100', numero: 100, nomArabe: 'العاديات', nomFrancais: 'Les Coureurs',      nbVersets: 11 },
  { id: 'sourate-099', numero: 99,  nomArabe: 'الزلزلة',  nomFrancais: 'Le Séisme',         nbVersets: 8  },
  { id: 'sourate-001', numero: 1,   nomArabe: 'الفاتحة',  nomFrancais: 'L\'Ouverture',      nbVersets: 7  },
];

// ── Histoires des Prophètes ───────────────────────────────────────────────────

export const PROPHETES_SEED: ProphetData[] = [
  {
    id: 'prophete-adam',
    nom: 'Adam',
    nomArabe: 'آدم',
    resume: 'Le premier être humain créé par Allah, placé au paradis avant de descendre sur Terre.',
    valeursPedagogiques: ['Le pardon', 'La responsabilité', 'Les conséquences de nos actes'],
    ideeActivites: [
      'Dessiner le jardin d\'Eden et ses fruits',
      'Discuter : pourquoi est-il important d\'obéir ?',
      'Faire une liste de choses pour lesquelles on demande pardon',
    ],
    quizJunior: [
      {
        id: 'q-adam-j1',
        question: 'Qui a créé Adam ?',
        options: ['Les anges', 'Allah', 'Le soleil'],
        bonneReponse: 1,
      },
      {
        id: 'q-adam-j2',
        question: 'De quoi Allah a-t-il créé Adam ?',
        options: ['De l\'eau', 'Du feu', 'De la terre'],
        bonneReponse: 2,
      },
    ],
    quizSenior: [
      {
        id: 'q-adam-s1',
        question: 'Quel était le nom de la femme d\'Adam ?',
        options: ['Maryam', 'Hawa (Ève)', 'Sara'],
        bonneReponse: 1,
      },
      {
        id: 'q-adam-s2',
        question: 'Qui a refusé de se prosterner devant Adam et pourquoi ?',
        options: ['Jibreel, par oubli', 'Iblis, par orgueil', 'Mikael, par peur'],
        bonneReponse: 1,
      },
    ],
  },
  {
    id: 'prophete-nouh',
    nom: 'Nouh (Noé)',
    nomArabe: 'نوح',
    resume: 'Prophète qui construisit l\'arche sur ordre d\'Allah pour sauver les croyants du déluge.',
    valeursPedagogiques: ['La persévérance', 'La foi malgré les épreuves', 'L\'obéissance à Allah'],
    ideeActivites: [
      'Construire une arche en LEGO ou en carton',
      'Dessiner les animaux entrant deux par deux',
      'Compter combien d\'années Nouh a prêché (950 ans !)',
    ],
    quizJunior: [
      {
        id: 'q-nouh-j1',
        question: 'Qu\'a construit Nouh sur ordre d\'Allah ?',
        options: ['Une maison', 'Une arche (bateau)', 'Un pont'],
        bonneReponse: 1,
      },
    ],
    quizSenior: [
      {
        id: 'q-nouh-s1',
        question: 'Combien d\'années Nouh a-t-il prêché son peuple ?',
        options: ['100 ans', '500 ans', '950 ans'],
        bonneReponse: 2,
      },
    ],
  },
  {
    id: 'prophete-ibrahim',
    nom: 'Ibrahim (Abraham)',
    nomArabe: 'إبراهيم',
    resume: 'Le Khalil (ami intime) d\'Allah, père des prophètes, qui brisa les idoles et fut jeté dans le feu.',
    valeursPedagogiques: ['Le courage', 'La foi absolue en Allah', 'Le sacrifice'],
    ideeActivites: [
      'Relier Ibrahim à la construction de la Kaaba',
      'Discuter : pourquoi est-il important de ne pas adorer les idoles ?',
      'Activité : dessiner la Kaaba et expliquer le Hajj',
    ],
    quizJunior: [
      {
        id: 'q-ibrahim-j1',
        question: 'Qu\'a fait Ibrahim avec les idoles de son peuple ?',
        options: ['Il les a peintes', 'Il les a brisées', 'Il les a cachées'],
        bonneReponse: 1,
      },
    ],
    quizSenior: [
      {
        id: 'q-ibrahim-s1',
        question: 'Comment Allah a-t-il protégé Ibrahim dans le feu ?',
        options: ['Il l\'a rendu invisible', 'Il a rendu le feu frais et sûr', 'Il a éteint le feu'],
        bonneReponse: 1,
      },
    ],
  },
  {
    id: 'prophete-moussa',
    nom: 'Moussa (Moïse)',
    nomArabe: 'موسى',
    resume: 'Prophète envoyé à Pharaon pour libérer les Bani Israël, il reçut la Torah sur le Mont Sinaï.',
    valeursPedagogiques: ['Le courage face à l\'injustice', 'La confiance en Allah', 'La liberté'],
    ideeActivites: [
      'Rejouer la séparation de la mer Rouge avec un bac à eau',
      'Dessiner le bâton qui se transforme en serpent',
      'Parler de ce que signifie être juste et libre',
    ],
    quizJunior: [
      {
        id: 'q-moussa-j1',
        question: 'Quel miracle Allah a-t-il donné à Moussa ?',
        options: ['Voler dans les airs', 'Séparer la mer', 'Parler aux animaux'],
        bonneReponse: 1,
      },
    ],
    quizSenior: [
      {
        id: 'q-moussa-s1',
        question: 'Comment s\'appelait le livre révélé à Moussa ?',
        options: ['L\'Injil', 'La Torah', 'Le Zabur'],
        bonneReponse: 1,
      },
    ],
  },
  {
    id: 'prophete-issa',
    nom: 'Issa (Jésus)',
    nomArabe: 'عيسى',
    resume: 'Prophète né miraculeusement de Maryam, il guérissait les malades et donnait vie aux oiseaux d\'argile.',
    valeursPedagogiques: ['La miséricorde', 'La guérison du cœur', 'Les miracles d\'Allah'],
    ideeActivites: [
      'Modeler des oiseaux en argile',
      'Discuter des miracles d\'Allah dans la nature',
      'Parler du respect de toutes les religions du Livre',
    ],
    quizJunior: [
      {
        id: 'q-issa-j1',
        question: 'Comment Issa est-il venu au monde ?',
        options: ['Normalement', 'Sans père, par miracle d\'Allah', 'Envoyé du ciel'],
        bonneReponse: 1,
      },
    ],
    quizSenior: [
      {
        id: 'q-issa-s1',
        question: 'Comment s\'appelle le livre révélé à Issa ?',
        options: ['La Torah', 'Le Zabur', 'L\'Injil'],
        bonneReponse: 2,
      },
    ],
  },
  {
    id: 'prophete-muhammad',
    nom: 'Muhammad ﷺ',
    nomArabe: 'محمد',
    resume: 'Le dernier des prophètes, envoyé à toute l\'humanité, qui reçut le Coran et fonda la communauté islamique.',
    valeursPedagogiques: ['La générosité', 'La douceur', 'L\'honnêteté', 'L\'amour de la famille'],
    ideeActivites: [
      'Apprendre des hadiths simples sur la gentillesse',
      'Dessiner la ville de La Mecque et Médine',
      'Jeu : trouver des exemples de sunnah dans la vie quotidienne',
    ],
    quizJunior: [
      {
        id: 'q-muhammad-j1',
        question: 'Quel livre Allah a-t-il révélé à Muhammad ﷺ ?',
        options: ['La Torah', 'L\'Injil', 'Le Coran'],
        bonneReponse: 2,
      },
    ],
    quizSenior: [
      {
        id: 'q-muhammad-s1',
        question: 'Dans quelle ville Muhammad ﷺ est-il né ?',
        options: ['Médine', 'La Mecque', 'Jérusalem'],
        bonneReponse: 1,
      },
    ],
  },
];

// ── Duaas ─────────────────────────────────────────────────────────────────────

export const DUAAS_SEED: DuaaData[] = [
  {
    id: 'duaa-bismillah',
    nom: 'Avant de manger',
    texteArabe: 'بِسْمِ اللَّهِ',
    translitteration: 'Bismillah',
    traduction: 'Au nom d\'Allah',
    categorie: 'quotidien',
  },
  {
    id: 'duaa-apres-manger',
    nom: 'Après avoir mangé',
    texteArabe: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ',
    translitteration: 'Alhamdulillahi alladhi at\'amana wa saqana wa ja\'alana muslimin',
    traduction: 'Louange à Allah qui nous a nourris, abreuvés et fait musulmans',
    categorie: 'quotidien',
  },
  {
    id: 'duaa-dormir',
    nom: 'Avant de dormir',
    texteArabe: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    translitteration: 'Bismika Allahumma amutu wa ahya',
    traduction: 'En Ton nom, ô Allah, je meurs et je vis',
    categorie: 'quotidien',
  },
  {
    id: 'duaa-reveil',
    nom: 'Au réveil',
    texteArabe: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    translitteration: 'Alhamdulillahi alladhi ahyana ba\'da ma amatana wa ilayhin-nushur',
    traduction: 'Louange à Allah qui nous a redonné vie après nous avoir fait mourir, et c\'est vers Lui la résurrection',
    categorie: 'quotidien',
  },
  {
    id: 'duaa-sortir',
    nom: 'En sortant de chez soi',
    texteArabe: 'بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    translitteration: 'Bismillahi tawakkaltu \'alallahi wa la hawla wa la quwwata illa billah',
    traduction: 'Au nom d\'Allah, je me confie à Allah, il n\'y a de force et de puissance qu\'en Allah',
    categorie: 'quotidien',
  },
  {
    id: 'duaa-wc-entrer',
    nom: 'En entrant aux toilettes',
    texteArabe: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ',
    translitteration: 'Allahumma inni a\'udhu bika minal khubuthi wal khaba\'ith',
    traduction: 'Ô Allah, je me réfugie auprès de Toi contre les mâles et femelles démons',
    categorie: 'quotidien',
  },
  {
    id: 'duaa-voyage',
    nom: 'En voyageant',
    texteArabe: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ',
    translitteration: 'Subhana alladhi sakhkhara lana hadha wa ma kunna lahu muqrinin',
    traduction: 'Gloire à Celui qui nous a soumis cela alors que nous n\'en étions pas capables',
    categorie: 'voyage',
  },
  {
    id: 'duaa-entrer-maison',
    nom: 'En entrant chez soi',
    texteArabe: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ الْمَوْلِجِ وَخَيْرَ الْمَخْرَجِ',
    translitteration: 'Allahumma inni as\'aluka khayral mawlaji wa khayral makhraj',
    traduction: 'Ô Allah, je Te demande le bien de l\'entrée et le bien de la sortie',
    categorie: 'quotidien',
  },
];

// ── Apprentissages fondamentaux ────────────────────────────────────────────────

export const APPRENTISSAGES_SEED: ApprentissageData[] = [
  {
    id: 'app-shahada',
    nom: 'La Shahada',
    description: 'La déclaration de foi : "Ashadu an la ilaha illallah wa ashadu anna Muhammadan rasulullah"',
    categorie: 'pilliers',
    ordre: 1,
  },
  {
    id: 'app-salat',
    nom: 'La Salât (prière)',
    description: 'Les 5 prières quotidiennes : Fajr, Dhuhr, Asr, Maghrib, Isha. Leurs heures, leurs rak\'as et leurs gestes.',
    categorie: 'pilliers',
    ordre: 2,
  },
  {
    id: 'app-wudu',
    nom: 'Les Ablutions (Wudu)',
    description: 'La purification avant la prière : les étapes dans l\'ordre, les parties du corps.',
    categorie: 'pratique',
    ordre: 3,
  },
  {
    id: 'app-zakat',
    nom: 'La Zakat',
    description: 'L\'aumône obligatoire : donner une partie de ses biens aux plus démunis.',
    categorie: 'pilliers',
    ordre: 4,
  },
  {
    id: 'app-ramadan',
    nom: 'Le Ramadan & le Jeûne',
    description: 'Le mois sacré du jeûne : pourquoi on jeûne, ce qui rompt le jeûne, l\'esprit du Ramadan.',
    categorie: 'pilliers',
    ordre: 5,
  },
  {
    id: 'app-hajj',
    nom: 'Le Hajj',
    description: 'Le pèlerinage à La Mecque : ses rites, sa signification, l\'histoire d\'Ibrahim.',
    categorie: 'pilliers',
    ordre: 6,
  },
  {
    id: 'app-aid-fitr',
    nom: 'Aïd el-Fitr',
    description: 'La fête de la rupture du jeûne après le Ramadan : sa signification, ses traditions.',
    categorie: 'fetes',
    ordre: 7,
  },
  {
    id: 'app-aid-adha',
    nom: 'Aïd el-Adha',
    description: 'La fête du sacrifice commémorant l\'acte d\'Ibrahim : le sacrifice, le partage.',
    categorie: 'fetes',
    ordre: 8,
  },
  {
    id: 'app-halal-haram',
    nom: 'Halal & Haram',
    description: 'Ce qui est permis et ce qui est interdit en Islam : nourriture, comportement, relations.',
    categorie: 'pratique',
    ordre: 9,
  },
  {
    id: 'app-quran-bases',
    nom: 'Bases de la récitation',
    description: 'Apprendre à tenir le Coran avec respect, les règles de base du tajwid pour les enfants.',
    categorie: 'pratique',
    ordre: 10,
  },
];
