import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAmount,
  formatMoney,
  formatSigned,
  percentChange,
} from "../src/domain/money.js";

test("parseAmount aceita os formatos que o usuário digita", () => {
  assert.equal(parseAmount("50"), 5000);
  assert.equal(parseAmount("50,5"), 5050);
  assert.equal(parseAmount("1.234,56"), 123456);
  assert.equal(parseAmount("1234.56"), 123456);
  assert.equal(parseAmount("R$ 1.234,56"), 123456);
  assert.equal(parseAmount(" 99,99 "), 9999);
  assert.equal(parseAmount("1.234"), 123400, "ponto de milhar não é decimal");
  assert.equal(parseAmount(12.34), 1234);
});

test("parseAmount rejeita entradas inválidas", () => {
  for (const input of ["", "   ", "abc", "R$", "1,2,3", ".", "-", null, undefined, {}]) {
    assert.equal(parseAmount(input), null, `deveria rejeitar: ${JSON.stringify(input)}`);
  }
});

test("parseAmount não acumula erro de ponto flutuante", () => {
  // 0.1 + 0.2 em float dá 0.30000000000000004; em centavos, dá 30 exato.
  assert.equal(parseAmount("0,10") + parseAmount("0,20"), 30);
});

test("formatMoney usa o padrão brasileiro", () => {
  assert.match(formatMoney(123456), /^R\$\s?1\.234,56$/);
  assert.match(formatMoney(0), /^R\$\s?0,00$/);
  assert.match(formatMoney(-500), /^-?R\$\s?-?5,00$/);
});

test("formatSigned marca valores positivos com +", () => {
  assert.ok(formatSigned(500).startsWith("+"));
  assert.ok(!formatSigned(-500).startsWith("+"));
  assert.ok(!formatSigned(0).startsWith("+"));
});

test("percentChange trata o divisor zero", () => {
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(0, 100), null);
  assert.equal(percentChange(100, 150), 50);
  assert.equal(percentChange(100, 50), -50);
});
