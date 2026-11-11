import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, escapeCsv, toBackup, parseBackup } from "../src/domain/export.js";

const tx = {
  id: "1",
  date: "2026-03-07",
  description: "Mercado",
  category: "Alimentação",
  type: "expense",
  amount: 123456,
  tags: ["casa", "feira"],
  note: "sem a feira",
  recurring: false,
  seriesId: null,
};

test("escapeCsv protege campos com separador, aspas e quebra de linha", () => {
  assert.equal(escapeCsv("simples"), "simples");
  assert.equal(escapeCsv("a;b"), '"a;b"');
  assert.equal(escapeCsv('diz "oi"'), '"diz ""oi"""');
  assert.equal(escapeCsv("linha\nnova"), '"linha\nnova"');
  assert.equal(escapeCsv(null), "");
});

test("toCsv gera cabeçalho e linha no padrão brasileiro", () => {
  const [header, row] = toCsv([tx]).split("\r\n");
  assert.equal(
    header,
    "Data;Descrição;Categoria;Tipo;Valor;Etiquetas;Observação;Recorrente"
  );
  assert.equal(
    row,
    "07/03/2026;Mercado;Alimentação;Saída;1234,56;casa, feira;sem a feira;Não"
  );
});

test("toCsv não deixa uma descrição quebrar as colunas", () => {
  const linhas = toCsv([{ ...tx, description: 'Pão; "especial"' }]).split("\r\n");
  assert.equal(linhas.length, 2, "ainda são duas linhas");
  assert.ok(linhas[1].includes('"Pão; ""especial"""'));
});

test("toCsv marca parcelas de recorrência", () => {
  assert.ok(toCsv([{ ...tx, seriesId: "abc" }]).includes(";Sim"));
});

test("o backup faz a volta completa", () => {
  const original = { transactions: [tx], budgets: { Moradia: 100000 } };
  const restored = parseBackup(toBackup(original));
  assert.deepEqual(restored.transactions, original.transactions);
  assert.deepEqual(restored.budgets, original.budgets);
});

test("parseBackup recusa arquivos inválidos com mensagem legível", () => {
  assert.throws(() => parseBackup("não é json"), /JSON válido/);
  assert.throws(() => parseBackup('{"foo":1}'), /backup do Controle Financeiro/);
  assert.throws(() => parseBackup("null"), /backup do Controle Financeiro/);
});
