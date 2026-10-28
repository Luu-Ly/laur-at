'use strict';
// ============================================================
//  CONFIGURATION DU SCRUTIN : modifiez uniquement ce fichier
//  pour changer les abstracts, les titres, les catégories ou les jurés.
// ============================================================

const EVENT = {
  title: 'Vote du jury',
  subtitle: '1ère Journée de Recherche du CH de Mayotte',
};

// Les membres du jury : chacun se connecte avec ses initiales (pas de mot de passe).
// Les initiales doivent être uniques. Pour changer un juré, modifiez cette liste.
const JURORS = [
  ['JURY-01', 'AC'], ['JURY-02', 'LP'], ['JURY-03', 'MN'], ['JURY-04', 'NT'],
  ['JURY-05', 'PB'], ['JURY-06', 'OR'], ['JURY-07', 'MK'], ['JURY-08', 'SM'],
  ['JURY-09', 'CB'], ['JURY-10', 'AG'], ['JURY-11', 'MD'], ['JURY-12', 'PF'],
].map(([id, initials]) => ({ id, initials }));

// Les résultats (3 lauréats) s'affichent automatiquement quand ce nombre de jurés ont voté.
const JURY_SIZE = Number(process.env.JURY_SIZE) || JURORS.length;

// Barème catégorie A : 1er choix = 3 points, 2e = 2 points, 3e = 1 point
const POINTS_A = [3, 2, 1];

const CATEGORIES = {
  A: {
    label: 'Catégorie A',
    who: 'Médecins, pharmaciens, biologistes',
    mode: 'rank3',
    question: 'Choisissez les 3 meilleurs abstracts, par ordre de préférence.',
  },
  B: {
    label: 'Catégorie B',
    who: 'Paramédical, sage-femme, IDE, kiné',
    mode: 'single',
    question: 'Sélectionnez le meilleur abstract.',
  },
  C: {
    label: 'Catégorie C',
    who: 'Étudiants (externes, internes en médecine-pharmacie), élèves-infirmiers, master',
    mode: 'yesno',
    question: 'Un seul abstract est en lice : souhaitez-vous le récompenser ?',
  },
};

const ABSTRACTS = {
  A: [
    ['2026-A-001', "Syndrome d'encéphalopathie postérieure réversible"],
    ['2026-A-002', 'Severe dengue fever'],
    ['2026-A-003', "Programme d'éducation thérapeutique chez des enfants drépanocytaires"],
    ['2026-A-004', 'PADAM = pediatric abscess drainage anesthesia in Mayotte'],
    ['2026-A-005', 'Le Béri-béri à Mayotte'],
    ['2026-A-006', 'Pediatric Kikuchi disease : a literature review, preliminary results'],
    ['2026-A-007', 'Siclopedie hotline after Chido'],
    ['2026-A-008', 'Oxygénothérapie hyperbare et diminution de la douleur dans les CVO'],
    ['2026-A-009', 'Pentobarbital IR pour sédation consciente en pédiatrie'],
    ['2026-A-010', 'Plaies thoraco-abdominales par armes blanches'],
    // 2026-A-011 : absent de la liste d'origine (retrait volontaire à confirmer)
    ['2026-A-012', 'Case report : Prader-Willi et puberté précoce'],
    ['2026-A-013', 'Oxygénothérapie hyperbare et diminution de la fréquence des crises CVO'],
  ],
  B: [
    ['2026-B-001', "Évaluation des professionnels à la prise en charge d'une urgence vitale"],
    ['2026-B-002', 'Représentation maternité et vécu du deuil périnatal à Mayotte'],
  ],
  C: [
    // Numéro à vérifier : seul le titre figurait dans le sondage d'origine
    ['2026-C-001', 'Violences sexuelles chez patients VIH'],
  ],
};

const abstracts = {};
for (const k of Object.keys(ABSTRACTS)) {
  abstracts[k] = ABSTRACTS[k].map(([id, title]) => ({ id, title }));
}

module.exports = { EVENT, JURORS, JURY_SIZE, POINTS_A, CATEGORIES, abstracts };
