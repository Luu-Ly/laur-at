'use strict';
// Test de bout en bout de l'API (stockage en mémoire) : node test/api.test.js
process.env.SESSION_SECRET = 'test-secret';
const assert = require('assert');

let passed = 0;
const ok = (name) => { passed += 1; console.log('  ✓ ' + name); };

class Client {
  constructor(base) { this.base = base; this.jar = {}; }
  async call(method, path, body, extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    const cookie = Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.Cookie = cookie;
    const r = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of r.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      if (/Max-Age=0/.test(c)) delete this.jar[kv.slice(0, i)];
      else this.jar[kv.slice(0, i)] = kv.slice(i + 1);
    }
    const type = r.headers.get('content-type') || '';
    const data = type.includes('json') ? await r.json() : await r.text();
    return { status: r.status, data, headers: r.headers };
  }
}

const A = (n) => `2026-A-${String(n).padStart(3, '0')}`;
// 12 bulletins de référence : résultats calculés À LA MAIN
const BALLOTS = [
  [[12, 4, 5], 'B1', 1], [[12, 4, 7], 'B1', 1], [[12, 5, 13], 'B1', 0], [[4, 2, 7], 'B1', 1],
  [[4, 13, 12], 'B1', 1], [[7, 4, 12], 'B2', 1], [[7, 12, 4], 'B1', 0], [[4, 7, 12], 'B2', 1],
  [[12, 7, 4], 'B1', 1], [[5, 4, 7], 'B2', 0], [[4, 12, 7], 'B2', 1], [[7, 4, 12], 'B1', 0],
].map(([a, b, c]) => ({ A: a.map(A), B: `2026-B-00${b[1]}`, C: c }));
// Points attendus (3-2-1) : 004=24, 012=20, 007=17, 005=6, 013=3, 002=2  (total 72 = 12 × 6)
// B : B-001 = 8 voix, B-002 = 4 voix. C : récompenser = 8, blanc = 4.

