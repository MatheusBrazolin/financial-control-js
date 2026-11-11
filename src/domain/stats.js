/**
 * Estatísticas puras. Nenhuma destas funções toca o DOM nem o localStorage —
 * é por isso que todas são testáveis com `npm test`.
 */

import {
  monthOf,
  addMonths,
  daysInMonth,
  currentMonth,
  todayISO,
} from "./dates.js";
import { percentChange } from "./money.js";

/** Soma entradas, saídas e saldo (em centavos) de uma lista. */
export function totals(transactions) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

/** Gastos agrupados por categoria, do maior para o menor. */
export function byCategory(transactions, type = "expense") {
  const map = new Map();
  for (const t of transactions) {
    if (t.type !== type) continue;
    map.set(t.category, (map.get(t.category) || 0) + t.amount);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      share: total ? amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Transações de um mês específico. */
export function inMonth(transactions, month) {
  return transactions.filter((t) => monthOf(t.date) === month);
}

/**
 * Os quatro indicadores do topo do dashboard.
 * `today` existe para os testes poderem congelar a data.
 */
export function insights(transactions, month = currentMonth(), today = todayISO()) {
  const current = inMonth(transactions, month);
  const previous = inMonth(transactions, addMonths(month, -1));

  const expenses = current.filter((t) => t.type === "expense");
  const currentTotals = totals(current);
  const previousTotals = totals(previous);

  const biggest = expenses.reduce(
    (max, t) => (!max || t.amount > max.amount ? t : max),
    null
  );

  const top = byCategory(current)[0] || null;

  const days = daysInMonth(month);
  const isCurrentMonth = month === today.slice(0, 7);
  const elapsed = isCurrentMonth ? Number(today.slice(8, 10)) : days;
  const dailyAverage = elapsed ? Math.round(currentTotals.expense / elapsed) : 0;
  const projection = dailyAverage * days;

  return {
    month,
    ...currentTotals,
    savingsRate: currentTotals.income
      ? currentTotals.balance / currentTotals.income
      : null,
    biggestExpense: biggest,
    topCategory: top,
    dailyAverage,
    projection,
    daysElapsed: elapsed,
    daysRemaining: Math.max(days - elapsed, 0),
    previousExpense: previousTotals.expense,
    expenseDelta: currentTotals.expense - previousTotals.expense,
    expenseDeltaPercent: percentChange(
      previousTotals.expense,
      currentTotals.expense
    ),
  };
}

/** Situação de cada orçamento no mês: gasto, limite, % e status. */
export function budgetStatus(transactions, budgets, month) {
  const spent = new Map(
    byCategory(inMonth(transactions, month)).map((c) => [c.category, c.amount])
  );
  return Object.entries(budgets)
    .map(([category, limit]) => {
      const used = spent.get(category) || 0;
      const ratio = limit ? used / limit : 0;
      return {
        category,
        limit,
        used,
        remaining: limit - used,
        ratio,
        status: ratio > 1 ? "over" : ratio >= 0.8 ? "warning" : "ok",
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/** Comparação lado a lado de dois meses. */
export function compareMonths(transactions, monthA, monthB) {
  const a = totals(inMonth(transactions, monthA));
  const b = totals(inMonth(transactions, monthB));
  return {
    monthA,
    monthB,
    a,
    b,
    delta: {
      income: b.income - a.income,
      expense: b.expense - a.expense,
      balance: b.balance - a.balance,
    },
    percent: {
      income: percentChange(a.income, b.income),
      expense: percentChange(a.expense, b.expense),
      balance: percentChange(a.balance, b.balance),
    },
  };
}

/** Série mensal (entradas, saídas, saldo) dos últimos `count` meses. */
export function monthlySeries(transactions, until = currentMonth(), count = 12) {
  const months = [];
  for (let i = count - 1; i >= 0; i--) months.push(addMonths(until, -i));

  const buckets = new Map(
    months.map((m) => [m, { month: m, income: 0, expense: 0, balance: 0 }])
  );
  for (const t of transactions) {
    const bucket = buckets.get(monthOf(t.date));
    if (!bucket) continue;
    if (t.type === "income") bucket.income += t.amount;
    else bucket.expense += t.amount;
  }
  for (const bucket of buckets.values()) {
    bucket.balance = bucket.income - bucket.expense;
  }
  return months.map((m) => buckets.get(m));
}
