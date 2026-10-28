'use strict';
const { JURORS } = require('./config');

// Normalise des initiales saisies : « l.p », « Lp », « é m » → « LP », « EM »
function normalizeInitials(raw) {
  return String(raw || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s.\-']/g, '').toUpperCase();
}
const findJurorById = (id) => JURORS.find((j) => j.id === id) || null;
const findJurorByInitials = (raw) => {
  const n = normalizeInitials(raw);
  return n ? JURORS.find((j) => j.initials === n) || null : null;
};

module.exports = { normalizeInitials, findJurorById, findJurorByInitials };
