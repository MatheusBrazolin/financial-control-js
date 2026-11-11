/**
 * Orçamentos por mês.
 *
 * Guardar um único limite por categoria era um erro: baixar o teto de
 * Alimentação hoje reescrevia o passado, e meses já fechados passavam a
 * aparecer como estourados. Agora cada mês guarda os limites que valiam
 * nele:
 *
 *   { "2026-11": { "Alimentação": 60000 }, "2027-01": { ... } }
 *
 * Um mês sem registro próprio herda o mês definido mais recente antes
 * dele — então definir o limite uma vez vale para todos os meses
 * seguintes, até alguém mudar.
 */

import { CATEGORIES } from "./transactions.js";

/**
 * Chave onde entram os limites do formato antigo (sem mês). Por ser menor
 * que qualquer mês real, ela é herdada por todos — inclusive pelos meses
 * anteriores à migração, que é como o app se comportava antes.
 */
export const BASE_MONTH = "0000-00";

/** Limites que valem em `month`, já resolvendo a herança. */
export function budgetsFor(budgets, month) {
  const applicable = Object.keys(budgets || {})
    .filter((key) => key <= month)
    .sort();
  const latest = applicable[applicable.length - 1];
  return latest ? { ...budgets[latest] } : {};
}

/** Define (ou sobrescreve) um limite no mês, partindo do que já valia nele. */
export function setBudget(budgets, month, category, limitCents) {
  const base = budgetsFor(budgets, month);
  return {
    ...budgets,
    [month]: { ...base, [category]: limitCents },
  };
}

/**
 * Remove um limite a partir de `month`. Os meses anteriores continuam com
 * o que tinham — apagar um orçamento não reescreve o histórico.
 */
export function removeBudget(budgets, month, category) {
  const base = budgetsFor(budgets, month);
  delete base[category];
  return { ...budgets, [month]: base };
}

/** Normaliza o que veio do disco, migrando o formato antigo se preciso. */
export function normalizeBudgets(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  if (!Object.keys(raw).length) return {};

  // Formato antigo: { "Alimentação": 600 } — chaves são categorias, não
  // meses. Basta UMA chave em formato de mês para o objeto ser do formato
  // novo: assim uma chave corrompida não faz o arquivo inteiro ser lido
  // como legado (e os limites virarem categorias inventadas).
  const isLegacy = !Object.keys(raw).some((key) => /^\d{4}-\d{2}$/.test(key));
  const byMonth = isLegacy ? { [BASE_MONTH]: raw } : raw;

  const out = {};
  for (const [month, limits] of Object.entries(byMonth)) {
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (!limits || typeof limits !== "object") continue;

    const clean = {};
    for (const [category, value] of Object.entries(limits)) {
      if (!CATEGORIES.includes(category)) continue;
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0) continue;
      // Só o formato antigo guardava reais. Adivinhar a unidade pelo
      // tamanho do número quebrava o formato novo: um teto de R$ 100,00
      // (10000 centavos) viraria R$ 10.000 ao restaurar um backup.
      clean[category] = isLegacy ? Math.round(number * 100) : Math.round(number);
    }
    // Um mês pode ficar vazio de propósito: é assim que se zera a herança.
    out[month] = clean;
  }
  return out;
}
