(() => {
  'use strict';
  const root = document.getElementById('app');
  const whoChip = document.getElementById('who');
  const POINTS = [3, 2, 1];
  const ORDINAL = ['1er choix', '2e choix', '3e choix'];
  let ME = null;
  const st = { A: [], B: null, C: null };

  // Petit constructeur DOM : tout le texte passe par textContent (pas d'injection HTML)
  const h = (tag, props = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };

  async function api(path, body) {
    const r = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = {};
    try { data = await r.json(); } catch (e) { /* réponse vide */ }
    if (!r.ok) throw Object.assign(new Error(data.error || 'Erreur de connexion au serveur.'), { status: r.status });
    return data;
  }

  const show = (...nodes) => { root.replaceChildren(...nodes); window.scrollTo(0, 0); };
  const titleOf = (id) => Object.values(ME.config.abstracts).flat().find((a) => a.id === id)?.title || id;

  // ---------------------------------------------------------------- connexion
  function loginView(msg) {
    whoChip.classList.add('hidden');
    const needCode = !!(ME && ME.needCode);
    const err = h('div', { class: 'err hidden', role: 'alert' });
    const ini = h('input', { type: 'text', id: 'login-ini', class: 'initials', maxlength: '6', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'LP', required: true });
    const code = needCode ? h('input', { type: 'password', id: 'login-code', autocomplete: 'off', required: true }) : null;
    const btn = h('button', { class: 'btn', type: 'submit' }, 'Accéder au vote');
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        btn.disabled = true;
        err.classList.add('hidden');
        try {
          await api('/api/login', { initials: ini.value, code: code ? code.value : undefined });
          await boot();
        } catch (ex) {
          err.textContent = ex.message;
          err.classList.remove('hidden');
          btn.disabled = false;
        }
      },
    },
    h('div', { class: 'field' }, h('label', { for: 'login-ini' }, 'Vos initiales'), ini),
    code ? h('div', { class: 'field' }, h('label', { for: 'login-code' }, 'Code d’accès'), code) : null,
    err, btn);
    show(h('div', { class: 'panel login-box' },
      h('h2', {}, 'Vote du jury'),
      h('p', { class: 'lead' }, 'Saisissez vos initiales pour accéder au vote. Votre vote reste anonyme.'),
      msg ? h('div', { class: 'note' }, msg) : null,
      form));
    ini.focus();
  }

  // ---------------------------------------------------------------- vote
  function voteView() {
    const cfg = ME.config;
    const cats = cfg.categories;
    whoChip.textContent = `Connecté : ${ME.initials}`;
    whoChip.classList.remove('hidden');

    // --- catégorie A : classement des 3 meilleurs
    const cardsA = cfg.abstracts.A.map((a) => {
      const badge = h('span', { class: 'badge', 'aria-hidden': 'true' });
      const btn = h('button', { type: 'button', class: 'pick', 'aria-pressed': 'false', onclick: () => toggleA(a.id) },
        h('span', { class: 'cid' }, a.id), h('span', { class: 'ctitle' }, a.title));
      const card = h('div', { class: 'card' }, btn, badge);
      return { a, card, btn, badge };
    });
    const podium = h('div', { class: 'podium' });
    const panelA = h('section', { class: 'panel', id: 'cat-A' },
      h('div', { class: 'cat-head' }, h('span', { class: 'cat-letter' }, 'A'), h('h2', {}, cats.A.label), h('span', { class: 'cat-who' }, cats.A.who)),
      h('p', { class: 'lead' }, cats.A.question),
      h('div', { class: 'rule' }, 'Cliquez sur un abstract pour le choisir : le 1er cliqué = 1er choix (3 points), le 2e = 2e choix (2 points), le 3e = 3e choix (1 point). Une fois 3 choix faits, les autres abstracts sont verrouillés ; vous pouvez réordonner ou retirer un choix dans « Mon classement ».'),
      h('div', { class: 'grid' }, cardsA.map((c) => c.card)),
      podium);

    // --- catégorie B : un seul abstract
    const cardsB = cfg.abstracts.B.map((a) => {
      const badge = h('span', { class: 'badge', 'aria-hidden': 'true' });
      const btn = h('button', { type: 'button', class: 'pick', role: 'radio', 'aria-checked': 'false', onclick: () => { st.B = st.B === a.id ? null : a.id; update(); } },
        h('span', { class: 'cid' }, a.id), h('span', { class: 'ctitle' }, a.title));
      return { a, card: h('div', { class: 'card' }, btn, badge), btn, badge };
    });
    const panelB = h('section', { class: 'panel', id: 'cat-B' },
      h('div', { class: 'cat-head' }, h('span', { class: 'cat-letter' }, 'B'), h('h2', {}, cats.B.label), h('span', { class: 'cat-who' }, cats.B.who)),
      h('p', { class: 'lead' }, cats.B.question),
      h('div', { class: 'grid', role: 'radiogroup', 'aria-label': 'Catégorie B' }, cardsB.map((c) => c.card)));

    // --- catégorie C : récompenser / blanc
    const cAbs = cfg.abstracts.C[0];
    const btnYes = h('button', { type: 'button', class: 'choice', role: 'radio', 'aria-checked': 'false', onclick: () => { st.C = 1; update(); } }, 'Récompenser l’abstract', h('small', {}, 'Vote pour (1)'));
    const btnNo = h('button', { type: 'button', class: 'choice blank', role: 'radio', 'aria-checked': 'false', onclick: () => { st.C = 0; update(); } }, 'Vote blanc', h('small', {}, 'Ne pas récompenser (0)'));
    const panelC = h('section', { class: 'panel', id: 'cat-C' },
      h('div', { class: 'cat-head' }, h('span', { class: 'cat-letter' }, 'C'), h('h2', {}, cats.C.label), h('span', { class: 'cat-who' }, cats.C.who)),
      h('p', { class: 'lead' }, cats.C.question),
      h('div', { class: 'c-title' }, h('span', { class: 'cid' }, cAbs.id), cAbs.title),
      h('div', { class: 'choice-row', role: 'radiogroup', 'aria-label': 'Catégorie C' }, btnYes, btnNo));

    // --- barre d'envoi
    const stepEls = { A: h('span', { class: 'step' }, 'Catégorie A'), B: h('span', { class: 'step' }, 'Catégorie B'), C: h('span', { class: 'step' }, 'Catégorie C') };
    const submit = h('button', { type: 'button', class: 'btn', onclick: openReview }, 'Vérifier et valider mon vote');
    const bar = h('div', { class: 'stickybar' }, h('div', { class: 'wrap' }, h('div', { class: 'steps' }, Object.values(stepEls)), submit));

    show(panelA, panelB, panelC, h('div', { class: 'hint' }, 'Le vote est définitif une fois validé.'), bar);

    function toggleA(id) {
      const i = st.A.indexOf(id);
      if (i >= 0) st.A.splice(i, 1);
      else if (st.A.length < 3) st.A.push(id);
      update();
    }
    function moveA(i, d) {
      const j = i + d;
      if (j < 0 || j > 2 || !st.A[i] || !st.A[j]) return;
      [st.A[i], st.A[j]] = [st.A[j], st.A[i]];
      update(`move-${j}`);
    }

    function update(focusKey) {
      const full = st.A.length === 3;
      for (const c of cardsA) {
        const i = st.A.indexOf(c.a.id);
        c.card.className = 'card' + (i >= 0 ? ` on r${i + 1}` : '') + (i < 0 && full ? ' dim' : '');
        c.btn.setAttribute('aria-pressed', String(i >= 0));
        c.btn.disabled = i < 0 && full;
        c.badge.textContent = i >= 0 ? String(i + 1) : '';
      }
      podium.replaceChildren(
        h('h3', {}, 'Mon classement'),
        ...[0, 1, 2].map((i) => {
          const id = st.A[i];
          return h('div', { class: 'slot' + (id ? '' : ' empty') },
            h('span', { class: 'medal' }, i + 1),
            h('span', { class: 'txt' }, id ? titleOf(id) : `${ORDINAL[i]} : à choisir`, h('small', {}, `${ORDINAL[i]} · ${POINTS[i]} point${POINTS[i] > 1 ? 's' : ''}`)),
            id ? h('span', { class: 'ctl' },
              h('button', { type: 'button', class: 'icon-btn', 'data-k': `move-${i - 1}`, 'aria-label': 'Monter', disabled: i === 0, onclick: () => moveA(i, -1) }, '↑'),
              h('button', { type: 'button', class: 'icon-btn', 'data-k': `move-${i + 1}`, 'aria-label': 'Descendre', disabled: i === 2 || !st.A[i + 1], onclick: () => moveA(i, 1) }, '↓'),
              h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Retirer', onclick: () => toggleA(id) }, '✕')) : null);
        }));
      if (focusKey) podium.querySelector(`[data-k="${focusKey}"]:not(:disabled)`)?.focus();

      for (const c of cardsB) {
        const on = st.B === c.a.id;
        c.card.className = 'card' + (on ? ' on' : '');
        c.btn.setAttribute('aria-checked', String(on));
        c.badge.textContent = on ? '✓' : '';
      }
      btnYes.className = 'choice' + (st.C === 1 ? ' on' : '');
      btnNo.className = 'choice blank' + (st.C === 0 ? ' on' : '');
      btnYes.setAttribute('aria-checked', String(st.C === 1));
      btnNo.setAttribute('aria-checked', String(st.C === 0));

      const done = { A: full, B: !!st.B, C: st.C === 0 || st.C === 1 };
      for (const k of Object.keys(stepEls)) stepEls[k].className = 'step' + (done[k] ? ' done' : '');
      submit.disabled = !(done.A && done.B && done.C);
    }
    update();
  }

  // ---------------------------------------------------------------- confirmation
  function openReview() {
    const ini = ME.initials;
    const err = h('div', { class: 'err hidden', role: 'alert' });
    const confirm = h('button', { type: 'button', class: 'btn', onclick: send }, 'Confirmer définitivement');
    const back = h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Modifier');
    const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Récapitulatif de votre vote' },
      h('div', { class: 'modal' },
        h('h2', {}, 'Récapitulatif de votre vote'),
        h('p', {}, 'Une fois confirmé, le vote est anonyme et ne peut plus être modifié.'),
        h('div', { class: 'recap' }, recapNodes(ini, st)),
        err,
        h('div', { class: 'row' }, confirm, back)));
    document.body.append(overlay);
    confirm.focus();
    function close() { overlay.remove(); }
    async function send() {
      confirm.disabled = true;
      back.disabled = true;
      err.classList.add('hidden');
      try {
        await api('/api/vote', { A: st.A, B: st.B, C: st.C });
        const snapshot = { ini, A: [...st.A], B: st.B, C: st.C };
        overlay.remove();
        doneView(ini, snapshot);
      } catch (ex) {
        if (ex.status === 409 || ex.status === 401) { overlay.remove(); await boot(); return; }
        err.textContent = ex.message;
        err.classList.remove('hidden');
        confirm.disabled = false;
        back.disabled = false;
      }
    }
  }

  function recapNodes(ini, s) {
    return [
      h('div', {}, h('b', {}, 'Initiales'), ini),
      h('div', {}, h('b', {}, 'Catégorie A : mon classement'), h('ol', {}, s.A.map((id, i) => h('li', {}, `${titleOf(id)} (${POINTS[i]} pt${POINTS[i] > 1 ? 's' : ''})`)))),
      h('div', {}, h('b', {}, 'Catégorie B'), titleOf(s.B)),
      h('div', {}, h('b', {}, 'Catégorie C'), s.C === 1 ? 'Récompenser l’abstract' : 'Vote blanc'),
    ];
  }

  // ---------------------------------------------------------------- fin
  function doneView(ini, snapshot) {
    whoChip.textContent = `Connecté : ${ME.initials}`;
    whoChip.classList.remove('hidden');
    show(h('div', { class: 'panel print-ok' },
      h('h2', {}, `Merci ${ini}, votre vote est enregistré`),
      h('div', { class: 'okbox' }, 'Votre vote est anonyme et définitif. Votre bulletin n’est rattaché ni à votre identifiant ni à vos initiales.'),
      snapshot ? h('div', { class: 'recap' }, recapNodes(ini, snapshot)) : h('p', { class: 'lead' }, 'Vous avez déjà voté.'),
      snapshot ? h('p', { class: 'hint' }, 'Ce récapitulatif n’est affiché qu’ici : il ne sera plus consultable après fermeture de la page.') : null,
      h('div', { class: 'row' },
        h('a', { class: 'btn', href: '/resultats', target: '_blank', rel: 'noopener' }, 'Suivre le dépouillement'),
        h('button', { class: 'btn ghost', type: 'button', onclick: logout }, 'Se déconnecter'))));
  }

  function closedView() {
    show(h('div', { class: 'panel' }, h('h2', {}, 'Le scrutin est clos'), h('p', { class: 'lead' }, 'Il n’est plus possible de voter.'),
      h('button', { class: 'btn ghost', type: 'button', onclick: logout }, 'Se déconnecter')));
  }

  async function logout() {
    try { await api('/api/logout', {}); } catch (e) { /* ignoré */ }
    st.A = []; st.B = null; st.C = null;
    await boot();
  }

  async function boot() {
    try {
      ME = await api('/api/me');
    } catch (ex) {
      return show(h('div', { class: 'err' }, ex.message));
    }
    if (!ME.authenticated) return loginView();
    if (ME.voted) return doneView(ME.initials, null);
    if (!ME.open) return closedView();
    voteView();
  }

  boot();
})();
