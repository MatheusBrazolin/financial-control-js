/**
 * Testes do store.
 *
 * O store fala com o localStorage, que não existe no Node — então aqui
 * ele é substituído por um dublê que também sabe simular cota cheia.
 * É o jeito de testar migração, recorrência e falha de gravação sem
 * navegador e sem dependência nenhuma.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

class FakeStorage {
  #data = new Map();
  full = false; // vira true para simular cota estourada

  getItem(key) {
    return this.#data.has(key) ? this.#data.get(key) : null;
  }
  setItem(key, value) {
    if (this.full) {
      const error = new Error("QuotaExceededError");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.#data.set(key, String(value));
  }
  removeItem(key) {
    this.#data.delete(key);
  }
  clear() {
    this.#data.clear();
  }
  get length() {
    return this.#data.size;
  }
  raw(key) {
    const value = this.getItem(key);
    return value === null ? null : JSON.parse(value);
  }
}

const storage = new FakeStorage();
globalThis.localStorage = storage;

// O store guarda estado de módulo, então só pode ser importado depois do
// stub existir — e uma vez só, para todos os testes.
const { store } = await import("../src/core/store.js");
const { budgetsFor } = await import("../src/domain/budgets.js");
const { currentMonth, addMonths } = await import("../src/domain/dates.js");

const HOJE = currentMonth();

beforeEach(() => {
  storage.clear();
  storage.full = false;
  store.clearAll();
  store.clearFilters();
  store.setMonth(HOJE);
});

const despesa = (patch = {}) => ({
  description: "Mercado",
  amount: 15000,
  category: "Alimentação",
  type: "expense",
  date: `${HOJE}-10`,
  tags: [],
  note: "",
  recurring: false,
  recurringUntil: null,
  ...patch,
});

// ── migração ──────────────────────────────────────────────────────

test("init migra os dados do formato antigo guardados pelo app v1", () => {
  storage.clear();
  storage.setItem(
    "transacoes",
    JSON.stringify([
      {
        id: 1700000000000,
        descricao: "Salário",
        valor: 3500.5,
        categoria: "Salário",
        tipo: "entrada",
        dataISO: "2026-01-05",
        recorrente: false,
      },
    ])
  );
  storage.setItem("orcamentos", JSON.stringify({ Alimentação: 600 }));

  store.init();

  assert.equal(store.state.transactions.length, 1);
  assert.equal(store.state.transactions[0].amount, 350050, "reais → centavos");
  assert.equal(store.state.transactions[0].type, "income");
  assert.equal(
    budgetsFor(store.state.budgets, "2026-01").Alimentação,
    60000,
    "o orçamento antigo vale em qualquer mês"
  );
});

test("init ignora um localStorage corrompido em vez de quebrar", () => {
  storage.clear();
  storage.setItem("fc:transactions", "{isso não é json");
  storage.setItem("fc:budgets", "[1,2,3]");
  storage.setItem("fc:goals", "null");

  assert.doesNotThrow(() => store.init());
  assert.deepEqual(store.state.transactions, []);
  assert.deepEqual(store.state.budgets, {});
  assert.deepEqual(store.state.goals, []);
});

// ── persistência ──────────────────────────────────────────────────

test("o que é adicionado vai para o disco", () => {
  store.addTransaction(despesa());
  assert.equal(storage.raw("fc:transactions").length, 1);
  assert.equal(storage.raw("fc:transactions")[0].description, "Mercado");
});

test("quando a gravação falha, o dado continua em memória e o app avisa", () => {
  let avisos = 0;
  store.onPersistFailure(() => avisos++);

  storage.full = true;
  const { transaction } = store.addTransaction(despesa({ description: "Uber" }));

  assert.equal(avisos, 1, "o app é avisado na hora");
  assert.equal(store.state.persistent, false);
  assert.ok(transaction, "a transação existe…");
  assert.equal(
    store.state.transactions.at(-1).description,
    "Uber",
    "…e continua utilizável em memória"
  );
  assert.ok(
    !storage.raw("fc:transactions").some((t) => t.description === "Uber"),
    "mas o disco continua com o conteúdo anterior"
  );

  // Não insiste em avisar a cada lançamento seguinte.
  store.addTransaction(despesa());
  assert.equal(avisos, 1);

  store.onPersistFailure(() => {});
});

// ── recorrência ───────────────────────────────────────────────────

test("adicionar uma recorrência antiga gera as parcelas até hoje", () => {
  const tresMesesAtras = addMonths(HOJE, -3);
  const { generated } = store.addTransaction(
    despesa({ date: `${tresMesesAtras}-05`, description: "Aluguel", recurring: true })
  );

  assert.equal(generated, 3, "os três meses seguintes");
  const serie = store.state.transactions.filter((t) => t.description === "Aluguel");
  assert.equal(serie.length, 4, "o modelo mais as três parcelas");
});

test("tornar recorrente pela edição também gera as parcelas", () => {
  const doisMesesAtras = addMonths(HOJE, -2);
  const { transaction } = store.addTransaction(
    despesa({ date: `${doisMesesAtras}-05`, description: "Internet" })
  );
  assert.equal(store.state.transactions.length, 1);

  const { generated } = store.updateTransaction(transaction.id, { recurring: true });
  assert.equal(generated, 2);
});

test("recorrência não duplica parcelas a cada init", () => {
  const tresMesesAtras = addMonths(HOJE, -3);
  store.addTransaction(despesa({ date: `${tresMesesAtras}-05`, recurring: true }));
  const antes = store.state.transactions.length;

  store.init();
  store.init();

  assert.equal(store.state.transactions.length, antes);
});

test("encerrar a recorrência apaga só as parcelas futuras", () => {
  const doisMesesAtras = addMonths(HOJE, -2);
  const { transaction } = store.addTransaction(
    despesa({ date: `${doisMesesAtras}-05`, recurring: true })
  );

  const removidas = store.stopRecurrence(transaction.id, addMonths(HOJE, -1));

  assert.equal(removidas, 1, "a parcela do mês corrente");
  assert.ok(
    store.state.transactions.some((t) => t.date.startsWith(addMonths(HOJE, -1))),
    "a do mês anterior fica"
  );
  // E não volta no próximo init.
  store.init();
  assert.ok(!store.state.transactions.some((t) => t.date.startsWith(HOJE)));
});

// ── excluir e desfazer ────────────────────────────────────────────

test("excluir uma recorrência leva a série junto, e desfazer traz tudo de volta", () => {
  const doisMesesAtras = addMonths(HOJE, -2);
  const { transaction } = store.addTransaction(
    despesa({ date: `${doisMesesAtras}-05`, recurring: true })
  );
  const total = store.state.transactions.length;

  const removidas = store.removeTransaction(transaction.id, { withSeries: true });
  assert.equal(removidas.length, total);
  assert.equal(store.state.transactions.length, 0);

  store.undoDelete();
  assert.equal(store.state.transactions.length, total);
});

test("desfazer sem nada excluído não faz nada", () => {
  assert.equal(store.undoDelete(), false);
});

// ── orçamentos ────────────────────────────────────────────────────

test("o orçamento é gravado no mês aberto e não reescreve o passado", () => {
  store.setMonth("2026-01");
  store.setBudget("Alimentação", 60000);

  store.setMonth("2026-11");
  store.setBudget("Alimentação", 40000);

  assert.equal(store.budgetsOfMonth("2026-03").Alimentação, 60000);
  assert.equal(store.budgetsOfMonth("2026-11").Alimentação, 40000);
});

// ── metas ─────────────────────────────────────────────────────────

test("meta aceita aportes e os soma", () => {
  const goal = store.addGoal({ name: "Viagem", target: 500000, deadline: "2027-06" });
  store.addContribution(goal.id, { date: `${HOJE}-05`, amount: 100000 });
  store.addContribution(goal.id, { date: `${HOJE}-20`, amount: 50000 });

  const salvo = store.state.goals[0].contributions.reduce((s, c) => s + c.amount, 0);
  assert.equal(salvo, 150000);
  assert.equal(storage.raw("fc:goals")[0].contributions.length, 2);
});

test("meta inválida não entra", () => {
  assert.equal(store.addGoal({ name: "", target: 0 }), null);
  assert.equal(store.state.goals.length, 0);
});

// ── backup ────────────────────────────────────────────────────────

test("replaceAll troca tudo e normaliza o que veio do arquivo", () => {
  store.addTransaction(despesa());

  const count = store.replaceAll({
    transactions: [
      { descricao: "Antigo", valor: 10, categoria: "Lazer", tipo: "saida", dataISO: "2026-02-01" },
      { lixo: true },
    ],
    budgets: { "2026-02": { Lazer: 10000 } },
    goals: [{ name: "Meta", target: 1000, contributions: [] }],
  });

  assert.equal(count, 1, "o registro inválido é descartado");
  assert.equal(store.state.transactions[0].description, "Antigo");
  assert.equal(store.budgetsOfMonth("2026-02").Lazer, 10000);
  assert.equal(store.state.goals.length, 1);
});

test("clearAll zera transações, orçamentos e metas", () => {
  store.addTransaction(despesa());
  store.setBudget("Lazer", 10000);
  store.addGoal({ name: "X", target: 100 });

  store.clearAll();

  assert.deepEqual(store.state.transactions, []);
  assert.deepEqual(store.state.budgets, {});
  assert.deepEqual(store.state.goals, []);
});

// ── assinantes ────────────────────────────────────────────────────

test("quem assina é avisado a cada mudança, e para ao cancelar", () => {
  let avisos = 0;
  const unsubscribe = store.subscribe(() => avisos++);

  store.addTransaction(despesa());
  store.setMonth("2026-01");
  assert.equal(avisos, 2);

  unsubscribe();
  store.addTransaction(despesa());
  assert.equal(avisos, 2);
});
