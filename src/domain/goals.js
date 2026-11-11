/**
 * Metas de economia.
 *
 * Uma meta tem um alvo, um prazo opcional e os aportes que você foi
 * fazendo. O progresso vem da soma dos aportes — não de adivinhar quais
 * transações "contam" como poupança, que seria um palpite errado na
 * metade das vezes.
 */

import { currentMonth, addMonths, monthOf } from "./dates.js";
import { newId } from "./transactions.js";

/**
 * {
 *   id, name, target (centavos), deadline "YYYY-MM"|null,
 *   contributions: [{ id, date: "YYYY-MM-DD", amount }],
 *   createdAt
 * }
 */

export function validateGoal({ name, target, deadline }) {
  const errors = {};
  if (!name || !name.trim()) errors.name = "Dê um nome à meta.";
  else if (name.trim().length > 60) errors.name = "Use no máximo 60 caracteres.";

  if (target === null || target === undefined || Number.isNaN(target)) {
    errors.target = "Informe quanto quer juntar.";
  } else if (target <= 0) {
    errors.target = "O alvo precisa ser maior que zero.";
  }

  if (deadline && !/^\d{4}-\d{2}$/.test(deadline)) errors.deadline = "Prazo inválido.";

  return { valid: Object.keys(errors).length === 0, errors };
}

export function normalizeGoals(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((goal) => {
      if (!goal || typeof goal !== "object") return null;
      const target = Math.round(Number(goal.target));
      if (!Number.isFinite(target) || target <= 0) return null;

      const contributions = Array.isArray(goal.contributions)
        ? goal.contributions
            .map((c) => {
              const amount = Math.round(Number(c?.amount));
              if (!Number.isFinite(amount) || amount === 0) return null;
              if (!/^\d{4}-\d{2}-\d{2}$/.test(c?.date ?? "")) return null;
              return { id: String(c.id ?? newId()), date: c.date, amount };
            })
            .filter(Boolean)
        : [];

      return {
        id: String(goal.id ?? newId()),
        name: String(goal.name ?? "Meta").slice(0, 60),
        target,
        deadline: /^\d{4}-\d{2}$/.test(goal.deadline ?? "") ? goal.deadline : null,
        contributions,
        createdAt: goal.createdAt ?? new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

/** Quanto já foi guardado numa meta. */
export function saved(goal) {
  return goal.contributions.reduce((sum, c) => sum + c.amount, 0);
}

/**
 * Situação da meta hoje: quanto falta, quanto por mês até o prazo e se
 * está no ritmo. `today` existe para os testes congelarem a data.
 */
export function goalProgress(goal, today = currentMonth()) {
  const total = saved(goal);
  const remaining = Math.max(goal.target - total, 0);
  const ratio = goal.target ? total / goal.target : 0;
  const done = total >= goal.target;

  if (!goal.deadline) {
    return {
      saved: total,
      remaining,
      ratio,
      done,
      monthsLeft: null,
      perMonth: null,
      expected: null,
      status: done ? "done" : "no-deadline",
    };
  }

  // Meses que ainda restam, contando o mês corrente.
  const monthsLeft = monthsBetween(today, goal.deadline) + 1;
  const perMonth = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;

  // Quanto já deveria ter sido guardado, se o esforço fosse linear.
  const start = monthOf(goal.createdAt);
  const span = Math.max(monthsBetween(start, goal.deadline) + 1, 1);
  const elapsed = Math.min(Math.max(monthsBetween(start, today) + 1, 0), span);
  const expected = Math.round((goal.target * elapsed) / span);

  let status;
  if (done) status = "done";
  else if (monthsLeft <= 0) status = "late";
  else status = total >= expected ? "on-track" : "behind";

  return {
    saved: total,
    remaining,
    ratio,
    done,
    monthsLeft: Math.max(monthsLeft, 0),
    perMonth,
    expected,
    status,
  };
}

/** Quantos meses de `from` até `to` (negativo se `to` já passou). */
export function monthsBetween(from, to) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function addContribution(goal, { date, amount }) {
  return {
    ...goal,
    contributions: [
      ...goal.contributions,
      { id: newId(), date, amount },
    ].sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}

export function removeContribution(goal, contributionId) {
  return {
    ...goal,
    contributions: goal.contributions.filter((c) => c.id !== contributionId),
  };
}

/** Projeção simples: em que mês a meta fecha no ritmo dos últimos aportes. */
export function projectedMonth(goal, today = currentMonth()) {
  const progress = goalProgress(goal, today);
  if (progress.done) return today;

  const months = new Set(goal.contributions.map((c) => monthOf(c.date)));
  if (!months.size) return null;

  const average = progress.saved / months.size;
  if (average <= 0) return null;

  return addMonths(today, Math.ceil(progress.remaining / average));
}