(async () => {
  const { JURORS } = require('../lib/config');
  const INITIALS = JURORS.map((j) => j.initials);
  assert.deepStrictEqual(INITIALS, ['AC', 'LP', 'MN', 'NT', 'PB', 'OR', 'MK', 'SM', 'CB', 'AG', 'MD', 'PF']);
  const { createServer } = require('../dev-server');
  const { computeResults } = require('../lib/scoring');
  const { abstracts } = require('../lib/config');
  const { getStore } = require('../lib/store');

  console.log('Scoring (calcul pur)');
  const r = computeResults(BALLOTS, abstracts);
  const pts = Object.fromEntries(r.A.rows.map((x) => [x.id, x.points]));
  assert.deepStrictEqual([pts[A(4)], pts[A(12)], pts[A(7)], pts[A(5)], pts[A(13)], pts[A(2)], pts[A(1)]], [24, 20, 17, 6, 3, 2, 0]);
  assert.strictEqual(r.A.rows.reduce((s, x) => s + x.points, 0), 72);
  const row4 = r.A.rows.find((x) => x.id === A(4));
  assert.deepStrictEqual([row4.r1, row4.r2, row4.r3], [4, 5, 2]);
  assert.deepStrictEqual(r.A.outcome, { status: 'winner', ids: [A(4)] });
  assert.deepStrictEqual(r.B.rows.map((x) => x.votes), [8, 4]);
  assert.strictEqual(r.C.reward, 8);
  assert.strictEqual(r.C.blank, 4);
  assert.strictEqual(r.C.outcome.status, 'winner');
  ok('barème 3-2-1, catégories B et C conformes au calcul manuel');

  const mkb = (a, b = '2026-B-001', c = 1) => ({ A: a, B: b, C: c });
  const [X, Y, Z, W] = [A(1), A(2), A(3), A(4)];
  const one = computeResults([mkb([X, Z, W]), mkb([Z, Y, W]), mkb([W, Z, Y])], abstracts);
  assert.deepStrictEqual(one.A.rows.slice(0, 4).map((x) => [x.id, x.points]), [[Z, 7], [W, 5], [X, 3], [Y, 3]]);
  assert.deepStrictEqual(one.A.outcome, { status: 'winner', ids: [Z] });
  const top2 = computeResults([
    mkb([A(12), A(4), A(5)]), mkb([A(12), A(4), A(7)]), mkb([A(12), A(5), A(13)]),
    mkb([A(4), A(2), A(7)]), mkb([A(4), A(13), A(12)]),
  ], abstracts);
  assert.strictEqual(top2.A.outcome.status, 'exaequo');
  assert.deepStrictEqual([...top2.A.outcome.ids].sort(), [A(4), A(12)]);
  const tie = computeResults([mkb([A(1), A(2), A(3)], '2026-B-001', 0), mkb([A(2), A(1), A(3)], '2026-B-002', 0)], abstracts);
  assert.deepStrictEqual([...tie.A.outcome.ids].sort(), [A(1), A(2)]);
  assert.strictEqual(tie.B.outcome.status, 'exaequo');
  assert.strictEqual(tie.C.outcome.status, 'not_awarded');
  assert.strictEqual(computeResults([], abstracts).A.outcome.status, 'none');
  ok('un lauréat par catégorie ; ex æquo au sommet = tous lauréats ; aucun vote = aucun lauréat');

  const server = createServer();
  await new Promise((res) => server.listen(0, res));
  const base = `http://127.0.0.1:${server.address().port}`;
  const anon = new Client(base);

  console.log('API');
  const jurors = [];
  const variants = ['ac', ' L.P ', 'm n', 'nt', 'PB', 'or', 'MK', 'S M', 'cb', 'AG', 'Md', 'pf']; // saisies variées
  for (let i = 0; i < 12; i++) {
    const cl = new Client(base);
    let x = await cl.call('POST', '/api/login', { initials: 'ZZ' });
    assert.strictEqual(x.status, 401);
    x = await cl.call('POST', '/api/login', { initials: variants[i] });
    assert.strictEqual(x.status, 200, 'initiales ' + variants[i]);
    jurors.push(cl);
  }
  ok('12 jurés se connectent avec leurs seules initiales (majuscules, points, espaces tolérés) ; initiales inconnues refusées');

  let x = await anon.call('GET', '/api/me');
  assert.strictEqual(x.data.authenticated, false);
  x = await jurors[0].call('GET', '/api/me');
  assert.deepStrictEqual([x.data.authenticated, x.data.voted], [true, false]);
  assert.strictEqual(x.data.config.abstracts.A.length, 12);
  x = await anon.call('GET', '/api/admin?action=state');
  assert.strictEqual(x.status, 404);
  ok('cookie requis ; plus aucune page ni route d’administration');

  const good = { A: BALLOTS[0].A, B: BALLOTS[0].B, C: BALLOTS[0].C };
  const bads = [
    ['A : 2 choix', { ...good, A: good.A.slice(0, 2) }],
    ['A : 4 choix', { ...good, A: [...good.A, A(1)] }],
    ['A : doublon', { ...good, A: [A(1), A(1), A(2)] }],
    ['A : abstract inconnu', { ...good, A: [A(1), A(2), '2026-A-011'] }],
    ['A : abstract d’une autre catégorie', { ...good, A: [A(1), A(2), '2026-B-001'] }],
    ['B : inconnu', { ...good, B: '2026-B-009' }],
    ['C : 2', { ...good, C: 2 }],
    ['C : texte', { ...good, C: '1' }],
  ];
  for (const [name, body] of bads) {
    x = await jurors[0].call('POST', '/api/vote', body);
    assert.strictEqual(x.status, 400, name);
  }
  x = await anon.call('POST', '/api/vote', good);
  assert.strictEqual(x.status, 401);
  x = await jurors[0].call('POST', '/api/vote', good, { Origin: 'https://pirate.example' });
  assert.strictEqual(x.status, 403);
  ok(`${bads.length} votes invalides rejetés + vote sans session (401) + origine étrangère (403)`);

  const [r1, r2] = await Promise.all([jurors[0].call('POST', '/api/vote', good), jurors[0].call('POST', '/api/vote', good)]);
  assert.deepStrictEqual([r1.status, r2.status].sort(), [200, 409]);
  x = await jurors[0].call('POST', '/api/vote', good);
  assert.strictEqual(x.status, 409);
  x = await jurors[0].call('GET', '/api/me');
  assert.deepStrictEqual([x.data.voted, x.data.initials], [true, 'AC']);
  ok('un seul vote par juré, même en double clic simultané');

  x = await anon.call('GET', '/api/progress');
  assert.deepStrictEqual([x.data.count, x.data.complete, x.data.voters], [1, false, ['AC']]);
  assert.strictEqual(x.data.winners, undefined);
  assert.strictEqual(x.data.details, undefined);
  ok('« AC a voté » visible ; ni lauréats ni scores tant que le jury n’est pas complet');

  for (let i = 1; i < 12; i++) {
    const b = BALLOTS[i];
    x = await jurors[i].call('POST', '/api/vote', { A: b.A, B: b.B, C: b.C });
    assert.strictEqual(x.status, 200, 'juré ' + i);
    x = await anon.call('GET', '/api/progress');
    assert.strictEqual(x.data.count, i + 1);
    assert.strictEqual(x.data.complete, i === 11);
    if (i < 11) assert.strictEqual(x.data.winners, undefined, 'pas de lauréats avant le 12e vote');
  }
  const prog = x.data;
  assert.deepStrictEqual(prog.voters, INITIALS);
  assert.deepStrictEqual(prog.winners.map((w) => w.winners.map((y) => y.id)), [[A(4)], ['2026-B-001'], ['2026-C-001']]);
  assert.deepStrictEqual(prog.winners.map((w) => w.status), ['winner', 'winner', 'winner']);
  ok('12 jurés votent : les 3 lauréats apparaissent uniquement au 12e vote');

  const hp = Object.fromEntries(prog.details.A.map((y) => [y.id, y.points]));
  assert.deepStrictEqual([hp[A(4)], hp[A(12)], hp[A(7)]], [24, 20, 17]);
  assert.deepStrictEqual(prog.details.B.map((y) => y.votes), [8, 4]);
  assert.deepStrictEqual(prog.details.C, { reward: 8, blank: 4 });
  ok('détail publié sur /resultats identique au calcul manuel (24 / 20 / 17 ; 8-4 ; 8-4)');

  // Anonymat : on inspecte directement la base
  const store = getStore();
  const ballots = await store.listBallots();
  const voters = await store.listVoters();
  assert.strictEqual(ballots.length, 12);
  assert.ok(ballots.every((b) => JSON.stringify(Object.keys(b).sort()) === '["A","B","C"]'), 'un bulletin = A, B, C uniquement');
  assert.ok(!/JURY-|\d{4}-\d\d-\d\dT/.test(JSON.stringify(ballots)), 'aucun identifiant ni horodatage dans les bulletins');
  assert.strictEqual(voters.length, 12);
  ok('anonymat : les bulletins ne contiennent ni identifiant, ni initiales, ni horodatage');

  // Remise à zéro par ELECTION_ID
  process.env.ELECTION_ID = 'officiel';
  x = await anon.call('GET', '/api/progress');
  assert.deepStrictEqual([x.data.count, x.data.complete], [0, false]);
  x = await jurors[3].call('GET', '/api/me');
  assert.strictEqual(x.data.voted, false);
  x = await jurors[3].call('POST', '/api/vote', { ...BALLOTS[3] });
  assert.strictEqual(x.status, 200);
  delete process.env.ELECTION_ID;
  x = await anon.call('GET', '/api/progress');
  assert.strictEqual(x.data.count, 12);
  ok('changer ELECTION_ID repart d’une urne vide (les anciens votes sont conservés à part)');

  // Code d'accès facultatif
  process.env.ACCESS_CODE = 'Mayotte2026';
  x = await new Client(base).call('GET', '/api/me');
  assert.deepStrictEqual([x.data.authenticated, x.data.needCode], [false, true]);
  const withCode = new Client(base);
  assert.strictEqual((await withCode.call('POST', '/api/login', { initials: 'AC' })).status, 401);
  assert.strictEqual((await withCode.call('POST', '/api/login', { initials: 'AC', code: 'faux' })).status, 401);
  assert.strictEqual((await withCode.call('POST', '/api/login', { initials: 'AC', code: ' mayotte2026 ' })).status, 200);
  delete process.env.ACCESS_CODE;
  x = await new Client(base).call('GET', '/api/me');
  assert.strictEqual(x.data.needCode, false);
  ok('code d’accès facultatif (ACCESS_CODE) : exigé quand défini, sans effet sinon');

  // Anti-devinette des initiales : trop d'échecs depuis une même connexion
  const brute = new Client(base);
  let last;
  for (let i = 0; i < 30; i++) last = await brute.call('POST', '/api/login', { initials: 'Q' + String.fromCharCode(65 + (i % 26)) });
  assert.strictEqual(last.status, 429);
  ok('blocage après 25 échecs de connexion depuis une même connexion');


  const forged = new Client(base);
  forged.jar.jury_session = Buffer.from(JSON.stringify({ r: 'juror', s: 'JURY-05', k: 'x', e: 9999999999 })).toString('base64url') + '.abc';
  x = await forged.call('GET', '/api/me');
  assert.strictEqual(x.data.authenticated, false);
  ok('cookie de session falsifié refusé');

  server.close();
  console.log(`\n${passed} groupes de tests réussis.`);
})().catch((e) => { console.error('\n✗ ÉCHEC :', e); process.exit(1); });
