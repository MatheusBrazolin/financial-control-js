import { test } from "node:test";
import assert from "node:assert/strict";
import {
  totals,
  byCategory,
  inMonth,
  insights,
  budgetStatus,
  compareMonths,
  monthlySeries,
} from "../src/domain/stats.js";

const tx = (id, date, type, amount, category = "Outros") => ({
  id,
  date,
  type,
  amount,
  category,
  description: `t${id}`,
  recurring: false,
  seriesId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const dataset = [
  tx("1", "2026-03-01", "income", 500000, "Salário"),
  tx("2", "2026-03-05", "expense", 120000, "Moradia"),
  tx("3", "2026-03-10", "expense", 45000, "Alimentação"),
  tx("4", "2026-03-18", "expense", 15000, "Alimentação"),
  tx("5", "2026-02-02", "expense", 90000, "Moradia"),
  tx("6", "2026-02-02", "income", 480000, "Salário"),
];

test("totals soma entradas, saídas e saldo", () => {
  const result = totals(dataset);
  assert.equal(result.income, 980000);
  assert.equal(result.expense, 270000);
  assert.equal(result.balance, 710000);
});

test("totals de lista vazia é zero", () => {
  assert.deepEqual(totals([]), { income: 0, expense: 0, balance: 0 });
});

test("byCategory agrupa, ordena e calcula a participação", () => {
  const result = byCategory(inMonth(dataset, "2026-03"));
  assert.deepEqual(
    result.map((c) => c.category),
    ["Moradia", "Alimentação"]
  );
  assert.equal(result[0].amount, 120000);
  assert.equal(result[1].amount, 60000, "soma as duas de Alimentação");
  assert.equal(Math.round(result[0].share * 100), 67);
});

test("insights olham só o mês pedido", () => {
  const result = insights(dataset, "2026-03", "2026-03-20");
  assert.equal(result.income, 500000);
  assert.equal(result.expense, 180000);
  assert.equal(result.balance, 320000);
  assert.equal(result.topCategory.category, "Moradia");
  assert.equal(result.biggestExpense.id, "2");
});

test("insights comparam com o mês anterior", () => {
  const result = insights(dataset, "2026-03", "2026-03-20");
  assert.equal(result.previousExpense, 90000);
  assert.equal(result.expenseDelta, 90000);
  assert.equal(Math.round(result.expenseDeltaPercent), 100);
});

test("a média diária usa os dias decorridos, não o mês inteiro", () => {
  // 180000 centavos em 20 dias = 9000/dia; projeção = 9000 * 31.
  const result = insights(dataset, "2026-03", "2026-03-20");
  assert.equal(result.dailyAverage, 9000);
  assert.equal(result.daysElapsed, 20);
  assert.equal(result.daysRemaining, 11);
  assert.equal(result.projection, 9000 * 31);
});

test("em mês passado a média usa o mês fechado", () => {
  const result = insights(dataset, "2026-02", "2026-03-20");
  assert.equal(result.daysElapsed, 28);
  assert.equal(result.daysRemaining, 0);
});

test("o maior gasto nunca é uma entrada", () => {
  const result = insights(
    [tx("a", "2026-05-01", "income", 999999), tx("b", "2026-05-02", "expense", 100)],
    "2026-05",
    "2026-05-10"
  );
  assert.equal(result.biggestExpense.id, "b");
});

test("mês sem movimento devolve indicadores vazios, não erro", () => {
  const result = insights(dataset, "2026-09", "2026-09-15");
  assert.equal(result.expense, 0);
  assert.equal(result.biggestExpense, null);
  assert.equal(result.topCategory, null);
  assert.equal(result.savingsRate, null);
});

test("budgetStatus compara o limite com o gasto DO MÊS", () => {
  const budgets = { Moradia: 100000, Alimentação: 80000 };
  const [first, second] = budgetStatus(dataset, budgets, "2026-03");

  assert.equal(first.category, "Moradia");
  assert.equal(first.used, 120000);
  assert.equal(first.status, "over");
  assert.equal(first.remaining, -20000);

  assert.equal(second.category, "Alimentação");
  assert.equal(second.used, 60000);
  assert.equal(second.status, "ok", "75% do limite ainda está ok");
});

test("budgetStatus separa ok, alerta e estouro", () => {
  const gastos = [tx("a", "2026-03-01", "expense", 80000, "Lazer")];
  assert.equal(budgetStatus(gastos, { Lazer: 200000 }, "2026-03")[0].status, "ok");
  assert.equal(
    budgetStatus(gastos, { Lazer: 100000 }, "2026-03")[0].status,
    "warning",
    "80% já é alerta"
  );
  assert.equal(budgetStatus(gastos, { Lazer: 50000 }, "2026-03")[0].status, "over");
});

test("budgetStatus ignora gastos de outros meses", () => {
  const [item] = budgetStatus(dataset, { Moradia: 200000 }, "2026-02");
  assert.equal(item.used, 90000, "só fevereiro, não os 120000 de março");
});

test("compareMonths devolve deltas e percentuais", () => {
  const result = compareMonths(dataset, "2026-02", "2026-03");
  assert.equal(result.delta.income, 20000);
  assert.equal(result.delta.expense, 90000);
  assert.equal(Math.round(result.percent.expense), 100);
});

test("monthlySeries devolve exatamente os meses pedidos, em ordem", () => {
  const series = monthlySeries(dataset, "2026-03", 3);
  assert.deepEqual(
    series.map((s) => s.month),
    ["2026-01", "2026-02", "2026-03"]
  );
  assert.equal(series[0].income, 0);
  assert.equal(series[1].expense, 90000);
  assert.equal(series[2].balance, 320000);
});
