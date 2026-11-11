import { test } from "node:test";
import assert from "node:assert/strict";
import {
  budgetsFor,
  setBudget,
  removeBudget,
  normalizeBudgets,
  BASE_MONTH,
} from "../src/domain/budgets.js";

test("budgetsFor herda o mês definido mais recente", () => {
  const budgets = {
    "2026-01": { Alimentação: 60000 },
    "2026-06": { Alimentação: 80000, Lazer: 20000 },
  };
  assert.deepEqual(budgetsFor(budgets, "2026-03"), { Alimentação: 60000 });
  assert.deepEqual(budgetsFor(budgets, "2026-06"), {
    Alimentação: 80000,
    Lazer: 20000,
  });
  assert.deepEqual(budgetsFor(budgets, "2027-01"), {
    Alimentação: 80000,
    Lazer: 20000,
  });
});

test("budgetsFor devolve vazio antes do primeiro mês definido", () => {
  assert.deepEqual(budgetsFor({ "2026-06": { Lazer: 1 } }, "2026-05"), {});
  assert.deepEqual(budgetsFor({}, "2026-05"), {});
  assert.deepEqual(budgetsFor(null, "2026-05"), {});
});

test("mudar o limite hoje NÃO reescreve os meses passados", () => {
  // Era exatamente esse o defeito do formato antigo.
  let budgets = setBudget({}, "2026-01", "Alimentação", 60000);
  budgets = setBudget(budgets, "2026-11", "Alimentação", 40000);

  assert.equal(budgetsFor(budgets, "2026-03").Alimentação, 60000);
  assert.equal(budgetsFor(budgets, "2026-11").Alimentação, 40000);
});

test("setBudget parte do que já valia no mês", () => {
  const budgets = setBudget(
    { "2026-01": { Alimentação: 60000, Moradia: 150000 } },
    "2026-05",
    "Lazer",
    20000
  );
  assert.deepEqual(budgetsFor(budgets, "2026-05"), {
    Alimentação: 60000,
    Moradia: 150000,
    Lazer: 20000,
  });
});

test("setBudget não altera o objeto recebido", () => {
  const original = { "2026-01": { Lazer: 1000 } };
  const copy = structuredClone(original);
  setBudget(original, "2026-02", "Lazer", 5000);
  assert.deepEqual(original, copy);
});

test("removeBudget vale do mês em diante, preservando o passado", () => {
  let budgets = setBudget({}, "2026-01", "Lazer", 20000);
  budgets = removeBudget(budgets, "2026-06", "Lazer");

  assert.equal(budgetsFor(budgets, "2026-03").Lazer, 20000);
  assert.equal(budgetsFor(budgets, "2026-06").Lazer, undefined);
  assert.equal(budgetsFor(budgets, "2027-01").Lazer, undefined);
});

test("normalizeBudgets migra o formato antigo sem mês", () => {
  const migrated = normalizeBudgets({ Alimentação: 600, Moradia: 1500 });
  assert.deepEqual(Object.keys(migrated), [BASE_MONTH]);
  // Reais viram centavos…
  assert.equal(migrated[BASE_MONTH].Alimentação, 60000);
  // …e, por herdar de um mês anterior a tudo, valem em qualquer mês.
  assert.equal(budgetsFor(migrated, "2024-01").Moradia, 150000);
  assert.equal(budgetsFor(migrated, "2030-12").Moradia, 150000);
});

test("normalizeBudgets mantém o formato novo e descarta lixo", () => {
  const normalized = normalizeBudgets({
    "2026-11": { Alimentação: 60000, Criptomoedas: 999, Lazer: -5, Moradia: "x" },
    "mês errado": { Lazer: 100 },
    "2026-12": null,
  });
  assert.deepEqual(Object.keys(normalized), ["2026-11"]);
  assert.deepEqual(normalized["2026-11"], { Alimentação: 60000 });
});

test("normalizeBudgets aguenta entrada inválida", () => {
  assert.deepEqual(normalizeBudgets(null), {});
  assert.deepEqual(normalizeBudgets("texto"), {});
  assert.deepEqual(normalizeBudgets({}), {});
});

test("restaurar backup não multiplica centavos por 100", () => {
  // O formato novo já está em centavos: um teto de R$ 100,00 tem que
  // continuar R$ 100,00, e não virar R$ 10.000 ao voltar de um backup.
  const restored = normalizeBudgets({ "2026-11": { Lazer: 10000 } });
  assert.equal(restored["2026-11"].Lazer, 10000);
});
