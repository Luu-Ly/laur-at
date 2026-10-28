'use strict';
const { POINTS_A } = require('./config');

// Calcul pur (sans accès base) : facile à tester et à vérifier.
//
// Règle : un lauréat par catégorie.
//  - A : l'abstract qui a le plus de points (1er choix = 3, 2e = 2, 3e = 1).
//  - B : l'abstract qui a le plus de voix.
//  - C : récompensé si les votes « récompenser » dépassent les votes blancs.
// En cas d'égalité au sommet (A, B), les abstracts ex æquo sont tous lauréats.
function computeResults(votes, abstracts) {
  const A = abstracts.A.map((a) => ({ ...a, points: 0, r1: 0, r2: 0, r3: 0 }));
  const byA = new Map(A.map((r) => [r.id, r]));
  const B = abstracts.B.map((a) => ({ ...a, votes: 0 }));
  const byB = new Map(B.map((r) => [r.id, r]));
  let reward = 0;
  let blank = 0;

  for (const v of votes) {
    v.A.forEach((id, i) => {
      const row = byA.get(id);
      row.points += POINTS_A[i];
      row['r' + (i + 1)] += 1;
    });
    byB.get(v.B).votes += 1;
    if (v.C === 1) reward += 1;
    else blank += 1;
  }

  // Classement : uniquement par points (1ers/2es/3es choix = information, pas un départage)
  A.sort((x, y) => y.points - x.points || y.r1 - x.r1 || y.r2 - x.r2 || x.id.localeCompare(y.id));
  A.forEach((r, i) => { r.position = i > 0 && A[i - 1].points === r.points ? A[i - 1].position : i + 1; });
  B.sort((x, y) => y.votes - x.votes || x.id.localeCompare(y.id));
  B.forEach((r, i) => { r.position = i > 0 && B[i - 1].votes === r.votes ? B[i - 1].position : i + 1; });

  const n = votes.length;
  return {
    voters: n,
    A: { rows: A, outcome: topOutcome(A, 'points', n) },
    B: { rows: B, outcome: topOutcome(B, 'votes', n) },
    C: { reward, blank, outcome: outcomeC(reward, blank, n) },
  };
}

function topOutcome(rows, field, n) {
  if (n === 0 || rows[0][field] === 0) return { status: 'none', ids: [] };
  const ids = rows.filter((r) => r[field] === rows[0][field]).map((r) => r.id);
  return { status: ids.length > 1 ? 'exaequo' : 'winner', ids };
}

function outcomeC(reward, blank, n) {
  if (n === 0) return { status: 'none' };
  if (reward > blank) return { status: 'winner' };
  if (reward === blank) return { status: 'tie' };
  return { status: 'not_awarded' };
}

module.exports = { computeResults };
