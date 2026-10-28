'use strict';
const { route, send, HttpError } = require('../lib/http');
const { getStore } = require('../lib/store');
const { requireJuror } = require('../lib/auth');
const { abstracts } = require('../lib/config');
const { validateVote } = require('../lib/validate');

module.exports = route(['POST'], async (req, res) => {
  const store = getStore();
  const juror = requireJuror(req);
  const ballot = validateVote(req.jsonBody, abstracts);

  // 1) « a voté » : écriture atomique, un seul passage par juré (même en cas de double clic)
  const marked = await store.markVoted(juror.id, { jurorId: juror.id, initials: juror.initials, at: new Date().toISOString() });
  if (!marked) throw new HttpError(409, 'Vous avez déjà voté : le vote est définitif.');

  // 2) bulletin anonyme (sans identifiant ni horodatage). En cas d'échec, on libère le juré.
  try {
    await store.addBallot(ballot);
  } catch (e) {
    await store.unmarkVoted(juror.id);
    throw e;
  }
  send(res, 200, { ok: true, initials: juror.initials });
});
