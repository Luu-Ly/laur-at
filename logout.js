'use strict';
const { route, send } = require('../lib/http');
const { endSession } = require('../lib/auth');

module.exports = route(['POST'], async (req, res) => {
  endSession(req, res);
  send(res, 200, { ok: true });
});
