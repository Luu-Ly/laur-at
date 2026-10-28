'use strict';
const { HttpError } = require('./auth');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString() || '{}');
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  return raw ? JSON.parse(raw) : {};
}

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'inconnue';

// Enveloppe commune : méthode, contrôle d'origine (anti-CSRF), JSON, erreurs.
function route(methods, fn) {
  return async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      if (!methods.includes(req.method)) throw new HttpError(405, 'Méthode non autorisée');
      req.url_ = new URL(req.url, 'http://local');
      if (req.method !== 'GET') {
        const origin = req.headers.origin;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        if (origin && new URL(origin).host !== host) throw new HttpError(403, 'Origine refusée');
        try { req.jsonBody = await readBody(req); } catch { throw new HttpError(400, 'Requête invalide'); }
      }
      await fn(req, res);
    } catch (e) {
      if (e.status) send(res, e.status, { error: e.message });
      else { console.error(e); send(res, 500, { error: 'Erreur serveur' }); }
    }
  };
}

module.exports = { route, send, clientIp, HttpError };
