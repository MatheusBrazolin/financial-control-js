/**
 * Funções puras de data. Tudo trafega como string ISO "YYYY-MM-DD"
 * ou chave de mês "YYYY-MM", nunca como objeto Date mutável — assim
 * não existe surpresa de fuso horário (o bug clássico do toISOString()).
 */

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Data de hoje no fuso local, como "YYYY-MM-DD". */
export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Mês de hoje, como "YYYY-MM". */
export function currentMonth(now = new Date()) {
  return todayISO(now).slice(0, 7);
}

/** "2026-03-07" -> "2026-03" */
export function monthOf(iso) {
  return String(iso || "").slice(0, 7);
}

/** Soma (ou subtrai) meses de uma chave "YYYY-MM". */
export function addMonths(monthKey, delta) {
  const [y, m] = monthKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Quantidade de dias do mês "YYYY-MM". */
export function daysInMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** "2026-03" -> "março de 2026" */
export function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MESES[m - 1]} de ${y}`;
}

/** "2026-03" -> "mar/26" */
export function monthLabelShort(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MESES[m - 1].slice(0, 3)}/${String(y).slice(2)}`;
}

/** "2026-03-07" -> "07/03/2026" */
export function formatDate(iso) {
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Mesmo dia em outro mês, limitado ao último dia existente.
 * (31/01 + 1 mês = 28/02, e não 03/03.)
 */
export function sameDayInMonth(iso, monthKey) {
  const day = Number(String(iso).slice(8, 10));
  const max = daysInMonth(monthKey);
  return `${monthKey}-${String(Math.min(day, max)).padStart(2, "0")}`;
}

/** Lista de meses de `from` até `to`, inclusive. */
export function monthRange(from, to) {
  const out = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard++ < 1200) {
    out.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return out;
}
