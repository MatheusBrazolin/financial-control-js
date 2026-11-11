import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateGoal,
  normalizeGoals,
  saved,
  goalProgress,
  monthsBetween,
  addContribution,
  removeContribution,
  projectedMonth,
} from "../src/domain/goals.js";

const meta = (patch = {}) => ({
  id: "g1",
  name: "Reserva de emergência",
  target: 1000000, // R$ 10.000
  deadline: "2027-06",
  contributions: [],
  createdAt: "2026-11-01T00:00:00.000Z",
  ...patch,
});

test("validateGoal exige nome e alvo", () => {
  assert.equal(validateGoal({ name: "Viagem", target: 500000 }).valid, true);

  const { valid, errors } = validateGoal({ name: "  ", target: 0 });
  assert.equal(valid, false);
  assert.ok(errors.name && errors.target);

  assert.equal(validateGoal({ name: "x", target: -1 }).valid, false);
  assert.equal(
    validateGoal({ name: "x", target: 100, deadline: "2027" }).valid,
    false
  );
});

test("monthsBetween conta meses nos dois sentidos", () => {
  assert.equal(monthsBetween("2026-11", "2027-06"), 7);
  assert.equal(monthsBetween("2026-11", "2026-11"), 0);
  assert.equal(monthsBetween("2027-01", "2026-11"), -2);
});

test("saved soma os aportes", () => {
  const goal = meta({
    contributions: [
      { id: "a", date: "2026-11-05", amount: 100000 },
      { id: "b", date: "2026-12-05", amount: 50000 },
    ],
  });
  assert.equal(saved(goal), 150000);
});

test("goalProgress calcula o quanto falta por mês", () => {
  const goal = meta({
    contributions: [{ id: "a", date: "2026-11-05", amount: 200000 }],
  });
  const p = goalProgress(goal, "2026-11");

  assert.equal(p.saved, 200000);
  assert.equal(p.remaining, 800000);
  assert.equal(p.monthsLeft, 8, "de novembro a junho, contando novembro");
  assert.equal(p.perMonth, 100000, "R$ 1.000 por mês");
});

test("goalProgress compara com o ritmo esperado", () => {
  // Prazo de 8 meses; no 1º mês, esperado = 1/8 do alvo = R$ 1.250.
  const atrasada = meta({
    contributions: [{ id: "a", date: "2026-11-05", amount: 50000 }],
  });
  assert.equal(goalProgress(atrasada, "2026-11").status, "behind");

  const emDia = meta({
    contributions: [{ id: "a", date: "2026-11-05", amount: 200000 }],
  });
  assert.equal(goalProgress(emDia, "2026-11").status, "on-track");
});

test("goalProgress marca concluída e nunca passa de 100% no que falta", () => {
  const goal = meta({
    contributions: [{ id: "a", date: "2026-11-05", amount: 1200000 }],
  });
  const p = goalProgress(goal, "2026-11");
  assert.equal(p.done, true);
  assert.equal(p.status, "done");
  assert.equal(p.remaining, 0, "não existe 'falta -R$ 2.000'");
  assert.ok(p.ratio > 1, "mas o ratio mostra que passou do alvo");
});

test("goalProgress marca atraso quando o prazo já passou", () => {
  const goal = meta({ deadline: "2026-10" });
  assert.equal(goalProgress(goal, "2026-12").status, "late");
});

test("goalProgress funciona sem prazo", () => {
  const p = goalProgress(meta({ deadline: null }), "2026-11");
  assert.equal(p.status, "no-deadline");
  assert.equal(p.monthsLeft, null);
  assert.equal(p.perMonth, null);
});

test("addContribution mantém os aportes em ordem de data", () => {
  let goal = meta();
  goal = addContribution(goal, { date: "2026-12-10", amount: 1000 });
  goal = addContribution(goal, { date: "2026-11-02", amount: 2000 });
  assert.deepEqual(
    goal.contributions.map((c) => c.date),
    ["2026-11-02", "2026-12-10"]
  );
});

test("removeContribution tira só o aporte pedido", () => {
  let goal = addContribution(meta(), { date: "2026-11-02", amount: 2000 });
  const [first] = goal.contributions;
  goal = addContribution(goal, { date: "2026-11-03", amount: 3000 });
  goal = removeContribution(goal, first.id);

  assert.equal(goal.contributions.length, 1);
  assert.equal(saved(goal), 3000);
});

test("projectedMonth estima o fim no ritmo dos aportes", () => {
  const goal = meta({
    target: 400000,
    contributions: [
      { id: "a", date: "2026-10-05", amount: 100000 },
      { id: "b", date: "2026-11-05", amount: 100000 },
    ],
  });
  // R$ 1.000/mês de média, faltam R$ 2.000 → mais 2 meses.
  assert.equal(projectedMonth(goal, "2026-11"), "2027-01");
});

test("projectedMonth não chuta sem aporte nenhum", () => {
  assert.equal(projectedMonth(meta(), "2026-11"), null);
});

test("normalizeGoals descarta metas e aportes inválidos", () => {
  const goals = normalizeGoals([
    meta(),
    { name: "sem alvo" },
    null,
    { name: "alvo zero", target: 0 },
    meta({
      id: "g2",
      contributions: [
        { id: "ok", date: "2026-11-01", amount: 100 },
        { id: "sem data", amount: 100 },
        { id: "valor zero", date: "2026-11-01", amount: 0 },
      ],
    }),
  ]);

  assert.equal(goals.length, 2);
  assert.equal(goals[1].contributions.length, 1);
});

test("normalizeGoals aguenta entrada inválida", () => {
  assert.deepEqual(normalizeGoals(null), []);
  assert.deepEqual(normalizeGoals({}), []);
});
