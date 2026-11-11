import { test } from "node:test";
import assert from "node:assert/strict";
import {
  todayISO,
  currentMonth,
  addMonths,
  daysInMonth,
  monthLabel,
  formatDate,
  sameDayInMonth,
  monthRange,
} from "../src/domain/dates.js";

test("todayISO usa o fuso local, não UTC", () => {
  // 1º de janeiro às 00:30 no horário de Brasília ainda é 03:30 UTC do dia 1,
  // mas às 21:30 do dia 31 o toISOString() viraria o dia — por isso não o usamos.
  const date = new Date(2026, 0, 1, 0, 30);
  assert.equal(todayISO(date), "2026-01-01");
  assert.equal(currentMonth(date), "2026-01");

  const lateNight = new Date(2025, 11, 31, 21, 30);
  assert.equal(todayISO(lateNight), "2025-12-31");
});

test("addMonths atravessa a virada do ano", () => {
  assert.equal(addMonths("2026-01", 1), "2026-02");
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-06", -18), "2024-12");
});

test("daysInMonth conhece anos bissextos", () => {
  assert.equal(daysInMonth("2026-02"), 28);
  assert.equal(daysInMonth("2024-02"), 29);
  assert.equal(daysInMonth("2026-01"), 31);
  assert.equal(daysInMonth("2026-04"), 30);
});

test("sameDayInMonth não estoura para o mês seguinte", () => {
  assert.equal(sameDayInMonth("2026-01-31", "2026-02"), "2026-02-28");
  assert.equal(sameDayInMonth("2026-01-15", "2026-03"), "2026-03-15");
  assert.equal(sameDayInMonth("2024-01-31", "2024-02"), "2024-02-29");
});

test("rótulos e formatação", () => {
  assert.equal(monthLabel("2026-03"), "março de 2026");
  assert.equal(formatDate("2026-03-07"), "07/03/2026");
});

test("monthRange lista os meses do intervalo", () => {
  assert.deepEqual(monthRange("2025-11", "2026-02"), [
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
  ]);
  assert.deepEqual(monthRange("2026-02", "2026-02"), ["2026-02"]);
  assert.deepEqual(monthRange("2026-03", "2026-01"), []);
});
