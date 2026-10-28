(() => {
  'use strict';
  const root = document.getElementById('live');
  let seen = 0;        // nombre d'initiales déjà affichées (pour animer les nouvelles)
  let sig = '';        // signature de l'écran de révélation (évite de rejouer l'animation)
  let first = true;

  const h = (tag, props = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };

  document.getElementById('fs').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });

  function head(p) {
    return [
      h('div', { class: 'live-kicker' }, 'Centre Hospitalier de Mayotte'),
      h('h1', {}, p.event.subtitle),
      h('div', { class: 'sub' }, 'Vote du jury · Meilleurs abstracts'),
    ];
  }

  function progressView(p) {
    const bar = h('div', { class: 'bar' }, h('i'));
    bar.firstChild.style.width = Math.round((p.count / p.size) * 100) + '%';
    const slots = [];
    for (let i = 0; i < p.size; i++) {
      const ini = p.voters[i];
      slots.push(ini
        ? h('div', { class: 'voter' + (!first && i >= seen ? ' new' : '') }, h('b', {}, ini), h('span', {}, 'a voté'))
        : h('div', { class: 'voter empty' }, h('b', {}, '··'), h('span', {}, 'en attente')));
    }
    seen = p.voters.length;
    sig = '';
    root.replaceChildren(...head(p),
      h('div', { class: 'counter' }, `${p.count} / ${p.size}`, h('small', {}, 'jurés ont voté')),
      bar, h('div', { class: 'voters' }, slots),
      !p.open ? h('div', { class: 'closed-note' }, 'Scrutin clos') : null,
      h('p', { class: 'sub' }, 'Les lauréats seront dévoilés quand tous les jurés auront voté.'));
  }

  function winnerCard(w, i) {
    const none = w.status === 'not_awarded' || w.status === 'none' || w.status === 'tie';
    const body = [];
    if (w.status === 'not_awarded' || w.status === 'none') body.push(h('div', { class: 'wtitle' }, 'Non attribué'));
    else if (w.status === 'tie') body.push(h('div', { class: 'wtitle' }, 'Égalité'), h('div', { class: 'small' }, 'Autant de voix pour que de votes blancs.'));
    else {
      w.winners.forEach((x) => body.push(h('div', { class: 'wtitle' }, x.title), h('div', { class: 'wid' }, x.id)));
      if (w.status === 'exaequo') body.push(h('div', { class: 'small' }, 'Ex æquo : tous les abstracts ci-dessus sont lauréats.'));
    }
    return h('article', { class: `win d${i + 1}` + (none ? ' none' : '') },
      h('div', { class: 'lab' }, `${w.label} · ${w.status === 'exaequo' ? 'Lauréats ex æquo' : 'Lauréat'}`), h('div', { class: 'who' }, w.who),
      h('div', { class: 'trophy', 'aria-hidden': 'true' }, none ? '—' : '🏆'), ...body);
  }

  const td = (v, cls) => h('td', cls ? { class: cls } : {}, v);
  const th = (v, cls) => h('th', cls ? { class: cls } : {}, v);

  // Détail des résultats (visible une fois les 12 jurés passés)
  function detailsView(d, winners) {
    const topA = new Set(winners[0].winners.map((x) => x.id));
    const topB = new Set(winners[1].winners.map((x) => x.id));
    return h('section', { class: 'detail' },
      h('h2', {}, 'Détail des résultats'),
      h('h3', {}, 'Catégorie A : points (1er choix = 3, 2e = 2, 3e = 1)'),
      h('div', { class: 'tbl-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, th('#', 'num'), th('Abstract'), th('Titre'), th('Points', 'num'), th('1ers', 'num'), th('2es', 'num'), th('3es', 'num'))),
        h('tbody', {}, d.A.map((x) => h('tr', { class: topA.has(x.id) ? 'topline' : '' }, td(x.position, 'num'), td(x.id), td(x.title), td(x.points, 'num'), td(x.r1, 'num'), td(x.r2, 'num'), td(x.r3, 'num')))))),
      h('h3', {}, 'Catégorie B : nombre de voix'),
      h('div', { class: 'tbl-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, th('Abstract'), th('Titre'), th('Voix', 'num'))),
        h('tbody', {}, d.B.map((x) => h('tr', { class: topB.has(x.id) ? 'topline' : '' }, td(x.id), td(x.title), td(x.votes, 'num')))))),
      h('h3', {}, 'Catégorie C'),
      h('p', {}, `Récompenser : ${d.C.reward} · Vote blanc : ${d.C.blank}`),
      h('p', { class: 'small' }, 'Règle : l’abstract de la catégorie C est récompensé si les votes « récompenser » dépassent les votes blancs. Les bulletins sont anonymes.'));
  }

  function revealView(p) {
    const s = JSON.stringify([p.winners, p.details]);
    if (s === sig) return;
    sig = s;
    root.replaceChildren(...head(p),
      h('div', { class: 'reveal-title' }, 'Les lauréats'),
      h('div', { class: 'winners' }, p.winners.map(winnerCard)),
      h('p', { class: 'sub' }, `${p.count} jurés ont voté · félicitations à tous les participants !`),
      p.details ? detailsView(p.details, p.winners) : null);
  }

  async function tick() {
    try {
      const r = await fetch('/api/progress', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const p = await r.json();
      if (p.complete && p.winners) revealView(p); else progressView(p);
      first = false;
    } catch (e) {
      if (first) root.replaceChildren(h('p', {}, 'Connexion au serveur impossible, nouvelle tentative…'));
    }
  }
  tick();
  setInterval(tick, 3000);
})();
