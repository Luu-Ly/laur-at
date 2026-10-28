'use strict';
const { route, send, clientIp, HttpError } = require('../lib/http');
const { getStore } = require('../lib/store');
const { startJurorSession, accessCodeRequired, accessCodeOk } = require('../lib/auth');
const { findJurorByInitials } = require('../lib/jurors');

module.exports = route(['POST'], async (req, res) => {
  const { initials, code } = req.jsonBody || {};
  if (typeof initials !== 'string') throw new HttpError(400, 'Saisissez vos initiales.');
  const store = getStore();
  const ipKey = `rl:ip:${clientIp(req)}`;

  // Seuls les échecs comptent (la salle entière derrière la même connexion ne se bloque pas)
  if ((await store.count(ipKey)) >= 25) throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');

  if (accessCodeRequired() && !accessCodeOk(code)) {
    await store.hit(ipKey, 600);
    throw new HttpError(401, 'Code d’accès incorrect.');
  }
  const juror = findJurorByInitials(initials);
  if (!juror) {
    await store.hit(ipKey, 600);
    throw new HttpError(401, 'Initiales non reconnues. Vérifiez-les ou contactez l’organisatrice.');
  }
  startJurorSession(req, res, juror);
  send(res, 200, { ok: true });
});
