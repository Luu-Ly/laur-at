'use strict';
const { HttpError } = require('./auth');

// Validation côté serveur : on ne fait jamais confiance au navigateur.
function validateVote(body, abstracts) {
  const idsA = new Set(abstracts.A.map((a) => a.id));
  const idsB = new Set(abstracts.B.map((a) => a.id));
  const { A, B, C } = body || {};
  if (!Array.isArray(A) || A.length !== 3 || A.some((x) => typeof x !== 'string' || !idsA.has(x))) {
    throw new HttpError(400, 'Catégorie A : choisissez exactement 3 abstracts valides.');
  }
  if (new Set(A).size !== 3) throw new HttpError(400, 'Catégorie A : les 3 choix doivent être différents.');
  if (typeof B !== 'string' || !idsB.has(B)) throw new HttpError(400, 'Catégorie B : choisissez un abstract.');
  if (C !== 0 && C !== 1) throw new HttpError(400, 'Catégorie C : choisissez « récompenser » ou « vote blanc ».');
  return { A, B, C };
}

module.exports = { validateVote };
