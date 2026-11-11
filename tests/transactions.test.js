import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validate,
  migrate,
  expandRecurring,
  filterTransactions,
  sortTransactions,
} from "../src/domain/transactions.js";

const base = {
  description: "Mercado",
  amount: 15000,
  category: "Alimentação",
  date: "2026-03-10",
  type: "expense",
};

test("validate aceita uma transação completa", () => {
  assert.equal(validate(base).valid, true);
});

test("validate aponta cada campo problemático", () => {
  const { valid, errors } = validate({
    description: "   ",
    amount: 0,
    category: "",
    date: "10/03/2026",
    type: "saida",
  });
  assert.equal(valid, false);
  assert.ok(errors.description && errors.amount && errors.category);
  assert.ok(errors.date && errors.type);
});

test("validate recusa valor negativo ou não numérico", () => {
  assert.equal(validate({ ...base, amount: -1 }).valid, false);
  assert.equal(validate({ ...base, amount: null }).valid, false);
  assert.equal(validate({ ...base, amount: NaN }).valid, false);
});

test("migrate converte o formato antigo em reais para centavos", () => {
  const legacy = {
    id: 1700000000000,
    descricao: "Salário",
    valor: 3500.5,
    categoria: "Salário",
    tipo: "entrada",
    data: "01/03/2026",
    dataISO: "2026-03-01",
    recorrente: true,
  };
  const migrated = migrate(legacy);
  assert.equal(migrated.amount, 350050);
  assert.equal(migrated.type, "income");
  assert.equal(migrated.date, "2026-03-01");
  assert.equal(migrated.recurring, true);
  assert.equal(migrated.category, "Salário");
});

test("migrate reconstrói a data quando só existe o formato brasileiro", () => {
  const migrated = migrate({
    descricao: "Luz",
    valor: 120,
    categoria: "Moradia",
    tipo: "saida",
    data: "07/02/2026",
  });
  assert.equal(migrated.date, "2026-02-07");
});

test("migrate descarta registros irrecuperáveis", () => {
  assert.equal(migrate(null), null);
  assert.equal(migrate({ descricao: "sem data", valor: 10 }), null);
  assert.equal(migrate({ descricao: "sem valor", data: "01/01/2026" }), null);
});

test("migrate joga categorias desconhecidas em Outros", () => {
  const migrated = migrate({
    descricao: "x",
    valor: 1,
    categoria: "Criptomoedas",
    tipo: "saida",
    dataISO: "2026-01-01",
  });
  assert.equal(migrated.category, "Outros");
});

test("expandRecurring cria uma parcela por mês até o mês de referência", () => {
  const template = {
    ...base,
    id: "t1",
    description: "Aluguel",
    date: "2026-01-05",
    recurring: true,
    seriesId: null,
  };
  const created = expandRecurring([template], "2026-04");
  assert.deepEqual(
    created.map((t) => t.date),
    ["2026-02-05", "2026-03-05", "2026-04-05"]
  );
  assert.ok(created.every((t) => t.seriesId === "t1" && !t.recurring));
});

test("expandRecurring não duplica o que já foi gerado", () => {
  const template = {
    ...base,
    id: "t1",
    date: "2026-01-05",
    recurring: true,
    seriesId: null,
  };
  const existing = { ...base, id: "x", date: "2026-02-05", seriesId: "t1" };
  const created = expandRecurring([template, existing], "2026-03");
  assert.deepEqual(
    created.map((t) => t.date),
    ["2026-03-05"]
  );
});

test("expandRecurring respeita o fim do mês curto", () => {
  const template = {
    ...base,
    id: "t1",
    date: "2026-01-31",
    recurring: true,
    seriesId: null,
  };
  const created = expandRecurring([template], "2026-02");
  assert.deepEqual(created.map((t) => t.date), ["2026-02-28"]);
});

test("expandRecurring ignora transações comuns", () => {
  assert.deepEqual(expandRecurring([{ ...base, id: "a" }], "2026-12"), []);
});

const dataset = [
  { ...base, id: "1", date: "2026-03-01", description: "Mercado", type: "expense" },
  { ...base, id: "2", date: "2026-03-20", description: "Salário", type: "income", category: "Salário" },
  { ...base, id: "3", date: "2026-02-10", description: "Uber", category: "Transporte" },
  { ...base, id: "4", date: "2026-03-15", description: "Netflix", seriesId: "x" },
];

test("filterTransactions combina mês, tipo, busca e recorrência", () => {
  assert.equal(filterTransactions(dataset, { month: "2026-03" }).length, 3);
  assert.equal(
    filterTransactions(dataset, { month: "2026-03", type: "income" }).length,
    1
  );
  assert.equal(filterTransactions(dataset, { query: "uber" }).length, 1);
  assert.equal(
    filterTransactions(dataset, { query: "transporte" }).length,
    1,
    "a busca também olha a categoria"
  );
  assert.equal(filterTransactions(dataset, { onlyRecurring: true }).length, 1);
  assert.equal(filterTransactions(dataset, {}).length, 4);
});

test("sortTransactions ordena por data nos dois sentidos", () => {
  const desc = sortTransactions(dataset).map((t) => t.id);
  assert.equal(desc[0], "2");
  const asc = sortTransactions(dataset, "asc").map((t) => t.id);
  assert.equal(asc[0], "3");
});

test("sortTransactions não altera o array recebido", () => {
  const copy = [...dataset];
  sortTransactions(dataset);
  assert.deepEqual(dataset, copy);
});
