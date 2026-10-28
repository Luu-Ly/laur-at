'use strict';
const { route, send } = require('../lib/http');
const { getStore } = require('../lib/store');
const { requireJuror, HttpError, accessCodeRequired } = require('../lib/auth');
const { EVENT, CATEGORIES, abstracts } = require('../lib/config');

module.exports = route(['GET'], async (req, res) => {
  let juror;
  try {
    juror = requireJuror(req);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) return send(res, 200, { authenticated: false, needCode: accessCodeRequired() });
    throw e;
  }
  const voter = await getStore().getVoter(juror.id);
  // Le bulletin n'est lié à personne : on ne renvoie que « a voté » et les initiales du juré.
  send(res, 200, {
    authenticated: true,
    id: juror.id,
    initials: juror.initials,
    open: true,
    voted: !!voter,
    config: { event: EVENT, categories: CATEGORIES, abstracts },
  });
});
