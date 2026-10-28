'use strict';
const { JURY_SIZE, CATEGORIES, abstracts, EVENT } = require('./config');
const { computeResults } = require('./scoring');

const titleOf = (id) => Object.values(abstracts).flat().find((a) => a.id === id)?.title || '';

// Données de la page publique /resultats : initiales de ceux qui ont voté puis,
// une fois les JURY_SIZE jurés passés, les lauréats et le détail des points
// (jamais les bulletins individuels).
async function buildProgress(store) {
  const voters = await store.listVoters();
  voters.sort((a, b) => a.at.localeCompare(b.at));
  const out = {
    size: JURY_SIZE,
    count: voters.length,
    open: true,
    complete: voters.length >= JURY_SIZE,
    voters: voters.map((v) => v.initials),
    event: EVENT,
  };
  if (!out.complete) return out;

  const r = computeResults(await store.listBallots(), abstracts);
  const mk = (cat, status, ids) => ({
    category: cat,
    label: CATEGORIES[cat].label,
    who: CATEGORIES[cat].who,
    status, // winner | exaequo | not_awarded | tie | none
    winners: ids.map((id) => ({ id, title: titleOf(id) })),
  });
  out.winners = [
    mk('A', r.A.outcome.status, r.A.outcome.ids),
    mk('B', r.B.outcome.status, r.B.outcome.ids),
    mk('C', r.C.outcome.status, r.C.outcome.status === 'winner' ? abstracts.C.map((a) => a.id) : []),
  ];
  out.details = {
    A: r.A.rows.map((x) => ({ id: x.id, title: x.title, points: x.points, r1: x.r1, r2: x.r2, r3: x.r3, position: x.position })),
    B: r.B.rows.map((x) => ({ id: x.id, title: x.title, votes: x.votes, position: x.position })),
    C: { reward: r.C.reward, blank: r.C.blank },
  };
  return out;
}

module.exports = { buildProgress };
