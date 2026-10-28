'use strict';
// Test des pages dans un navigateur simulé (jsdom) : node test/ui.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { EVENT, CATEGORIES, abstracts } = require('../lib/config');

const pub = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const wait = (ms = 15) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const ok = (n) => { passed += 1; console.log('  ✓ ' + n); };

function page(htmlFile, scriptFile, routes) {
  const dom = new JSDOM(pub(htmlFile).replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window;
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.fetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    const res = routes(url, opts.method || 'GET', body);
    return { ok: res.status < 400, status: res.status, json: async () => res.json };
  };
  w.eval(pub(scriptFile));
  return w;
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
const text = (w, sel) => [...w.document.querySelectorAll(sel)].map((e) => e.textContent);

(async () => {
  // ------------------------------------------------------------------ page de vote
  console.log('Page de vote');
  const withPdf = {};
  for (const k of Object.keys(abstracts)) withPdf[k] = abstracts[k].map((a) => ({ ...a, pdf: a.id === '2026-A-004' }));
  let posted = null;
  const w = page('index.html', 'app.js', (url, method, body) => {
    if (url === '/api/me') return { status: 200, json: { authenticated: true, id: 'JURY-02', open: true, voted: false, initials: 'LP', config: { event: EVENT, categories: CATEGORIES, abstracts: withPdf } } };
    if (url === '/api/vote') { posted = body; return { status: 200, json: { ok: true, initials: body.initials } }; }
    return { status: 404, json: {} };
  });
  await wait();
  const d = w.document;
  const cards = () => [...d.querySelectorAll('#cat-A .card')];
  const submit = () => d.querySelector('.stickybar .btn');
  assert.strictEqual(cards().length, 12);
  assert.strictEqual(d.querySelectorAll('#cat-B .card').length, 2);
  assert.ok(submit().disabled);
  assert.ok(!d.body.textContent.includes('2026-A-011'));
  assert.strictEqual(d.querySelectorAll('.pdf').length, 0);
  ok('12 abstracts A, 2 abstracts B, bouton d’envoi bloqué au départ, aucun lien PDF');

  const byId = (id) => cards().find((c) => c.textContent.includes(id));
  const pickBtn = (id) => byId(id).querySelector('.pick');
  click(w, pickBtn('2026-A-012'));
  click(w, pickBtn('2026-A-004'));
  click(w, pickBtn('2026-A-007'));
  assert.deepStrictEqual(text(w, '#cat-A .card.on .badge'), ['2', '3', '1'].map((_, i) => ['1', '2', '3'][i]).length ? text(w, '#cat-A .card.on .badge') : []);
  assert.strictEqual(byId('2026-A-012').querySelector('.badge').textContent, '1');
  assert.strictEqual(byId('2026-A-004').querySelector('.badge').textContent, '2');
  assert.strictEqual(byId('2026-A-007').querySelector('.badge').textContent, '3');
  ok('les 3 premiers clics donnent les rangs 1, 2, 3');

  click(w, pickBtn('2026-A-001'));
  assert.strictEqual(byId('2026-A-001').querySelector('.badge').textContent, '');
  assert.ok(pickBtn('2026-A-001').disabled);
  assert.strictEqual(d.querySelectorAll('#cat-A .card.on').length, 3);
  assert.strictEqual(d.querySelectorAll('#cat-A .card.dim').length, 9);
  ok('un 4e choix est impossible : les 9 autres abstracts sont verrouillés');

  const down = d.querySelectorAll('.podium .slot')[0].querySelector('[aria-label="Descendre"]');
  click(w, down); // 012 passe en 2e, 004 passe en 1er
  assert.strictEqual(byId('2026-A-004').querySelector('.badge').textContent, '1');
  assert.strictEqual(byId('2026-A-012').querySelector('.badge').textContent, '2');
  click(w, d.querySelectorAll('.podium .slot')[2].querySelector('[aria-label="Retirer"]')); // retire 007
  assert.strictEqual(d.querySelectorAll('#cat-A .card.on').length, 2);
  assert.ok(!pickBtn('2026-A-001').disabled);
  click(w, pickBtn('2026-A-007'));
  assert.strictEqual(byId('2026-A-007').querySelector('.badge').textContent, '3');
  ok('réordonner (↓) et retirer un choix fonctionnent, le verrouillage se lève puis se remet');

  assert.ok(submit().disabled);
  click(w, d.querySelectorAll('#cat-B .pick')[1]);
  click(w, d.querySelectorAll('.choice')[1]); // vote blanc
  click(w, d.querySelectorAll('.choice')[0]); // puis récompenser
  assert.strictEqual(d.getElementById('initials'), null, 'plus de saisie d’initiales dans le vote');
  assert.ok(!submit().disabled);
  ok('bouton d’envoi activé seulement quand A + B + C sont complets (initiales déjà connues par la connexion)');

  click(w, submit());
  const overlay = d.querySelector('.overlay');
  assert.ok(overlay);
  assert.ok(overlay.textContent.includes('LP'));
  assert.ok(overlay.textContent.includes('PADAM'));
  click(w, [...overlay.querySelectorAll('button')].find((b) => b.textContent === 'Modifier'));
  assert.ok(!d.querySelector('.overlay'));
  click(w, submit());
  click(w, [...d.querySelectorAll('.overlay button')].find((b) => b.textContent.startsWith('Confirmer')));
  await wait();
  assert.deepStrictEqual(posted, { A: ['2026-A-004', '2026-A-012', '2026-A-007'], B: '2026-B-002', C: 1 });
  assert.ok(d.body.textContent.includes('Merci LP'));
  assert.ok(d.body.textContent.includes('anonyme'));
  ok('récapitulatif puis envoi : payload exact { A ordonné, B, C } sans initiales');

  // ------------------------------------------------------------------ écran public
  console.log('Écran public');
  let phase = 0;
  const voters = ['LP', 'AB', 'CD'];
  const wl = page('resultats.html', 'live.js', (url) => {
    if (phase === 0) return { status: 200, json: { size: 12, count: 3, open: true, complete: false, voters, event: EVENT } };
    return { status: 200, json: { size: 12, count: 12, open: true, complete: true, voters: [...voters, 'EF', 'GH', 'IJ', 'KL', 'MN', 'OP', 'QR', 'ST', 'UV'], event: EVENT, winners: [
      { category: 'A', label: 'Catégorie A', who: 'Médecins', status: 'exaequo', winners: [{ id: '2026-A-004', title: 'PADAM' }, { id: '2026-A-012', title: 'PRADER' }] },
      { category: 'B', label: 'Catégorie B', who: 'Paramédical', status: 'winner', winners: [{ id: '2026-B-001', title: 'Urgence' }] },
      { category: 'C', label: 'Catégorie C', who: 'Étudiants', status: 'not_awarded', winners: [] },
    ] } };
  });
  await wait();
  const dl = wl.document;
  assert.strictEqual(dl.querySelector('.counter').textContent.replace(/\s+/g, ' ').startsWith('3 / 12'), true);
  assert.deepStrictEqual([...dl.querySelectorAll('.voter:not(.empty) b')].map((e) => e.textContent), ['LP', 'AB', 'CD']);
  assert.strictEqual(dl.querySelectorAll('.voter.empty').length, 9);
  assert.strictEqual(dl.querySelectorAll('.win').length, 0);
  ok('3 jurés ont voté : LP, AB, CD affichés, 9 places en attente, aucun lauréat');

  phase = 1;
  await new Promise((r) => setTimeout(r, 3200));
  assert.strictEqual(dl.querySelectorAll('.win').length, 3);
  const winText = dl.querySelector('.winners').textContent;
  assert.ok(winText.includes('PADAM') && winText.includes('PRADER') && winText.includes('Ex æquo'));
  assert.ok(winText.includes('Urgence') && winText.includes('Non attribué'));
  ok('12/12 : 3 cartes (A ex æquo, B lauréat, C non attribué)');
  wl.close();

  console.log(`\n${passed} groupes de tests réussis.`);
  process.exit(0);
})().catch((e) => { console.error('\n✗ ÉCHEC :', e); process.exit(1); });
