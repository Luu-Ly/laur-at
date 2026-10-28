'use strict';
// Couche de stockage : Redis (Upstash) en production, mémoire en local/test.
//
// ANONYMAT : « qui a voté » (voters) et « ce qui a été voté » (ballots) sont deux
// ensembles séparés. Un bulletin n'a ni identifiant de juré, ni horodatage, et
// les bulletins sont toujours relus dans un ordre mélangé.
//
// REMISE À ZÉRO : toutes les données de vote sont rangées sous ELECTION_ID.
// Changer cette variable (puis redéployer) repart d'une urne vide, sans rien supprimer.
const crypto = require('crypto');
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const election = () => String(process.env.ELECTION_ID || '1').replace(/[^\w-]/g, '_');

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function memoryStore() {
  const voters = new Map(); // clé : election + juré
  const ballots = new Map();
  const counters = new Map();
  const mine = (m) => [...m].filter(([k]) => k.startsWith(election() + '|')).map(([, v]) => v);
  return {
    kind: 'memory',
    async markVoted(id, rec) { const k = `${election()}|${id}`; if (voters.has(k)) return false; voters.set(k, rec); return true; },
    async unmarkVoted(id) { voters.delete(`${election()}|${id}`); },
    async getVoter(id) { return voters.get(`${election()}|${id}`) || null; },
    async listVoters() { return mine(voters); },
    async addBallot(b) { ballots.set(`${election()}|${crypto.randomUUID()}`, b); },
    async listBallots() { return shuffle(mine(ballots)); },
    async count(key) { const c = counters.get(key); return c && c.exp > Date.now() ? c.n : 0; },
    async hit(key, ttl) {
      const c = counters.get(key);
      if (c && c.exp > Date.now()) { c.n += 1; return c.n; }
      counters.set(key, { n: 1, exp: Date.now() + ttl * 1000 });
      return 1;
    },
    async clear(key) { counters.delete(key); },
  };
}

function redisStore(url, token) {
  const { Redis } = require('@upstash/redis');
  const r = new Redis({ url, token });
  const V = () => `jury:${election()}:voters`;
  const B = () => `jury:${election()}:ballots`;
  const vals = (o) => (o ? Object.values(o).map(parse) : []);
  return {
    kind: 'redis',
    async markVoted(id, rec) { return (await r.hsetnx(V(), id, JSON.stringify(rec))) === 1; },
    async unmarkVoted(id) { await r.hdel(V(), id); },
    async getVoter(id) { const v = await r.hget(V(), id); return v ? parse(v) : null; },
    async listVoters() { return vals(await r.hgetall(V())); },
    async addBallot(b) { await r.hset(B(), { [crypto.randomUUID()]: JSON.stringify(b) }); },
    async listBallots() { return shuffle(vals(await r.hgetall(B()))); },
    async count(key) { return Number((await r.get('jury:' + key)) || 0); },
    async hit(key, ttl) {
      const k = 'jury:' + key;
      const n = await r.incr(k);
      if (n === 1) await r.expire(k, ttl);
      return n;
    },
    async clear(key) { await r.del('jury:' + key); },
  };
}

let instance;
function getStore() {
  if (instance) return instance;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) instance = redisStore(url, token);
  else if (process.env.VERCEL) {
    const e = new Error('Base de données non configurée (Upstash Redis). Voir le README.');
    e.status = 500;
    throw e;
  } else instance = memoryStore();
  return instance;
}

module.exports = { getStore, memoryStore };
