import { el, $, render } from "../dom.js";
import { formatMoney } from "../../domain/money.js";
import { formatDate, monthLabel, monthLabelShort } from "../../domain/dates.js";
import { goalProgress, projectedMonth } from "../../domain/goals.js";

const STATUS = {
  done: { label: "concluída", tone: "done" },
  "on-track": { label: "no ritmo", tone: "ok" },
  behind: { label: "atrasada", tone: "warning" },
  late: { label: "prazo vencido", tone: "over" },
  "no-deadline": { label: "sem prazo", tone: "" },
};

export function renderGoals(state, handlers) {
  const grid = $("#goal-grid");

  if (!state.goals.length) {
    render(grid, [
      el("div", { class: "card empty" }, [
        el("p", { class: "empty__icon", "aria-hidden": "true", text: "◆" }),
        el("p", { class: "empty__title", text: "Nenhuma meta ainda" }),
        el("p", {
          class: "empty__text",
          text: "Crie uma meta acima e registre os aportes conforme for guardando. O app calcula quanto falta por mês até o prazo.",
        }),
      ]),
    ]);
    return;
  }

  render(
    grid,
    state.goals.map((goal) => {
      const p = goalProgress(goal);
      const status = STATUS[p.status] ?? STATUS["no-deadline"];
      const percent = Math.min(Math.round(p.ratio * 100), 999);
      const projection = projectedMonth(goal);

      return el("article", { class: `card goal goal--${status.tone}` }, [
        el("header", { class: "goal__header" }, [
          el("div", {}, [
            el("h3", { class: "goal__name", text: goal.name }),
            el("p", { class: "goal__meta" }, [
              el("span", { class: `goal__status goal__status--${status.tone}`, text: status.label }),
              goal.deadline && el("span", { text: ` · até ${monthLabel(goal.deadline)}` }),
            ]),
          ]),
          el("button", {
            class: "icon-btn icon-btn--danger",
            type: "button",
            "aria-label": `Excluir a meta ${goal.name}`,
            title: "Excluir meta",
            text: "🗑",
            onClick: () => handlers.onRemove(goal),
          }),
        ]),

        el("div", {
          class: "goal__bar",
          role: "progressbar",
          "aria-valuenow": String(Math.min(percent, 100)),
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "aria-label": `${goal.name}: ${percent}% do alvo`,
        }, [
          el("span", {
            class: "goal__fill",
            style: { width: `${Math.min(percent, 100)}%` },
          }),
        ]),

        el("p", { class: "goal__numbers" }, [
          el("strong", { text: formatMoney(p.saved) }),
          el("span", { text: ` de ${formatMoney(goal.target)} · ${percent}%` }),
        ]),

        el("p", { class: "goal__hint", text: hint(p, projection) }),

        el("div", { class: "goal__actions" }, [
          el("button", {
            class: "btn btn--ghost btn--small",
            type: "button",
            text: "Registrar aporte",
            onClick: () => handlers.onContribute(goal),
          }),
          goal.contributions.length > 0 &&
            el("details", { class: "goal__history" }, [
              el("summary", {
                text: `${goal.contributions.length} aporte${
                  goal.contributions.length > 1 ? "s" : ""
                }`,
              }),
              el(
                "ul",
                { class: "goal__list" },
                [...goal.contributions]
                  .reverse()
                  .map((c) =>
                    el("li", { class: "goal__list-item" }, [
                      el("span", { text: formatDate(c.date) }),
                      el("strong", { text: formatMoney(c.amount) }),
                      el("button", {
                        class: "icon-btn icon-btn--danger",
                        type: "button",
                        "aria-label": `Remover o aporte de ${formatDate(c.date)}`,
                        title: "Remover aporte",
                        text: "×",
                        onClick: () => handlers.onRemoveContribution(goal, c),
                      }),
                    ])
                  )
              ),
            ]),
        ]),
      ]);
    })
  );
}

function hint(progress, projection) {
  if (progress.done) return "Meta alcançada. 🎉";

  if (progress.status === "late") {
    return `Faltam ${formatMoney(progress.remaining)} e o prazo já passou.`;
  }

  if (progress.perMonth !== null) {
    const base = `Faltam ${formatMoney(progress.remaining)} — ${formatMoney(
      progress.perMonth
    )} por mês em ${progress.monthsLeft} ${
      progress.monthsLeft > 1 ? "meses" : "mês"
    }.`;
    if (!projection) return base;
    return `${base} No ritmo atual, fecha em ${monthLabelShort(projection)}.`;
  }

  const base = `Faltam ${formatMoney(progress.remaining)}.`;
  return projection
    ? `${base} No ritmo atual, fecha em ${monthLabelShort(projection)}.`
    : `${base} Registre um aporte para ver a projeção.`;
}
