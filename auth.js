'use strict';
const crypto = require('crypto');
const { findJurorById } = require('./jurors');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

let devSecret;
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.VERCEL) throw new HttpError(500, 'SESSION_SECRET non configuré (voir README).');
  return (devSecret = devSecret || crypto.randomBytes(32).toString('hex'));
}

const b64 = (b) => Buffer.from(b).toString('base64url');
function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function verify(token) {
  if (typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const good = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.e > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
const isHttps = (req) => (req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';
function setCookie(req, res, name, value, maxAge) {
  const c = `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', [...[].concat(res.getHeader('Set-Cookie') || []), c]);
}

const JUROR_COOKIE = 'jury_session';
const JUROR_TTL = 12 * 3600;

function startJurorSession(req, res, juror) {
  const e = Math.floor(Date.now() / 1000) + JUROR_TTL;
  setCookie(req, res, JUROR_COOKIE, sign({ r: 'juror', s: juror.id, e }), JUROR_TTL);
}
const endSession = (req, res) => setCookie(req, res, JUROR_COOKIE, '', 0);

// Renvoie le juré connecté (le cookie est signé : impossible à falsifier)
function requireJuror(req) {
  const p = verify(cookies(req)[JUROR_COOKIE]);
  const juror = p && p.r === 'juror' ? findJurorById(p.s) : null;
  if (!juror) throw new HttpError(401, 'Veuillez vous connecter.');
  return juror;
}

// Code d'accès facultatif (variable ACCESS_CODE) : un seul code commun à tout le jury
function accessCodeRequired() { return !!process.env.ACCESS_CODE; }
function accessCodeOk(code) {
  const h = (s) => crypto.createHash('sha256').update(String(s).trim().toLowerCase()).digest();
  return crypto.timingSafeEqual(h(code || ''), h(process.env.ACCESS_CODE));
}

module.exports = { HttpError, startJurorSession, endSession, requireJuror, accessCodeRequired, accessCodeOk, JUROR_COOKIE };
